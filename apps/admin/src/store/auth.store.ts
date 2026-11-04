import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PublicUser, UserRole } from '@ornate/types';

interface AuthState {
  accessToken: string | null;
  user: PublicUser | null;
  setAuth: (token: string, user: PublicUser) => void;
  setAccessToken: (token: string) => void;
  clearAuth: () => void;
  isAuthenticated: boolean;
  hasRole: (...roles: UserRole[]) => boolean;
}

const ROLE_HIERARCHY: Record<UserRole, number> = {
  customer: 0,
  support: 1,
  catalog_manager: 2,
  inventory_manager: 3,
  order_manager: 4,
  finance_manager: 5,
  admin: 6,
  super_admin: 7,
};

export const useAdminAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      setAuth: (token, user) => {
        if (user && user.role === 'customer') {
          console.warn('[Admin Auth] Customer accounts cannot access the admin store');
          set({ accessToken: null, user: null, isAuthenticated: false });
          return;
        }
        set({ accessToken: token, user, isAuthenticated: true });
      },
      setAccessToken: (token) => set({ accessToken: token }),
      clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),
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
