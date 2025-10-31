/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically loaded by Next.js when the experimental.instrumentationHook
 * feature is enabled. It initializes OpenTelemetry for monitoring and tracing.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

/**
 * Register function - called once when the server starts
 */
export async function register() {
  // Only run on server-side
  if (typeof window !== 'undefined') {
    return;
  }

  // Check if OpenTelemetry is enabled via environment variable
  if (process.env.NEXT_PUBLIC_ENABLE_OTEL !== 'true') {
    console.log('[Instrumentation] OpenTelemetry disabled via environment variable');
    return;
  }

  try {
    const { NodeSDK } = await import('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
    const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http');
    const ResourceModule = await import('@opentelemetry/resources');
    const SemanticConventions = await import('@opentelemetry/semantic-conventions');

    const otelEndpoint = process.env.NEXT_PUBLIC_OTEL_ENDPOINT || 'http://localhost:4318';

    const sdk = new NodeSDK({
      resource: new (ResourceModule as any).Resource({
        [SemanticConventions.ATTR_SERVICE_NAME]: 'dotmac-frontend',
        [SemanticConventions.ATTR_SERVICE_VERSION]: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
      }),
      traceExporter: new OTLPTraceExporter({
        url: `${otelEndpoint}/v1/traces`,
      }),
      metricReader: new OTLPMetricExporter({
        url: `${otelEndpoint}/v1/metrics`,
      }) as any, // Type mismatch workaround
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable file system instrumentation for Next.js
          '@opentelemetry/instrumentation-fs': {
            enabled: false,
          },
        }),
      ],
    });

    sdk.start();

    console.log('[Instrumentation] OpenTelemetry initialized successfully');

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => console.log('[Instrumentation] OpenTelemetry SDK shut down successfully'))
        .catch((error) => console.error('[Instrumentation] Error shutting down OpenTelemetry SDK', error))
        .finally(() => process.exit(0));
    });

  } catch (error) {
    console.error('[Instrumentation] Failed to initialize OpenTelemetry:', error);
    // Don't crash the app if OpenTelemetry fails to initialize
  }
}
