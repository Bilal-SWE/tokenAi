import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth';
import { getSupabaseAdmin } from '../lib/supabase';
import { formatTokens } from '@tokenai/shared';
import type { AppVariables } from '../types';

export const walletRouter = new Hono<{ Variables: AppVariables }>();

walletRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const supabase = getSupabaseAdmin();

  const [walletResult, txResult] = await Promise.all([
    supabase.from('wallets').select('balance').eq('user_id', userId).single(),
    supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  if (walletResult.error || !walletResult.data) {
    console.error('Wallet fetch error', { userId, error: walletResult.error });
    return c.json({ error: 'Could not fetch wallet' }, 500);
  }

  const balance = walletResult.data.balance;

  return c.json({
    balance,
    formattedBalance: formatTokens(balance),
    recentTransactions: txResult.data || [],
  });
});
