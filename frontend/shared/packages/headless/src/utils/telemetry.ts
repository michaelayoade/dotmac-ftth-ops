/**
 * OpenTelemetry initialization for Next.js applications
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource as OtelResource } from "@opentelemetry/resources";
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT,
} from "@opentelemetry/semantic-conventions";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

let isInitialized = false;

/**
 * Initialize OpenTelemetry
 */
export function initializeOTEL(serviceName: string) {
  // Prevent multiple initializations
  if (isInitialized) {
    console.warn("OpenTelemetry already initialized");
    return;
  }

  const otelEndpoint = process.env["NEXT_PUBLIC_OTEL_ENDPOINT"];

  if (!otelEndpoint) {
    console.log("OpenTelemetry endpoint not configured, skipping initialization");
    return;
  }

  try {
    // Configure resource
    const resource = OtelResource.default().merge(
      new OtelResource({
        [ATTR_SERVICE_NAME]: serviceName,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "1.0.0",
        [ATTR_DEPLOYMENT_ENVIRONMENT]: process.env["NODE_ENV"] || "development",
      }),
    );

    // Configure trace exporter
    const traceExporter = new OTLPTraceExporter({
      url: `${otelEndpoint}/v1/traces`,
      headers: {},
    });

    // Configure metric exporter
    const metricExporter = new OTLPMetricExporter({
      url: `${otelEndpoint}/v1/metrics`,
      headers: {},
    });

    // Configure SDK
    const sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader: new PeriodicExportingMetricReader({
        exporter: metricExporter,
        exportIntervalMillis: 10000, // Export metrics every 10 seconds
      }),
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": {
            enabled: false, // Disable fs instrumentation to reduce noise
          },
        }),
      ],
    });

    // Initialize SDK
    sdk.start();
    isInitialized = true;

    console.log(`✅ OpenTelemetry initialized for ${serviceName}`);
    console.log(`   Endpoint: ${otelEndpoint}`);
    console.log(`   Environment: ${process.env["NODE_ENV"]}`);

    // Graceful shutdown
    const gracefulShutdown = () => {
      sdk
        .shutdown()
        .then(() => console.log("OpenTelemetry terminated"))
        .catch((error) => console.error("Error terminating OpenTelemetry", error))
        .finally(() => process.exit(0));
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    console.error("Failed to initialize OpenTelemetry:", error);
  }
}

/**
 * Custom trace span for manual instrumentation
 */
export function createSpan(name: string, attributes?: Record<string, any>) {
  // This would be implemented with actual OTEL APIs
  return {
    end: () => {},
    setAttribute: (key: string, value: any) => {},
    setStatus: (status: any) => {},
  };
}

/**
 * Record custom metric
 */
export function recordMetric(name: string, value: number, attributes?: Record<string, any>) {
  // This would be implemented with actual OTEL metrics API
  if (process.env["NODE_ENV"] === "development") {
    console.log(`Metric: ${name} = ${value}`, attributes);
  }
}

/**
 * Performance monitoring utilities
 */
export const performance = {
  /**
   * Measure function execution time
   */
  measureTime: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      recordMetric(`${name}.duration`, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      recordMetric(`${name}.duration`, duration, { error: true });
      throw error;
    }
  },

  /**
   * Track page load performance
   */
  trackPageLoad: (pathname: string) => {
    if (typeof window !== "undefined" && window.performance) {
      const navigation = window.performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      if (navigation) {
        recordMetric("page.load.time", navigation.loadEventEnd - navigation.fetchStart, {
          pathname,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
          domInteractive: navigation.domInteractive - navigation.fetchStart,
        });
      }
    }
  },

  /**
   * Track API call performance
   */
  trackAPICall: (endpoint: string, method: string, duration: number, status: number) => {
    recordMetric("api.call.duration", duration, {
      endpoint,
      method,
      status,
      success: status >= 200 && status < 300,
    });
  },
};
