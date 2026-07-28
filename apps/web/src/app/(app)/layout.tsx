'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  MessageSquare, Plus, Wallet, Menu, X, LogOut, ShieldCheck, Settings,
  BarChart2, Receipt, Trash2, Globe, Terminal, PanelLeftClose, PanelLeftOpen,
  Cpu, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { apiFetch } from '@/lib/api';
import { WalletProvider, useWallet } from '@/context/WalletContext';
import { AppProvider, useApp } from '@/context/AppContext';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import type { ConversationSummary } from '@tokenai/shared';
import clsx from 'clsx';

function Sidebar({
  conversations,
  loadingConversations,
  onNewChat,
  onDeleteConversation,
  isAdmin,
  isCollapsed,
  onToggleCollapse,
  isMobile,
  onCloseMobile,
}: {
  conversations: ConversationSummary[];
  loadingConversations: boolean;
  onNewChat: () => void;
  onDeleteConversation: (id: string) => void;
  isAdmin: boolean;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobile?: boolean;
  onCloseMobile?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { formattedBalance, walletLoaded } = useWallet();
  const { selectedModelName } = useApp();
  const { t } = useAppPreferences();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [adminOpen, setAdminOpen] = useState(false);
  const [hideConversations, setHideConversations] = useState(false);

  const effectiveCollapsed = isMobile ? false : isCollapsed;

  // Automatically hide conversations when sidebar is collapsed, and show them when sidebar opens
  useEffect(() => {
    setHideConversations(effectiveCollapsed);
  }, [effectiveCollapsed]);

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
  }

  return (
    <aside
      className={clsx(
        'border-r flex flex-col h-full flex-shrink-0 transition-all duration-300 ease-in-out',
        effectiveCollapsed ? 'w-[68px]' : 'w-full md:w-[260px]'
      )}
      style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
    >
      {/* Header / Logo + Collapse Toggle button */}
      <div
        className={clsx(
          'p-4 border-b flex items-center',
          effectiveCollapsed ? 'justify-center' : 'justify-between'
        )}
        style={{ borderColor: 'var(--sidebar-border)' }}
      >
        {!effectiveCollapsed && <span className="text-xl font-bold text-blue-600">TokenAI</span>}
        {isMobile ? (
          <button
            onClick={onCloseMobile}
            title={t('closeSidebar')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onToggleCollapse}
            title={effectiveCollapsed ? t('openSidebar') : t('closeSidebar')}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            {effectiveCollapsed ? <PanelLeftOpen className="w-5 h-5 text-blue-600" /> : <PanelLeftClose className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* New chat button */}
      <div className={clsx('p-3', effectiveCollapsed && 'flex justify-center')}>
        <button
          onClick={onNewChat}
          title={t('newChat')}
          className={clsx(
            'bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center transition-all',
            effectiveCollapsed ? 'w-10 h-10 p-0' : 'w-full py-2.5 px-3 gap-2 text-sm'
          )}
        >
          <Plus className="w-4 h-4" />
          {!effectiveCollapsed && <span>{t('newChat')}</span>}
        </button>
      </div>

      {/* Conversation list header with toggle button */}
      {!effectiveCollapsed && (
        <div className="px-3 pt-2 pb-1 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-slate-400">
            {t('chatHistory')}
          </span>
          <button
            onClick={() => setHideConversations((prev) => !prev)}
            title={hideConversations ? t('showConversations') : t('hideConversations')}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 transition-colors flex items-center gap-1 text-xs"
          >
            <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', hideConversations && '-rotate-90')} />
          </button>
        </div>
      )}

      {/* Conversation list */}
      {!hideConversations ? (
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {loadingConversations ? (
            <div className="space-y-2 px-1 py-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={clsx(
                    'bg-gray-100 dark:bg-slate-700 rounded-lg animate-pulse',
                    effectiveCollapsed ? 'w-10 h-10 mx-auto' : 'h-10'
                  )}
                />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            !effectiveCollapsed && <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>No conversations yet</p>
          ) : (
            conversations.map((conv) => {
              const isActive = pathname === `/chat/${conv.id}`;
              const isConfirming = confirmDeleteId === conv.id;

              if (effectiveCollapsed) {
                return (
                  <Link
                    key={conv.id}
                    href={`/chat/${conv.id}`}
                    title={conv.title}
                    className={clsx(
                      'w-10 h-10 mx-auto flex items-center justify-center rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                        : 'hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500'
                    )}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </Link>
                );
              }

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
                      onClick={onCloseMobile}
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
      ) : (
        /* When conversations are hidden: display ONLY the active conversation item if present */
        (() => {
          const activeConv = conversations.find((c) => pathname === `/chat/${c.id}`);
          if (!activeConv) return null;
          return (
            <div className="px-2 py-1 mb-2">
              {effectiveCollapsed ? (
                <Link
                  href={`/chat/${activeConv.id}`}
                  title={activeConv.title}
                  className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg text-sm bg-blue-50 text-blue-700 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800"
                >
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                </Link>
              ) : (
                <Link
                  href={`/chat/${activeConv.id}`}
                  onClick={onCloseMobile}
                  className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-sm bg-blue-50/90 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-semibold border border-blue-200/80 dark:border-blue-800/80 shadow-xs"
                >
                  <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold">{activeConv.title}</div>
                    <div className="text-xs truncate font-medium text-blue-600/80 dark:text-blue-400/80">
                      {activeConv.model.split('/')[1]}
                    </div>
                  </div>
                </Link>
              )}
            </div>
          );
        })()
      )}

      {/* AI Coder Tab */}
      <div className={clsx('px-3 pb-2', effectiveCollapsed && 'flex justify-center')}>
        <Link
          href="/coder"
          onClick={onCloseMobile}
          title="AI Coder"
          className={clsx(
            'flex items-center gap-2.5 rounded-xl text-sm font-semibold transition-all duration-200 border',
            effectiveCollapsed ? 'w-10 h-10 justify-center p-0' : 'w-full px-3 py-2.5',
            pathname === '/coder'
              ? 'bg-violet-600 text-white border-violet-600 shadow-lg shadow-violet-500/20'
              : 'bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border-violet-200 dark:border-violet-700/50 text-violet-700 dark:text-violet-300 hover:from-violet-100 hover:to-indigo-100 dark:hover:from-violet-800/30 dark:hover:to-indigo-800/30'
          )}
        >
          <Terminal className="w-4 h-4 flex-shrink-0" />
          {!effectiveCollapsed && (
            <>
              <span>AI Coder</span>
              <span className="ms-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-500/20 dark:bg-violet-400/20 text-violet-600 dark:text-violet-400 border border-violet-300/50 dark:border-violet-600/50">
                Soon
              </span>
            </>
          )}
        </Link>
      </div>

      {/* Footer */}
      <div className="p-2 border-t space-y-1" style={{ borderColor: 'var(--sidebar-border)' }}>
        <Link
          href="/wallet"
          onClick={onCloseMobile}
          title={`Wallet: ${walletLoaded ? `${formattedBalance} tokens` : '...'}`}
          className={clsx(
            'flex items-center gap-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700',
            effectiveCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'px-3 py-2'
          )}
          style={{ color: 'var(--text-secondary)' }}
        >
          <Wallet className="w-4 h-4 flex-shrink-0" />
          {!effectiveCollapsed && <span className="font-medium">{walletLoaded ? `${formattedBalance} tokens` : '...'}</span>}
        </Link>

        <Link
          href="/settings"
          onClick={onCloseMobile}
          title={t('settings')}
          className={clsx(
            'flex items-center gap-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700',
            effectiveCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'px-3 py-2'
          )}
          style={{ color: 'var(--text-secondary)' }}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!effectiveCollapsed && <span>{t('settings')}</span>}
        </Link>

        {/* Admin links list */}
        {isAdmin && (
          effectiveCollapsed ? (
            <Link
              href="/admin"
              onClick={onCloseMobile}
              title={t('adminMenu')}
              className="w-10 h-10 justify-center mx-auto flex items-center rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 text-blue-600"
            >
              <ShieldCheck className="w-4 h-4" />
            </Link>
          ) : (
            <div className="pt-1">
              <button
                onClick={() => setAdminOpen((prev) => !prev)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700"
                style={{ color: 'var(--text-secondary)' }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-xs uppercase tracking-wider">{t('adminMenu')}</span>
                </div>
                <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform duration-200', adminOpen && 'rotate-180')} />
              </button>

              {adminOpen && (
                <div className="ml-3 border-l pl-2 space-y-1 mt-1 border-gray-200 dark:border-slate-700">
                  <Link
                    href="/admin"
                    onClick={onCloseMobile}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      pathname === '/admin' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    )}
                    style={{ color: pathname === '/admin' ? undefined : 'var(--text-secondary)' }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" /> Users
                  </Link>
                  <Link
                    href="/admin/stats"
                    onClick={onCloseMobile}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      pathname === '/admin/stats' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    )}
                    style={{ color: pathname === '/admin/stats' ? undefined : 'var(--text-secondary)' }}
                  >
                    <BarChart2 className="w-3.5 h-3.5" /> Stats
                  </Link>
                  <Link
                    href="/admin/transactions"
                    onClick={onCloseMobile}
                    className={clsx(
                      'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                      pathname === '/admin/transactions' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-gray-50 dark:hover:bg-slate-700'
                    )}
                    style={{ color: pathname === '/admin/transactions' ? undefined : 'var(--text-secondary)' }}
                  >
                    <Receipt className="w-3.5 h-3.5" /> Transactions
                  </Link>
                </div>
              )}
            </div>
          )
        )}

        <button
          onClick={handleSignOut}
          title={t('signOut')}
          className={clsx(
            'flex items-center gap-2 rounded-lg text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500',
            effectiveCollapsed ? 'w-10 h-10 justify-center mx-auto' : 'w-full px-3 py-2'
          )}
          style={{ color: 'var(--text-secondary)' }}
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          {!effectiveCollapsed && <span>{t('signOut')}</span>}
        </button>
      </div>

      {hideConversations && <div className="flex-1" />}
    </aside>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const {
    isAdmin,
    setIsAdmin,
    conversations,
    setConversations,
    loadingConversations,
    setLoadingConversations,
  } = useApp();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
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
  }, [setBalance, refreshBalance, setIsAdmin, setConversations, setLoadingConversations]);

  function handleNewChat() {
    router.push('/chat');
    setMobileDrawerOpen(false);
  }

  function handleDeleteConversation(id: string) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="flex h-screen overflow-hidden relative" style={{ background: 'var(--page-bg)' }}>
      {/* Mobile backdrop overlay */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden animate-fade-in"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer (Slide-over on mobile screens) */}
      <div
        className={clsx(
          'fixed inset-y-0 left-0 z-50 w-[280px] sm:w-[320px] bg-white dark:bg-slate-800 shadow-2xl transition-transform duration-300 ease-in-out md:hidden',
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <Sidebar
          conversations={conversations}
          loadingConversations={loadingConversations}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          isAdmin={isAdmin}
          isCollapsed={false}
          onToggleCollapse={() => {}}
          isMobile={true}
          onCloseMobile={() => setMobileDrawerOpen(false)}
        />
      </div>

      {/* Desktop Sidebar (Mini Icon-only Mode when collapsed) */}
      <div className="hidden md:block inset-y-0 left-0 z-30 flex-shrink-0 h-full">
        <Sidebar
          conversations={conversations}
          loadingConversations={loadingConversations}
          onNewChat={handleNewChat}
          onDeleteConversation={handleDeleteConversation}
          isAdmin={isAdmin}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 w-full h-full">
        {/* Mobile Header Bar */}
        <div
          className="md:hidden flex items-center justify-between px-3 py-2.5 border-b z-20 flex-shrink-0"
          style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="p-1.5 rounded-lg border text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              style={{ borderColor: 'var(--card-border)' }}
              title={t('openSidebar')}
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-base sm:text-lg text-blue-600">TokenAI</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1 bg-blue-600 text-white rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('newChat')}</span>
            </button>
            <Link
              href="/settings"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title={t('settings')}
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
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
