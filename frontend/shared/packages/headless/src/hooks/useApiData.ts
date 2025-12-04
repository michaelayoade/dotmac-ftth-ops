import { useCallback, useEffect, useRef, useState } from "react";

import { getApiClient } from "../api";

import { useApiErrorNotifications } from "./useNotifications";

interface UseApiDataOptions<T> {
  ttl?: number;
  fallbackData?: T | null;
  enabled?: boolean;
  retryCount?: number;
  retryDelay?: number;
}

interface UseApiDataResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

const cache = new Map<string, { data: unknown; timestamp: number }>();

export function useApiData<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseApiDataOptions<T> = {
    // Implementation pending
  },
): UseApiDataResult<T> {
  const {
    ttl = 5 * 60 * 1000, // 5 minutes default
    fallbackData,
    enabled = true,
    retryCount = 2,
    retryDelay = 1000,
  } = options;

  const [data, setData] = useState<T | null>(() => fallbackData ?? null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const mountedRef = useRef(true);
  const { notifyApiError } = useApiErrorNotifications();

  // Helper to check and use cached data
  const useCachedData = useCallback(() => {
    const cached = cache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < ttl) {
      setData(cached.data as T);
      setLastUpdated(new Date(cached.timestamp));
      return true;
    }
    return false;
  }, [key, ttl]);

  // Helper to handle successful fetch
  const handleFetchSuccess = useCallback(
    (result: T) => {
      if (mountedRef.current) {
        setData(result);
        setLastUpdated(new Date());
        setError(null);

        // Cache the successful result
        cache.set(key, {
          data: result,
          timestamp: Date.now(),
        });
      }
    },
    [key],
  );

  // Helper to schedule retry
  const scheduleRetry = useCallback(
    (attemptCount: number, fetchFn: (count: number) => Promise<void>) => {
      const delay = retryDelay * 2 ** attemptCount;
      retryTimeoutRef.current = setTimeout(() => {
        fetchFn(attemptCount + 1);
      }, delay);
    },
    [retryDelay],
  );

  // Helper to handle fallback data
  const useFallbackData = useCallback(() => {
    if (fallbackData !== undefined && fallbackData !== null && mountedRef.current && !data) {
      setData(fallbackData);
      setLastUpdated(new Date());
      setError(null);

      // Cache fallback data with shorter TTL (1 minute)
      cache.set(key, {
        data: fallbackData,
        timestamp: Date.now(),
      });

      return true;
    }
    return false;
  }, [key, fallbackData, data]);

  const fetchWithFallback = useCallback(
    async (attemptCount = 0): Promise<void> => {
      if (!enabled || !mountedRef.current) {
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Check cache first
        if (useCachedData()) {
          setIsLoading(false);
          return;
        }

        // Try to fetch from API
        const result = await fetcher();
        handleFetchSuccess(result);
      } catch (apiError) {
        // Retry if attempts remain
        if (attemptCount < retryCount) {
          scheduleRetry(attemptCount, fetchWithFallback);
          return;
        }

        // Use fallback data or set error
        if (!useFallbackData() && mountedRef.current && attemptCount === retryCount) {
          setError(apiError as Error);
          notifyApiError(apiError, `loading ${key.replace("-", " ")}`);
        }
      } finally {
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [
      key,
      fetcher,
      enabled,
      retryCount,
      notifyApiError,
      useCachedData,
      handleFetchSuccess,
      scheduleRetry,
      useFallbackData,
    ],
  );

  const refetch = useCallback(async () => {
    // Clear cache for this key to force fresh fetch
    cache.delete(key);
    await fetchWithFallback();
  }, [key, fetchWithFallback]);

  useEffect(() => {
    mountedRef.current = true;
    fetchWithFallback();

    return () => {
      mountedRef.current = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [fetchWithFallback]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    refetch,
    lastUpdated,
  };
}

// Specialized hooks for different data types
export function useCustomerDashboard() {
  return useApiData("customer-dashboard", async () => {
    const client = getApiClient();
    const response = await client.getCustomerDashboard();
    return response.data;
  });
}

export function useCustomerServices() {
  return useApiData("customer-services", async () => {
    const client = getApiClient();
    const response = await client.getCustomerServices();
    return response.data;
  });
}

export function useCustomerBilling() {
  return useApiData("customer-billing", async () => {
    const client = getApiClient();
    const response = await client.getCustomerBilling();
    return response.data;
  });
}

export function useCustomerUsage(period?: string) {
  return useApiData(`customer-usage-${period || "30d"}`, async () => {
    const client = getApiClient();
    const response = await client.getCustomerUsage(period);
    return response.data;
  });
}

export function useCustomerDocuments() {
  return useApiData("customer-documents", async () => {
    const client = getApiClient();
    const response = await client.getCustomerDocuments();
    return response.data;
  });
}

export function useCustomerSupportTickets() {
  return useApiData("customer-support-tickets", async () => {
    const client = getApiClient();
    const response = await client.getCustomerSupportTickets();
    return response.data;
  });
}
