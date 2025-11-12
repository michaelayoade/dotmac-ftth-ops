/**
 * Refactored Performance Monitoring Hook
 * Main hook that orchestrates performance monitoring functionality
 */

import { useMemo, useRef } from "react";
import type { PerformanceMetrics, PerformanceObserverConfig } from "./types";
import { usePerformanceObservers } from "./usePerformanceObservers";
import { useMetricTracking } from "./useMetricTracking";
import { usePerformanceReporting } from "./usePerformanceReporting";

const defaultConfig: PerformanceObserverConfig = {
  enableCoreWebVitals: true,
  enableResourceTiming: true,
  enableNavigationTiming: true,
  enableCustomMetrics: true,
  reportingInterval: 30000, // 30 seconds
  enableConsoleLogging: process.env["NODE_ENV"] === "development",
};

export function usePerformanceMonitoring(config: PerformanceObserverConfig = {}) {
  const finalConfig = useMemo(() => ({ ...defaultConfig, ...config }), [config]);

  const metricsRef = useRef<PerformanceMetrics>({
    customMetrics: {},
  });

  // Set up performance observers
  usePerformanceObservers(metricsRef, finalConfig);

  // Set up metric tracking
  const metricTracking = useMetricTracking(metricsRef, finalConfig);

  // Set up reporting
  const reporting = usePerformanceReporting(metricsRef, finalConfig);

  return {
    ...metricTracking,
    ...reporting,
  };
}
