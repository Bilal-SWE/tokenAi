import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import type { AppVariables } from '../types';

export const conversationsRouter = new Hono<{ Variables: AppVariables }>();

conversationsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('conversations')
    .select('id, title, model, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Conversations fetch error', { userId, error });
    return c.json({ error: 'Could not fetch conversations' }, 500);
  }

  return c.json(data || []);
});

conversationsRouter.get('/:id/messages', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const conversationId = c.req.param('id');
  const supabase = getSupabaseAdmin();

  // Verify ownership
  const { data: conv } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', conversationId)
    .eq('user_id', userId)
    .single();

  if (!conv) {
    return c.json({ error: 'Conversation not found' }, 404);
  }

  const { data, error } = await supabase
    .from('messages')
    .select('id, role, content, tokens_used, model, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Messages fetch error', { userId, conversationId, error });
    return c.json({ error: 'Could not fetch messages' }, 500);
  }

  return c.json(data || []);
});

conversationsRouter.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const conversationId = c.req.param('id');
  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('conversations')
    .delete()
    .eq('id', conversationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Conversation delete error', { userId, conversationId, error });
    return c.json({ error: 'Could not delete conversation' }, 500);
  }

  return c.json({ success: true });
});
