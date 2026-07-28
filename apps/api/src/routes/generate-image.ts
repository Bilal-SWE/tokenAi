import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import type { AppVariables } from '../types';
import { IMAGE_MODELS } from '@tokenai/shared';

export const generateImageRouter = new Hono<{ Variables: AppVariables }>();

generateImageRouter.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { prompt, model: modelId, conversationId: inputConvId } = await c.req.json<{
    prompt: string;
    model?: string;
    conversationId?: string | null;
  }>();

  if (!prompt?.trim()) {
    return c.json({ error: 'prompt is required' }, 400);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return c.json({ error: 'Image generation is not configured on this server' }, 503);
  }

  // Validate & resolve model (default to Gemini Flash Image)
  const imageModel = IMAGE_MODELS.find((m) => m.id === modelId) ?? IMAGE_MODELS[0];
  const tokenCost = imageModel.credits;

  // Map our UI model IDs to supported OpenRouter model IDs
  let openRouterModelId = imageModel.id;
  if (imageModel.id === 'openai/dall-e-2') {
    openRouterModelId = 'black-forest-labs/flux-1.1-schnell';
  } else if (imageModel.id === 'openai/dall-e-3') {
    openRouterModelId = 'black-forest-labs/flux-1.1-dev';
  } else if (imageModel.id === 'openai/dall-e-3-hd') {
    openRouterModelId = 'black-forest-labs/flux-1.1-pro';
  } else if (imageModel.id === 'google/gemini-3.1-flash-image-lite') {
    openRouterModelId = 'google/gemini-3.1-flash-image';
  }

  const supabase = getSupabaseAdmin();

  const { data: wallet } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (!wallet || wallet.balance < tokenCost) {
    return c.json({ error: 'insufficient_tokens', balance: wallet?.balance ?? 0 }, 402);
  }

  try {
    let imageUrl: string | undefined;

    const upstreamHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://tokenai.app',
      'X-Title': 'TokenAI',
    };

    /** Parse an OpenRouter error response and return a user-facing message + HTTP status. */
    async function parseUpstreamError(response: Response): Promise<{ status: 400 | 503 | 502; message: string }> {
      const body = await response.text().catch(() => '');
      console.error('Image generation upstream error', { userId, model: imageModel.id, status: response.status, body: body.slice(0, 300) });
      try {
        const parsed = JSON.parse(body);
        const msg: string = parsed?.error?.message ?? parsed?.message ?? '';
        if (response.status === 402 || msg.toLowerCase().includes('credit')) {
          return { status: 503, message: 'Image generation is temporarily unavailable. Please try again later.' };
        }
        if (response.status === 400 && (msg.includes('endpoint') || msg.includes('model'))) {
          return { status: 400, message: 'This image model is not available. Please select a different one.' };
        }
        if (msg) return { status: 502, message: msg.slice(0, 200) };
      } catch { /* not JSON */ }
      return { status: 502, message: 'Image generation failed. Please try again.' };
    }

    if (imageModel.apiType === 'chat-completion') {
      // ── Gemini-style: chat/completions with modalities ──────────────────
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify({
          model: openRouterModelId,
          messages: [{ role: 'user', content: prompt.trim() }],
          modalities: ['image', 'text'],
        }),
      });

      if (!response.ok) {
        const { status, message } = await parseUpstreamError(response);
        return c.json({ error: message }, status);
      }

      const result = await response.json() as {
        choices?: Array<{
          message?: {
            content?: string | Array<{ type: string; image_url?: { url?: string }; text?: string }>;
            images?: Array<{ image_url?: { url?: string } }>;
          };
        }>;
      };

      // Try multiple response formats that OpenRouter/Gemini may return
      const msg = result?.choices?.[0]?.message;

      // Format 1: message.images[] (old spec)
      imageUrl = msg?.images?.[0]?.image_url?.url;

      // Format 2: message.content is a base64 data URL string
      if (!imageUrl && typeof msg?.content === 'string' && msg.content.startsWith('data:image')) {
        imageUrl = msg.content;
      }

      // Format 3: message.content is an array of parts
      if (!imageUrl && Array.isArray(msg?.content)) {
        for (const part of msg.content as Array<{ type: string; image_url?: { url?: string } }>) {
          if (part.type === 'image_url' && part.image_url?.url) {
            imageUrl = part.image_url.url;
            break;
          }
        }
      }

      if (!imageUrl) {
        console.error('Gemini image: unexpected response structure', JSON.stringify(result).slice(0, 500));
      }

    } else {
      // ── FLUX style: images/generations endpoint ───────────────────────────
      const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
        method: 'POST',
        headers: upstreamHeaders,
        body: JSON.stringify({
          model: openRouterModelId,
          prompt: prompt.trim(),
          n: 1,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        const { status, message } = await parseUpstreamError(response);
        return c.json({ error: message }, status);
      }

      const result = await response.json() as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };

      // Prefer URL; fall back to base64 data URI
      const item = result?.data?.[0];
      if (item?.url) {
        imageUrl = item.url;
      } else if (item?.b64_json) {
        imageUrl = `data:image/png;base64,${item.b64_json}`;
      } else {
        console.error('Image generation: unexpected response structure', JSON.stringify(result).slice(0, 500));
      }
    }

    if (!imageUrl) {
      console.error('No image returned from provider', { userId, model: imageModel.id, openRouterModel: openRouterModelId });
      return c.json({ error: 'No image returned from the provider. Please try a different model.' }, 500);
    }

    await supabase.rpc('deduct_tokens', {
      p_user_id: userId,
      p_amount: tokenCost,
      p_description: `Image generation (${imageModel.label})`,
      p_metadata: { prompt: prompt.slice(0, 200), model: imageModel.id },
    });

    const { data: updatedWallet } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    // ── Save to conversation ────────────────────────────────────────────────
    let conversationId: string | null = inputConvId ?? null;

    if (!conversationId) {
      // Create a new conversation for this image generation session
      const title = prompt.slice(0, 60) || 'Image generation';
      const { data: conv } = await supabase
        .from('conversations')
        .insert({ user_id: userId, title, model: imageModel.id })
        .select('id')
        .single();
      if (conv) conversationId = conv.id;
    }

    if (conversationId) {
      // Save user prompt message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'user',
        content: prompt.trim(),
      });
      // Save assistant image message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        user_id: userId,
        role: 'assistant',
        content: imageUrl,
        model: imageModel.id,
        tokens_used: tokenCost,
      });
    }

    return c.json({
      url: imageUrl,
      tokensUsed: tokenCost,
      newBalance: updatedWallet?.balance ?? wallet.balance - tokenCost,
      conversationId,
    });
  } catch (err) {
    console.error('Image generation error', err);
    return c.json({ error: 'Image generation failed' }, 500);
  }
});
