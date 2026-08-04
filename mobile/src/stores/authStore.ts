import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserRole } from "@/types/api";

interface AuthState {
  token: string | null;
  role: UserRole | null;
  userId: string | null;
  hasHydrated: boolean;
  setAuth: (token: string, role: UserRole, userId: string) => void;
  clearAuth: () => void;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      userId: null,
      hasHydrated: false,
      setAuth: (token, role, userId) => set({ token, role, userId }),
      clearAuth: () => set({ token: null, role: null, userId: null }),
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "fastship-auth",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
