/**
 * Performance measurement and optimization utilities
 */
import { useEffect, useRef, useState } from "react";

export interface PerformanceMeasurement {
  name: string;
  duration: number;
  startTime: number;
  endTime: number;
  metadata?: Record<string, any>;
}

/**
 * Measure the performance of a function execution
 */
export function measurePerformance<T>(
  name: string,
  fn: () => T,
  metadata?: Record<string, any>,
): { result: T; measurement: PerformanceMeasurement } {
  const startTime = performance.now();
  const result = fn();
  const endTime = performance.now();

  const measurement: PerformanceMeasurement = {
    name,
    duration: endTime - startTime,
    startTime,
    endTime,
    ...(metadata !== undefined ? { metadata } : {}),
  };

  // Log to console in development
  if (process.env["NODE_ENV"] === "development") {
    console.log(`[Performance] ${name}: ${measurement.duration.toFixed(2)}ms`, measurement);
  }

  return { result, measurement };
}

/**
 * Measure async function performance
 */
export async function measureAsyncPerformance<T>(
  name: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>,
): Promise<{ result: T; measurement: PerformanceMeasurement }> {
  const startTime = performance.now();
  const result = await fn();
  const endTime = performance.now();

  const measurement: PerformanceMeasurement = {
    name,
    duration: endTime - startTime,
    startTime,
    endTime,
    ...(metadata !== undefined ? { metadata } : {}),
  };

  if (process.env["NODE_ENV"] === "development") {
    console.log(`[Performance] ${name}: ${measurement.duration.toFixed(2)}ms`, measurement);
  }

  return { result, measurement };
}

/**
 * Higher-order component for performance tracking
 */
export function withPerformanceTracking<P extends Record<string, any>>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string,
) {
  const displayName =
    componentName || WrappedComponent.displayName || WrappedComponent.name || "Component";

  const PerformanceTrackedComponent: React.FC<P> = (props) => {
    const renderStartTime = useRef<number>();
    const [measurements, setMeasurements] = useState<PerformanceMeasurement[]>([]);

    useEffect(() => {
      renderStartTime.current = performance.now();
    });

    useEffect(() => {
      if (renderStartTime.current) {
        const endTime = performance.now();
        const measurement: PerformanceMeasurement = {
          name: `${displayName} render`,
          duration: endTime - renderStartTime.current,
          startTime: renderStartTime.current,
          endTime,
          metadata: { props: Object.keys(props) },
        };

        setMeasurements((prev) => [...prev.slice(-9), measurement]); // Keep last 10 measurements

        if (process.env["NODE_ENV"] === "development" && measurement.duration > 16) {
          console.warn(
            `[Performance] Slow render detected for ${displayName}: ${measurement.duration.toFixed(2)}ms`,
          );
        }
      }
    });

    return React.createElement(WrappedComponent, props);
  };

  PerformanceTrackedComponent.displayName = `withPerformanceTracking(${displayName})`;
  return PerformanceTrackedComponent;
}

/**
 * Hook for collecting performance metrics
 */
