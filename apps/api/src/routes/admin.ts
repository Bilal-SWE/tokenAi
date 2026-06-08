import { Hono, type Context } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { formatTokens } from '@tokenai/shared';
import type { AppVariables } from '../types';

type AdminEnv = { Variables: AppVariables };
export const adminRouter = new Hono<AdminEnv>();

function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());
  return adminEmails.includes(email.toLowerCase());
}

async function adminGuard(c: Context<AdminEnv>, next: () => Promise<void>) {
  const userId = c.get('userId');
  const supabase = getSupabaseAdmin();
  const { data: profile } = await supabase.from('profiles').select('email').eq('id', userId).single();
  if (!profile || !isAdminEmail(profile.email)) return c.json({ error: 'Forbidden' }, 403);
  await next();
}

// GET /api/admin/check — quick admin status check (200 ok | 403 forbidden)
adminRouter.get('/check', authMiddleware, adminGuard, async (c) => {
  return c.json({ isAdmin: true });
});

// GET /api/admin/users
adminRouter.get('/users', authMiddleware, adminGuard, async (c) => {
  const supabase = getSupabaseAdmin();

  // 1. Fetch profiles + wallets (no `banned` here — column may not exist yet)
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, wallets(balance)')
    .order('created_at', { ascending: false });

  if (error) return c.json({ error: 'Failed to fetch users', detail: error.message }, 500);

  // 2. Try to get banned status separately — safe fallback if column doesn't exist yet
  //    Run: ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned boolean NOT NULL DEFAULT false;
  let bannedMap: Record<string, boolean> = {};
  try {
    const { data: bannedRows } = await supabase
      .from('profiles')
      .select('id, banned');
    (bannedRows || []).forEach((p: { id: string; banned?: boolean | null }) => {
      bannedMap[p.id] = p.banned ?? false;
    });
  } catch {
    // Column doesn't exist yet — treat everyone as not banned
  }

  // 3. Efficient per-user message count using a Postgres aggregate via rpc
  //    Falls back to 0 if the function doesn't exist
  let countMap: Record<string, number> = {};
  try {
    const { data: counts } = await supabase.rpc('get_user_message_counts');
    (counts || []).forEach((row: { user_id: string; count: number }) => {
      countMap[row.user_id] = row.count;
    });
  } catch {
    // RPC not available — message count will show 0 (non-critical)
  }

  const result = (users || []).map((u: {
    id: string; email: string; full_name: string | null;
    created_at: string; wallets: Array<{ balance: number }> | null;
  }) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    created_at: u.created_at,
    banned: bannedMap[u.id] ?? false,
    balance: u.wallets?.[0]?.balance ?? 0,
    formattedBalance: formatTokens(u.wallets?.[0]?.balance ?? 0),
    messageCount: countMap[u.id] ?? 0,
  }));

  return c.json(result);
});

