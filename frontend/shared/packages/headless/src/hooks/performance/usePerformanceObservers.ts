/**
 * Performance Observers Hook
 * Handles setup and management of performance observers
 */

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type { PerformanceMetrics, PerformanceObserverConfig } from "./types";

export function usePerformanceObservers(
  metrics: MutableRefObject<PerformanceMetrics>,
  config: PerformanceObserverConfig,
) {
  const observersRef = useRef<PerformanceObserver[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !("PerformanceObserver" in window)) {
      return;
    }

    const observers: PerformanceObserver[] = [];

    // Core Web Vitals Observer
    if (config.enableCoreWebVitals) {
      try {
        const coreWebVitalsObserver = createCoreWebVitalsObserver(metrics.current);
        observers.push(coreWebVitalsObserver);
      } catch (error) {
        if (config.enableConsoleLogging) {
          console.warn("Failed to create Core Web Vitals observer:", error);
        }
      }
    }

    // Resource Timing Observer
    if (config.enableResourceTiming) {
      try {
        const resourceObserver = createResourceObserver(metrics.current);
        observers.push(resourceObserver);
      } catch (error) {
        if (config.enableConsoleLogging) {
          console.warn("Failed to create Resource Timing observer:", error);
        }
      }
    }

    // Navigation Timing Observer
    if (config.enableNavigationTiming) {
      try {
        const navigationObserver = createNavigationObserver(metrics.current);
        observers.push(navigationObserver);
      } catch (error) {
        if (config.enableConsoleLogging) {
          console.warn("Failed to create Navigation Timing observer:", error);
        }
      }
    }

    observersRef.current = observers;

    return () => {
      observers.forEach((observer) => observer.disconnect());
      observersRef.current = [];
    };
  }, [config, metrics]);

  return observersRef;
}

function createCoreWebVitalsObserver(metrics: PerformanceMetrics): PerformanceObserver {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      processPerformanceEntry(entry, metrics);
    }
  });

  const entryTypes = [
    "paint",
    "largest-contentful-paint",
    "first-input",
    "layout-shift",
    "navigation",
  ];
  entryTypes.forEach((type) => {
    try {
      observer.observe({ entryTypes: [type] });
    } catch {
      // Silently ignore unsupported observer types
    }
  });

  return observer;
}

function createResourceObserver(metrics: PerformanceMetrics): PerformanceObserver {
  const observer = new PerformanceObserver((list) => {
    const resourceEntries = list.getEntries() as PerformanceResourceTiming[];
    metrics.resourceCount = (metrics.resourceCount || 0) + resourceEntries.length;

    const totalSize = resourceEntries.reduce((sum, entry) => sum + (entry.transferSize || 0), 0);
    metrics.totalResourceSize = (metrics.totalResourceSize || 0) + totalSize;
  });

  observer.observe({ entryTypes: ["resource"] });
  return observer;
}

function createNavigationObserver(metrics: PerformanceMetrics): PerformanceObserver {
  const observer = new PerformanceObserver((list) => {
    const navEntries = list.getEntries() as PerformanceNavigationTiming[];
    for (const entry of navEntries) {
      const start = entry.startTime;
      metrics.navigationStart = start;
      metrics.domContentLoaded = entry.domContentLoadedEventEnd - start;
      metrics.loadComplete = entry.loadEventEnd - start;
    }
  });

  observer.observe({ entryTypes: ["navigation"] });
  return observer;
}

function processPerformanceEntry(entry: PerformanceEntry, metrics: PerformanceMetrics): void {
  switch (entry.entryType) {
    case "paint":
      if (entry.name === "first-contentful-paint") {
        metrics.fcp = entry.startTime;
      }
      break;
    case "largest-contentful-paint":
      metrics.lcp = entry.startTime;
      break;
    case "first-input":
      metrics.fid = (entry as any).processingStart - entry.startTime;
      break;
    case "layout-shift":
      if (!(entry as any).hadRecentInput) {
        metrics.cls = (metrics.cls || 0) + (entry as any).value;
      }
      break;
    case "navigation": {
      const navEntry = entry as PerformanceNavigationTiming;
      metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
      break;
    }
  }
}
