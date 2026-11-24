import { create } from 'zustand';

interface UIState {
  mobileSearchOpen: boolean;
  openMobileSearch: () => void;
  closeMobileSearch: () => void;
  toggleMobileSearch: () => void;
  setMobileSearchOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileSearchOpen: false,
  openMobileSearch: () => set({ mobileSearchOpen: true }),
  closeMobileSearch: () => set({ mobileSearchOpen: false }),
  toggleMobileSearch: () => set((state) => ({ mobileSearchOpen: !state.mobileSearchOpen })),
  setMobileSearchOpen: (open: boolean) => set({ mobileSearchOpen: open }),
}));