export function usePerformanceMetrics(componentName: string) {
  const [metrics, setMetrics] = useState<{
    renderCount: number;
    averageRenderTime: number;
    slowRenders: number;
    lastRenderTime: number;
  }>({
    renderCount: 0,
    averageRenderTime: 0,
    slowRenders: 0,
    lastRenderTime: 0,
  });

  const renderStartTime = useRef<number>();
  const renderTimes = useRef<number[]>([]);

  useEffect(() => {
    renderStartTime.current = performance.now();
  });

  useEffect(() => {
    if (renderStartTime.current) {
      const renderTime = performance.now() - renderStartTime.current;
      renderTimes.current.push(renderTime);

      // Keep only last 50 render times
      if (renderTimes.current.length > 50) {
        renderTimes.current = renderTimes.current.slice(-50);
      }

      const averageRenderTime =
        renderTimes.current.reduce((sum, time) => sum + time, 0) / renderTimes.current.length;
      const slowRenders = renderTimes.current.filter((time) => time > 16).length;

      setMetrics({
        renderCount: renderTimes.current.length,
        averageRenderTime,
        slowRenders,
        lastRenderTime: renderTime,
      });

      if (process.env["NODE_ENV"] === "development") {
        if (renderTime > 16) {
          console.warn(`[Performance] Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
        }

        if (slowRenders > renderTimes.current.length * 0.2) {
          console.warn(
            `[Performance] High slow render ratio in ${componentName}: ${slowRenders}/${renderTimes.current.length}`,
          );
        }
      }
    }
  });

  return metrics;
}

/**
 * Bundle optimization utilities
 */
export const optimizeBundle = {
  /**
   * Lazy load a component with loading fallback
   */
  lazyLoad: <T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    fallback?: React.ComponentType,
  ) => {
    const LazyComponent = React.lazy(importFn);

    return (props: React.ComponentProps<T>) =>
      React.createElement(
        React.Suspense,
        {
          fallback: fallback
            ? React.createElement(fallback)
            : React.createElement("div", null, "Loading..."),
        },
        React.createElement(LazyComponent, props),
      );
  },

  /**
   * Preload a module for faster lazy loading
   */
  preload: async (importFn: () => Promise<any>) => {
    try {
      await importFn();
    } catch (error) {
      console.warn("[Performance] Failed to preload module:", error);
    }
  },

  /**
   * Create a resource hint for prefetching
   */
  prefetch: (href: string, as?: "script" | "style" | "image") => {
    if (typeof window === "undefined") return;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = href;
    if (as) link.as = as;

    document.head.appendChild(link);
  },

  /**
   * Create a resource hint for preloading
   */
  preloadResource: (href: string, as: "script" | "style" | "image" | "font", type?: string) => {
    if (typeof window === "undefined") return;

    const link = document.createElement("link");
    link.rel = "preload";
    link.href = href;
    link.as = as;
    if (type) link.type = type;

    // Add crossorigin for fonts
    if (as === "font") {
      link.crossOrigin = "anonymous";
    }

    document.head.appendChild(link);
  },
};

/**
 * Memory usage utilities
 */
export const memoryUtils = {
  /**
   * Get current memory usage if supported
   */
  getMemoryUsage: (): { used: number; total: number } | null => {
    const memory = (performance as any).memory;
    if (!memory) return null;

    return {
      used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
      total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
    };
  },

  /**
   * Monitor memory leaks by tracking object references
   */
  trackMemoryLeaks: (objectName: string, obj: any) => {
    if (process.env["NODE_ENV"] !== "development") return;

    const refs = new Set();
    const trackRef = (ref: any) => refs.add(ref);
    const untrackRef = (ref: any) => refs.delete(ref);

    // Weak reference tracking would be ideal here
    console.log(`[Memory] Tracking ${objectName} references:`, refs.size);

    return { trackRef, untrackRef, getRefCount: () => refs.size };
  },
};

/**
 * Network performance utilities
 */
export const networkUtils = {
  /**
   * Get connection information
   */
  getConnectionInfo: () => {
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    if (!connection) return null;

    return {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
      saveData: connection.saveData,
    };
  },

  /**
   * Measure request performance
   */
  measureRequest: async (
    url: string,
    options?: RequestInit,
  ): Promise<{
    response: Response;
    timing: {
      dns: number;
      connect: number;
      request: number;
      response: number;
      total: number;
    };
  }> => {
    const startTime = performance.now();

    // Use performance observer to get detailed timing
    const observer = new PerformanceObserver((list) => {
      const entry = list.getEntries().find((e) => e.name === url);
      if (entry && "domainLookupEnd" in entry && "connectEnd" in entry) {
        const resource = entry as PerformanceResourceTiming;
        console.log("[Network] Request timing:", {
          dns: resource.domainLookupEnd - resource.domainLookupStart,
          connect: resource.connectEnd - resource.connectStart,
          request: resource.requestStart - resource.connectEnd,
          response: resource.responseEnd - resource.requestStart,
          total: resource.responseEnd - resource.startTime,
        });
      }
    });

    observer.observe({ entryTypes: ["resource"] });

    const response = await fetch(url, options);
    const endTime = performance.now();

    observer.disconnect();

    return {
      response,
      timing: {
        dns: 0, // Would be populated by PerformanceResourceTiming
        connect: 0,
        request: 0,
        response: 0,
        total: endTime - startTime,
      },
    };
  },
};

// React import for lazy loading
import React from "react";
