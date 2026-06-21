'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { apiFetch } from '@/lib/api';
import { formatBalance } from '@tokenai/shared';

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

export function WalletProvider({ children, initialBalance = 0 }: { children: ReactNode; initialBalance?: number }) {
  const [balance, setBalanceState] = useState(initialBalance);
  const [walletLoaded, setWalletLoaded] = useState(false);

  const setBalance = useCallback((newBalance: number) => {
    setBalanceState(newBalance);
  }, []);

  const refreshBalance = useCallback(async () => {
    try {
      const data = await apiFetch<{ balance: number }>('/api/wallet');
      setBalanceState(data.balance);
    } catch {
      // Silently fail — balance will show stale value
    } finally {
      setWalletLoaded(true);
    }
  }, []);

  return (
    <WalletContext.Provider value={{
      balance,
      formattedBalance: walletLoaded ? formatBalance(balance) : '...',
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
