'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { ConversationSummary } from '@tokenai/shared';
import { apiFetch } from '@/lib/api';

export interface PendingNewChat {
  id: string;
  messages: any[];
}

interface AppContextValue {
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  conversations: ConversationSummary[];
  setConversations: React.Dispatch<React.SetStateAction<ConversationSummary[]>>;
  loadingConversations: boolean;
  setLoadingConversations: (v: boolean) => void;
  refreshConversations: () => Promise<void>;
  pendingNewChat: PendingNewChat | null;
  setPendingNewChat: (chat: PendingNewChat | null) => void;
  clearPendingNewChat: () => void;
  selectedModelName: string;
  setSelectedModelName: (name: string) => void;
}

const AppContext = createContext<AppContextValue>({
  isAdmin: false,
  setIsAdmin: () => {},
  conversations: [],
  setConversations: () => {},
  loadingConversations: true,
  setLoadingConversations: () => {},
  refreshConversations: async () => {},
  pendingNewChat: null,
  setPendingNewChat: () => {},
  clearPendingNewChat: () => {},
  selectedModelName: 'Gemini 2.5 Flash Lite',
  setSelectedModelName: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [pendingNewChat, setPendingNewChat] = useState<PendingNewChat | null>(null);
  const [selectedModelName, setSelectedModelName] = useState<string>('Gemini 2.5 Flash Lite');

  const setIsAdminCallback = useCallback((v: boolean) => setIsAdmin(v), []);

  const refreshConversations = useCallback(async () => {
    try {
      const data = await apiFetch<ConversationSummary[]>('/api/conversations');
      setConversations(data);
    } catch (e) {
      console.error('Failed to refresh conversations', e);
    }
  }, []);

  const clearPendingNewChat = useCallback(() => setPendingNewChat(null), []);

  return (
    <AppContext.Provider
      value={{
        isAdmin,
        setIsAdmin: setIsAdminCallback,
        conversations,
        setConversations,
        loadingConversations,
        setLoadingConversations,
        refreshConversations,
        pendingNewChat,
        setPendingNewChat,
        clearPendingNewChat,
        selectedModelName,
        setSelectedModelName,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}

