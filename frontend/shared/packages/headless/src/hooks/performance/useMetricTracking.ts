/**
 * Metric Tracking Hook
 * Handles custom metrics and tracking functionality
 */

import { useCallback } from "react";
import type { PerformanceMetrics, PerformanceObserverConfig } from "./types";

export function useMetricTracking(
  metrics: React.MutableRefObject<PerformanceMetrics>,
  config: PerformanceObserverConfig,
) {
  const trackCustomMetric = useCallback(
    (name: string, value: number) => {
      if (!config.enableCustomMetrics) {
        return;
      }

      metrics.current.customMetrics[name] = value;
      if (config.enableConsoleLogging) {
        console.log(`📊 Custom metric tracked: ${name} = ${value}`);
      }
    },
    [config.enableCustomMetrics, config.enableConsoleLogging, metrics],
  );

  const trackInteraction = useCallback(
    (interactionName: string, startTime?: number) => {
      const endTime = performance.now();
      const duration = startTime ? endTime - startTime : endTime;
      trackCustomMetric(`interaction_${interactionName}`, duration);
    },
    [trackCustomMetric],
  );

  const trackApiCall = useCallback(
    (endpoint: string, duration: number, success: boolean) => {
      const cleanEndpoint = endpoint.replace(/[^a-zA-Z0-9]/g, "_");
      trackCustomMetric(`api_${cleanEndpoint}_duration`, duration);
      trackCustomMetric(`api_${cleanEndpoint}_success`, success ? 1 : 0);
    },
    [trackCustomMetric],
  );

  const trackComponentRender = useCallback(
    (componentName: string, renderTime: number) => {
      trackCustomMetric(`component_${componentName}_render`, renderTime);
    },
    [trackCustomMetric],
  );

  return {
    trackCustomMetric,
    trackInteraction,
    trackApiCall,
    trackComponentRender,
  };
}
