/**
 * Payment Data Caching Hook
 * Manages caching for payment-related data
 */

import { useState, useCallback } from "react";

interface CacheEntry {
  data: any;
  timestamp: number;
}

export interface UsePaymentCacheConfig {
  defaultDuration?: number;
}

export interface UsePaymentCacheReturn {
  getCachedData: (key: string) => any | null;
  setCachedData: (key: string, data: any, duration?: number) => void;
  clearCache: (key?: string) => void;
  isCacheExpired: (key: string) => boolean;
}

export function usePaymentCache(config: UsePaymentCacheConfig = {}): UsePaymentCacheReturn {
  const { defaultDuration = 300000 } = config; // 5 minutes default
  const [cache, setCache] = useState<Map<string, CacheEntry>>(new Map());

  const getCachedData = useCallback(
    (key: string) => {
      const cached = cache.get(key);
      if (!cached) return null;

      if (Date.now() - cached.timestamp > defaultDuration) {
        // Remove expired entry
        setCache((prev) => {
          const newCache = new Map(prev);
          newCache.delete(key);
          return newCache;
        });
        return null;
      }

      return cached.data;
    },
    [cache, defaultDuration],
  );

  const setCachedData = useCallback((key: string, data: any, duration?: number) => {
    setCache(
      (prev) =>
        new Map(
          prev.set(key, {
            data,
            timestamp: Date.now() - (duration ? Date.now() + duration : 0),
          }),
        ),
    );
  }, []);

  const clearCache = useCallback((key?: string) => {
    if (key) {
      setCache((prev) => {
        const newCache = new Map(prev);
        newCache.delete(key);
        return newCache;
      });
    } else {
      setCache(new Map());
    }
  }, []);

  const isCacheExpired = useCallback(
    (key: string) => {
      const cached = cache.get(key);
      if (!cached) return true;
      return Date.now() - cached.timestamp > defaultDuration;
    },
    [cache, defaultDuration],
  );

  return {
    getCachedData,
    setCachedData,
    clearCache,
    isCacheExpired,
  };
}
