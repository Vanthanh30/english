"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { AuthSession, AuthUser } from "@/services/auth.service";

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  sessionReady: boolean;
  setSession: (session: AuthSession) => void;
  clearSession: () => void;
  markHydrated: () => void;
  markSessionReady: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      hasHydrated: false,
      sessionReady: false,
      setSession: (session) =>
        set({
          accessToken: session.accessToken,
          user: session.user,
          sessionReady: true,
        }),
      clearSession: () =>
        set({ accessToken: null, user: null, sessionReady: true }),
      markHydrated: () => set({ hasHydrated: true }),
      markSessionReady: () => set({ sessionReady: true }),
    }),
    {
      name: "english-quest-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
      }),
      onRehydrateStorage: () => (state) => {
        state?.markHydrated();
      },
    },
  ),
);
