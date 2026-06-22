import { Context, Next } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';
import type { AppVariables } from '../types';

export async function authMiddleware(c: Context<{ Variables: AppVariables }>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401);
  }

  const token = authHeader.slice(7);
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  c.set('userId', user.id);
  c.set('userToken', token);
  c.set('userEmail', user.email ?? '');
  await next();
}
