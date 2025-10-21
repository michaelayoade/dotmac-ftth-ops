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
  // OpenTelemetry initialization temporarily disabled
  // TODO: Re-enable after resolving OpenTelemetry SDK version compatibility issues
  console.log("Instrumentation hook registered (OpenTelemetry disabled)");
}
