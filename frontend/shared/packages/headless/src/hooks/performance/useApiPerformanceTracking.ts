/**
 * API Performance Tracking Hook
 */

import { useCallback } from "react";
import { usePerformanceMonitoring } from "./usePerformanceMonitoring";

export function useApiPerformanceTracking() {
  const { trackApiCall } = usePerformanceMonitoring();

  const trackApiRequest = useCallback(
    async <T>(endpoint: string, apiCall: () => Promise<T>): Promise<T> => {
      const startTime = performance.now();
      let success = false;

      try {
        const result = await apiCall();
        success = true;
        return result;
      } catch (error) {
        success = false;
        throw error;
      } finally {
        const duration = performance.now() - startTime;
        trackApiCall(endpoint, duration, success);
      }
    },
    [trackApiCall],
  );

  return { trackApiRequest };
}
