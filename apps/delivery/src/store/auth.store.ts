import { create } from 'zustand';
import type { DeliveryPartnerProfile } from '@ornate/types';

export interface DeliveryAuthState {
  token: string | null;
  refreshToken: string | null;
  partner: DeliveryPartnerProfile | null;
  isAuthenticated: boolean;
  setAuth: (token: string, partner: DeliveryPartnerProfile, refreshToken?: string | null) => void;
  setTokens: (token: string, refreshToken?: string | null) => void;
  updatePartnerProfile: (updates: Partial<DeliveryPartnerProfile>) => void;
  clearAuth: () => void;
}

const STORAGE_KEY_TOKEN = 'eshopy_delivery_token';
const STORAGE_KEY_REFRESH_TOKEN = 'eshopy_delivery_refresh_token';
const STORAGE_KEY_PARTNER = 'eshopy_delivery_partner';

export const useDeliveryAuthStore = create<DeliveryAuthState>((set) => {
  const initialToken =
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_TOKEN) : null;
  const initialRefreshToken =
    typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY_REFRESH_TOKEN) : null;

  let initialPartner: DeliveryPartnerProfile | null = null;
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(STORAGE_KEY_PARTNER);
    if (raw) {
      try {
        initialPartner = JSON.parse(raw);
      } catch {
        initialPartner = null;
      }
    }
  }

  return {
    token: initialToken,
    refreshToken: initialRefreshToken,
    partner: initialPartner,
    isAuthenticated: Boolean(initialToken && initialPartner),

    setAuth: (token: string, partner: DeliveryPartnerProfile, refreshToken?: string | null) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, token);
      localStorage.setItem(STORAGE_KEY_PARTNER, JSON.stringify(partner));
      if (refreshToken) {
        localStorage.setItem(STORAGE_KEY_REFRESH_TOKEN, refreshToken);
      }
      set((state) => ({
        token,
        refreshToken: refreshToken !== undefined ? refreshToken : state.refreshToken,
        partner,
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

    updatePartnerProfile: (updates: Partial<DeliveryPartnerProfile>) => {
      set((state) => {
        if (!state.partner) return state;
        const updated = { ...state.partner, ...updates };
        localStorage.setItem(STORAGE_KEY_PARTNER, JSON.stringify(updated));
        return { partner: updated };
      });
    },

    clearAuth: () => {
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEY_PARTNER);
      set({ token: null, refreshToken: null, partner: null, isAuthenticated: false });
    },
  };
});
