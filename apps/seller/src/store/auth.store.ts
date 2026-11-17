import { create } from 'zustand';
import type { SellerProfile } from '@ornate/types';

export interface SellerAuthState {
  token: string | null;
  seller: SellerProfile | null;
  store: SellerProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: string, seller: SellerProfile) => void;
  updateSellerProfile: (updates: Partial<SellerProfile>) => void;
  updateStoreProfile: (updates: Partial<SellerProfile>) => void;
  clearAuth: () => void;
}

const STORAGE_KEY_TOKEN = 'eshopy_seller_token';
const STORAGE_KEY_SELLER = 'eshopy_seller_data';

export const useSellerAuthStore = create<SellerAuthState>((set) => {
  const initialToken =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem(STORAGE_KEY_TOKEN) ||
        localStorage.getItem('eshopy_store_token') ||
        localStorage.getItem('eshophy_store_token')
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
    seller: initialSeller,
    store: initialSeller,
    isAuthenticated: Boolean(initialToken && initialSeller),

    setAuth: (token: string, seller: SellerProfile) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_SELLER, JSON.stringify(seller));
      set({ token, seller, store: seller, isAuthenticated: true });
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
      localStorage.removeItem(STORAGE_KEY_SELLER);
      localStorage.removeItem('eshopy_store_token');
      localStorage.removeItem('eshopy_store_data');
      set({ token: null, seller: null, store: null, isAuthenticated: false });
    },
  };
});

// Backward compatibility alias
export const useStoreAuthStore = useSellerAuthStore;
