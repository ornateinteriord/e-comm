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
      setAuth: (token, user) => set({ accessToken: token, user, isAuthenticated: true }),
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
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, isAuthenticated: state.isAuthenticated }),
    },
  ),
);
