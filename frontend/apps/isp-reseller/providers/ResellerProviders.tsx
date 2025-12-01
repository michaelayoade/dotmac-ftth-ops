"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ResellerAuthProvider } from "@/lib/auth/ResellerAuthContext";

interface ResellerProvidersProps {
  children: ReactNode;
}

export function ResellerProviders({ children }: ResellerProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            gcTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ResellerAuthProvider>{children}</ResellerAuthProvider>
    </QueryClientProvider>
  );
}
