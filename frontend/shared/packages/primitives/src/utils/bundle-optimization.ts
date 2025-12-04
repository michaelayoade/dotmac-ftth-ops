/**
 * Bundle Optimization Utilities
 * Code splitting, tree shaking, and dynamic loading optimizations
 */

import React, { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";

// Bundle analysis utilities
export interface BundleAnalysis {
  totalSize: number;
  componentSizes: Map<string, number>;
  recommendations: string[];
  splitPoints: string[];
}

// Dynamic import wrapper with error handling and loading states
export const createDynamicImport = <T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  componentName: string,
  preloadCondition?: () => boolean,
): LazyExoticComponent<T> => {
  // Preload component if condition is met
  if (preloadCondition?.()) {
    importFunc().catch((error) => {
      console.warn(`Failed to preload component ${componentName}:`, error);
    });
  }

  return lazy(async () => {
    try {
      const startTime = performance.now();
      const module = await importFunc();
      const loadTime = performance.now() - startTime;

      // Log slow loading components
      if (loadTime > 100) {
        console.warn(`Slow component load: ${componentName} took ${loadTime.toFixed(2)}ms`);
      }

      return module;
    } catch (error) {
      console.error(`Failed to load component ${componentName}:`, error);

      // Return a fallback component
      const Fallback = React.forwardRef<any, any>((props, ref) =>
        React.createElement(
          "div",
          {
            className: "p-4 bg-red-50 border border-red-200 rounded",
            ref,
            ...props,
          },
          React.createElement(
            "p",
            { className: "text-red-800" },
            `Failed to load ${componentName}`,
          ),
        ),
      );

      return {
        default: Fallback as unknown as T,
      };
    }
  });
};

// Code splitting configurations for different component types
export const SplitPoints = {
  // Charts - Heavy recharts dependency
  CHARTS: {
    threshold: 50000, // 50KB
    priority: "high",
    preloadCondition: () => {
      // Preload if user is likely to need charts (SSR safe)
      if (typeof window === "undefined") return false;
      return window.innerWidth > 768 && "IntersectionObserver" in window;
    },
  },

  // Complex forms - Heavy validation libraries
  FORMS: {
    threshold: 30000, // 30KB
    priority: "medium",
    preloadCondition: () => {
      // Preload if forms are visible in viewport (SSR safe)
      if (typeof document === "undefined") return false;
      return document.querySelector("form") !== null;
    },
  },

  // Admin features - Only for admin users
  ADMIN: {
    threshold: 25000, // 25KB
    priority: "low",
    preloadCondition: () => {
      // Check if user has admin role (SSR safe)
      if (typeof localStorage === "undefined") return false;
      return localStorage.getItem("userRole") === "admin";
    },
  },

  // Animations - Optional enhancements
  ANIMATIONS: {
    threshold: 20000, // 20KB
    priority: "low",
    preloadCondition: () => {
      // Only load if user prefers animations (SSR safe)
      if (typeof window === "undefined") return false;
      return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    },
  },
} as const;

// Lazy loaded chart components with optimized splitting
export const LazyCharts = {
  RevenueChart: createDynamicImport(
    () =>
      import("../charts/OptimizedCharts").then((m) => ({
        default: m.OptimizedRevenueChart,
      })),
    "RevenueChart",
    SplitPoints.CHARTS.preloadCondition,
  ),

  NetworkUsageChart: createDynamicImport(
    () =>
      import("../charts/InteractiveChart").then((m) => ({
        default: m.NetworkUsageChart,
      })),
    "NetworkUsageChart",
    SplitPoints.CHARTS.preloadCondition,
  ),

  ServiceStatusChart: createDynamicImport(
    () =>
      import("../charts/InteractiveChart").then((m) => ({
        default: m.ServiceStatusChart,
      })),
    "ServiceStatusChart",
    SplitPoints.CHARTS.preloadCondition,
  ),

  BandwidthChart: createDynamicImport(
    () =>
      import("../charts/InteractiveChart").then((m) => ({
        default: m.BandwidthChart,
      })),
    "BandwidthChart",
    SplitPoints.CHARTS.preloadCondition,
  ),
};

