import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser } from '@ornate/types';

interface AuthState {
  accessToken: string | null;
  user: PublicUser | null;
  setAuth: (token: string, user: PublicUser) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) =>
        set({ accessToken: token, user, isAuthenticated: true }),
      setAccessToken: (token) =>
        set({ accessToken: token }),
      clearAuth: () =>
        set({ accessToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'ornate-auth',
      // Only persist user info (not access token - that lives in memory after reload)
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
