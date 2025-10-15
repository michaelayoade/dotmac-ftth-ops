/**
 * Next.js Instrumentation Hook
 *
 * This file is automatically loaded by Next.js when the experimental.instrumentationHook
 * feature is enabled. It initializes OpenTelemetry for monitoring and tracing.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

import { initializeOTEL } from '@dotmac/headless';

/**
 * Register function - called once when the server starts
 */
export async function register() {
  // Only initialize in server-side environment
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const serviceName = process.env.OTEL_SERVICE_NAME || 'dotmac-base-app';

    try {
      initializeOTEL(serviceName);
    } catch (error) {
      console.error('Failed to initialize telemetry:', error);
      // Don't throw - continue running even if telemetry fails
    }
  }
}
