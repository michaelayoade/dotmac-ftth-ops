/**
 * API Response Cache
 * Handles caching of API responses with TTL and invalidation
 */

import type { CacheEntry } from "./types";

export class ApiCache {
  private cache = new Map<string, CacheEntry>();
  private defaultTTL: number;
  private maxSize: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(defaultTTL: number = 5 * 60 * 1000, maxSize: number = 1000) {
    this.defaultTTL = defaultTTL;
    this.maxSize = maxSize;
    this.startCleanup();
  }

  // Generate cache key
  private generateKey(url: string, method: string = "GET", params?: any): string {
    const paramsStr = params ? JSON.stringify(params) : "";
    return `${method}:${url}:${btoa(paramsStr).slice(0, 16)}`;
  }

  // Check if entry is expired
  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.timestamp + entry.ttl;
  }

  // Get cached response
  get<T = any>(url: string, method?: string, params?: any): T | null {
    const key = this.generateKey(url, method, params);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  // Set cached response
  set<T = any>(url: string, data: T, method?: string, params?: any, ttl?: number): void {
    // Don't cache if data is null/undefined or cache is at capacity
    if (data == null) return;

    // If at capacity, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.generateKey(url, method, params);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
      key,
    };

    this.cache.set(key, entry);
  }

  // Check if response is cached and valid
  has(url: string, method?: string, params?: any): boolean {
    const key = this.generateKey(url, method, params);
    const entry = this.cache.get(key);

    if (!entry) return false;

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Invalidate specific cache entry
  invalidate(url: string, method?: string, params?: any): void {
    const key = this.generateKey(url, method, params);
    this.cache.delete(key);
  }

  // Invalidate all entries matching pattern
  invalidatePattern(pattern: string | RegExp): number {
    let deleted = 0;
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    for (const [key, entry] of this.cache.entries()) {
      if (regex.test(entry.key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  // Invalidate all entries for a specific endpoint
  invalidateEndpoint(endpoint: string): number {
    return this.invalidatePattern(
      new RegExp(`GET:${endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }

  // Get cache statistics
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.values()).map((entry) => ({
      key: entry.key,
      age: now - entry.timestamp,
      ttl: entry.ttl,
    }));

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need hit/miss tracking
      entries,
    };
  }

  // Cleanup expired entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.debug(`API Cache: Cleaned ${cleaned} expired entries`);
    }
  }

  // Start automatic cleanup
  private startCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // Clean every minute
  }

  // Stop automatic cleanup
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Destroy cache
  destroy(): void {
    this.stopCleanup();
    this.clear();
  }

  // Get cache keys matching pattern
  getKeys(pattern?: string | RegExp): string[] {
    if (!pattern) {
      return Array.from(this.cache.keys());
    }

    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;
    return Array.from(this.cache.entries())
      .filter(([, entry]) => regex.test(entry.key))
      .map(([key]) => key);
  }

  // Preload cache with data
  preload<T = any>(
    entries: Array<{
      url: string;
      method?: string;
      params?: any;
      data: T;
      ttl?: number;
    }>,
  ): void {
    entries.forEach(({ url, method, params, data, ttl }) => {
      this.set(url, data, method, params, ttl);
    });
  }

  // Export cache data for persistence
  export(): Record<string, CacheEntry> {
    return Object.fromEntries(this.cache);
  }

  // Import cache data from persistence
  import(data: Record<string, CacheEntry>): void {
    const now = Date.now();

    Object.entries(data).forEach(([key, entry]) => {
      // Only import non-expired entries
      if (now <= entry.timestamp + entry.ttl) {
        this.cache.set(key, entry);
      }
    });
  }
}
