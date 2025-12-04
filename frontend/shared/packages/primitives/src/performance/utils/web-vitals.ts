/**
 * Core Web Vitals measurement utilities
 * Based on the web-vitals library patterns
 */

export interface Metric {
  name: string;
  value: number;
  delta: number;
  id: string;
  isFinal: boolean;
}

export type ReportCallback = (metric: Metric) => void;

let supportsPerfNow = false;
let supportsPerformanceObserver = false;

// Feature detection
try {
  supportsPerfNow = typeof performance !== "undefined" && typeof performance.now === "function";
  supportsPerformanceObserver = typeof PerformanceObserver !== "undefined";
} catch (e) {
  // Ignore errors in environments where these APIs don't exist
}

/**
 * Generate a unique ID for each metric
 */
function generateUniqueID(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get the current timestamp
 */
function now(): number {
  return supportsPerfNow ? performance.now() : Date.now();
}

/**
 * Cumulative Layout Shift (CLS)
 * Measures visual stability
 */
export function getCLS(onReport: ReportCallback, reportAllChanges = false): void {
  if (!supportsPerformanceObserver) return;

  let clsValue = 0;
  let clsEntries: PerformanceEntry[] = [];
  let sessionValue = 0;
  let sessionEntries: PerformanceEntry[] = [];
  let reportedMetricIDs: { [key: string]: boolean } = {};

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const layoutShift = entry as any;

      // Only count layout shifts without recent user input
      if (!layoutShift.hadRecentInput) {
        const firstSessionEntry = sessionEntries[0];
        const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

        // If the entry occurred less than 1 second after the previous entry
        // and less than 5 seconds after the first entry in the session,
        // include the entry in the current session. Otherwise, start a new session.
        if (
          sessionValue &&
          firstSessionEntry &&
          lastSessionEntry &&
          entry.startTime - lastSessionEntry.startTime < 1000 &&
          entry.startTime - firstSessionEntry.startTime < 5000
        ) {
          sessionValue += layoutShift.value;
          sessionEntries.push(entry);
        } else {
          sessionValue = layoutShift.value;
          sessionEntries = [entry];
        }

        // If the current session value is larger than the current CLS value,
        // update CLS and the entries contributing to it.
        if (sessionValue > clsValue) {
          clsValue = sessionValue;
          clsEntries = [...sessionEntries];

          const id = generateUniqueID();
          const metric: Metric = {
            name: "CLS",
            value: clsValue,
            delta: clsValue,
            id,
            isFinal: false,
          };

          if (!reportedMetricIDs[id] && (clsValue > 0 || reportAllChanges)) {
            onReport(metric);
            reportedMetricIDs[id] = true;
          }
        }
      }
    }
  });

  try {
    observer.observe({ type: "layout-shift", buffered: true });
  } catch (e) {
    // Silently fail if layout-shift is not supported
  }

  // Report the final CLS value on page hide
  const reportFinal = () => {
    if (clsValue > 0) {
      const metric: Metric = {
        name: "CLS",
        value: clsValue,
        delta: clsValue,
        id: generateUniqueID(),
        isFinal: true,
      };
      onReport(metric);
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", reportFinal, { once: true });
    window.addEventListener("beforeunload", reportFinal, { once: true });
  }
}

/**
 * First Contentful Paint (FCP)
 * Measures when the first text or image is painted
 */
export function getFCP(onReport: ReportCallback): void {
  if (!supportsPerformanceObserver) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name === "first-contentful-paint") {
        const metric: Metric = {
          name: "FCP",
          value: entry.startTime,
          delta: entry.startTime,
          id: generateUniqueID(),
          isFinal: true,
        };
        onReport(metric);
        observer.disconnect();
        break;
      }
    }
  });

  try {
    observer.observe({ type: "paint", buffered: true });
  } catch (e) {
    // Paint timing not supported
  }
}

/**
 * First Input Delay (FID)
 * Measures interactivity
 */
export function getFID(onReport: ReportCallback): void {
  if (!supportsPerformanceObserver) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const firstInput = entry as any;
      const processingStart = firstInput.processingStart;
      const startTime = firstInput.startTime;

      if (processingStart && processingStart > startTime) {
        const metric: Metric = {
          name: "FID",
          value: processingStart - startTime,
          delta: processingStart - startTime,
          id: generateUniqueID(),
          isFinal: true,
        };
        onReport(metric);
        observer.disconnect();
        break;
      }
    }
  });

  try {
    observer.observe({ type: "first-input", buffered: true });
  } catch (e) {
    // First input timing not supported
  }
}

