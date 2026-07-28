import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { AI_MODELS, getModel } from '@tokenai/shared';
import type { AppVariables } from '../types';

export const coderRouter = new Hono<{ Variables: AppVariables }>();

coderRouter.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const supabase = getSupabaseAdmin();

  try {
    const { prompt, files, filePaths, model: inputModel } = await c.req.json<{
      prompt: string;
      files: { path: string; content: string }[];
      filePaths?: string[];
      model?: string;
    }>();

    if (!prompt) {
      return c.json({ error: 'Prompt is required' }, 400);
    }

    const model = inputModel || 'google/gemini-2.5-pro';
    const modelInfo = getModel(model);
    if (!modelInfo) {
      return c.json({ error: 'model_not_supported', model }, 400);
    }

    const multiplier = modelInfo.multiplier;
    const isFree = Number(multiplier) === 0;

    // 1. Fetch wallet balance
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      console.error('Wallet fetch error', { userId, error: walletError });
      return c.json({ error: 'Could not fetch wallet' }, 500);
    }

    // 2. Estimate token count
    let filesBlock = '';
    if (files && files.length > 0) {
      filesBlock = files.map(f => `--- FILE: ${f.path} ---\n${f.content}`).join('\n\n');
    }

    let structureBlock = '';
    if (filePaths && filePaths.length > 0) {
      structureBlock = `Workspace Directory Structure:\n${filePaths.map(p => `- ${p}`).join('\n')}\n\n`;
    }

    const estimatedTokens = Math.ceil((prompt.length + filesBlock.length + structureBlock.length) / 4) + 1500;
    const maxOutputTokens = 8000;
    let reservationAmount = 0;

    if (!isFree) {
      const singleRequestCost = Math.ceil((estimatedTokens + maxOutputTokens) * Number(multiplier));
      reservationAmount = Math.min(singleRequestCost, wallet.balance);

      if (reservationAmount <= 0) {
        return c.json({ error: 'insufficient_tokens', balance: wallet.balance, required: singleRequestCost }, 402);
      }

      // Reserve tokens
      const { data: reserved } = await supabase.rpc('deduct_tokens', {
        p_user_id: userId,
        p_amount: reservationAmount,
        p_description: `Reserved for CLI coder with ${modelInfo.label}`,
        p_metadata: { model, type: 'coder_reservation' },
      });

      if (!reserved) {
        return c.json({ error: 'insufficient_tokens', balance: wallet.balance, required: reservationAmount }, 402);
      }
    }

    // Helper for complete refund on error
    const refundAll = async (reason: string) => {
      if (!isFree && reservationAmount > 0) {
        await supabase.rpc('refund_tokens', {
          p_user_id: userId,
          p_amount: reservationAmount,
          p_description: reason,
          p_metadata: { model },
        });
      }
    };

    // 3. Build system instructions and payload for OpenRouter
    const systemPrompt = `You are an AI coding assistant.
The user wants you to edit their codebase files based on their prompt.
Below is the workspace directory structure and the contents of relevant files:

${structureBlock}
Relevant Files Content:
${filesBlock}

Review the user prompt and the files.
Provide the code changes in the following format:
For every file you modify or create, wrap its COMPLETE NEW CONTENTS in:
<file path="relative/path/to/file.ext">
[complete file content here]
</file>

Strict rules:
1. Do not use diffs or placeholders. You MUST return the complete file content.
2. Only output files within the XML-like <file path="...">...</file> tags.
3. If no changes are needed for a file, do not output that file block.
4. You can create new files by using a new path.
5. Provide explanations and comments inside the tags or in standard markdown outside, but all code changes must be inside those tags.`;

    const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://tokenai.app',
        'X-Title': 'TokenAI CLI',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        stream: false,
        max_tokens: maxOutputTokens,
      }),
    });

    if (!orResp.ok) {
      const errBody = await orResp.text();
      console.error('OpenRouter CLI error', { userId, status: orResp.status, body: errBody });
      await refundAll('Refund - upstream error in CLI coder');
      return c.json({ error: 'upstream_error', details: errBody }, 502);
    }

    const data = await orResp.json() as any;
    const assistantContent = data.choices?.[0]?.message?.content || '';
    const tokensUsed = data.usage?.total_tokens || Math.ceil((prompt.length + assistantContent.length) / 4);

    const actualCost = Math.ceil(tokensUsed * Number(multiplier));
    let newBalance = wallet.balance;

    if (!isFree && reservationAmount > 0) {
      const refundAmount = Math.max(0, reservationAmount - actualCost);
      if (refundAmount > 0) {
        await supabase.rpc('refund_tokens', {
          p_user_id: userId,
          p_amount: refundAmount,
          p_description: `Refund for CLI coder with ${modelInfo.label}`,
          p_metadata: { model, aiTokens: tokensUsed, multiplier },
        });
      }
      const { data: updatedWallet } = await supabase
        .from('wallets').select('balance').eq('user_id', userId).single();
      newBalance = updatedWallet?.balance ?? Math.max(0, wallet.balance - reservationAmount);
    }

    return c.json({
      response: assistantContent,
      tokensUsed,
      cost: actualCost,
      newBalance,
    });

  } catch (err: any) {
    console.error('CLI Coder route error', err);
    return c.json({ error: err.message || 'Server error' }, 500);
  }
});
