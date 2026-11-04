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
      setAuth: (token, user) => {
        // Enforce storefront restriction: only customer accounts can have a session in web storefront
        if (user && user.role !== 'customer') {
          console.warn('[Storefront Auth] Rejecting non-customer account from storefront store:', user.role);
          set({ accessToken: null, user: null, isAuthenticated: false });
          return;
        }
        set({ accessToken: token, user, isAuthenticated: true });
      },
      setAccessToken: (token) =>
        set({ accessToken: token, isAuthenticated: Boolean(token) }),
      clearAuth: () =>
        set({ accessToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'ornate-auth',
      partialize: (state) => ({
        user: state.isAuthenticated && state.user?.role === 'customer' ? state.user : null,
        accessToken: state.user?.role === 'customer' ? state.accessToken : null,
        isAuthenticated: state.isAuthenticated && state.user?.role === 'customer',
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.isAuthenticated || !state?.accessToken || state?.user?.role !== 'customer') {
          state?.clearAuth();
        }
      },
    },
  ),
);
