import { QueryClient } from "@tanstack/react-query";
import type { PortalType } from "../UniversalProviders";

export function createPortalQueryClient(_portal: PortalType): QueryClient {
  // Lightweight defaults; tune per-portal later if needed
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error: any) => {
          if (error?.status === 401 || error?.status === 403) return false;
          return failureCount < 3;
        },
      },
    },
  });
}