/**
 * Largest Contentful Paint (LCP)
 * Measures loading performance
 */
export function getLCP(onReport: ReportCallback, reportAllChanges = false): void {
  if (!supportsPerformanceObserver) return;

  let lcpValue = 0;
  let reportedMetricIDs: { [key: string]: boolean } = {};

  const observer = new PerformanceObserver((list) => {
    const lastEntry = list.getEntries().pop() as any;
    if (lastEntry) {
      lcpValue = lastEntry.startTime;
      const id = generateUniqueID();
      const metric: Metric = {
        name: "LCP",
        value: lcpValue,
        delta: lcpValue,
        id,
        isFinal: false,
      };

      if (!reportedMetricIDs[id] && (reportAllChanges || !reportedMetricIDs[metric.name])) {
        onReport(metric);
        reportedMetricIDs[id] = true;
      }
    }
  });

  try {
    observer.observe({ type: "largest-contentful-paint", buffered: true });
  } catch (e) {
    // LCP not supported
  }

  // Report the final LCP value on page hide or first user interaction
  const reportFinal = () => {
    if (lcpValue > 0) {
      const metric: Metric = {
        name: "LCP",
        value: lcpValue,
        delta: lcpValue,
        id: generateUniqueID(),
        isFinal: true,
      };
      onReport(metric);
    }
  };

  if (typeof window !== "undefined") {
    // LCP becomes final after first user interaction
    const handleInteraction = () => {
      reportFinal();
      observer.disconnect();
      ["keydown", "click", "touchstart"].forEach((event) => {
        window.removeEventListener(event, handleInteraction, { capture: true });
      });
    };

    ["keydown", "click", "touchstart"].forEach((event) => {
      window.addEventListener(event, handleInteraction, {
        capture: true,
        once: true,
      });
    });

    window.addEventListener("pagehide", reportFinal, { once: true });
    window.addEventListener("beforeunload", reportFinal, { once: true });
  }
}

/**
 * Time to First Byte (TTFB)
 * Measures server response time
 */
export function getTTFB(onReport: ReportCallback): void {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;

  if (navigation && navigation.responseStart && navigation.requestStart) {
    const ttfb = navigation.responseStart - navigation.requestStart;
    const metric: Metric = {
      name: "TTFB",
      value: ttfb,
      delta: ttfb,
      id: generateUniqueID(),
      isFinal: true,
    };
    onReport(metric);
  }
}

/**
 * Convenience functions for one-time measurement
 */
export function onCLS(callback: ReportCallback, reportAllChanges?: boolean): void {
  getCLS(callback, reportAllChanges);
}

export function onFCP(callback: ReportCallback): void {
  getFCP(callback);
}

export function onFID(callback: ReportCallback): void {
  getFID(callback);
}

export function onLCP(callback: ReportCallback, reportAllChanges?: boolean): void {
  getLCP(callback, reportAllChanges);
}

export function onTTFB(callback: ReportCallback): void {
  getTTFB(callback);
}

/**
 * Collect all Core Web Vitals
 */
export function collectAllVitals(callback: ReportCallback): void {
  onCLS(callback);
  onFCP(callback);
  onFID(callback);
  onLCP(callback);
  onTTFB(callback);
}

/**
 * Web Vitals scoring utility
 */
export function scoreMetric(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const thresholds = {
    CLS: { good: 0.1, poor: 0.25 },
    FCP: { good: 1800, poor: 3000 },
    FID: { good: 100, poor: 300 },
    LCP: { good: 2500, poor: 4000 },
    TTFB: { good: 800, poor: 1800 },
  };

  const threshold = thresholds[name as keyof typeof thresholds];
  if (!threshold) return "good";

  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/**
 * Create a performance observer that automatically handles cleanup
 */
export function createPerformanceObserver(
  callback: (entries: PerformanceEntry[]) => void,
  options: PerformanceObserverInit,
): PerformanceObserver | null {
  if (!supportsPerformanceObserver) return null;

  try {
    const observer = new PerformanceObserver((list) => {
      callback(list.getEntries());
    });

    observer.observe(options);
    return observer;
  } catch (e) {
    console.warn("Failed to create performance observer:", e);
    return null;
  }
}