// Lazy loaded status indicators with optimization
export const LazyStatusIndicators = {
  StatusBadge: createDynamicImport(
    () =>
      import("../indicators/OptimizedStatusIndicators").then((m) => ({
        default: m.OptimizedStatusBadge,
      })),
    "StatusBadge",
  ),

  UptimeIndicator: createDynamicImport(
    () =>
      import("../indicators/OptimizedStatusIndicators").then((m) => ({
        default: m.OptimizedUptimeIndicator,
      })),
    "UptimeIndicator",
  ),

  NetworkPerformanceIndicator: createDynamicImport(
    () =>
      import("../indicators/StatusIndicators").then((m) => ({
        default: m.NetworkPerformanceIndicator,
      })),
    "NetworkPerformanceIndicator",
  ),
};

// Tree shaking helpers - ensure only used utilities are bundled
export const TreeShakableUtils = {
  // Only import specific accessibility functions when needed
  a11y: {
    announceToScreenReader: () => import("../utils/a11y").then((m) => m.announceToScreenReader),
    generateChartDescription: () => import("../utils/a11y").then((m) => m.generateChartDescription),
    useKeyboardNavigation: () => import("../utils/a11y").then((m) => m.useKeyboardNavigation),
  },

  // Only import specific security functions when needed
  security: {
    sanitizeText: () => import("../utils/security").then((m) => m.sanitizeText),
    validateData: () => import("../utils/security").then((m) => m.validateData),
    validateArray: () => import("../utils/security").then((m) => m.validateArray),
  },

  // Only import specific performance functions when needed
  performance: {
    useRenderProfiler: () => import("../utils/performance").then((m) => m.useRenderProfiler),
    useThrottledState: () => import("../utils/performance").then((m) => m.useThrottledState),
    useDebouncedState: () => import("../utils/performance").then((m) => m.useDebouncedState),
  },
};

// Bundle size analyzer
export const analyzeBundleSize = async (): Promise<BundleAnalysis> => {
  const analysis: BundleAnalysis = {
    totalSize: 0,
    componentSizes: new Map(),
    recommendations: [],
    splitPoints: [],
  };

  try {
    // Analyze component sizes (mock implementation - would integrate with webpack-bundle-analyzer)
    const components = [
      { name: "Charts", size: 85000, category: "heavy" },
      { name: "StatusIndicators", size: 25000, category: "medium" },
      { name: "ErrorBoundary", size: 8000, category: "light" },
      { name: "Accessibility", size: 15000, category: "medium" },
      { name: "Security", size: 12000, category: "medium" },
      { name: "Performance", size: 18000, category: "medium" },
    ];

    components.forEach((component) => {
      analysis.totalSize += component.size;
      analysis.componentSizes.set(component.name, component.size);

      // Generate recommendations
      if (component.size > SplitPoints.CHARTS.threshold) {
        analysis.recommendations.push(
          `Consider code splitting for ${component.name} (${(component.size / 1000).toFixed(1)}KB)`,
        );
        analysis.splitPoints.push(component.name);
      } else if (component.size > 20000) {
        analysis.recommendations.push(
          `Monitor bundle size for ${component.name} (${(component.size / 1000).toFixed(1)}KB)`,
        );
      }
    });

    // Overall bundle recommendations
    if (analysis.totalSize > 200000) {
      analysis.recommendations.push(
        "Bundle size exceeds 200KB - implement aggressive code splitting",
      );
    } else if (analysis.totalSize > 100000) {
      analysis.recommendations.push(
        "Bundle size is large - consider lazy loading non-critical components",
      );
    }
  } catch (error) {
    console.error("Bundle analysis failed:", error);
    analysis.recommendations.push("Bundle analysis failed - manual inspection recommended");
  }

  return analysis;
};

// Preloading strategies based on user interaction patterns
export const PreloadingStrategies = {
  // Preload on hover with delay
  onHover: (importFunc: () => Promise<any>, delay = 200) => {
    let timeoutId: NodeJS.Timeout;

    return {
      onMouseEnter: () => {
        timeoutId = setTimeout(() => {
          importFunc().catch(console.error);
        }, delay);
      },
      onMouseLeave: () => {
        if (timeoutId) clearTimeout(timeoutId);
      },
    };
  },

  // Preload when component enters viewport
  onVisible: (importFunc: () => Promise<any>, rootMargin = "100px") => {
    return {
      ref: (element: HTMLElement | null) => {
        if (!element || typeof window === "undefined" || !("IntersectionObserver" in window))
          return;

        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                importFunc().catch(console.error);
                observer.unobserve(entry.target);
              }
            });
          },
          { rootMargin },
        );

        observer.observe(element);
      },
    };
  },

  // Preload during idle time
  onIdle: (importFunc: () => Promise<any>) => {
    if (typeof window === "undefined") return;

    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => {
        importFunc().catch(console.error);
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        importFunc().catch(console.error);
      }, 1);
    }
  },

  // Preload based on user intent (mouse movement towards element)
  onIntent: (importFunc: () => Promise<any>) => {
    let isMovingTowards = false;

    return {
      onMouseMove: (event: MouseEvent, targetElement: HTMLElement) => {
        const rect = targetElement.getBoundingClientRect();
        const isInDirection =
          event.clientX >= rect.left - 50 &&
          event.clientX <= rect.right + 50 &&
          event.clientY >= rect.top - 50 &&
          event.clientY <= rect.bottom + 50;

        if (isInDirection && !isMovingTowards) {
          isMovingTowards = true;
          importFunc().catch(console.error);
        }
      },
    };
  },
};

