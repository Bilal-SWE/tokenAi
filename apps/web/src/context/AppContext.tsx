'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AppContextValue {
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue>({
  isAdmin: false,
  setIsAdmin: () => {},
});

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const set = useCallback((v: boolean) => setIsAdmin(v), []);
  return (
    <AppContext.Provider value={{ isAdmin, setIsAdmin: set }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
