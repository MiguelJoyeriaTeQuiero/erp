'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, clearTokens, setTokens } from './api-client';
import type { LoginResponse, User } from '@/types/auth';

// ── Contexto ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Escuchar evento global de sesión expirada (disparado por api-client al fallar el refresh)
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      clearTokens();
      router.replace('/login');
    };
    window.addEventListener('auth:expired', handleExpired);
    return () => window.removeEventListener('auth:expired', handleExpired);
  }, [router]);

  // Restaurar sesión al montar la app
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const response = await api.get<{ data: User }>('/auth/me');
        setUser(response.data);
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    void restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ data: LoginResponse }>('/auth/login', { email, password });
    const { accessToken, refreshToken, user: loggedUser } = response.data;
    setTokens(accessToken, refreshToken);
    setUser(loggedUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignorar errores al cerrar sesión en el servidor
    } finally {
      clearTokens();
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
