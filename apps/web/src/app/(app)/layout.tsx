'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare, Plus, Wallet, Menu, X, LogOut, ShieldCheck, Settings,
  BarChart2, Receipt, Trash2, Sun, Moon, Monitor, Globe,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { WalletProvider, useWallet } from '@/context/WalletContext';
import { AppProvider, useApp } from '@/context/AppContext';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import { formatTokens } from '@tokenai/shared';
import type { ConversationSummary } from '@tokenai/shared';
import clsx from 'clsx';

function Sidebar({
  conversations,
  loadingConversations,
  onNewChat,
  onDeleteConversation,
  isAdmin,
}: {
  conversations: ConversationSummary[];
  loadingConversations: boolean;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { formattedBalance, walletLoaded } = useWallet();
  const { theme, language, setTheme, setLanguage, t } = useAppPreferences();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function handleDeleteClick(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(id);
  }

  async function handleConfirmDelete(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiFetch(`/api/conversations/${id}`, { method: 'DELETE' });
      onDeleteConversation(id);
      if (pathname === `/chat/${id}`) router.push('/chat');
    } catch {
      // ignore
    } finally {
      setConfirmDeleteId(null);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDeleteId(null);
  }

  const themeOptions: { value: typeof theme; icon: React.ReactNode; label: string }[] = [
    { value: 'light', icon: <Sun className="w-3.5 h-3.5" />, label: t('light') },
    { value: 'dark',  icon: <Moon className="w-3.5 h-3.5" />, label: t('dark') },
    { value: 'system', icon: <Monitor className="w-3.5 h-3.5" />, label: t('system') },
  ];

  return (
    <aside
      className="w-[260px] border-r flex flex-col h-full flex-shrink-0"
      style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
    >
      {/* Logo */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
        <span className="text-xl font-bold text-blue-600">TokenAI</span>
      </div>

      {/* New chat button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg py-2 px-3 flex items-center gap-2 text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          {t('newChat')}
        </button>
      </div>

      {/* Conversation list */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {loadingConversations ? (
          <div className="space-y-2 px-2 py-1">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No conversations yet</p>
        ) : (
          conversations.map((conv) => {
            const isActive = pathname === `/chat/${conv.id}`;
            const isConfirming = confirmDeleteId === conv.id;

            return (
              <div key={conv.id} className="group relative">
                {isConfirming ? (
                  <div className="flex items-center gap-1 px-3 py-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                    <Trash2 className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <span className="flex-1 text-xs text-red-700 dark:text-red-400 truncate">{t('confirmDelete')}</span>
                    <button
                      onMouseDown={(e) => handleConfirmDelete(e, conv.id)}
                      className="text-xs text-red-600 font-semibold hover:text-red-800 px-1.5 py-0.5 rounded hover:bg-red-100 transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      onMouseDown={handleCancelDelete}
                      className="text-xs px-1.5 py-0.5 rounded transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t('cancel')}
                    </button>
                  </div>
                ) : (
                  <Link
                    href={`/chat/${conv.id}`}
                    className={clsx(
                      'flex items-start gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    )}
                    style={{ color: isActive ? undefined : 'var(--text-primary)' }}
                  >
                    <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 opacity-60" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{conv.title}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{conv.model.split('/')[1]}</div>
                    </div>
                    <button
                      onClick={(e) => handleDeleteClick(e, conv.id)}
                      title={t('deleteConversation')}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </Link>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t space-y-1" style={{ borderColor: 'var(--sidebar-border)' }}>
        <Link
          href="/wallet"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Wallet className="w-4 h-4" />
          <span className="font-medium">{walletLoaded ? `${formattedBalance} tokens` : '...'}</span>
        </Link>
        <Link
          href="/settings"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Settings className="w-4 h-4" /> {t('settings')}
        </Link>

        {/* Theme toggle */}
        <div className="px-3 pt-2 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
            {t('theme')}
          </p>
          <div className="flex gap-1">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                title={opt.label}
                className={clsx(
                  'flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium transition-colors border',
                  theme === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
                )}
                style={{ color: theme === opt.value ? undefined : 'var(--text-secondary)' }}
              >
                {opt.icon}
                <span className="hidden sm:inline">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Language toggle */}
        <div className="px-3 pb-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
            {t('language')}
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setLanguage('en')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors border',
                language === 'en'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              )}
              style={{ color: language === 'en' ? undefined : 'var(--text-secondary)' }}
            >
              <Globe className="w-3 h-3" /> EN
            </button>
            <button
              onClick={() => setLanguage('ar')}
              className={clsx(
                'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors border',
                language === 'ar'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              )}
              style={{ color: language === 'ar' ? undefined : 'var(--text-secondary)' }}
            >
              <Globe className="w-3 h-3" /> عربي
            </button>
          </div>
        </div>

        {/* Admin links — only visible to admins */}
        {isAdmin && (
          <>
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Admin</div>
            <Link href="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
              style={{ color: 'var(--text-secondary)' }}>
              <ShieldCheck className="w-4 h-4" /> Users
            </Link>
            <Link href="/admin/stats"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
              style={{ color: 'var(--text-secondary)' }}>
              <BarChart2 className="w-4 h-4" /> Stats
            </Link>
            <Link href="/admin/transactions"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
              style={{ color: 'var(--text-secondary)' }}>
              <Receipt className="w-4 h-4" /> Transactions
            </Link>
          </>
        )}

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
          style={{ color: 'var(--text-secondary)' }}>
          <LogOut className="w-4 h-4" /> {t('signOut')}
        </button>
      </div>
    </aside>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAdmin, setIsAdmin } = useApp();
  const router = useRouter();
  const { setBalance, refreshBalance } = useWallet();
  const { t } = useAppPreferences();

  useEffect(() => {
    apiFetch<{ conversations: ConversationSummary[]; balance: number; isAdmin: boolean }>('/api/init')
      .then((data) => {
        setConversations(data.conversations);
        setBalance(data.balance);
        setIsAdmin(data.isAdmin);
        refreshBalance();
      })
      .catch(() => {})
      .finally(() => setLoadingConversations(false));
  }, [setBalance, refreshBalance, setIsAdmin]);

  function handleNewChat() {
    router.push('/chat');
    setSidebarOpen(false);
  }

  function handleDeleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--page-bg)' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={clsx(
        'fixed md:relative inset-y-0 left-0 z-30 transition-transform duration-200 md:translate-x-0',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      )}>
        <Sidebar
          conversations={conversations}
          loadingConversations={loadingConversations}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          isAdmin={isAdmin}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div
          className="md:hidden flex items-center gap-3 px-4 py-3 border-b"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <button onClick={() => setSidebarOpen(true)} className="p-1">
            <Menu className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <span className="font-bold text-blue-600">TokenAI</span>
          {sidebarOpen && (
            <button onClick={() => setSidebarOpen(false)} className="ml-auto p-1">
              <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          )}
        </div>

        <main className="flex-1 overflow-hidden">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav
          className="md:hidden flex border-t"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <Link href="/chat" className="flex-1 flex flex-col items-center py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <MessageSquare className="w-5 h-5 mb-1" />
            {t('chat')}
          </Link>
          <Link href="/wallet" className="flex-1 flex flex-col items-center py-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <Wallet className="w-5 h-5 mb-1" />
            {t('wallet')}
          </Link>
        </nav>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProvider>
      <WalletProvider>
        <AppLayoutInner>{children}</AppLayoutInner>
      </WalletProvider>
    </AppProvider>
  );
}