// GET /api/admin/users/:id — detailed user info with activity
adminRouter.get('/users/:id', authMiddleware, adminGuard, async (c) => {
  const userId = c.req.param('id');
  const supabase = getSupabaseAdmin();

  const [
    { data: profile },
    { data: wallet },
    { data: recentConvs },
    { data: recentTxns },
    { data: msgStats },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('wallets').select('balance').eq('user_id', userId).single(),
    supabase.from('conversations')
      .select('id, title, model, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('transactions')
      .select('id, type, amount, description, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase.from('messages')
      .select('tokens_used, model')
      .eq('user_id', userId)
      .eq('role', 'assistant'),
  ]);

  if (!profile) return c.json({ error: 'User not found' }, 404);

  const totalMessages = msgStats?.length ?? 0;
  const totalTokensUsed = (msgStats || []).reduce((s: number, m: { tokens_used: number | null }) => s + (m.tokens_used ?? 0), 0);

  // Per-model usage for this user
  const modelMap: Record<string, { count: number; tokens: number }> = {};
  (msgStats || []).forEach((m: { model: string | null; tokens_used: number | null }) => {
    if (!m.model) return;
    if (!modelMap[m.model]) modelMap[m.model] = { count: 0, tokens: 0 };
    modelMap[m.model].count++;
    modelMap[m.model].tokens += m.tokens_used ?? 0;
  });
  const modelUsage = Object.entries(modelMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([model, stats]) => ({ model, ...stats }));

  return c.json({
    id: profile.id,
    email: profile.email,
    full_name: profile.full_name,
    created_at: profile.created_at,
    banned: profile.banned ?? false,
    balance: wallet?.balance ?? 0,
    formattedBalance: formatTokens(wallet?.balance ?? 0),
    totalMessages,
    totalTokensUsed,
    modelUsage,
    recentConversations: recentConvs || [],
    recentTransactions: recentTxns || [],
  });
});

// POST /api/admin/add-tokens
adminRouter.post('/add-tokens', authMiddleware, adminGuard, async (c) => {
  const { userId: targetUserId, amount, description } = await c.req.json<{ userId: string; amount: number; description?: string }>();
  if (!targetUserId || !amount || amount <= 0) return c.json({ error: 'userId and positive amount are required' }, 400);

  const supabase = getSupabaseAdmin();
  const { data: wallet } = await supabase.from('wallets').select('id').eq('user_id', targetUserId).single();
  if (!wallet) await supabase.from('wallets').insert({ user_id: targetUserId, balance: 0 });

  const { data: newBalance, error } = await supabase.rpc('add_tokens', {
    p_user_id: targetUserId, p_amount: amount,
    p_description: description || 'Admin token grant', p_metadata: { source: 'admin' },
  });
  if (error) return c.json({ error: 'Failed to add tokens' }, 500);
  return c.json({ success: true, newBalance, formattedBalance: formatTokens(newBalance) });
});

// POST /api/admin/set-balance
adminRouter.post('/set-balance', authMiddleware, adminGuard, async (c) => {
  const { userId: targetUserId, balance } = await c.req.json<{ userId: string; balance: number }>();
  if (!targetUserId || balance === undefined || balance < 0) return c.json({ error: 'Invalid params' }, 400);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('wallets').upsert({ user_id: targetUserId, balance }, { onConflict: 'user_id' });
  if (error) return c.json({ error: 'Failed to set balance' }, 500);
  return c.json({ success: true, balance, formattedBalance: formatTokens(balance) });
});

// POST /api/admin/users/:id/ban
adminRouter.post('/users/:id/ban', authMiddleware, adminGuard, async (c) => {
  const userId = c.req.param('id') as string;
  const supabase = getSupabaseAdmin();

  // Ban in Supabase auth (effectively locks the account)
  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: '876000h', // ~100 years
  });
  if (authError) return c.json({ error: 'Failed to ban user in auth' }, 500);

  // Mark in profiles table
  const { error: dbError } = await supabase
    .from('profiles')
    .update({ banned: true })
    .eq('id', userId);

  if (dbError) console.error('profiles ban update failed', dbError);

  return c.json({ success: true });
});

// POST /api/admin/users/:id/unban
adminRouter.post('/users/:id/unban', authMiddleware, adminGuard, async (c) => {
  const userId = c.req.param('id') as string;
  const supabase = getSupabaseAdmin();

  const { error: authError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: 'none',
  });
  if (authError) return c.json({ error: 'Failed to unban user' }, 500);

  const { error: dbError } = await supabase
    .from('profiles')
    .update({ banned: false })
    .eq('id', userId);

  if (dbError) console.error('profiles unban update failed', dbError);

  return c.json({ success: true });
});

