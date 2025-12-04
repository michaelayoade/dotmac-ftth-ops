"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { PartnerAuthProvider } from "@/lib/auth/PartnerAuthContext";

interface PartnerProvidersProps {
  children: ReactNode;
}

export function PartnerProviders({ children }: PartnerProvidersProps) {
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
      <PartnerAuthProvider>{children}</PartnerAuthProvider>
    </QueryClientProvider>
  );
}
