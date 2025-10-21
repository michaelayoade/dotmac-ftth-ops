/**
 * Offline support and caching hook for ISP platform
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAuthStore } from "@dotmac/headless/auth";
import { useTenantStore } from "@dotmac/headless/stores";

export interface OfflineEntry {
  id: string;
  operation: "create" | "update" | "delete";
  resource: string;
  data: unknown;
  timestamp: number;
  tenantId: string;
  userId: string;
  retryCount: number;
  maxRetries: number;
  status: "pending" | "syncing" | "synced" | "failed";
  error?: string;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  etag?: string;
  version?: number;
  tenantId: string;
}

export interface OfflineSyncOptions {
  enableOffline?: boolean;
  enableCache?: boolean;
  defaultTTL?: number;
  maxRetries?: number;
  retryInterval?: number;
  syncOnReconnect?: boolean;
  debug?: boolean;
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingOperations: number;
  lastSyncTime: number | null;
  syncErrors: string[];
}

// Storage keys
const OFFLINE_QUEUE_KEY = "dotmac-offline-queue";
const CACHE_PREFIX = "dotmac-cache";
const METADATA_KEY = "dotmac-cache-metadata";

// Cache utilities
class CacheManager {
  private static getKey(resource: string, params?: Record<string, unknown>): string {
    const paramString = params ? JSON.stringify(params) : "";
    return `${CACHE_PREFIX}:${resource}:${btoa(paramString)}`;
  }

  static get<T>(
    resource: string,
    params?: Record<string, unknown>,
    tenantId?: string,
  ): CacheEntry<T> | null {
    try {
      const key = CacheManager.getKey(resource, params);
      const stored = localStorage.getItem(key);
      if (!stored) {
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(stored);

      // Check tenant isolation
      if (tenantId && entry.tenantId !== tenantId) {
        return null;
      }

      // Check TTL
      if (Date.now() > entry.timestamp + entry.ttl) {
        CacheManager.delete(resource, params);
        return null;
      }

      return entry;
    } catch (_error) {
      return null;
    }
  }

  static set<T>(
    resource: string,
    data: T,
    ttl: number,
    tenantId: string,
    options: {
      params?: Record<string, unknown>;
      etag?: string;
      version?: number;
    } = {
      // Implementation pending
    },
  ): void {
    const { params, etag, _version } = options;
    try {
      const key = CacheManager.getKey(resource, params);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        etag,
        version,
        tenantId,
      };

      localStorage.setItem(key, JSON.stringify(entry));
      CacheManager.updateMetadata(key, resource, tenantId);
    } catch (_error) {
      // Error handling intentionally empty
    }
  }

  static delete(resource: string, params?: Record<string, unknown>): void {
    try {
      const key = CacheManager.getKey(resource, params);
      localStorage.removeItem(key);
      CacheManager.removeFromMetadata(key);
    } catch (_error) {
      // Error handling intentionally empty
    }
  }

  static clear(tenantId?: string): void {
    try {
      const metadata = CacheManager.getMetadata();
      Object.keys(metadata).forEach((key) => {
        if (!tenantId || metadata[key].tenantId === tenantId) {
          localStorage.removeItem(key);
          delete metadata[key];
        }
      });
      localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
    } catch (_error) {
      // Error handling intentionally empty
    }
  }

  private static getMetadata(): Record<
    string,
    { resource: string; tenantId: string; timestamp: number }
  > {
    try {
      const stored = localStorage.getItem(METADATA_KEY);
      return stored
        ? JSON.parse(stored)
        : {
            // Implementation pending
          };
    } catch {
      return {
        // Implementation pending
      };
    }
  }

  private static updateMetadata(key: string, resource: string, tenantId: string): void {
    const metadata = CacheManager.getMetadata();
    metadata[key] = { resource, tenantId, timestamp: Date.now() };
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  }

  private static removeFromMetadata(key: string): void {
    const metadata = CacheManager.getMetadata();
    delete metadata[key];
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  }
}

// Offline queue manager
class OfflineManager {
  static getQueue(): OfflineEntry[] {
    try {
      const stored = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  static addToQueue(entry: Omit<OfflineEntry, "id" | "timestamp" | "retryCount" | "status">): void {
    try {
      const queue = OfflineManager.getQueue();
      const newEntry: OfflineEntry = {
        ...entry,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        retryCount: 0,
        status: "pending",
      };

      queue.push(newEntry);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (_error) {
      // Error handling intentionally empty
    }
  }

  static removeFromQueue(entryId: string): void {
    try {
      const queue = OfflineManager.getQueue().filter((entry) => entry.id !== entryId);
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (_error) {
      // Error handling intentionally empty
    }
  }

  static updateQueueEntry(entryId: string, updates: Partial<OfflineEntry>): void {
    try {
      const queue = OfflineManager.getQueue().map((entry) =>
        entry.id === entryId ? { ...entry, ...updates } : entry,
      );
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (_error) {
      // Error handling intentionally empty
    }
  }

  static clearQueue(tenantId?: string): void {
    try {
      if (tenantId) {
        const queue = OfflineManager.getQueue().filter((entry) => entry.tenantId !== tenantId);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
      } else {
        localStorage.removeItem(OFFLINE_QUEUE_KEY);
      }
    } catch (_error) {
      // Error handling intentionally empty
    }
  }
}

// Composition helpers for sync operations
const SyncOperations = {
  validatePrerequisites: (enableOffline: boolean, user: unknown, tenant: unknown) =>
    enableOffline && user && tenant?.tenant,

  createQueueEntry: (params: {
    operation: "create" | "update" | "delete";
    resource: string;
    data: unknown;
    tenantId: string;
    userId: string;
    maxRetries: number;
  }): Omit<OfflineEntry, "id" | "timestamp" | "retryCount" | "status"> => ({
    operation: params.operation,
    resource: params.resource,
    data: params.data,
    tenantId: params.tenantId,
    userId: params.userId,
    maxRetries: params.maxRetries,
  }),

  filterPendingQueue: (queue: OfflineEntry[], tenantId: string) =>
    queue
      .filter((entry) => entry.tenantId === tenantId)
      .filter((entry) => entry.status === "pending" || entry.status === "failed"),

  processQueueEntry: async (
    entry: OfflineEntry,
    syncFunction: (entry: OfflineEntry) => Promise<void>,
  ) => {
    OfflineManager.updateQueueEntry(entry.id, { status: "syncing" });
    await syncFunction(entry);
    OfflineManager.removeFromQueue(entry.id);
  },

  handleEntryError: (entry: OfflineEntry, error: unknown): string | null => {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const retryCount = entry.retryCount + 1;

    if (retryCount >= entry.maxRetries) {
      OfflineManager.updateQueueEntry(entry.id, {
        status: "failed",
        error: errorMessage,
        retryCount,
      });
      return `${entry.resource}: ${errorMessage}`;
    }
    OfflineManager.updateQueueEntry(entry.id, {
      status: "pending",
      retryCount,
    });
    return null;
  },
};

const CacheOperations = {
  validateCacheAccess: (enableCache: boolean, tenantId?: string) => enableCache && tenantId,

  getCacheEntry: <T>(
    resource: string,
    params: Record<string, unknown> | undefined,
    tenantId: string,
  ) => {
    const entry = CacheManager.get<T>(resource, params, tenantId);
    return entry?.data || null;
  },

  setCacheEntry: <T>(
    resource: string,
    data: T,
    ttl: number,
    tenantId: string,
    options: {
      params?: Record<string, unknown>;
      etag?: string;
      version?: number;
    } = {
      // Implementation pending
    },
  ) => {
    CacheManager.set(resource, data, ttl, tenantId, options);
  },
};

type QueueEntry = OfflineEntry;

export function useOfflineSync(
  options: OfflineSyncOptions = {
    // Implementation pending
  },
) {
  const {
    enableOffline = true,
    enableCache = true,
    defaultTTL = 5 * 60 * 1000, // 5 minutes
    maxRetries = 3,
    retryInterval = 5000,
    syncOnReconnect = true,
    debug = false,
  } = options;

  const { user } = useAuthStore();
  const { currentTenant } = useTenantStore();

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncErrors, setSyncErrors] = useState<string[]>([]);

  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  // Debug logging
  const log = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debug) {
        console.log(`[OfflineSync] ${message}`, ...args);
      }
    },
    [debug],
  );

  // Get pending operations count
  const pendingOperations = useMemo(() => {
    const queue = OfflineManager.getQueue();
    return currentTenant?.tenant?.id
      ? queue.filter((entry) => entry.tenantId === currentTenant.tenant.id).length
      : queue.length;
  }, [currentTenant?.tenant?.id]);

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => {
      log("Network online");
      setIsOnline(true);
      if (syncOnReconnect) {
        syncPendingOperations();
      }
    };

    const handleOffline = () => {
      log("Network offline");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [syncOnReconnect, syncPendingOperations, log]);

  // Cache operations
  const cacheGet = useCallback(
    <T>(resource: string, params?: Record<string, unknown>): T | null => {
      if (!CacheOperations.validateCacheAccess(enableCache, currentTenant?.tenant?.id)) {
        return null;
      }

      const data = CacheOperations.getCacheEntry<T>(resource, params, currentTenant?.tenant.id);
      log("Cache get:", resource, data ? "HIT" : "MISS");
      return data;
    },
    [enableCache, currentTenant?.tenant?.id, log],
  );

  const cacheSet = useCallback(
    <T>(
      resource: string,
      data: T,
      ttl?: number,
      params?: Record<string, unknown>,
      etag?: string,
      version?: number,
    ): void => {
      if (!CacheOperations.validateCacheAccess(enableCache, currentTenant?.tenant?.id)) {
        return;
      }

      log("Cache set:", resource);
      CacheOperations.setCacheEntry(resource, data, ttl || defaultTTL, currentTenant?.tenant.id, {
        params,
        etag,
        version,
      });
    },
    [enableCache, currentTenant?.tenant?.id, defaultTTL, log],
  );

  const cacheDelete = useCallback(
    (resource: string, params?: Record<string, unknown>): void => {
      if (!enableCache) {
        return;
      }

      log("Cache delete:", resource);
      CacheManager.delete(resource, params);
    },
    [enableCache, log],
  );

  const cacheClear = useCallback(
    (tenantOnly = true): void => {
      if (!enableCache) {
        return;
      }

      log("Cache clear:", tenantOnly ? "tenant-only" : "all");
      CacheManager.clear(tenantOnly ? currentTenant?.tenant?.id : undefined);
    },
    [enableCache, currentTenant?.tenant?.id, log],
  );

  // Offline operations
  const queueOperation = useCallback(
    (
      operation: "create" | "update" | "delete",
      resource: string,
      data: unknown,
      operationMaxRetries?: number,
    ): void => {
      if (!SyncOperations.validatePrerequisites(enableOffline, user, currentTenant)) {
        return;
      }

      log("Queueing offline operation:", operation, resource);
      const queueEntry = SyncOperations.createQueueEntry({
        operation,
        resource,
        data,
        tenantId: currentTenant?.tenant.id,
        userId: user?.id,
        maxRetries: operationMaxRetries || maxRetries,
      });
      OfflineManager.addToQueue(queueEntry);
    },
    [enableOffline, user, currentTenant?.tenant, maxRetries, log, currentTenant],
  );

  // Helper to get pending operations for current tenant
  const getPendingQueue = useCallback(() => {
    if (!currentTenant?.tenant?.id) {
      return [];
    }

    return SyncOperations.filterPendingQueue(OfflineManager.getQueue(), currentTenant.tenant.id);
  }, [currentTenant?.tenant?.id]);

  // Helper to sync a single operation
  const syncSingleOperation = useCallback(
    async (entry: QueueEntry): Promise<void> => {
      OfflineManager.updateQueueEntry(entry.id, { status: "syncing" });

      // This would call your actual API
      // For now, simulating API call
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate some failures for testing
      if (Math.random() < 0.1) {
        throw new Error("Simulated network error");
      }

      log("Synced operation:", entry.id);
      OfflineManager.removeFromQueue(entry.id);
    },
    [log],
  );

  // Helper to handle sync error
  const handleSyncError = useCallback(
    (entry: QueueEntry, error: unknown): string | null => {
      log(
        "Failed to sync operation:",
        entry.id,
        error instanceof Error ? error.message : "Unknown error",
      );
      return SyncOperations.handleEntryError(entry, error);
    },
    [log],
  );

  // Helper to schedule retry
  const scheduleRetryIfNeeded = useCallback(
    (errors: string[], queueLength: number) => {
      if (errors.length < queueLength) {
        retryTimeoutRef.current = setTimeout(() => {
          syncPendingOperations();
        }, retryInterval);
      }
    },
    [retryInterval, syncPendingOperations],
  );

  // Sync pending operations
  const syncPendingOperations = useCallback(async (): Promise<void> => {
    if (!isOnline || isSyncing || !currentTenant?.tenant?.id) {
      return;
    }

    const queue = getPendingQueue();
    if (queue.length === 0) {
      return;
    }

    log("Syncing pending operations:", queue.length);
    setIsSyncing(true);
    setSyncErrors([]);

    const errors: string[] = [];

    for (const entry of queue) {
      try {
        await syncSingleOperation(entry);
      } catch (error) {
        const errorMessage = handleSyncError(entry, error);
        if (errorMessage) {
          errors.push(errorMessage);
        }
      }
    }

    setIsSyncing(false);
    setLastSyncTime(Date.now());
    setSyncErrors(errors);

    // Schedule retry for remaining operations
    scheduleRetryIfNeeded(errors, queue.length);
  }, [
    isOnline,
    isSyncing,
    currentTenant?.tenant?.id,
    log,
    getPendingQueue,
    syncSingleOperation,
    handleSyncError,
    scheduleRetryIfNeeded,
  ]);

  // Auto-sync interval
  useEffect(() => {
    if (isOnline && enableOffline) {
      syncIntervalRef.current = setInterval(() => {
        syncPendingOperations();
      }, 30000); // Sync every 30 seconds

      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    }
  }, [isOnline, enableOffline, syncPendingOperations]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  // Clear data when tenant changes
  useEffect(() => {
    const prevTenantId = localStorage.getItem("last-tenant-id");
    const currentTenantId = currentTenant?.tenant?.id;

    if (prevTenantId && currentTenantId && prevTenantId !== currentTenantId) {
      log("Tenant changed, clearing cache and offline queue");
      cacheClear(true);
      // Keep offline queue for old tenant for now
    }

    if (currentTenantId) {
      localStorage.setItem("last-tenant-id", currentTenantId);
    }
  }, [currentTenant?.tenant?.id, cacheClear, log]);

  const status: SyncStatus = {
    isOnline,
    isSyncing,
    pendingOperations,
    lastSyncTime,
    syncErrors,
  };

  return {
    // Status
    ...status,

    // Cache operations
    cacheGet,
    cacheSet,
    cacheDelete,
    cacheClear,

    // Offline operations
    queueOperation,
    syncPendingOperations,

    // Utilities
    isOfflineSupported: enableOffline,
    isCacheEnabled: enableCache,
    canSync: isOnline && !isSyncing,
  };
}

// Hook for cached API calls
export function useCachedData<T>(
  resource: string,
  fetcher: () => Promise<T>,
  options: {
    params?: Record<string, unknown>;
    ttl?: number;
    staleWhileRevalidate?: boolean;
    enabled?: boolean;
  } = {
    // Implementation pending
  },
) {
  const { params, ttl, staleWhileRevalidate = true, enabled = true } = options;

  const { cacheGet, cacheSet, _isOnline } = useOfflineSync();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const fetchData = useCallback(
    async (useCache = true) => {
      if (!enabled) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Try cache first
        if (useCache) {
          const cached = cacheGet<T>(resource, params);
          if (cached) {
            setData(cached);
            setIsStale(false);
            if (!staleWhileRevalidate || !isOnline) {
              setIsLoading(false);
              return;
            }
            setIsStale(true);
          }
        }

        // Fetch fresh data if online
        if (isOnline) {
          const freshData = await fetcher();
          setData(freshData);
          setIsStale(false);
          cacheSet(resource, freshData, ttl, params);
        } else if (!data) {
          throw new Error("No cached data available offline");
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        setError(errorMessage);
        if (!data) {
          setData(null);
        }
      }

      setIsLoading(false);
    },
    [enabled, resource, params, fetcher, cacheGet, cacheSet, staleWhileRevalidate, ttl, data],
  );

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    return fetchData(false);
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    isStale,
    refetch,
  };
}

// ISP-specific offline utilities
export const ISP_CACHE_KEYS = {
  CUSTOMERS: "customers",
  NETWORK_DEVICES: "network:devices",
  BILLING_INVOICES: "billing:invoices",
  SUPPORT_TICKETS: "support:tickets",
  ANALYTICS_METRICS: "analytics:metrics",
  USER_PERMISSIONS: "user:permissions",
  TENANT_SETTINGS: "tenant:settings",
} as const;

export const ISP_CACHE_TTLS = {
  SHORT: 1 * 60 * 1000, // 1 minute
  MEDIUM: 5 * 60 * 1000, // 5 minutes
  LONG: 30 * 60 * 1000, // 30 minutes
  PERSISTENT: 24 * 60 * 60 * 1000, // 24 hours
} as const;
