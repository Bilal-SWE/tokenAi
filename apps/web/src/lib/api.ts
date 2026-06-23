import { supabase } from './supabase';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new ApiError(401, 'Not authenticated');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...headers, ...(options?.headers as Record<string, string> || {}) },
  });

  if (res.status === 402) {
    const data = await res.json();
    window.dispatchEvent(new CustomEvent('tokenai:insufficient-tokens', { detail: data }));
    throw new ApiError(402, 'Insufficient tokens', data);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, (data as { error?: string }).error || 'Request failed', data);
  }

  return res.json() as Promise<T>;
}

export async function apiStream(
  path: string,
  body: unknown,
  onChunk: (data: unknown) => void,
  onDone: (data: { tokensUsed: number; newBalance: number; conversationId: string; balanceExhausted?: boolean }) => void
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    if (res.status === 402) {
      const data = await res.json();
      window.dispatchEvent(new CustomEvent('tokenai:insufficient-tokens', { detail: data }));
      throw new ApiError(402, 'Insufficient tokens', data);
    }
    throw new ApiError(res.status, 'Stream request failed');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let balanceExhausted = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      let data: { done?: boolean; error?: string; details?: string; balance_exhausted?: boolean } | undefined;
      try {
        data = JSON.parse(raw);
      } catch {
        continue; // Skip malformed chunks
      }
      if (data?.error) {
        // Include OpenRouter's raw error details in the message for debugging
        const msg = data.details ? `${data.error}: ${data.details}` : data.error;
        throw new ApiError(502, msg, data);
      }
      if (data?.balance_exhausted) {
        balanceExhausted = true;
        continue;
      }
      if (data?.done) {
        onDone({ ...(data as { tokensUsed: number; newBalance: number; conversationId: string }), balanceExhausted });
      } else {
        onChunk(data);
      }
    }
  }
}

export async function apiStreamPresentation(
  topic: string,
  onCode: (code: string, tokensUsed: number, newBalance: number) => void
): Promise<void> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/api/generate-presentation`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ topic }),
  });

  if (!res.ok) {
    if (res.status === 402) {
      const data = await res.json();
      window.dispatchEvent(new CustomEvent('tokenai:insufficient-tokens', { detail: data }));
      throw new ApiError(402, 'Insufficient tokens', data);
    }
    throw new ApiError(res.status, 'Presentation generation failed');
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const lines = decoder.decode(value).split('\n');
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      let data: Record<string, unknown>;
      try { data = JSON.parse(raw); } catch { continue; }

      if (data.error) {
        const msg = String(data.error);
        if (msg === 'insufficient_tokens') {
          window.dispatchEvent(new CustomEvent('tokenai:insufficient-tokens', { detail: data }));
          throw new ApiError(402, 'Insufficient tokens', data);
        }
        throw new ApiError(502, msg, data);
      }
      if (data.done && data.code) {
        onCode(String(data.code), Number(data.tokensUsed), Number(data.newBalance));
      }
    }
  }
}

export { API_URL };
