import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser, UserRole } from '@ornate/types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: PublicUser | null;
  setAuth: (token: string, user: PublicUser, refreshToken?: string | null) => void;
  setAccessToken: (token: string, refreshToken?: string | null) => void;
  clearAuth: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 0,
  seller: 1,
  store: 1,
  delivery_partner: 1,
  support: 2,
  catalog_manager: 3,
  inventory_manager: 4,
  order_manager: 5,
  finance_manager: 6,
  admin: 7,
  super_admin: 8,
};

export const useAdminAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user, refreshToken) => {
        if (user && user.role === 'customer') {
          console.warn('[Admin Auth] Customer accounts cannot access the admin store');
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
        })),
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
      hasRole: (...roles) => {
        const u = get().user;
        if (!u) return false;
        const currentLevel = ROLE_HIERARCHY[u.role] ?? 0;
        return roles.some((r) => currentLevel >= ROLE_HIERARCHY[r]);
      },
    }),
    {
      name: 'ornate-admin-auth',
      partialize: (state) => ({
        user: state.isAuthenticated && state.user?.role !== 'customer' ? state.user : null,
        accessToken: state.user?.role !== 'customer' ? state.accessToken : null,
        refreshToken: state.user?.role !== 'customer' ? state.refreshToken : null,
        isAuthenticated: state.isAuthenticated && state.user?.role !== 'customer',
      }),
      onRehydrateStorage: () => (state) => {
        if (!state?.isAuthenticated || !state?.accessToken || state?.user?.role === 'customer') {
          state?.clearAuth();
        }
      },
    },
  ),
);
