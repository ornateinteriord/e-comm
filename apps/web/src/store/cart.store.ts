import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  variantId?: string | null;
  productName: string;
  productSlug: string;
  productImage?: string;
  sku: string;
  quantity: number;
  unitApplicablePrice: number;
  unitMrp: number;
  lineTotal: number;
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'lineTotal'>) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, variantId: string | null | undefined, qty: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
}

export function calcCartTotals(items: CartItem[]) {
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (item.lineTotal || (item.quantity * (item.unitApplicablePrice || 0))),
    0
  );
  return { itemCount, subtotal };
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      itemCount: 0,
      subtotal: 0,

      addItem: (item) =>
        set((state) => {
          const lineTotal = item.quantity * item.unitApplicablePrice;
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId,
          );
          let newItems: CartItem[];
          if (existing) {
            newItems = state.items.map((i) =>
              i.productId === item.productId && i.variantId === item.variantId
                ? {
                    ...i,
                    quantity: i.quantity + item.quantity,
                    lineTotal: (i.quantity + item.quantity) * i.unitApplicablePrice,
                  }
                : i,
            );
          } else {
            newItems = [...state.items, { ...item, lineTotal }];
          }
          const { itemCount, subtotal } = calcCartTotals(newItems);
          return { items: newItems, itemCount, subtotal };
        }),

      removeItem: (productId, variantId) =>
        set((state) => {
          const newItems = state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId),
          );
          const { itemCount, subtotal } = calcCartTotals(newItems);
          return { items: newItems, itemCount, subtotal };
        }),

      updateQuantity: (productId, variantId, qty) =>
        set((state) => {
          if (qty <= 0) {
            const newItems = state.items.filter(
              (i) => !(i.productId === productId && i.variantId === variantId),
            );
            const { itemCount, subtotal } = calcCartTotals(newItems);
            return { items: newItems, itemCount, subtotal };
          }
          const newItems = state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity: qty, lineTotal: qty * i.unitApplicablePrice }
              : i,
          );
          const { itemCount, subtotal } = calcCartTotals(newItems);
          return { items: newItems, itemCount, subtotal };
        }),

      clearCart: () => set({ items: [], itemCount: 0, subtotal: 0 }),
    }),
    {
      name: 'ornate-cart',
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.items)) {
          const { itemCount, subtotal } = calcCartTotals(state.items);
          state.itemCount = itemCount;
          state.subtotal = subtotal;
        }
      },
    },
  ),
);
