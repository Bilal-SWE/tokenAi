import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { authMiddleware } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';
import { getSupabaseAdmin } from '../lib/supabase';
import type { AppVariables } from '../types';
import type { SendMessageRequest } from '@tokenai/shared';
import { getModel, AI_MODELS, FREE_DAILY_MESSAGE_LIMIT } from '@tokenai/shared';

const FREE_MODEL_IDS = AI_MODELS.filter((m) => Number(m.multiplier) === 0).map((m) => m.id);

export const chatRouter = new Hono<{ Variables: AppVariables }>();

chatRouter.post('/', authMiddleware, rateLimitMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json<SendMessageRequest>();
  const { conversationId: inputConvId, content, model, imageUrl, fileText, fileData, fileName,
          systemPrompt, contextMessages: incomingContextMessages, skipPersist } = body;

  if (!content || !model) {
    return c.json({ error: 'content and model are required' }, 400);
  }

  // Validate base64 image size (max ~4MB base64 ≈ 3MB raw)
  if (imageUrl && imageUrl.length > 4_000_000) {
    return c.json({ error: 'Image too large (max 3MB)' }, 400);
  }

  // Validate base64 PDF size (max ~15M base64 chars ≈ 11MB raw)
  if (fileData && fileData.length > 15_000_000) {
    return c.json({ error: 'PDF too large (max ~10MB)' }, 400);
  }

  const modelInfo = getModel(model);

  // Reject unknown / removed model IDs outright — a missing modelInfo would cause
  // the multiplier to fall back to 1, which could let users run expensive models
  // for almost free and would give wrong max_tokens budgets.
  if (!modelInfo) {
    return c.json({ error: 'model_not_supported', model }, 400);
  }

  const multiplier = modelInfo.multiplier;
  const isFree = Number(multiplier) === 0;

  const supabase = getSupabaseAdmin();

  // Check wallet balance
  const { data: wallet, error: walletError } = await supabase
    .from('wallets')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (walletError || !wallet) {
    console.error('Wallet fetch error', { userId, error: walletError });
    return c.json({ error: 'Could not fetch wallet' }, 500);
  }

  // Estimated input tokens (chars/4 + buffer for history & system prompt)
  // Buffer of 500 covers typical conversation history without over-reducing output budget.
  const estInputTokens = Math.ceil(content.length / 4)
    + (fileText ? Math.ceil(fileText.length / 4) : 0)
    + 500;

  // How many output tokens the user can actually afford.
  // For free models this is 8000 (the platform cap). For paid models we derive
  // it from the wallet balance so the model literally cannot generate more than
  // the user can pay for.
  let maxOutputTokens = 8000; // safe default (overridden below for paid models)

  // Amount reserved upfront from wallet before streaming (0 for free models).
  // After streaming, unused portion is refunded via refund_tokens().
  let reservationAmount = 0;

  if (isFree) {
    // Free models: no balance needed, but enforce a daily message limit
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
    // How many total AI tokens the user can afford
    const totalAffordableTokens = Math.floor(wallet.balance / Number(multiplier));
    // Subtract estimated input to get the output budget
    const affordableOutputTokens = Math.max(1, totalAffordableTokens - estInputTokens);
    // Never exceed 8000 (model/platform hard cap)
    maxOutputTokens = Math.min(8000, affordableOutputTokens);

    // Pre-reserve the maximum possible cost before streaming.
    // This atomically locks the tokens so concurrent requests cannot overdraw
    // the wallet. The unused portion is refunded after the stream ends.
    reservationAmount = Math.ceil((estInputTokens + maxOutputTokens) * Number(multiplier));
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

  // Create or retrieve conversation (skipped in compare-mode secondary stream)
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

    // Build stored content (always text for DB)
    const storedUserContent = imageUrl
      ? `[Image attached] ${content}`
      : fileData
      ? `[PDF attached: ${fileName ?? 'document.pdf'}] ${content}`
      : fileText
      ? `[File context attached] ${content}`
      : content;

    // Save user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      user_id: userId,
      role: 'user',
      content: storedUserContent,
    });
  }

  // Fetch last 20 messages for context (~10 exchanges of memory)
  // When skipPersist, rely solely on incomingContextMessages (passed by frontend)
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

  // Replace the last user message with the multimodal version if needed
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

  // Build the final messages array
  let finalMessages: { role: string; content: unknown }[];

  if (skipPersist) {
    // Compare mode (stream B): use incomingContextMessages as real chat history
    // then append the current user message — nothing is stored in DB
    finalMessages = [
      ...(incomingContextMessages || []).map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content },
    ];
  } else {
    // Normal mode: optionally prepend a system prompt and/or linked-conversation context
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

  // Safety-net: mid-stream char limit derived from the same maxOutputTokens
  // (chars ≈ tokens × 4). For free models this is effectively unlimited.
  const affordableOutputChars = isFree ? Infinity : maxOutputTokens * 4;

  return streamSSE(c, async (stream) => {
    let assistantContent = '';
    let tokensUsed = 0;
    let balanceExhausted = false;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://tokenai.app',
          'X-Title': 'TokenAI',
        },
        body: JSON.stringify({
          model,
          messages: finalMessages,
          stream: true,
          // *** THIS IS THE KEY FIX ***
          // Tell the model exactly how many tokens it is allowed to generate.
          // For paid models this is derived from the user's actual wallet balance,
          // so the model CANNOT generate more tokens than the user can pay for.
          max_tokens: maxOutputTokens,
          // Native PDF processing
          ...(fileData
            ? { plugins: [{ id: 'file-parser', pdf: { engine: 'native' } }] }
            : {}),
        }),
      });

      if (!response.ok || !response.body) {
        const errorBody = await response.text().catch(() => '');
        console.error('OpenRouter error', { userId, model, status: response.status, body: errorBody });
        // Refund the full reservation — user got no response
        if (!isFree && reservationAmount > 0) {
          const { error: refundErr } = await supabase.rpc('refund_tokens', {
            p_user_id: userId,
            p_amount: reservationAmount,
            p_description: 'Refund - upstream error',
            p_metadata: { model },
          });
          if (refundErr) console.error('Refund on upstream error failed', refundErr);
        }
        await stream.writeSSE({ data: JSON.stringify({ error: 'upstream_error', details: errorBody }) });
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

              // Stop mid-stream if output chars exceed what balance can cover
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

      // If usage wasn't in the stream, estimate from content length
      if (tokensUsed === 0) {
        tokensUsed = Math.ceil((content.length + assistantContent.length) / 4);
      }

      const actualCost = Math.ceil(tokensUsed * Number(multiplier));
      let newBalance = wallet.balance;

      if (!isFree && reservationAmount > 0) {
        // Refund the unused portion of the pre-reservation back to the user.
        // If actual cost somehow exceeds the reservation (rare, due to input estimation),
        // refundAmount is 0 and no refund is issued — user is charged reservationAmount.
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
          .from('wallets')
          .select('balance')
          .eq('user_id', userId)
          .single();

        newBalance = updatedWallet?.balance ?? Math.max(0, wallet.balance - actualCost);
      }

      if (!skipPersist) {
        // Save assistant message
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: assistantContent,
          tokens_used: actualCost,
          model,
        });

        // Update conversation timestamp
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
          aiTokens: tokensUsed,
          newBalance,
        }),
      });
    } catch (err) {
      console.error('Chat stream error', { userId, model, err });
      // Refund the full reservation so the user isn't charged for a failed request
      if (!isFree && reservationAmount > 0) {
        const { error: refundErr } = await supabase.rpc('refund_tokens', {
          p_user_id: userId,
          p_amount: reservationAmount,
          p_description: 'Refund - stream error',
          p_metadata: { model },
        });
        if (refundErr) console.error('Refund on stream error failed', refundErr);
      }
      await stream.writeSSE({ data: JSON.stringify({ error: 'stream_error' }) });
    }
  });
});
