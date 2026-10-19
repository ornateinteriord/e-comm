import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartItem {
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

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      get itemCount() {
        return get().items.reduce((sum, item) => sum + item.quantity, 0);
      },
      get subtotal() {
        return get().items.reduce((sum, item) => sum + item.lineTotal, 0);
      },
      addItem: (item) =>
        set((state) => {
          const existing = state.items.find(
            (i) => i.productId === item.productId && i.variantId === item.variantId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId && i.variantId === item.variantId
                  ? {
                    ...i,
                    quantity: i.quantity + item.quantity,
                    lineTotal: (i.quantity + item.quantity) * i.unitApplicablePrice,
                  }
                  : i,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...item, lineTotal: item.quantity * item.unitApplicablePrice },
            ],
          };
        }),
      removeItem: (productId, variantId) =>
        set((state) => ({
          items: state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId),
          ),
        })),
      updateQuantity: (productId, variantId, qty) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity: qty, lineTotal: qty * i.unitApplicablePrice }
              : i,
          ),
        })),
      clearCart: () => set({ items: [] }),
    }),
    { name: 'ornate-cart' },
  ),
);
