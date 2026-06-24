import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { getSupabaseAdmin } from '../lib/supabase';
import { executeLiveDataTool } from '../lib/tools/liveData';
import type { LiveDataArgs } from '../lib/tools/liveData';
import type { AppVariables } from '../types';
import type { SendMessageRequest } from '@tokenai/shared';
import { getModel, AI_MODELS, FREE_DAILY_MESSAGE_LIMIT } from '@tokenai/shared';

const FREE_MODEL_IDS = AI_MODELS.filter((m) => Number(m.multiplier) === 0).map((m) => m.id);

export const chatRouter = new Hono<{ Variables: AppVariables }>();

// ─── Tool definitions sent to OpenRouter on every tool-capable request ────────

const CHAT_TOOLS = [
  {
    type: 'openrouter:web_search',
    parameters: {
      engine: 'exa',
      max_results: 5,
      search_context_size: 'high',
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_live_data',
      description:
        'Get real-time structured data like live/recent sports scores, standings, or fixtures. ' +
        'Use this instead of web search for anything that changes in real time.',
      parameters: {
        type: 'object',
        properties: {
          domain: {
            type: 'string',
            enum: ['sports'],
            description: 'Which live-data source to query. Extensible later (finance, weather).',
          },
          query: {
            type: 'string',
            description: "What to fetch, e.g. 'world cup 2026 scores today'.",
          },
        },
        required: ['domain', 'query'],
      },
    },
  },
];

// ─── Internal types for non-streaming OpenRouter responses ────────────────────

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ORNonStreamResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    total_tokens?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    web_search_requests?: number;
  };
}

// ─── OpenRouter headers (shared) ─────────────────────────────────────────────

function orHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://tokenai.app',
    'X-Title': 'TokenAI',
  };
}

// ─── Route ────────────────────────────────────────────────────────────────────

