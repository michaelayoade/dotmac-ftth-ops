/**
 * Performance Reporting Utilities
 */

import type { PerformanceMetrics, PerformanceObserverConfig } from "./types";

export function reportMetrics(
  metrics: PerformanceMetrics,
  config: PerformanceObserverConfig,
): void {
  if (config.enableConsoleLogging) {
    logMetricsToConsole(metrics);
  }

  if (config.reportingEndpoint) {
    sendMetricsToEndpoint(metrics, config.reportingEndpoint, config.enableConsoleLogging ?? false);
  }

  if (typeof window !== "undefined" && (window as any).gtag) {
    sendMetricsToGoogleAnalytics(metrics);
  }
}

function logMetricsToConsole(metrics: PerformanceMetrics): void {
  console.group("📊 Performance Metrics");

  logWebVitalMetrics(metrics);
  logLoadMetrics(metrics);
  logCustomMetrics(metrics.customMetrics);

  console.groupEnd();
}

function logWebVitalMetrics(metrics: PerformanceMetrics): void {
  logMetric("🎨 First Contentful Paint", metrics.fcp, (v) => `${v.toFixed(2)}ms`);
  logMetric("🖼️ Largest Contentful Paint", metrics.lcp, (v) => `${v.toFixed(2)}ms`);
  logMetric("👆 First Input Delay", metrics.fid, (v) => `${v.toFixed(2)}ms`);
  logMetric("📐 Cumulative Layout Shift", metrics.cls, (v) => v.toFixed(4));
  logMetric("🌐 Time to First Byte", metrics.ttfb, (v) => `${v.toFixed(2)}ms`);
}

function logLoadMetrics(metrics: PerformanceMetrics): void {
  logMetric("📄 DOM Content Loaded", metrics.domContentLoaded, (v) => `${v.toFixed(2)}ms`);
  logMetric("✅ Load Complete", metrics.loadComplete, (v) => `${v.toFixed(2)}ms`);
  logMetric("📦 Resource Count", metrics.resourceCount, (v) => v.toString());
  logMetric(
    "💾 Total Resource Size",
    metrics.totalResourceSize,
    (v) => `${(v / 1024).toFixed(2)}KB`,
  );
}

function logCustomMetrics(customMetrics: Record<string, number>): void {
  if (Object.keys(customMetrics).length > 0) {
    console.log("🔧 Custom Metrics:");
    for (const [name, value] of Object.entries(customMetrics)) {
      console.log(`  ${name}: ${value}`);
    }
  }
}

function logMetric(
  label: string,
  value: number | undefined,
  formatter: (v: number) => string,
): void {
  if (value !== undefined) {
    console.log(`${label}: ${formatter(value)}`);
  }
}

function sendMetricsToEndpoint(
  metrics: PerformanceMetrics,
  endpoint: string,
  enableLogging: boolean,
): void {
  const payload = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    metrics,
  };

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    if (enableLogging) {
      console.error("Failed to send metrics to endpoint:", endpoint);
    }
  });
}

function sendMetricsToGoogleAnalytics(metrics: PerformanceMetrics): void {
  const gtag = (window as any).gtag;
  if (!gtag) return;

  const events = [
    { metric: metrics.fcp, event: "first_contentful_paint" },
    { metric: metrics.lcp, event: "largest_contentful_paint" },
    { metric: metrics.fid, event: "first_input_delay" },
    { metric: metrics.cls, event: "cumulative_layout_shift", multiplier: 1000 },
  ];

  events.forEach(({ metric, event, multiplier = 1 }) => {
    if (metric !== undefined) {
      gtag("event", event, { value: Math.round(metric * multiplier) });
    }
  });
}
