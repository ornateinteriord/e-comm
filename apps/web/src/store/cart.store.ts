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

export function computeCouponDiscount(code: string | null | undefined, subtotal: number): number {
  if (!code || subtotal <= 0) return 0;
  const upper = code.trim().toUpperCase();
  const shipping = subtotal >= 50000 ? 0 : 5000;
  const normalTax = Math.round(subtotal * 0.18);
  const normalTotal = subtotal + shipping + normalTax;

  if (upper === 'WELCOME10') {
    return Math.round(subtotal * 0.1);
  }
  if (upper === 'FLAT500') {
    return subtotal >= 150000 ? 50000 : 0;
  }
  if (upper === 'SUPER20') {
    return Math.round(subtotal * 0.2);
  }
  if (upper === 'CASHTEST') {
    return Math.max(0, normalTotal - 100);
  }
  return 0;
}

export function calcOrderTotals(subtotal: number, appliedCoupon: string | null | undefined) {
  const upper = appliedCoupon?.trim().toUpperCase();
  const isCashTest = upper === 'CASHTEST';
  const shippingCharge = subtotal === 0 ? 0 : subtotal >= 50000 ? 0 : 5000;
  const couponDiscount = computeCouponDiscount(upper, subtotal);

  if (isCashTest && subtotal > 0) {
    return {
      subtotal,
      shippingCharge,
      couponDiscount,
      tax: 0,
      grandTotal: 100, // 100 paise = ₹1.00 for payment testing
    };
  }

  const taxable = Math.max(0, subtotal - couponDiscount);
  const tax = Math.round(taxable * 0.18);
  const grandTotal = Math.max(0, taxable + shippingCharge + tax);

  return {
    subtotal,
    shippingCharge,
    couponDiscount,
    tax,
    grandTotal,
  };
}

export function calcCartTotals(items: CartItem[]) {
  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const subtotal = items.reduce(
    (sum, item) => sum + (item.lineTotal || (item.quantity * (item.unitApplicablePrice || 0))),
    0
  );
  return { itemCount, subtotal };
}

interface CartState {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'lineTotal'>) => void;
  removeItem: (productId: string, variantId?: string | null) => void;
  updateQuantity: (productId: string, variantId: string | null | undefined, qty: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
  appliedCoupon: string | null;
  couponDiscount: number;
  applyCoupon: (code: string) => { success: boolean; message?: string };
  removeCoupon: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      itemCount: 0,
      subtotal: 0,
      appliedCoupon: null,
      couponDiscount: 0,

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
          const couponDiscount = computeCouponDiscount(state.appliedCoupon, subtotal);
          return { items: newItems, itemCount, subtotal, couponDiscount };
        }),

      removeItem: (productId, variantId) =>
        set((state) => {
          const newItems = state.items.filter(
            (i) => !(i.productId === productId && i.variantId === variantId),
          );
          const { itemCount, subtotal } = calcCartTotals(newItems);
          const couponDiscount = computeCouponDiscount(state.appliedCoupon, subtotal);
          return { items: newItems, itemCount, subtotal, couponDiscount };
        }),

      updateQuantity: (productId, variantId, qty) =>
        set((state) => {
          if (qty <= 0) {
            const newItems = state.items.filter(
              (i) => !(i.productId === productId && i.variantId === variantId),
            );
            const { itemCount, subtotal } = calcCartTotals(newItems);
            const couponDiscount = computeCouponDiscount(state.appliedCoupon, subtotal);
            return { items: newItems, itemCount, subtotal, couponDiscount };
          }
          const newItems = state.items.map((i) =>
            i.productId === productId && i.variantId === variantId
              ? { ...i, quantity: qty, lineTotal: qty * i.unitApplicablePrice }
              : i,
          );
          const { itemCount, subtotal } = calcCartTotals(newItems);
          const couponDiscount = computeCouponDiscount(state.appliedCoupon, subtotal);
          return { items: newItems, itemCount, subtotal, couponDiscount };
        }),

      applyCoupon: (code: string) => {
        const upper = code.trim().toUpperCase();
        const currentSubtotal = get().subtotal;
        if (currentSubtotal <= 0) {
          return { success: false, message: 'Your cart is empty.' };
        }
        if (upper === 'FLAT500' && currentSubtotal < 150000) {
          return {
            success: false,
            message: 'Minimum order condition of ₹1500 not met for FLAT500.',
          };
        }
        if (
          upper === 'WELCOME10' ||
          (upper === 'FLAT500' && currentSubtotal >= 150000) ||
          upper === 'SUPER20' ||
          upper === 'CASHTEST'
        ) {
          const discount = computeCouponDiscount(upper, currentSubtotal);
          set({ appliedCoupon: upper, couponDiscount: discount });
          return { success: true };
        }
        return {
          success: false,
          message: 'Invalid coupon code or minimum order condition not met. Try "WELCOME10", "SUPER20", or "CASHTEST".',
        };
      },

      removeCoupon: () => {
        set({ appliedCoupon: null, couponDiscount: 0 });
      },

      clearCart: () => set({ items: [], itemCount: 0, subtotal: 0, appliedCoupon: null, couponDiscount: 0 }),
    }),
    {
      name: 'ornate-cart',
      partialize: (state) => ({ items: state.items, appliedCoupon: state.appliedCoupon }),
      onRehydrateStorage: () => (state) => {
        if (state && Array.isArray(state.items)) {
          const { itemCount, subtotal } = calcCartTotals(state.items);
          state.itemCount = itemCount;
          state.subtotal = subtotal;
          state.couponDiscount = computeCouponDiscount(state.appliedCoupon, subtotal);
        }
      },
    },
  ),
);
