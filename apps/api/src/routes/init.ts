import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { formatTokens } from '@tokenai/shared';
import type { AppVariables } from '../types';

export const initRouter = new Hono<{ Variables: AppVariables }>();

// Single bootstrap endpoint — returns everything the app shell needs in one request:
// conversations list, wallet balance, and admin status.
// This replaces 3 separate requests (each with its own auth verification) with 1.
initRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const supabase = getSupabaseAdmin();

  const [
    { data: conversations },
    { data: wallet },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, title, model, created_at, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('wallets')
      .select('balance')
      .eq('user_id', userId)
      .single(),
    supabase
      .from('profiles')
      .select('is_admin, email')
      .eq('id', userId)
      .single(),
  ]);

  const balance = wallet?.balance ?? 0;
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
  const isAdmin = profile?.is_admin === true || adminEmails.includes((profile?.email ?? '').toLowerCase());

  return c.json({
    conversations: conversations || [],
    balance,
    formattedBalance: formatTokens(balance),
    isAdmin,
  });
});