chatRouter.post('/', authMiddleware, rateLimitMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json<SendMessageRequest>();
  const {
    conversationId: inputConvId, content, model, imageUrl, fileText, fileData, fileName,
    systemPrompt, contextMessages: incomingContextMessages, skipPersist,
  } = body;

  if (!content || !model) {
    return c.json({ error: 'content and model are required' }, 400);
  }

  if (imageUrl && imageUrl.length > 4_000_000) {
    return c.json({ error: 'Image too large (max 3MB)' }, 400);
  }

  if (fileData && fileData.length > 15_000_000) {
    return c.json({ error: 'PDF too large (max ~10MB)' }, 400);
  }

  const modelInfo = getModel(model);
  if (!modelInfo) {
    return c.json({ error: 'model_not_supported', model }, 400);
  }

  const multiplier = modelInfo.multiplier;
  const isFree = Number(multiplier) === 0;
  const useTools = modelInfo.supportsTools && !isFree;

  const supabase = getSupabaseAdmin();

  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (walletError || !wallet) {
    console.error('Wallet fetch error', { userId, error: walletError });
    return c.json({ error: 'Could not fetch wallet' }, 500);
  }

  const estInputTokens = Math.ceil(content.length / 4)
    + (fileText ? Math.ceil(fileText.length / 4) : 0)
    + 500;

  let maxOutputTokens = 8000;
  let reservationAmount = 0;

  if (isFree) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('model', FREE_MODEL_IDS)
      .gte('created_at', startOfDay.toISOString());

    if ((count ?? 0) >= FREE_DAILY_MESSAGE_LIMIT) {
      return c.json({ error: 'free_limit_reached', limit: FREE_DAILY_MESSAGE_LIMIT }, 429);
    }
  } else {
    const totalAffordableTokens = Math.floor(wallet.balance / Number(multiplier));
    const affordableOutputTokens = Math.max(1, totalAffordableTokens - estInputTokens);
    maxOutputTokens = Math.min(8000, affordableOutputTokens);

    // Reserve the single-request cost, capped at the wallet balance so users
    // with any positive balance are never incorrectly blocked. Any unused
    // portion is refunded after the response is produced.
    const singleRequestCost = Math.ceil((estInputTokens + maxOutputTokens) * Number(multiplier));
    reservationAmount = Math.min(singleRequestCost, wallet.balance);

    if (reservationAmount <= 0) {
      return c.json({ error: 'insufficient_tokens', balance: wallet.balance, required: singleRequestCost }, 402);
    }

    const { data: reserved } = await supabase.rpc('deduct_tokens', {
      p_user_id: userId,
      p_amount: reservationAmount,
      p_description: `Reserved for chat with ${modelInfo?.label ?? model}`,
      p_metadata: { model, type: 'reservation' },
    });

    if (!reserved) {
      return c.json({ error: 'insufficient_tokens', balance: wallet.balance, required: reservationAmount }, 402);
    }
  }

  // ── Conversation & message setup (unchanged) ──────────────────────────────

  let conversationId = inputConvId;
  if (!skipPersist) {
    if (!conversationId) {
      const title = content.slice(0, 60) || 'New conversation';
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert({ user_id: userId, title, model })
        .select('id')
        .single();

      if (convError || !conv) {
        console.error('Conversation create error', { userId, error: convError });
        return c.json({ error: 'Could not create conversation' }, 500);
      }
      conversationId = conv.id;
    }

    const storedUserContent = imageUrl
      ? `[Image attached] ${content}`
      : fileData
      ? `[PDF attached: ${fileName ?? 'document.pdf'}] ${content}`
      : fileText
      ? `[File context attached] ${content}`
      : content;

    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: storedUserContent,
    });
  }

  let historyMessages: { role: string; content: string }[] = [];
  if (!skipPersist && conversationId) {
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);
    historyMessages = (history || [])
      .reverse()
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
  }

  const contextMessages = historyMessages.map((m, i) => {
    if (i === historyMessages.length - 1 && m.role === 'user') {
      if (imageUrl) {
        return {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: imageUrl } },
            { type: 'text', text: content },
          ],
        };
      }
      if (fileData) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: content },
            { type: 'file', file: { filename: fileName ?? 'document.pdf', file_data: fileData } },
          ],
        };
      }
      if (fileText) {
        const maxChars = 30_000;
        const truncated = fileText.length > maxChars
          ? fileText.slice(0, maxChars) + '\n\n[Content truncated]'
          : fileText;
        return {
          role: 'user',
          content: `Here is the file content:\n\n${truncated}\n\n---\n\n${content}`,
        };
      }
    }
    return m;
  });

  let finalMessages: { role: string; content: unknown }[];

  if (skipPersist) {
    finalMessages = [
      ...(incomingContextMessages || []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ];
  } else {
    const systemParts: string[] = [];
    if (systemPrompt) systemParts.push(systemPrompt);
    if (incomingContextMessages && incomingContextMessages.length > 0) {
      const contextBlock = incomingContextMessages
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n\n');
      systemParts.push(`Context from a previous conversation (for reference):\n\n${contextBlock}`);
    }
    finalMessages = systemParts.length > 0
      ? [{ role: 'system', content: systemParts.join('\n\n---\n\n') }, ...contextMessages]
      : contextMessages;
  }

  const affordableOutputChars = isFree ? Infinity : maxOutputTokens * 4;

  // ── SSE stream ────────────────────────────────────────────────────────────

  return streamSSE(c, async (stream) => {
    let assistantContent = '';
    let balanceExhausted = false;

    // Shared refund helper used in both paths
    const refundReservation = async (reason: string) => {
      if (!isFree && reservationAmount > 0) {
        const { error: refundErr } = await supabase.rpc('refund_tokens', {
          p_user_id: userId,
          p_amount: reservationAmount,
          p_description: reason,
          p_metadata: { model },
        });
        if (refundErr) console.error('Refund failed', refundErr);
      }
    };

    // Shared post-send: save to DB and emit done event
    const finalize = async (actualCost: number, newBalance: number) => {
      if (!skipPersist) {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: assistantContent,
          tokens_used: actualCost,
          model,
        });
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);
      }
      await stream.writeSSE({
        data: JSON.stringify({
          done: true,
          conversationId: skipPersist ? null : conversationId,
          tokensUsed: actualCost,
          newBalance,
          balanceExhausted,
        }),
      });
    };

    try {
      if (useTools) {
        // ── AGENTIC LOOP (non-streaming, tool-capable models) ───────────────
        const maxIterations = parseInt(process.env.MAX_TOOL_ITERATIONS ?? '4');
        let loopMessages = [...finalMessages] as Record<string, unknown>[];
        let totalLlmTokens = 0;
        let totalWebSearchRequests = 0;

        for (let iter = 0; iter < maxIterations; iter++) {
          const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: orHeaders(),
            body: JSON.stringify({
              model,
              messages: loopMessages,
              tools: CHAT_TOOLS,
              stream: false,
              max_tokens: maxOutputTokens,
              ...(fileData ? { plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }] } : {}),
            }),
          });

          if (!orResp.ok) {
            const errBody = await orResp.text().catch(() => '');
            console.error('OpenRouter error (tools loop)', { userId, model, iter, status: orResp.status, body: errBody });
            await refundReservation('Refund - upstream error (tools loop)');
            let msg = 'The AI provider returned an error. Please try again.';
            try {
              const p = JSON.parse(errBody);
              const m: string = p?.error?.message ?? p?.message ?? '';
              if (orResp.status === 402 || m.toLowerCase().includes('credits')) {
                console.error('OpenRouter credits exhausted', { userId, model });
                msg = 'The AI service is temporarily unavailable. Please try again later.';
              } else if (m) msg = m.slice(0, 200);
            } catch { /* non-JSON */ }
            await stream.writeSSE({ data: JSON.stringify({ error: 'upstream_error', details: msg }) });
            return;
          }

          const data = await orResp.json() as ORNonStreamResponse;
          const usage = data.usage;
          totalLlmTokens += usage?.total_tokens
            ?? ((usage?.prompt_tokens ?? 0) + (usage?.completion_tokens ?? 0));
          totalWebSearchRequests += usage?.web_search_requests ?? 0;

          const choice = data.choices?.[0];
          if (!choice) break;

          if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
            // Append assistant message (with tool_calls) to history
            loopMessages = [...loopMessages, choice.message as unknown as Record<string, unknown>];

            // Execute only our get_live_data function — openrouter:web_search is resolved server-side
            const toolResults: Record<string, unknown>[] = [];
            for (const tc of choice.message.tool_calls) {
              if (tc.function?.name !== 'get_live_data') continue;
              let args: LiveDataArgs;
              try {
                args = JSON.parse(tc.function.arguments) as LiveDataArgs;
              } catch {
                toolResults.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify({ error: 'invalid arguments' }) });
                continue;
              }
              const result = await executeLiveDataTool(args);
              toolResults.push({ role: 'tool', tool_call_id: tc.id, content: result });
            }

            if (toolResults.length > 0) {
              loopMessages = [...loopMessages, ...toolResults];
            } else {
              // Only server-side tools were called (web search) — OpenRouter already merged
              // results; the model will produce a text response on the next iteration
            }
            continue;
          }

          // Normal text response — loop is done
          assistantContent = choice.message.content ?? '';
          break;
        }

        // If the loop cap was hit without a text response, assistantContent stays as whatever
        // partial content we may have received (or empty, which is fine).

        // Calculate combined cost: LLM tokens + web search requests
        const webSearchCostPerRequest = parseInt(process.env.WEB_SEARCH_COST_PER_REQUEST ?? '6000');
        const webSearchCost = totalWebSearchRequests * webSearchCostPerRequest;
        const llmCost = Math.ceil(totalLlmTokens * Number(multiplier));
        const actualCost = llmCost + webSearchCost;

        // Emit content to client
        if (assistantContent) {
          await stream.writeSSE({
            data: JSON.stringify({ choices: [{ delta: { content: assistantContent } }] }),
          });
        }

        // Refund unused reservation
        let newBalance = wallet.balance;
        if (!isFree && reservationAmount > 0) {
          const refundAmount = Math.max(0, reservationAmount - actualCost);
          if (refundAmount > 0) {
            await supabase.rpc('refund_tokens', {
              p_user_id: userId,
              p_amount: refundAmount,
              p_description: `Refund for chat with ${modelInfo?.label ?? model}`,
              p_metadata: { model, conversationId, aiTokens: totalLlmTokens, webSearchRequests: totalWebSearchRequests, multiplier },
            });
          }
          const { data: updatedWallet } = await supabase
            .from('wallets').select('balance').eq('user_id', userId).single();
          newBalance = updatedWallet?.balance ?? Math.max(0, wallet.balance - actualCost);
        }

        await finalize(actualCost, newBalance);

      } else {
        // ── STREAMING PATH (free models or non-tool-capable) ─────────────────
        let tokensUsed = 0;

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: orHeaders(),
          body: JSON.stringify({
            model,
            messages: finalMessages,
            stream: true,
            max_tokens: maxOutputTokens,
            ...(fileData ? { plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }] } : {}),
          }),
        });

        if (!response.ok || !response.body) {
          const errorBody = await response.text().catch(() => '');
          console.error('OpenRouter error', { userId, model, status: response.status, body: errorBody });
          await refundReservation('Refund - upstream error');
          let friendlyError = 'The AI provider returned an error. Please try again.';
          try {
            const parsed = JSON.parse(errorBody);
            const msg: string = parsed?.error?.message ?? parsed?.message ?? '';
            if (response.status === 402 || msg.toLowerCase().includes('credits')) {
              console.error('OpenRouter credits exhausted', { userId, model, status: response.status });
              friendlyError = 'The AI service is temporarily unavailable. Please try again later or switch to a different model.';
            } else if (msg) {
              friendlyError = msg.length > 200 ? msg.slice(0, 200) + '…' : msg;
            }
          } catch { /* not JSON */ }
          await stream.writeSSE({ data: JSON.stringify({ error: 'upstream_error', details: friendlyError }) });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        outer: while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (raw === '[DONE]') continue;

            try {
              const parsed = JSON.parse(raw);

              if (parsed.usage?.total_tokens) {
                tokensUsed = parsed.usage.total_tokens;
              }

              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                assistantContent += delta;
                if (!isFree && assistantContent.length >= affordableOutputChars) {
                  balanceExhausted = true;
                  await reader.cancel();
                  await stream.writeSSE({ data: JSON.stringify({ balance_exhausted: true }) });
                  break outer;
                }
              }

              await stream.writeSSE({ data: raw });
            } catch {
              // Skip malformed chunks
            }
          }
        }

        if (tokensUsed === 0) {
          tokensUsed = Math.ceil((content.length + assistantContent.length) / 4);
        }

        const actualCost = Math.ceil(tokensUsed * Number(multiplier));
        let newBalance = wallet.balance;

        if (!isFree && reservationAmount > 0) {
          const refundAmount = Math.max(0, reservationAmount - actualCost);
          if (refundAmount > 0) {
            await supabase.rpc('refund_tokens', {
              p_user_id: userId,
              p_amount: refundAmount,
              p_description: `Refund for chat with ${modelInfo?.label ?? model}`,
              p_metadata: { model, conversationId, aiTokens: tokensUsed, multiplier },
            });
          }
          const { data: updatedWallet } = await supabase
            .from('wallets').select('balance').eq('user_id', userId).single();
          newBalance = updatedWallet?.balance ?? Math.max(0, wallet.balance - actualCost);
        }

        await finalize(actualCost, newBalance);
      }
    } catch (err) {
      console.error('Chat stream error', { userId, model, err });
      await refundReservation('Refund - stream error');
      await stream.writeSSE({ data: JSON.stringify({ error: 'stream_error' }) });
    }
  });
});
