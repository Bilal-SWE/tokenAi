'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatBalance } from '@tokenai/shared';
import {
  Users, MessageSquare, Coins, DollarSign, Loader2, TrendingUp, RefreshCw,
  UserPlus, Zap, Award,
} from 'lucide-react';
import clsx from 'clsx';

interface TopUser {
  id: string;
  email: string;
  full_name: string | null;
  messageCount: number;
  balance: number;
}

interface DayPoint {
  date: string;
  label: string;
  count: number;
}

interface ModelStat {
  model: string;
  count: number;
  tokensUsed: number;
}

interface Stats {
  totalUsers: number;
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
  totalMessages: number;
  messagesToday: number;
  messagesThisWeek: number;
  totalTokensUsed: number;
  totalRevenueCents: number;
  allModels: ModelStat[];
  topModels: ModelStat[];
  daily14Days: DayPoint[];
  topUsers: TopUser[];
}

function StatCard({ icon: Icon, label, value, sub, badge, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  badge?: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border p-5" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        {badge && (
          <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{value}</div>
      <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      {sub && <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  );
}

function MiniBarChart({ data }: { data: DayPoint[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-[3px] h-16 w-full">
      {data.map((d, i) => {
        const heightPct = (d.count / max) * 100;
        const isToday = i === data.length - 1;
        return (
          <div
            key={d.date}
            className="flex-1 group relative cursor-default"
            style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
          >
            <div
              className={clsx(
                'w-full rounded-sm transition-all',
                isToday ? 'bg-blue-500' : 'bg-blue-200 dark:bg-blue-800 group-hover:bg-blue-400 dark:group-hover:bg-blue-600'
              )}
              style={{ height: `${Math.max(heightPct, 3)}%` }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 pointer-events-none">
              <div className="text-[10px] font-medium whitespace-nowrap rounded px-1.5 py-0.5"
                style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: 'var(--text-primary)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
                {d.label}: {d.count}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AdminStatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<Stats>('/api/admin/stats');
      setStats(data);
    } catch (err) {
      if ((err as { status?: number }).status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (forbidden) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-muted)' }}>
        Admin access required
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--text-muted)' }} />
      </div>
    );
  }

  if (!stats) return null;

  const visibleModels = showAllModels ? stats.allModels : stats.allModels.slice(0, 6);
  const totalModelCount = stats.allModels.reduce((s, m) => s + m.count, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 overflow-y-auto h-full" style={{ color: 'var(--text-primary)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-blue-600" /> Platform Stats
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Real-time overview of TokenAI usage</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-slate-700"
        >
          <RefreshCw className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      {/* Stat cards — row 1 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          icon={Users}
          label="Total users"
          value={stats.totalUsers.toLocaleString()}
          sub={`+${stats.newUsersThisMonth} this month`}
          color="bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          icon={UserPlus}
          label="New users"
          value={stats.newUsersToday.toLocaleString()}
          sub={`${stats.newUsersThisWeek} this week`}
          badge="Today"
          color="bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        />
        <StatCard
          icon={MessageSquare}
          label="Total messages"
          value={stats.totalMessages.toLocaleString()}
          sub={`${stats.messagesToday} today · ${stats.messagesThisWeek} this week`}
          color="bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400"
        />
        <StatCard
          icon={DollarSign}
          label="Total revenue"
          value={`$${(stats.totalRevenueCents / 100).toFixed(2)}`}
          color="bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400"
        />
      </div>

      {/* Stat cards — row 2 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Coins}
          label="Tokens consumed"
          value={formatBalance(stats.totalTokensUsed)}
          color="bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
        />
        <StatCard
          icon={Zap}
          label="Avg msg/user"
          value={stats.totalUsers > 0 ? Math.round(stats.totalMessages / stats.totalUsers).toLocaleString() : '0'}
          color="bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
        />
        <StatCard
          icon={Award}
          label="Models used"
          value={stats.allModels.length.toLocaleString()}
          sub="distinct models"
          color="bg-pink-50 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400"
        />
        <StatCard
          icon={TrendingUp}
          label="Active this week"
          value={stats.messagesThisWeek.toLocaleString()}
          sub="AI responses generated"
          color="bg-teal-50 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
        />
      </div>

      {/* Daily activity chart */}
      <div className="rounded-xl border p-6 mb-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Daily AI Responses (Last 14 Days)
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{
            background: 'var(--hover-bg)', color: 'var(--text-muted)'
          }}>
            Today: {stats.daily14Days[stats.daily14Days.length - 1]?.count ?? 0}
          </span>
        </div>
        <MiniBarChart data={stats.daily14Days} />
        <div className="flex justify-between mt-2">
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{stats.daily14Days[0]?.label}</span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{stats.daily14Days[stats.daily14Days.length - 1]?.label}</span>
        </div>
      </div>

      {/* Two columns: models + top users */}
      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* All models */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-violet-500" /> Model Usage
          </h2>
          {stats.allModels.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data yet</p>
          ) : (
            <>
              <div className="space-y-3">
                {visibleModels.map((m, i) => {
                  const pct = totalModelCount > 0 ? Math.round((m.count / totalModelCount) * 100) : 0;
                  const palette = [
                    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500',
                    'bg-pink-500', 'bg-rose-500', 'bg-orange-500', 'bg-amber-500',
                  ];
                  return (
                    <div key={m.model}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium truncate max-w-[180px]" style={{ color: 'var(--text-secondary)' }}>
                          {m.model.split('/')[1] || m.model}
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {m.count.toLocaleString()} · {pct}% · {formatBalance(m.tokensUsed)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--hover-bg)' }}>
                        <div
                          className={`h-full ${palette[i % palette.length]} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {stats.allModels.length > 6 && (
                <button
                  onClick={() => setShowAllModels(!showAllModels)}
                  className="mt-3 text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  {showAllModels ? 'Show less' : `Show all ${stats.allModels.length} models`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Top users */}
        <div className="rounded-xl border p-6" style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}>
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> Top Users by Activity
          </h2>
          {stats.topUsers.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No data yet</p>
          ) : (
            <div className="space-y-2">
              {stats.topUsers.map((u, i) => (
                <div key={u.id} className="flex items-center gap-3 py-1.5">
                  <span
                    className={clsx(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                      i === 0 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                        : i === 1 ? 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                        : i === 2 ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                        : 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400'
                    )}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      {u.full_name || u.email.split('@')[0]}
                    </div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {u.messageCount.toLocaleString()}
                    </div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>msgs</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={clsx(
                      'text-xs font-medium px-1.5 py-0.5 rounded-full',
                      u.balance > 0
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                    )}>
                      {formatBalance(u.balance)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
