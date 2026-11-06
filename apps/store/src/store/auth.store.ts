import { create } from 'zustand';
import type { StoreProfile } from '@ornate/types';

interface StoreAuthState {
  token: string | null;
  store: StoreProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: string, store: StoreProfile) => void;
  updateStoreProfile: (updates: Partial<StoreProfile>) => void;
  clearAuth: () => void;
}

const STORAGE_KEY_TOKEN = 'eshophy_store_token';
const STORAGE_KEY_STORE = 'eshophy_store_data';

export const useStoreAuthStore = create<StoreAuthState>((set) => {
  const initialToken = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_TOKEN) : null;
  let initialStore: StoreProfile | null = null;
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEY_STORE);
    if (raw) {
      try {
        initialStore = JSON.parse(raw);
      } catch {
        initialStore = null;
      }
    }
  }

  return {
    token: initialToken,
    store: initialStore,
    isAuthenticated: Boolean(initialToken && initialStore),

    setAuth: (token: string, store: StoreProfile) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(store));
      set({ token, store, isAuthenticated: true });
    },

    updateStoreProfile: (updates: Partial<StoreProfile>) => {
      set((state) => {
        if (!state.store) return state;
        const updated = { ...state.store, ...updates };
        localStorage.setItem(STORAGE_KEY_STORE, JSON.stringify(updated));
        return { store: updated };
      });
    },

    clearAuth: () => {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_STORE);
      set({ token: null, store: null, isAuthenticated: false });
    },
  };
});

