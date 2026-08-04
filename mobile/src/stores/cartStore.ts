import { create } from "zustand";

import type { Product } from "@/types/api";

interface CartLine {
  product: Product;
  qty: number;
}

interface CartState {
  merchantId: string | null;
  lines: Record<string, CartLine>;
  setMerchant: (merchantId: string) => void;
  addOne: (product: Product) => void;
  removeOne: (productId: string) => void;
  clear: () => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  merchantId: null,
  lines: {},
  setMerchant: (merchantId) => {
    if (get().merchantId !== merchantId) set({ merchantId, lines: {} });
  },
  addOne: (product) =>
    set((state) => {
      const existing = state.lines[product.id];
      const qty = (existing?.qty ?? 0) + 1;
      return { lines: { ...state.lines, [product.id]: { product, qty } } };
    }),
  removeOne: (productId) =>
    set((state) => {
      const existing = state.lines[productId];
      if (!existing) return state;
      if (existing.qty <= 1) {
        const { [productId]: _removed, ...rest } = state.lines;
        return { lines: rest };
      }
      return {
        lines: { ...state.lines, [productId]: { ...existing, qty: existing.qty - 1 } },
      };
    }),
  clear: () => set({ merchantId: null, lines: {} }),
}));
