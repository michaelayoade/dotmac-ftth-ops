/**
 * Performance Optimization Utilities
 * Tools for React performance optimization, memoization, and rendering efficiency
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";

// Performance monitoring types
export interface PerformanceMetrics {
  renderTime: number;
  componentName: string;
  timestamp: number;
  renderCount: number;
  propsChanges: number;
}

export interface RenderProfile {
  component: string;
  totalRenders: number;
  avgRenderTime: number;
  maxRenderTime: number;
  minRenderTime: number;
  lastRender: number;
  propsHistory: any[];
}

// Global performance tracking
const performanceProfiles = new Map<string, RenderProfile>();
const renderMetrics: PerformanceMetrics[] = [];

// Performance monitoring hook
export const useRenderProfiler = (componentName: string, props?: any) => {
  const renderCount = useRef(0);
  const lastProps = useRef(props);
  const renderStart = useRef(0);

  // Track render start
  renderStart.current = performance.now();

  useEffect(() => {
    const renderEnd = performance.now();
    const renderTime = renderEnd - renderStart.current;
    renderCount.current += 1;

    // Calculate props changes
    const propsChanges =
      props && lastProps.current
        ? Object.keys(props).reduce((changes, key) => {
            return props[key] !== lastProps.current[key] ? changes + 1 : changes;
          }, 0)
        : 0;

    // Record metrics
    const metric: PerformanceMetrics = {
      renderTime,
      componentName,
      timestamp: renderEnd,
      renderCount: renderCount.current,
      propsChanges,
    };

    renderMetrics.push(metric);

    // Update profile
    const existing = performanceProfiles.get(componentName);
    const profile: RenderProfile = {
      component: componentName,
      totalRenders: renderCount.current,
      avgRenderTime: existing
        ? (existing.avgRenderTime * (existing.totalRenders - 1) + renderTime) / renderCount.current
        : renderTime,
      maxRenderTime: existing ? Math.max(existing.maxRenderTime, renderTime) : renderTime,
      minRenderTime: existing ? Math.min(existing.minRenderTime, renderTime) : renderTime,
      lastRender: renderEnd,
      propsHistory: existing ? [...existing.propsHistory.slice(-9), props] : [props],
    };

    performanceProfiles.set(componentName, profile);
    lastProps.current = props;

    // Clean up old metrics (keep last 1000)
    if (renderMetrics.length > 1000) {
      renderMetrics.splice(0, renderMetrics.length - 1000);
    }
  });

  return {
    renderCount: renderCount.current,
    getProfile: () => performanceProfiles.get(componentName),
    getAllProfiles: () => Array.from(performanceProfiles.values()),
    getRecentMetrics: () => renderMetrics.slice(-10),
  };
};

// Memoization helpers
export const createMemoizedSelector = <T, R>(
  selector: (data: T) => R,
  dependencies: (data: T) => any[] = () => [],
) => {
  let lastDeps: any[] = [];
  let lastResult: R;
  let lastData: T;

  return (data: T): R => {
    const currentDeps = dependencies(data);

    if (
      data !== lastData ||
      currentDeps.length !== lastDeps.length ||
      currentDeps.some((dep, index) => dep !== lastDeps[index])
    ) {
      lastResult = selector(data);
      lastDeps = currentDeps;
      lastData = data;
    }

    return lastResult;
  };
};

// Deep comparison for complex objects
export const useDeepMemo = <T>(factory: () => T, deps: any[]): T => {
  const ref = useRef<{ value: T; deps: any[] }>();

  const deepEqual = (a: any[], b: any[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((val, index) => {
      if (typeof val === "object" && val !== null) {
        return JSON.stringify(val) === JSON.stringify(b[index]);
      }
      return val === b[index];
    });
  };

  if (!ref.current || !deepEqual(deps, ref.current.deps)) {
    ref.current = {
      value: factory(),
      deps: [...deps],
    };
  }

  return ref.current.value;
};

// Throttled state updates
export const useThrottledState = <T>(
  initialValue: T,
  delay: number = 100,
): [T, (value: T) => void, T] => {
  const [state, setState] = useState<T>(initialValue);
  const [throttledState, setThrottledState] = useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setThrottledValue = useCallback(
    (value: T) => {
      setState(value);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setThrottledState(value);
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setThrottledValue, throttledState];
};

// Debounced state updates
export const useDebouncedState = <T>(
  initialValue: T,
  delay: number = 300,
): [T, (value: T) => void, T] => {
  const [state, setState] = useState<T>(initialValue);
  const [debouncedState, setDebouncedState] = useState<T>(initialValue);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const setDebouncedValue = useCallback(
    (value: T) => {
      setState(value);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDebouncedState(value);
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, setDebouncedValue, debouncedState];
};

// Lazy loading hook
export const useLazyComponent = <T extends React.ComponentType<any>>(
  importFunction: () => Promise<{ default: T }>,
  fallback?: React.ComponentType,
) => {
  const [Component, setComponent] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadComponent = useCallback(async () => {
    if (Component || loading) return;

    setLoading(true);
    setError(null);

    try {
      const module = await importFunction();
      setComponent(() => module.default);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load component"));
    } finally {
      setLoading(false);
    }
  }, [Component, loading, importFunction]);

  return {
    Component: Component || fallback || null,
    loading,
    error,
    loadComponent,
  };
};

// Virtual scrolling hook for large datasets
export const useVirtualizedList = <T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 5,
}: {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}) => {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const visibleStart = Math.floor(scrollTop / itemHeight);
    const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

    const start = Math.max(0, visibleStart - overscan);
    const end = Math.min(items.length, visibleEnd + overscan);

    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end).map((item, index) => ({
      item,
      index: visibleRange.start + index,
      style: {
        position: "absolute" as const,
        top: (visibleRange.start + index) * itemHeight,
        height: itemHeight,
      },
    }));
  }, [items, visibleRange, itemHeight]);

  const totalHeight = items.length * itemHeight;

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight,
    handleScroll,
    scrollTop,
  };
};

// Bundle size analyzer
export const analyzeBundleImpact = (componentName: string, size: number) => {
  const impact = {
    component: componentName,
    size,
    percentage: 0,
    recommendation: "",
  };

  // Calculate recommendations based on size
  if (size > 100000) {
    // > 100KB
    impact.recommendation = "Consider code splitting - component is large";
  } else if (size > 50000) {
    // > 50KB
    impact.recommendation = "Monitor size - consider lazy loading";
  } else if (size > 25000) {
    // > 25KB
    impact.recommendation = "Good size - check for unused dependencies";
  } else {
    impact.recommendation = "Optimal size for immediate loading";
  }

  return impact;
};

// Memory usage monitoring
export const useMemoryMonitor = (componentName: string) => {
  const [memoryUsage, setMemoryUsage] = useState<{
    used: number;
    total: number;
    percentage: number;
  } | null>(null);

  useEffect(() => {
    const checkMemory = () => {
      if ("memory" in performance) {
        const memory = (performance as any).memory;
        const used = memory.usedJSHeapSize;
        const total = memory.totalJSHeapSize;
        const percentage = (used / total) * 100;

        setMemoryUsage({ used, total, percentage });

        // Warn if memory usage is high
        if (percentage > 80) {
          console.warn(`${componentName}: High memory usage (${percentage.toFixed(1)}%)`);
        }
      }
    };

    checkMemory();
    const interval = setInterval(checkMemory, 5000);

    return () => clearInterval(interval);
  }, [componentName]);

  return memoryUsage;
};

// Performance optimization recommendations
export const getPerformanceRecommendations = (profile: RenderProfile): string[] => {
  const recommendations: string[] = [];

  // High render frequency
  if (profile.totalRenders > 100 && profile.avgRenderTime > 16) {
    recommendations.push("Consider using React.memo() to prevent unnecessary re-renders");
  }

  // Slow render times
  if (profile.avgRenderTime > 50) {
    recommendations.push("Optimize expensive calculations with useMemo()");
  }

  // Frequent props changes
  if (profile.propsHistory.length > 5) {
    const recentChanges = profile.propsHistory.slice(-5);
    const changeFrequency = recentChanges.length / 5;
    if (changeFrequency > 0.8) {
      recommendations.push("Stabilize props with useCallback() to reduce re-renders");
    }
  }

  // Large render time variance
  const variance = profile.maxRenderTime - profile.minRenderTime;
  if (variance > 100) {
    recommendations.push("Inconsistent render times - check for conditional heavy operations");
  }

  return recommendations;
};

// Performance reporting
export const generatePerformanceReport = (): {
  summary: {
    totalComponents: number;
    avgRenderTime: number;
    slowestComponent: string;
    fastestComponent: string;
    totalRenders: number;
  };
  components: RenderProfile[];
  recommendations: { component: string; suggestions: string[] }[];
} => {
  const profiles = Array.from(performanceProfiles.values());

  if (profiles.length === 0) {
    return {
      summary: {
        totalComponents: 0,
        avgRenderTime: 0,
        slowestComponent: "",
        fastestComponent: "",
        totalRenders: 0,
      },
      components: [],
      recommendations: [],
    };
  }

  const avgRenderTime = profiles.reduce((sum, p) => sum + p.avgRenderTime, 0) / profiles.length;
  const slowest = profiles.reduce((prev, curr) =>
    curr.avgRenderTime > prev.avgRenderTime ? curr : prev,
  );
  const fastest = profiles.reduce((prev, curr) =>
    curr.avgRenderTime < prev.avgRenderTime ? curr : prev,
  );
  const totalRenders = profiles.reduce((sum, p) => sum + p.totalRenders, 0);

  const recommendations = profiles
    .map((profile) => ({
      component: profile.component,
      suggestions: getPerformanceRecommendations(profile),
    }))
    .filter((r) => r.suggestions.length > 0);

  return {
    summary: {
      totalComponents: profiles.length,
      avgRenderTime,
      slowestComponent: slowest.component,
      fastestComponent: fastest.component,
      totalRenders,
    },
    components: profiles,
    recommendations,
  };
};

// Export performance data for analysis
export const exportPerformanceData = () => {
  const report = generatePerformanceReport();
  const data = {
    timestamp: new Date().toISOString(),
    report,
    metrics: renderMetrics.slice(-100), // Last 100 renders
  };

  return JSON.stringify(data, null, 2);
};
