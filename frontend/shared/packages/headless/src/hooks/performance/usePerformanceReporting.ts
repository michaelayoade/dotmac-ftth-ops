/**
 * Performance Reporting Hook
 * Handles metric reporting and data transmission
 */

import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";

import { reportMetrics } from "./reportingUtils";
import type { PerformanceMetrics, PerformanceObserverConfig } from "./types";

export function usePerformanceReporting(
  metrics: MutableRefObject<PerformanceMetrics>,
  config: PerformanceObserverConfig,
) {
  const reportingTimerRef = useRef<NodeJS.Timeout>();

  // Setup automatic reporting interval
  useEffect(() => {
    if (config.reportingInterval && config.reportingInterval > 0) {
      reportingTimerRef.current = setInterval(() => {
        reportMetrics(metrics.current, config);
      }, config.reportingInterval);

      return () => {
        if (reportingTimerRef.current) {
          clearInterval(reportingTimerRef.current);
        }
      };
    }
    return undefined;
  }, [config, metrics]);

  const reportNow = useCallback(() => {
    reportMetrics(metrics.current, config);
  }, [config, metrics]);

  const getMetrics = useCallback(() => {
    return { ...metrics.current };
  }, [metrics]);

  return {
    reportNow,
    getMetrics,
  };
}
