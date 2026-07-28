'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import ChatInterface from '@/components/ChatInterface';
import { useApp } from '@/context/AppContext';
import type { ModelId } from '@tokenai/shared';
import { AI_MODELS } from '@tokenai/shared';

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tokens_used?: number;
  model?: string;
}

export default function ConversationPage() {
  const params = useParams<{ id?: string[] }>();
  const conversationId = params.id?.[0] || null;
  const { pendingNewChat, clearPendingNewChat } = useApp();

  const isPending = !!(pendingNewChat && conversationId && pendingNewChat.id === conversationId);
  const didInitializeFromPendingRef = useRef(isPending);

  const [messages, setMessages] = useState<StoredMessage[]>(
    isPending ? pendingNewChat.messages : []
  );
  const [initialModel, setInitialModel] = useState<ModelId>(() => {
    if (isPending) {
      const lastModel = pendingNewChat.messages.findLast((m) => m.model)?.model as ModelId | undefined;
      if (lastModel && AI_MODELS.some((m) => m.id === lastModel)) {
        return lastModel;
      }
    }
    return 'google/gemini-2.5-flash-lite';
  });
  const [loading, setLoading] = useState(() => {
    if (!conversationId) return false;
    return !isPending;
  });

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      didInitializeFromPendingRef.current = false;
      return;
    }
    if (didInitializeFromPendingRef.current) {
      const timer = setTimeout(() => {
        clearPendingNewChat();
      }, 0);
      didInitializeFromPendingRef.current = false;
      return () => clearTimeout(timer);
    }
    async function load() {
      setLoading(true);
      try {
        const data = await apiFetch<StoredMessage[]>(`/api/conversations/${conversationId}/messages`);
        setMessages(data);
        const lastModel = data.findLast((m) => m.model)?.model as ModelId | undefined;
        if (lastModel && AI_MODELS.some((m) => m.id === lastModel)) {
          setInitialModel(lastModel);
        }
      } catch {
        // Non-fatal — show empty chat
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [conversationId, clearPendingNewChat]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <ChatInterface
      key="chat-interface"
      conversationId={conversationId}
      initialMessages={messages}
      initialModel={initialModel}
      placeholder={conversationId ? "Continue the conversation..." : "Type a message..."}
    />
  );
}


