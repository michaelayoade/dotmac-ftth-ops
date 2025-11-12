/**
 * TanStack Query Test Utilities
 * Provides test wrappers and utilities for testing React Query hooks
 */
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * Creates a new QueryClient instance for testing
 * Disables retries and unnecessary refetching for predictable tests
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry failed queries in tests
        gcTime: 0, // Garbage collect immediately (replaces cacheTime in v5)
        refetchOnWindowFocus: false, // Disable auto-refetch
        refetchOnReconnect: false, // Disable auto-refetch on reconnect
      },
      mutations: {
        retry: false, // Don't retry failed mutations
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });
}

/**
 * Creates a wrapper component with QueryClientProvider for testing
 * Usage:
 * ```ts
 * const { result } = renderHook(() => useYourHook(), {
 *   wrapper: createQueryWrapper(),
 * });
 * ```
 */
export function createQueryWrapper() {
  const testQueryClient = createTestQueryClient();

  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={testQueryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

/**
 * Creates a wrapper with a custom QueryClient instance
 * Useful when you need to control the QueryClient configuration
 */
export function createQueryWrapperWithClient(queryClient: QueryClient) {
  return function QueryWrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}
