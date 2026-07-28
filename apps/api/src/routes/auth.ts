import { Hono } from 'hono';
import { getSupabaseAdmin } from '../lib/supabase';
import type { AppVariables } from '../types';

export const authRouter = new Hono<{ Variables: AppVariables }>();

authRouter.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: 'Email and password are required' }, 400);
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return c.json({ error: error?.message || 'Authentication failed' }, 401);
    }

    return c.json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (err: any) {
    console.error('CLI Login route error', err);
    return c.json({ error: err.message || 'Server error' }, 500);
  }
});