// GET /api/admin/stats — comprehensive platform stats
adminRouter.get('/stats', authMiddleware, adminGuard, async (c) => {
  const supabase = getSupabaseAdmin();

  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - 6); weekStart.setHours(0, 0, 0, 0);
  const monthStart = new Date(now); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(now.getDate() - 13); fourteenDaysAgo.setHours(0, 0, 0, 0);

  const [
    { count: totalUsers },
    { count: newUsersToday },
    { count: newUsersThisWeek },
    { count: newUsersThisMonth },
    { count: totalMessages },
    { count: messagesToday },
    { count: messagesThisWeek },
    { data: deductions },
    { data: revenue },
    // model + token stats (max 2000 rows — enough for grouping without full scan)
    { data: modelStats },
    // daily chart: only created_at needed, limited to 14-day window (small set)
    { data: recentMsgDates },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', todayStart.toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', weekStart.toISOString()),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString()),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('role', 'assistant'),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('role', 'assistant').gte('created_at', todayStart.toISOString()),
    supabase.from('messages').select('*', { count: 'exact', head: true }).eq('role', 'assistant').gte('created_at', weekStart.toISOString()),
    supabase.from('transactions').select('amount').eq('type', 'deduction'),
    supabase.from('orders').select('amount_usd_cents').eq('status', 'completed'),
    supabase.from('messages').select('model, tokens_used').eq('role', 'assistant').not('model', 'is', null).limit(5000),
    supabase.from('messages').select('created_at').eq('role', 'assistant').gte('created_at', fourteenDaysAgo.toISOString()),
  ]);

  const totalTokensUsed = (deductions || []).reduce((sum: number, t: { amount: number }) => sum + Math.abs(t.amount), 0);
  const totalRevenue = (revenue || []).reduce((sum: number, o: { amount_usd_cents: number }) => sum + o.amount_usd_cents, 0);

  // Model usage: count + tokens per model
  const modelMap: Record<string, { count: number; tokens: number }> = {};
  (modelStats || []).forEach((m: { model: string; tokens_used: number | null }) => {
    if (!modelMap[m.model]) modelMap[m.model] = { count: 0, tokens: 0 };
    modelMap[m.model].count++;
    modelMap[m.model].tokens += m.tokens_used ?? 0;
  });
  const allModels = Object.entries(modelMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([model, stats]) => ({ model, count: stats.count, tokensUsed: stats.tokens }));

  // Daily usage for last 14 days
  const dailyMap: Record<string, number> = {};
  (recentMsgDates || []).forEach((m: { created_at: string }) => {
    const day = m.created_at.split('T')[0];
    dailyMap[day] = (dailyMap[day] || 0) + 1;
  });
  const daily14Days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - (13 - i));
    const key = d.toISOString().split('T')[0];
    return { date: key, label: d.toLocaleDateString('en', { month: 'short', day: 'numeric' }), count: dailyMap[key] || 0 };
  });

  // Top users via RPC (efficient) or fallback to empty list
  let topUsers: { id: string; email: string; full_name: string | null; messageCount: number; balance: number }[] = [];
  try {
    const { data: topRaw } = await supabase.rpc('get_user_message_counts');
    const topSorted = (topRaw || [])
      .sort((a: { count: number }, b: { count: number }) => b.count - a.count)
      .slice(0, 8);

    if (topSorted.length > 0) {
      const topIds = topSorted.map((r: { user_id: string }) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, wallets(balance)')
        .in('id', topIds);

      const profileMap: Record<string, { email: string; full_name: string | null; balance: number }> = {};
      (profiles || []).forEach((p: { id: string; email: string; full_name: string | null; wallets: { balance: number }[] | null }) => {
        profileMap[p.id] = { email: p.email, full_name: p.full_name, balance: p.wallets?.[0]?.balance ?? 0 };
      });

      topUsers = topSorted.map((r: { user_id: string; count: number }) => ({
        id: r.user_id,
        email: profileMap[r.user_id]?.email ?? r.user_id,
        full_name: profileMap[r.user_id]?.full_name ?? null,
        messageCount: r.count,
        balance: profileMap[r.user_id]?.balance ?? 0,
      }));
    }
  } catch {
    // RPC not available — top users will be empty (non-critical)
  }

  return c.json({
    totalUsers: totalUsers ?? 0,
    newUsersToday: newUsersToday ?? 0,
    newUsersThisWeek: newUsersThisWeek ?? 0,
    newUsersThisMonth: newUsersThisMonth ?? 0,
    totalMessages: totalMessages ?? 0,
    messagesToday: messagesToday ?? 0,
    messagesThisWeek: messagesThisWeek ?? 0,
    totalTokensUsed,
    totalRevenueCents: totalRevenue,
    allModels,
    topModels: allModels.slice(0, 3),
    daily14Days,
    topUsers,
  });
});

// GET /api/admin/transactions
adminRouter.get('/transactions', authMiddleware, adminGuard, async (c) => {
  const supabase = getSupabaseAdmin();
  const page = parseInt(c.req.query('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from('transactions')
    .select('*, profiles(email, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return c.json({ error: 'Failed to fetch transactions' }, 500);
  return c.json({ data: data || [], total: count ?? 0, page, limit });
});
