'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import ChatInterface from '@/components/ChatInterface';
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
  const params = useParams<{ id: string }>();
  const conversationId = params.id;

  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [initialModel, setInitialModel] = useState<ModelId>('google/gemini-3.1-flash-lite');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
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
  }, [conversationId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <ChatInterface
      conversationId={conversationId}
      initialMessages={messages}
      initialModel={initialModel}
      placeholder="Continue the conversation..."
    />
  );
}
