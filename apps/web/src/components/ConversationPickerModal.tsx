'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Loader2, Search } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import type { ConversationSummary } from '@tokenai/shared';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Props {
  currentConversationId: string | null;
  onSelect: (conv: ConversationSummary, messages: Message[]) => void;
  onClose: () => void;
}

export default function ConversationPickerModal({ currentConversationId, onSelect, onClose }: Props) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch<ConversationSummary[]>('/api/conversations')
      .then(setConversations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleSelect(conv: ConversationSummary) {
    setLoadingId(conv.id);
    try {
      const msgs = await apiFetch<Message[]>(`/api/conversations/${conv.id}/messages`);
      onSelect(conv, msgs.slice(-20));
    } catch {
      // ignore
    } finally {
      setLoadingId(null);
    }
  }

  const filtered = conversations.filter(
    (c) =>
      c.id !== currentConversationId &&
      c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--card-bg)', borderColor: 'var(--card-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--card-border)' }}
        >
          <div>
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>
              Link conversation context
            </h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              The model will reference this conversation
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: 'var(--input-bg)',
                borderColor: 'var(--input-border)',
                color: 'var(--text-primary)',
              }}
              autoFocus
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-72 overflow-y-auto px-2 pb-3">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
              {search ? 'No conversations match' : 'No other conversations'}
            </p>
          ) : (
            filtered.map((conv) => (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv)}
                disabled={loadingId === conv.id}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-100 dark:bg-blue-900"
                >
                  {loadingId === conv.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-blue-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {conv.title}
                  </div>
                  <div className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {conv.model.split('/')[1]}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
