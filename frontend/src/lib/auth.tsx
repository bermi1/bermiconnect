import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, setUnauthorizedHandler, tokenStore } from './api';
import type { Account, AuthResult, User } from './types';

interface AuthCtx {
  user: User | null; account: Account | null; loading: boolean;
  signIn: (r: AuthResult) => void; signOut: () => void; refresh: () => Promise<void>;
}
const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(!!tokenStore.get());
  const navigate = useNavigate();
  const qc = useQueryClient();

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) { setLoading(false); return; }
    try {
      const me = await api.get<{ user: User; account: Account }>('/me');
      setUser(me.user); setAccount(me.account);
    } catch {
      /* 401 handled globally */
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null); setAccount(null); qc.clear();
      const here = window.location.pathname;
      if (here.startsWith('/app')) navigate(`/login?next=${encodeURIComponent(here)}&expired=1`, { replace: true });
    });
    refresh();
  }, [navigate, qc, refresh]);

  const signIn = (r: AuthResult) => { tokenStore.set(r.token); setUser(r.user); setAccount(r.account); setLoading(false); };
  const signOut = () => { tokenStore.clear(); setUser(null); setAccount(null); qc.clear(); navigate('/login'); };

  return <Ctx.Provider value={{ user, account, loading, signIn, signOut, refresh }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
