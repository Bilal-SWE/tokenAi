'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { formatBalance } from '@tokenai/shared';
import {
  Loader2, Plus, RefreshCw, Settings, Users, Coins, Ban, CheckCircle,
  Mail, MessageSquare, Clock, ChevronRight, X, Activity,
} from 'lucide-react';
import clsx from 'clsx';

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  banned: boolean;
  balance: number;
  formattedBalance: string;
  messageCount: number;
}

interface UserDetail extends AdminUser {
  totalMessages: number;
  totalTokensUsed: number;
  modelUsage: Array<{ model: string; count: number; tokens: number }>;
  recentConversations: Array<{ id: string; title: string; model: string; created_at: string }>;
  recentTransactions: Array<{ id: string; type: string; amount: number; description: string; created_at: string }>;
}

const QUICK_AMOUNTS = [
  { label: '500K', value: 500_000 },
  { label: '1M', value: 1_000_000 },
  { label: '2M', value: 2_200_000 },
  { label: '5M', value: 5_000_000 },
  { label: '10M', value: 10_000_000 },
];

type ActiveTab = 'tokens' | 'activity';

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('tokens');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [setBalanceMode, setSetBalanceMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [banning, setBanning] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<AdminUser[]>('/api/admin/users');
      setUsers(data);
    } catch (err) {
      if ((err as { status?: number }).status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  async function loadUserDetail(userId: string) {
    setDetailLoading(true);
    setUserDetail(null);
    try {
      const data = await apiFetch<UserDetail>(`/api/admin/users/${userId}`);
      setUserDetail(data);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }

  function selectUser(user: AdminUser) {
    setSelectedUserId(user.id);
    setSuccessMsg('');
    setErrorMsg('');
    setAmount('');
    setDescription('');
    loadUserDetail(user.id);
  }

  const filteredUsers = users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;

  async function handleTokenAction() {
    if (!selectedUser || !amount) return;
    setSaving(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const endpoint = setBalanceMode ? '/api/admin/set-balance' : '/api/admin/add-tokens';
      const nanodollars = Math.round(parseFloat(amount) * 1_000_000_000);
      const body = setBalanceMode
        ? { userId: selectedUser.id, balance: nanodollars }
        : { userId: selectedUser.id, amount: nanodollars, description: description || undefined };

      const res = await apiFetch<{ newBalance?: number; balance?: number; formattedBalance: string }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      const newBal = res.newBalance ?? res.balance ?? 0;
      setUsers((prev) => prev.map((u) =>
        u.id === selectedUser.id ? { ...u, balance: newBal, formattedBalance: formatBalance(newBal) } : u
      ));
      if (userDetail) setUserDetail({ ...userDetail, balance: newBal, formattedBalance: formatBalance(newBal) });
      setSuccessMsg(`✓ ${setBalanceMode ? 'Balance set to' : 'Added'} $${parseFloat(amount).toFixed(2)}`);
      setAmount('');
      setDescription('');
    } catch {
      setErrorMsg('Failed to update tokens.');
    } finally {
      setSaving(false);
    }
  }

  async function handleBanToggle() {
    if (!selectedUser) return;
    setBanning(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      const endpoint = selectedUser.banned
        ? `/api/admin/users/${selectedUser.id}/unban`
        : `/api/admin/users/${selectedUser.id}/ban`;
      await apiFetch(endpoint, { method: 'POST' });
      const newBanned = !selectedUser.banned;
      setUsers((prev) => prev.map((u) =>
        u.id === selectedUser.id ? { ...u, banned: newBanned } : u
      ));
      if (userDetail) setUserDetail({ ...userDetail, banned: newBanned });
      setSuccessMsg(newBanned ? '✓ User account suspended' : '✓ User account reinstated');
    } catch {
      setErrorMsg('Failed to update account status.');
    } finally {
      setBanning(false);
    }
  }

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <Settings className="w-12 h-12 text-gray-300 mb-3" />
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Admin access required</h2>
        <p className="text-sm mt-1 max-w-sm" style={{ color: 'var(--text-muted)' }}>
          Add your email to <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">ADMIN_EMAILS</code> in{' '}
          <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded">apps/api/.env.local</code> and restart the API.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--page-bg)' }}>
      {/* Users list */}
      <div
        className="w-[340px] border-r flex flex-col flex-shrink-0"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
      >
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Users className="w-5 h-5 text-blue-600" /> Users
            </h1>
            <button
              onClick={loadUsers}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} style={{ color: 'var(--text-muted)' }} />
            </button>
          </div>
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
          />
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{users.length} total users</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>No users found</p>
          ) : (
            filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => selectUser(user)}
                className={clsx(
                  'w-full text-left px-4 py-3 border-b transition-colors',
                  selectedUserId === user.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-600'
                    : 'hover:bg-gray-50 dark:hover:bg-slate-700/50'
                )}
                style={{ borderColor: 'var(--card-border)' }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {user.full_name || 'No name'}
                      </span>
                      {user.banned && (
                        <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                          Banned
                        </span>
                      )}
                    </div>
                    <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</div>
                    <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {user.messageCount} messages
                    </div>
                  </div>
                  <div className={clsx(
                    'text-xs font-semibold flex-shrink-0 px-2 py-0.5 rounded-full',
                    user.balance > 0 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  )}>
                    {user.formattedBalance}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--page-bg)' }}>
        {!selectedUser ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Coins className="w-12 h-12 mb-3" style={{ color: 'var(--text-muted)', opacity: 0.3 }} />
            <p style={{ color: 'var(--text-muted)' }}>Select a user to manage their account</p>
          </div>
        ) : (
          <div className="max-w-2xl">
            {/* User header card */}
            <div className="rounded-xl border p-5 mb-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                      {selectedUser.full_name || 'No name'}
                    </h2>
                    {selectedUser.banned && (
                      <span className="text-xs bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                        Suspended
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{selectedUser.email}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Joined {new Date(selectedUser.created_at).toLocaleDateString()}
                  </p>
                  {detailLoading ? (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--text-muted)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Loading details...</span>
                    </div>
                  ) : userDetail && (
                    <div className="flex gap-4 mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span><strong style={{ color: 'var(--text-secondary)' }}>{userDetail.totalMessages}</strong> messages</span>
                      <span><strong style={{ color: 'var(--text-secondary)' }}>{formatBalance(userDetail.totalTokensUsed)}</strong> spent</span>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-2xl font-bold text-blue-600">{selectedUser.formattedBalance}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {selectedUser.balance.toLocaleString()} tokens
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="flex gap-2 mt-4 pt-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
                <a
                  href={`mailto:${selectedUser.email}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
                  style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)' }}
                >
                  <Mail className="w-3.5 h-3.5" /> Email
                </a>
                <button
                  onClick={handleBanToggle}
                  disabled={banning}
                  className={clsx(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                    selectedUser.banned
                      ? 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20'
                      : 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20'
                  )}
                >
                  {banning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : selectedUser.banned ? (
                    <CheckCircle className="w-3.5 h-3.5" />
                  ) : (
                    <Ban className="w-3.5 h-3.5" />
                  )}
                  {selectedUser.banned ? 'Reinstate' : 'Suspend'}
                </button>
              </div>
            </div>

            {/* Messages */}
            {(successMsg || errorMsg) && (
              <div className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm mb-4',
                successMsg ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
              )}>
                {successMsg || errorMsg}
                <button onClick={() => { setSuccessMsg(''); setErrorMsg(''); }} className="ml-auto">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Tabs */}
            <div className="flex rounded-lg border p-1 mb-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
              <button
                onClick={() => setActiveTab('tokens')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === 'tokens' ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                )}
                style={{ color: activeTab === 'tokens' ? undefined : 'var(--text-secondary)' }}
              >
                <Coins className="w-3.5 h-3.5" /> Tokens
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-md transition-colors',
                  activeTab === 'activity' ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                )}
                style={{ color: activeTab === 'activity' ? undefined : 'var(--text-secondary)' }}
              >
                <Activity className="w-3.5 h-3.5" /> Activity
              </button>
            </div>

            {/* Token management tab */}
            {activeTab === 'tokens' && (
              <div className="space-y-4">
                {/* Mode toggle */}
                <div className="flex rounded-lg border p-1" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                  <button
                    onClick={() => setSetBalanceMode(false)}
                    className={clsx(
                      'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                      !setBalanceMode ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    )}
                    style={{ color: !setBalanceMode ? undefined : 'var(--text-secondary)' }}
                  >
                    <Plus className="w-4 h-4 inline mr-1" /> Add tokens
                  </button>
                  <button
                    onClick={() => setSetBalanceMode(true)}
                    className={clsx(
                      'flex-1 py-2 text-sm font-medium rounded-md transition-colors',
                      setBalanceMode ? 'bg-blue-600 text-white' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    )}
                    style={{ color: setBalanceMode ? undefined : 'var(--text-secondary)' }}
                  >
                    <Settings className="w-4 h-4 inline mr-1" /> Set balance
                  </button>
                </div>

                {/* Quick amounts */}
                {!setBalanceMode && (
                  <div className="flex flex-wrap gap-2">
                    {QUICK_AMOUNTS.map((q) => (
                      <button
                        key={q.label}
                        onClick={() => setAmount(q.value.toString())}
                        className={clsx(
                          'px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                          amount === q.value.toString()
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'hover:border-gray-300 dark:hover:border-slate-500'
                        )}
                        style={{
                          background: amount === q.value.toString() ? undefined : 'var(--card-bg)',
                          borderColor: amount === q.value.toString() ? undefined : 'var(--card-border)',
                          color: amount === q.value.toString() ? undefined : 'var(--text-secondary)',
                        }}
                      >
                        {q.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                      {setBalanceMode ? 'New balance (tokens)' : 'Amount to add (tokens)'}
                    </label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min="0"
                      className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
                      placeholder="e.g. 5.00"
                    />
                    {amount && !isNaN(parseFloat(amount)) && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>= ${parseFloat(amount).toFixed(2)}</p>
                    )}
                  </div>

                  {!setBalanceMode && (
                    <div>
                      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                        Description <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)', color: 'var(--text-primary)' }}
                        placeholder="e.g. Bonus tokens, Promo, etc."
                      />
                    </div>
                  )}

                  <button
                    onClick={handleTokenAction}
                    disabled={!amount || saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {saving ? 'Saving...' : setBalanceMode ? 'Set balance' : `Add $${amount ? parseFloat(amount).toFixed(2) : '0.00'}`}
                  </button>
                </div>
              </div>
            )}

            {/* Activity tab */}
            {activeTab === 'activity' && (
              <div className="space-y-4">
                {detailLoading ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
                  </div>
                ) : userDetail ? (
                  <>
                    {/* Model usage */}
                    {userDetail.modelUsage.length > 0 && (
                      <div className="rounded-xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                          <Activity className="w-4 h-4 text-blue-500" /> Model Usage
                        </h3>
                        <div className="space-y-2">
                          {userDetail.modelUsage.slice(0, 5).map((m, i) => {
                            const total = userDetail.modelUsage.reduce((s, x) => s + x.count, 0);
                            const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
                            const colors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-pink-500'];
                            return (
                              <div key={m.model}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="font-medium truncate max-w-[200px]" style={{ color: 'var(--text-secondary)' }}>
                                    {m.model.split('/')[1] || m.model}
                                  </span>
                                  <span style={{ color: 'var(--text-muted)' }}>{m.count} msgs · {pct}%</span>
                                </div>
                                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--hover-bg)' }}>
                                  <div className={`h-full ${colors[i] || 'bg-gray-400'} rounded-full`} style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Recent conversations */}
                    <div className="rounded-xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <MessageSquare className="w-4 h-4 text-indigo-500" /> Recent Conversations
                      </h3>
                      {userDetail.recentConversations.length === 0 ? (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No conversations yet</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.recentConversations.map((conv) => (
                            <div
                              key={conv.id}
                              className="flex items-center gap-2 py-1.5"
                            >
                              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                              <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{conv.title}</span>
                              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                {new Date(conv.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Recent transactions */}
                    <div className="rounded-xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
                      <h3 className="font-semibold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <Clock className="w-4 h-4 text-violet-500" /> Recent Transactions
                      </h3>
                      {userDetail.recentTransactions.length === 0 ? (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No transactions yet</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.recentTransactions.map((txn) => (
                            <div key={txn.id} className="flex items-center gap-2">
                              <span
                                className={clsx(
                                  'text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
                                  txn.type === 'deduction'
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                    : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                )}
                              >
                                {txn.type === 'deduction' ? '-' : '+'}{formatBalance(Math.abs(txn.amount))}
                              </span>
                              <span className="flex-1 text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{txn.description}</span>
                              <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                {new Date(txn.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>Failed to load activity</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
