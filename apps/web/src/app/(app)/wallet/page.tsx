'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useWallet } from '@/context/WalletContext';
import { formatBalance } from '@tokenai/shared';
import { Loader2, Plus } from 'lucide-react';
import clsx from 'clsx';

interface Transaction {
  id: string;
  type: 'purchase' | 'deduction' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export default function WalletPage() {
  const { balance, formattedBalance } = useWallet();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<{ balance: number; recentTransactions: Transaction[] }>('/api/wallet');
        setTransactions(data.recentTransactions);
      } catch {
        // Non-fatal
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Balance card */}
      <div className="bg-blue-600 rounded-2xl p-6 text-white mb-6">
        <div className="text-sm text-blue-200 mb-1">Current balance</div>
        <div className="text-4xl font-bold">{formattedBalance}</div>
        <div className="text-blue-200 text-sm mt-1">Available balance</div>
        <Link
          href="/topup"
          className="mt-4 inline-flex items-center gap-1.5 bg-white text-blue-600 font-medium rounded-lg px-4 py-2 text-sm hover:bg-blue-50 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add funds
        </Link>
      </div>

      {/* Transaction history */}
      <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Recent transactions</h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">No transactions yet</p>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
          {transactions.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{tx.description}</div>
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {new Date(tx.created_at).toLocaleDateString()} · Balance after: {formatBalance(tx.balance_after)}
                </div>
              </div>
              <div className={clsx(
                'text-sm font-semibold',
                tx.amount > 0 ? 'text-green-600' : 'text-red-500'
              )}>
                {tx.amount > 0 ? '+' : ''}{formatBalance(Math.abs(tx.amount))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
