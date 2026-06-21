'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatBalance } from '@tokenai/shared';
import { Loader2, RefreshCw, ArrowUpCircle, ArrowDownCircle, Receipt } from 'lucide-react';
import clsx from 'clsx';

interface Transaction {
  id: string;
  user_id: string;
  type: 'purchase' | 'deduction' | 'refund' | 'bonus';
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
  profiles: { email: string; full_name: string | null } | null;
}

interface Response {
  data: Transaction[];
  total: number;
  page: number;
}

const TYPE_STYLES: Record<string, string> = {
  purchase: 'bg-green-100 text-green-700',
  bonus: 'bg-blue-100 text-blue-700',
  deduction: 'bg-red-100 text-red-600',
  refund: 'bg-yellow-100 text-yellow-700',
};

export default function AdminTransactionsPage() {
  const [data, setData] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  async function load(p = 1) {
    setLoading(true);
    try {
      const res = await apiFetch<Response>(`/api/admin/transactions?page=${p}`);
      setData(res.data);
      setTotal(res.total);
      setPage(p);
    } catch (err) {
      if ((err as { status?: number }).status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (forbidden) return <div className="flex items-center justify-center h-full text-gray-400 text-sm">Admin access required</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="w-6 h-6 text-blue-600" /> Transactions
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total transactions</p>
        </div>
        <button onClick={() => load(page)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <RefreshCw className={clsx('w-4 h-4 text-gray-500', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <div className="col-span-3">User</div>
          <div className="col-span-2">Type</div>
          <div className="col-span-3">Description</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-2 text-right">Date</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No transactions yet</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.map((tx) => (
              <div key={tx.id} className="grid grid-cols-12 px-5 py-3.5 items-center hover:bg-gray-50 transition-colors">
                <div className="col-span-3 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{tx.profiles?.full_name || 'No name'}</div>
                  <div className="text-xs text-gray-400 truncate">{tx.profiles?.email}</div>
                </div>
                <div className="col-span-2">
                  <span className={clsx('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', TYPE_STYLES[tx.type])}>
                    {tx.amount > 0
                      ? <ArrowUpCircle className="w-3 h-3" />
                      : <ArrowDownCircle className="w-3 h-3" />}
                    {tx.type}
                  </span>
                </div>
                <div className="col-span-3 text-sm text-gray-600 truncate">{tx.description}</div>
                <div className={clsx('col-span-2 text-sm font-semibold text-right', tx.amount > 0 ? 'text-green-600' : 'text-red-500')}>
                  {tx.amount > 0 ? '+' : ''}{formatBalance(Math.abs(tx.amount))}
                </div>
                <div className="col-span-2 text-xs text-gray-400 text-right">
                  {new Date(tx.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {total > 50 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">Page {page} of {Math.ceil(total / 50)}</span>
            <div className="flex gap-2">
              <button onClick={() => load(page - 1)} disabled={page <= 1}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                Previous
              </button>
              <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / 50)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-100 transition-colors">
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
