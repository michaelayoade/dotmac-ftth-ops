/**
 * Performance Monitoring Types
 */

export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte

  // Custom metrics
  customMetrics: Record<string, number>;

  // Navigation timing
  navigationStart?: number;
  domContentLoaded?: number;
  loadComplete?: number;

  // Resource timing
  resourceCount?: number;
  totalResourceSize?: number;
}

export interface PerformanceObserverConfig {
  enableCoreWebVitals?: boolean;
  enableResourceTiming?: boolean;
  enableNavigationTiming?: boolean;
  enableCustomMetrics?: boolean;
  reportingEndpoint?: string;
  reportingInterval?: number;
  enableConsoleLogging?: boolean;
}
