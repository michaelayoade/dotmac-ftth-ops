/**
 * TanStack Query Client Utilities
 *
 * Helper functions and query keys for TanStack Query
 */

import { QueryClient } from "@tanstack/react-query";

/**
 * Query key factory for consistent cache keys
 */
export const queryKeys = {
  customers: {
    all: ["customers"] as const,
    lists: () => [...queryKeys.customers.all, "list"] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.customers.lists(), filters] as const,
    details: () => [...queryKeys.customers.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.customers.details(), id] as const,
    activities: (customerId: string) =>
      [...queryKeys.customers.detail(customerId), "activities"] as const,
    notes: (customerId: string) => [...queryKeys.customers.detail(customerId), "notes"] as const,
  },
  users: {
    all: ["users"] as const,
    lists: () => [...queryKeys.users.all, "list"] as const,
    list: (filters?: Record<string, any>) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  rbac: {
    all: ["rbac"] as const,
    roles: ["rbac", "roles"] as const,
    permissions: ["rbac", "permissions"] as const,
    userPermissions: (userId: string) => ["rbac", "users", userId, "permissions"] as const,
    userRoles: (userId: string) => ["rbac", "users", userId, "roles"] as const,
  },
  billing: {
    all: ["billing"] as const,
    plans: ["billing", "plans"] as const,
    subscriptions: ["billing", "subscriptions"] as const,
    invoices: ["billing", "invoices"] as const,
  },
};

/**
 * Optimistic update helpers
 */
export const optimisticHelpers = {
  /**
   * Add item to list optimistically
   */
  addToList: <T>(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    newItem: T,
    options?: { position?: "start" | "end" },
  ): void => {
    queryClient.setQueryData<T[]>(queryKey as any, (oldData) => {
      if (!oldData) return [newItem];
      return options?.position === "start" ? [newItem, ...oldData] : [...oldData, newItem];
    });
  },

  /**
   * Update item in list optimistically
   */
  updateInList: <T extends { id: string }>(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    itemId: string,
    updates: Partial<T> | T | Record<string, any>,
  ): void => {
    queryClient.setQueryData<T[]>(queryKey as any, (oldData) => {
      if (!oldData) return undefined;
      return oldData.map((item) => (item.id === itemId ? ({ ...item, ...updates } as T) : item));
    });
  },

  /**
   * Update single item optimistically
   */
  updateItem: <T>(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    updates: Partial<T> | T,
  ): void => {
    queryClient.setQueryData<T>(queryKey as any, (oldData) => {
      if (!oldData) return updates as T;
      return { ...oldData, ...updates };
    });
  },

  /**
   * Remove item from list optimistically
   */
  removeFromList: <T extends { id: string }>(
    queryClient: QueryClient,
    queryKey: readonly unknown[],
    itemId: string,
  ): void => {
    queryClient.setQueryData<T[]>(queryKey as any, (oldData) => {
      if (!oldData) return undefined;
      return oldData.filter((item) => item.id !== itemId);
    });
  },
};

/**
 * Cache invalidation helpers
 */
export const invalidateHelpers = {
  /**
   * Invalidate all queries for a resource
   */
  invalidateAll: async (queryClient: QueryClient, resourceKey: readonly string[]) => {
    await queryClient.invalidateQueries({ queryKey: resourceKey });
  },

  /**
   * Invalidate list queries for a resource
   */
  invalidateLists: async (queryClient: QueryClient, resourceKey: readonly string[]) => {
    await queryClient.invalidateQueries({
      queryKey: [...resourceKey, "list"],
      exact: false,
    });
  },

  /**
   * Invalidate detail query for a specific item
   */
  invalidateDetail: async (
    queryClient: QueryClient,
    resourceKey: readonly string[],
    itemId: string,
  ) => {
    await queryClient.invalidateQueries({
      queryKey: [...resourceKey, "detail", itemId],
    });
  },

  /**
   * Invalidate multiple related query keys
   */
  invalidateRelated: async (
    queryClient: QueryClient,
    queryKeys: readonly (readonly unknown[])[],
  ) => {
    await Promise.all(
      queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey: queryKey as any })),
    );
  },
};

/**
 * Default query client configuration
 */
export const defaultQueryClientConfig = {
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (previously cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
};

/**
 * Create a new query client instance
 */
export function createQueryClient() {
  return new QueryClient(defaultQueryClientConfig);
}

export const queryClientUtils = {
  queryKeys,
  optimisticHelpers,
  invalidateHelpers,
  createQueryClient,
};

export default queryClientUtils;
