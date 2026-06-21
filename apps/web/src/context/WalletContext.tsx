'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { formatTokens } from '@tokenai/shared';

const CACHE_KEY = 'tokenai_balance';

function readCache(): number | null {
  try {
    const v = localStorage.getItem(CACHE_KEY);
    return v !== null ? parseInt(v, 10) : null;
  } catch {
    return null;
  }
}

function writeCache(balance: number) {
  try { localStorage.setItem(CACHE_KEY, String(balance)); } catch {}
}

interface WalletContextValue {
  balance: number;
  formattedBalance: string;
  walletLoaded: boolean;
  refreshBalance: () => Promise<void>;
  setBalance: (balance: number) => void;
}

const WalletContext = createContext<WalletContextValue>({
  balance: 0,
  formattedBalance: '...',
  walletLoaded: false,
  refreshBalance: async () => {},
  setBalance: () => {},
});

export function WalletProvider({ children, initialBalance }: { children: ReactNode; initialBalance?: number }) {
  const cached = typeof window !== 'undefined' ? readCache() : null;
  const seed = initialBalance ?? cached ?? 0;

  const [balance, setBalanceState] = useState(seed);
  const [walletLoaded, setWalletLoaded] = useState(initialBalance !== undefined || cached !== null);

  const setBalance = useCallback((newBalance: number) => {
    setBalanceState(newBalance);
    writeCache(newBalance);
  }, []);

  // Called by AppLayout after /api/init resolves — no extra fetch needed.
  const refreshBalance = useCallback(async () => {
    setWalletLoaded(true);
  }, []);

  return (
    <WalletContext.Provider value={{
      balance,
      formattedBalance: formatTokens(balance),
      walletLoaded,
      refreshBalance,
      setBalance,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
