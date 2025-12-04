"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { TenantAuthProvider } from "@/lib/auth/TenantAuthContext";

interface TenantProvidersProps {
  children: ReactNode;
}

export function TenantProviders({ children }: TenantProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TenantAuthProvider>{children}</TenantAuthProvider>
    </QueryClientProvider>
  );
}
