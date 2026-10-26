import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';
import type { SessionUser } from './types';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  user: SessionUser | null;
  status: AuthStatus;
  login: (email: string, password: string) => Promise<SessionUser>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'OTHER';
    contactNumber?: string;
  }) => Promise<SessionUser>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const reload = useCallback(async () => {
    try {
      const result = await api.auth.session();
      setUser(result.user);
      setStatus('authenticated');
    } catch {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  useEffect(() => {
    let active = true;
    api.auth
      .session()
      .then((result) => {
        if (!active) return;
        setUser(result.user);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus('anonymous');
      });

    const onExpired = () => {
      setUser(null);
      setStatus('anonymous');
    };
    window.addEventListener('mediflow:session-expired', onExpired);
    return () => {
      active = false;
      window.removeEventListener('mediflow:session-expired', onExpired);
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.auth.login(email, password);
    setUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const register = useCallback<AuthContextValue['register']>(async (payload) => {
    const result = await api.auth.register(payload);
    setUser(result.user);
    setStatus('authenticated');
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
      setStatus('anonymous');
    }
  }, []);

  const value = useMemo(
    () => ({ user, status, login, register, logout, reload }),
    [user, status, login, register, logout, reload]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
