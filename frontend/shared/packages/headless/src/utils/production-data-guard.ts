/**
 * Production Data Guard - Prevents Mock Data in Production
 *
 * This utility ensures that mock data is never included in production builds
 * while allowing it to be used safely in development and testing environments.
 *
 * Features:
 * - Compile-time removal of mock data in production builds
 * - Runtime warnings for development
 * - Type-safe mock data handling
 * - Configurable fallback behavior
 */

// Remove React dependency for now to fix build issues
// import React from 'react';

// Development flag - will be replaced by bundler in production
declare const __DEV__: boolean;

export interface MockDataConfig {
  enableInTest?: boolean;
  enableInDevelopment?: boolean;
  fallbackToEmpty?: boolean;
  warningMessage?: string;
}

export interface MockDataGuard {
  isDevelopment: boolean;
  isTest: boolean;
  isProduction: boolean;
  shouldUseMockData: boolean;
}

/**
 * Create a mock data guard with environment detection
 */
export function createMockDataGuard(config?: MockDataConfig): MockDataGuard {
  const isDevelopment = process.env["NODE_ENV"] === "development";
  const isTest = process.env["NODE_ENV"] === "test";
  const isProduction = process.env["NODE_ENV"] === "production";

  const shouldUseMockData =
    (isDevelopment && (config?.enableInDevelopment ?? true)) ||
    (isTest && (config?.enableInTest ?? true));

  return {
    isDevelopment,
    isTest,
    isProduction,
    shouldUseMockData,
  };
}

/**
 * Conditionally return mock data based on environment
 */
export function mockData<T>(
  mockValue: T,
  productionFallback?: T,
  config?: MockDataConfig,
): T | undefined {
  const guard = createMockDataGuard(config);

  if (guard.shouldUseMockData) {
    // In development/test, show warning if configured
    if (guard.isDevelopment && config?.warningMessage) {
      console.warn(`🔧 Mock Data Active: ${config.warningMessage}`);
    }
    return mockValue;
  }

  if (guard.isProduction) {
    // In production, never return mock data
    if (productionFallback !== undefined) {
      return productionFallback;
    }

    if (config?.fallbackToEmpty) {
      return (Array.isArray(mockValue) ? [] : {}) as T;
    }

    // Log error for production mock data attempts
    console.error("🚨 Attempted to use mock data in production environment");
    return undefined;
  }

  return productionFallback;
}

/**
 * Development-only function that gets completely removed in production
 */
export function devOnly<T>(fn: () => T): T | undefined {
  if (process.env["NODE_ENV"] === "development") {
    return fn();
  }
  return undefined;
}

/**
 * Test-only function that gets removed in production
 */
export function testOnly<T>(fn: () => T): T | undefined {
  if (process.env["NODE_ENV"] === "test") {
    return fn();
  }
  return undefined;
}

/**
 * Hook for React components to safely use mock data
 */
export function useMockData<T>(
  mockValue: T,
  productionFallback?: T,
  config?: MockDataConfig,
): T | undefined {
  // This will be tree-shaken in production builds
  if (process.env["NODE_ENV"] === "production") {
    return productionFallback;
  }

  return mockData(mockValue, productionFallback, config);
}

/**
 * Wrapper for API functions to use mock data in development
 */
export function mockApiWrapper<TArgs extends any[], TReturn>(
  realApiCall: (...args: TArgs) => Promise<TReturn>,
  mockData: TReturn | (() => TReturn),
  config?: MockDataConfig & { delay?: number },
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    const guard = createMockDataGuard(config);

    if (guard.shouldUseMockData) {
      // Simulate API delay in development
      const delay = config?.delay ?? 500;
      await new Promise((resolve) => setTimeout(resolve, delay));

      const result = typeof mockData === "function" ? (mockData as () => TReturn)() : mockData;

      if (guard.isDevelopment && config?.warningMessage) {
        console.warn(`🔧 Mock API Active: ${config.warningMessage}`);
      }

      return result;
    }

    // Use real API call in production
    return realApiCall(...args);
  };
}

/**
 * Conditional component rendering based on environment
 * (Disabled for now to avoid React dependency issues)
 */
/*
export function MockDataIndicator({ 
  children, 
  message = "Using mock data" 
}: { 
  children?: any;
  message?: string;
}): any | null {
  if (process.env["NODE_ENV"] !== 'development') {
    return null;
  }

  return null; // Simplified for now
}
*/

/**
 * Type-safe mock data generator
 */
export interface MockGenerator<T> {
  generate(): T;
  generateMany(count: number): T[];
  withOverrides(overrides: Partial<T>): MockGenerator<T>;
}

export function createMockGenerator<T>(
  factory: () => T,
  config?: MockDataConfig,
): MockGenerator<T> {
  return {
    generate(): T {
      const guard = createMockDataGuard(config);
      if (!guard.shouldUseMockData) {
        throw new Error("Mock data generation attempted in production environment");
      }
      return factory();
    },

    generateMany(count: number): T[] {
      return Array.from({ length: count }, () => this.generate());
    },

    withOverrides(overrides: Partial<T>): MockGenerator<T> {
      return createMockGenerator(
        () => ({
          ...factory(),
          ...overrides,
        }),
        config,
      );
    },
  };
}

/**
 * Environment-aware console logging
 */
export const safeConsole = {
  dev: (message: string, ...args: any[]): void => {
    if (process.env["NODE_ENV"] === "development") {
      console.log(`🔧 [DEV] ${message}`, ...args);
    }
  },

  test: (message: string, ...args: any[]): void => {
    if (process.env["NODE_ENV"] === "test") {
      console.log(`🧪 [TEST] ${message}`, ...args);
    }
  },

  warn: (message: string, ...args: any[]): void => {
    if (process.env["NODE_ENV"] !== "production") {
      console.warn(`⚠️ ${message}`, ...args);
    }
  },

  error: (message: string, ...args: any[]): void => {
    console.error(`🚨 ${message}`, ...args);
  },
};

// Export default guard instance
export const defaultMockGuard = createMockDataGuard();
