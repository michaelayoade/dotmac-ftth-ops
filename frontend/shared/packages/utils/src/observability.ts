/**
 * Observability Integration
 *
 * Integration with DotMac Platform observability stack
 * (OpenTelemetry, Prometheus, Grafana)
 */

// Local type definition for AppError
export interface AppError {
  id: string;
  message: string;
  details?: string;
  category?: string;
  severity: string;
  statusCode?: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  timestamp: Date;
  retryable: boolean;
  action?: string;
  context?: Record<string, unknown>;
  originalError?: Error;
}

/**
 * Get OpenTelemetry endpoint from environment
 */
function getOtelEndpoint(): string {
  return (
    process.env.NEXT_PUBLIC_OTEL_ENDPOINT ||
    process.env.OBSERVABILITY__OTEL_ENDPOINT ||
    "http://localhost:4318"
  );
}

/**
 * Report error to observability stack
 *
 * Sends error data to OpenTelemetry collector which forwards to:
 * - Prometheus (metrics)
 * - Grafana Loki (logs)
 * - Grafana Tempo (traces)
 */
export function reportErrorToObservability(error: AppError): void {
  try {
    // Skip reporting in development if configured
    if (
      process.env.NODE_ENV === "development" &&
      process.env.NEXT_PUBLIC_SKIP_ERROR_REPORTING === "true"
    ) {
      return;
    }

    const endpoint = getOtelEndpoint();

    // Create error event payload for OpenTelemetry
    const payload = {
      timestamp: error.timestamp.toISOString(),
      severity: error.severity,
      category: error.category,
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      retryable: error.retryable,
      context: {
        ...error.context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: getSessionId(),
      },
      attributes: {
        "error.id": error.id,
        "error.category": error.category,
        "error.severity": error.severity,
        "error.retryable": error.retryable,
        "http.status_code": error.statusCode,
        "component.name": error.context?.component,
        "action.name": error.context?.action,
      },
    };

    // Send to OpenTelemetry collector
    // Using fetch with keepalive to ensure delivery even on page unload
    fetch(`${endpoint}/v1/logs`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: "service.name", value: { stringValue: "dotmac-frontend" } },
                { key: "deployment.environment", value: { stringValue: process.env.NODE_ENV } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: "error-handler" },
                logRecords: [
                  {
                    timeUnixNano: BigInt(error.timestamp.getTime()) * BigInt(1000000),
                    severityNumber: getSeverityNumber(error.severity),
                    severityText: error.severity.toUpperCase(),
                    body: { stringValue: error.message },
                    attributes: Object.entries(payload.attributes).map(([key, value]) => ({
                      key,
                      value: { stringValue: String(value) },
                    })),
                  },
                ],
              },
            ],
          },
        ],
      }),
      keepalive: true,
    }).catch((err) => {
      // Silently fail - don't want error reporting to cause more errors
      console.warn("Failed to report error to observability:", err);
    });

    // Also increment error counter metric
    incrementErrorMetric(error);
  } catch (err) {
    // Silently fail
    console.warn("Error in observability reporting:", err);
  }
}

/**
 * Get OpenTelemetry severity number
 */
function getSeverityNumber(severity: string): number {
  switch (severity) {
    case "info":
      return 9; // INFO
    case "warning":
      return 13; // WARN
    case "error":
      return 17; // ERROR
    case "critical":
      return 21; // FATAL
    default:
      return 0; // UNSPECIFIED
  }
}

/**
 * Get or create session ID for error correlation
 */
function getSessionId(): string {
  let sessionId = sessionStorage.getItem("observability_session_id");

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    sessionStorage.setItem("observability_session_id", sessionId);
  }

  return sessionId;
}

/**
 * Increment error counter metric
 *
 * Sends metric to Prometheus via OpenTelemetry
 */
function incrementErrorMetric(error: AppError): void {
  const endpoint = getOtelEndpoint();

  fetch(`${endpoint}/v1/metrics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resourceMetrics: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: "dotmac-frontend" } }],
          },
          scopeMetrics: [
            {
              scope: { name: "error-handler" },
              metrics: [
                {
                  name: "frontend.errors.total",
                  description: "Total number of frontend errors",
                  unit: "1",
                  sum: {
                    dataPoints: [
                      {
                        asInt: "1",
                        timeUnixNano: BigInt(Date.now()) * BigInt(1000000),
                        attributes: [
                          { key: "error.category", value: { stringValue: error.category } },
                          { key: "error.severity", value: { stringValue: error.severity } },
                          { key: "http.status_code", value: { intValue: error.statusCode || 0 } },
                        ],
                      },
                    ],
                    aggregationTemporality: 2, // CUMULATIVE
                    isMonotonic: true,
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
    keepalive: true,
  }).catch(() => {
    // Silently fail
  });
}

/**
 * Create a trace span for error context
 *
 * Links error to active trace in OpenTelemetry
 */
export function createErrorSpan(error: AppError): void {
  // This would integrate with your existing OpenTelemetry tracing
  // For now, just log to console in development
  if (process.env.NODE_ENV === "development") {
    console.groupCollapsed(
      `%c[Error Trace] ${error.category}`,
      "color: #ef4444; font-weight: bold",
    );
    console.log("Message:", error.message);
    console.log("Severity:", error.severity);
    console.log("Category:", error.category);
    console.log("Status Code:", error.statusCode);
    console.log("Context:", error.context);
    console.log("Original Error:", error.originalError);
    console.groupEnd();
  }
}

/**
 * Send custom metric to observability stack
 */
export function recordMetric(
  name: string,
  value: number,
  labels: Record<string, string | number> = {},
): void {
  const endpoint = getOtelEndpoint();

  fetch(`${endpoint}/v1/metrics`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      resourceMetrics: [
        {
          resource: {
            attributes: [{ key: "service.name", value: { stringValue: "dotmac-frontend" } }],
          },
          scopeMetrics: [
            {
              scope: { name: "custom-metrics" },
              metrics: [
                {
                  name,
                  description: `Custom metric: ${name}`,
                  unit: "1",
                  gauge: {
                    dataPoints: [
                      {
                        asDouble: value,
                        timeUnixNano: BigInt(Date.now()) * BigInt(1000000),
                        attributes: Object.entries(labels).map(([key, val]) => ({
                          key,
                          value:
                            typeof val === "number"
                              ? { intValue: val }
                              : { stringValue: String(val) },
                        })),
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    }),
    keepalive: true,
  }).catch(() => {
    // Silently fail
  });
}

/**
 * Performance monitoring integration
 */
export function recordPerformance(
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>,
): void {
  recordMetric("frontend.operation.duration", duration, {
    operation,
    ...metadata,
  });
}
