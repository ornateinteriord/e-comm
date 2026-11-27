import { create } from 'zustand';
import type { SellerProfile } from '@ornate/types';

export interface SellerAuthState {
  token: string | null;
  refreshToken: string | null;
  seller: SellerProfile | null;
  store: SellerProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: string, seller: SellerProfile, refreshToken?: string | null) => void;
  setTokens: (token: string, refreshToken?: string | null) => void;
  updateSellerProfile: (updates: Partial<SellerProfile>) => void;
  updateStoreProfile: (updates: Partial<SellerProfile>) => void;
  clearAuth: () => void;
}

const STORAGE_KEY_TOKEN = 'eshopy_seller_token';
const STORAGE_KEY_REFRESH_TOKEN = 'eshopy_seller_refresh_token';
const STORAGE_KEY_SELLER = 'eshopy_seller_data';

export const useSellerAuthStore = create<SellerAuthState>((set) => {
  const initialToken =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_TOKEN) ||
        localStorage.getItem('eshopy_store_token') ||
        localStorage.getItem('eshophy_store_token')
      : null;

  const initialRefreshToken =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN)
      : null;

  let initialSeller: SellerProfile | null = null;
  if (typeof localStorage !== 'undefined') {
    const raw =
      localStorage.getItem(STORAGE_KEY_SELLER) ||
      localStorage.getItem('eshopy_store_data') ||
      localStorage.getItem('eshophy_store_data');
    if (raw) {
      try {
        initialSeller = JSON.parse(raw);
      } catch {
        initialSeller = null;
      }
    }
  }

  return {
    token: initialToken,
    refreshToken: initialRefreshToken,
    seller: initialSeller,
    store: initialSeller,
    isAuthenticated: Boolean(initialToken && initialSeller),

    setAuth: (token: string, seller: SellerProfile, refreshToken?: string | null) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_SELLER, JSON.stringify(seller));
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
      }
      set((state) => ({
        token,
        refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
        seller,
        store: seller,
        isAuthenticated: true,
      }));
    },

    setTokens: (token: string, refreshToken?: string | null) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
      }
      set((state) => ({
        token,
        refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
      }));
    },

    updateSellerProfile: (updates: Partial<SellerProfile>) => {
      set((state) => {
        const current = state.seller || state.store;
        if (!current) return state;
        const updated = { ...current, ...updates };
        localStorage.setItem(STORAGE_KEY_SELLER, JSON.stringify(updated));
        return { seller: updated, store: updated };
      });
    },

    updateStoreProfile: (updates: Partial<SellerProfile>) => {
      set((state) => {
        const current = state.seller || state.store;
        if (!current) return state;
        const updated = { ...current, ...updates };
        localStorage.setItem(STORAGE_KEY_SELLER, JSON.stringify(updated));
        return { seller: updated, store: updated };
      });
    },

    clearAuth: () => {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEY_SELLER);
      localStorage.removeItem('eshopy_store_token');
      localStorage.removeItem('eshopy_store_data');
      set({ token: null, refreshToken: null, seller: null, store: null, isAuthenticated: false });
    },
  };
});

// Backward compatibility alias
export const useStoreAuthStore = useSellerAuthStore;
