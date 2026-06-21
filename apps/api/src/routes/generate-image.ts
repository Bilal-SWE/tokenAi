import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import type { AppVariables } from '../types';
import { IMAGE_MODELS } from '@tokenai/shared';

export const generateImageRouter = new Hono<{ Variables: AppVariables }>();

generateImageRouter.post('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { prompt, model: modelId } = await c.req.json<{ prompt: string; model?: string }>();

  if (!prompt?.trim()) {
    return c.json({ error: 'prompt is required' }, 400);
  }

  if (!process.env.OPENROUTER_API_KEY) {
    return c.json({ error: 'Image generation is not configured on this server' }, 503);
  }

  // Validate & resolve model (default to Gemini Flash Image)
  const imageModel = IMAGE_MODELS.find((m) => m.id === modelId) ?? IMAGE_MODELS[0];
  const tokenCost = imageModel.nanodollarsPerImage;

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

    if (imageModel.apiType === 'chat-completion') {
      // ── Gemini-style: chat/completions with modalities ──────────────────
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://tokenai.app',
          'X-Title': 'TokenAI',
        },
        body: JSON.stringify({
          model: imageModel.id,
          messages: [{ role: 'user', content: prompt.trim() }],
          modalities: ['image', 'text'],
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error('Image generation upstream error', { userId, model: imageModel.id, status: response.status, detail: detail.slice(0, 200) });
        return c.json({ error: 'Image generation failed' }, 502);
      }

      const result = await response.json() as {
        choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } }> } }>;
      };
      imageUrl = result?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

    } else {
      // ── DALL-E / FLUX style: images/generations endpoint ─────────────────
      const response = await fetch('https://openrouter.ai/api/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'HTTP-Referer': 'https://tokenai.app',
          'X-Title': 'TokenAI',
        },
        body: JSON.stringify({
          model: imageModel.id,
          prompt: prompt.trim(),
          n: 1,
          size: '1024x1024',
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        console.error('Image generation upstream error', { userId, model: imageModel.id, status: response.status, detail: detail.slice(0, 200) });
        return c.json({ error: 'Image generation failed' }, 502);
      }

      const result = await response.json() as {
        data?: Array<{ url?: string; b64_json?: string }>;
      };
      imageUrl = result?.data?.[0]?.url;
    }

    if (!imageUrl) {
      console.error('No image returned from provider', { userId, model: imageModel.id });
      return c.json({ error: 'No image returned from provider' }, 500);
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

    return c.json({
      url: imageUrl,
      tokensUsed: tokenCost,
      newBalance: updatedWallet?.balance ?? wallet.balance - tokenCost,
    });
  } catch (err) {
    console.error('Image generation error', err);
    return c.json({ error: 'Image generation failed' }, 500);
  }
});