// Resource hints for browser optimization
export const addResourceHints = () => {
  if (typeof document === "undefined") return;

  const head = document.head;

  // Preload critical CSS
  const preloadCSS = document.createElement("link");
  preloadCSS.rel = "preload";
  preloadCSS.href = "/styles/accessibility.css";
  preloadCSS.as = "style";
  head.appendChild(preloadCSS);

  // DNS prefetch for external resources
  const dnsPrefetch = document.createElement("link");
  dnsPrefetch.rel = "dns-prefetch";
  dnsPrefetch.href = "//fonts.googleapis.com";
  head.appendChild(dnsPrefetch);

  // Preconnect for critical third-party resources
  const preconnect = document.createElement("link");
  preconnect.rel = "preconnect";
  preconnect.href = "https://api.example.com";
  head.appendChild(preconnect);
};

// Bundle splitting configuration for build tools
export const bundleSplitConfig = {
  // Vendor chunk for third-party libraries
  vendor: {
    name: "vendor",
    test: /[\\/]node_modules[\\/]/,
    priority: 10,
    chunks: "all",
  },

  // Common chunk for shared utilities
  common: {
    name: "common",
    minChunks: 2,
    priority: 5,
    chunks: "all",
    reuseExistingChunk: true,
  },

  // Chart components chunk
  charts: {
    name: "charts",
    test: /[\\/]src[\\/]charts[\\/]/,
    priority: 8,
    chunks: "all",
  },

  // Status indicators chunk
  indicators: {
    name: "indicators",
    test: /[\\/]src[\\/]indicators[\\/]/,
    priority: 7,
    chunks: "all",
  },
};

// Performance budget enforcement
export const PerformanceBudgets = {
  // Size budgets in bytes
  sizes: {
    initial: 100000, // 100KB initial bundle
    asyncChunks: 50000, // 50KB per async chunk
    assets: 500000, // 500KB total assets
  },

  // Performance metrics budgets
  metrics: {
    firstContentfulPaint: 1500, // 1.5s
    largestContentfulPaint: 2500, // 2.5s
    firstInputDelay: 100, // 100ms
    cumulativeLayoutShift: 0.1, // 0.1 CLS score
  },

  // Check if budgets are exceeded
  checkBudgets: (actualSizes: any, actualMetrics: any) => {
    const violations: string[] = [];

    // Check size budgets
    Object.entries(PerformanceBudgets.sizes).forEach(([key, budget]) => {
      if (actualSizes[key] > budget) {
        violations.push(`${key} size budget exceeded: ${actualSizes[key]} > ${budget}`);
      }
    });

    // Check performance budgets
    Object.entries(PerformanceBudgets.metrics).forEach(([key, budget]) => {
      if (actualMetrics[key] > budget) {
        violations.push(`${key} performance budget exceeded: ${actualMetrics[key]} > ${budget}`);
      }
    });

    return violations;
  },
};

// Export bundle optimization report
export const generateBundleReport = async () => {
  const analysis = await analyzeBundleSize();

  const report = {
    timestamp: new Date().toISOString(),
    analysis,
    recommendations: analysis.recommendations,
    splitPoints: analysis.splitPoints,
    optimizations: {
      lazyComponents: Object.keys(LazyCharts).concat(Object.keys(LazyStatusIndicators)),
      treeShakableUtilities: Object.keys(TreeShakableUtils),
      preloadingStrategies: Object.keys(PreloadingStrategies),
    },
    performanceBudgets: PerformanceBudgets.sizes,
  };

  return report;
};
