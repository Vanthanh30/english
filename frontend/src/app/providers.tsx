"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { authApi } from "@/services/auth.service";
import { useAuthStore } from "@/stores/auth.store";

export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const started = useRef(false);

  useEffect(() => {
    if (!hasHydrated || started.current) return;
    started.current = true;

    const initialToken = useAuthStore.getState().accessToken;

    async function restoreSession() {
      try {
        if (initialToken) {
          try {
            const user = await authApi.me(initialToken);
            useAuthStore.getState().setSession({
              accessToken: initialToken,
              user,
            });
            return;
          } catch {
            useAuthStore.getState().setSession(await authApi.refresh());
            return;
          }
        }

        useAuthStore.getState().setSession(await authApi.refresh());
      } catch {
        if (useAuthStore.getState().accessToken === initialToken) {
          useAuthStore.getState().clearSession();
        }
      } finally {
        useAuthStore.getState().markSessionReady();
      }
    }

    void restoreSession();
  }, [hasHydrated]);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
