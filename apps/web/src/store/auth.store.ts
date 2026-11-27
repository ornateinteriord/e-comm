import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser } from '@ornate/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: PublicUser | null;
  setAuth: (token: string, user: PublicUser, refreshToken?: string | null) => void;
  setAccessToken: (token: string, refreshToken?: string | null) => void;
  clearAuth: () => void;
  isAuthenticated: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user, refreshToken) => {
        // Enforce storefront restriction: only customer accounts can have a session in web storefront
        if (user && user.role !== 'customer') {
          console.warn('[Storefront Auth] Rejecting non-customer account from storefront store:', user.role);
          set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
          return;
        }
        set((state) => ({
          accessToken: token,
          refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
          user,
          isAuthenticated: true,
        }));
      },
      setAccessToken: (token, refreshToken) =>
        set((state) => ({
          accessToken: token,
          refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
          isAuthenticated: Boolean(token),
        })),
      clearAuth: () =>
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
    }),
    {
      name: 'ornate-auth',
      partialize: (state) => ({
        user: state.isAuthenticated && state.user?.role === 'customer' ? state.user : null,
        accessToken: state.user?.role === 'customer' ? state.accessToken : null,
        refreshToken: state.user?.role === 'customer' ? state.refreshToken : null,
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
