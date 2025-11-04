/**
 * MSW Browser Setup
 *
 * Configures Mock Service Worker for browser environment.
 * This enables API mocking during development and Storybook.
 */

import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

/**
 * Create MSW worker with handlers
 */
export const worker = setupWorker(...handlers);

/**
 * Start MSW in development mode
 *
 * Usage in app:
 * ```typescript
 * if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_MSW_ENABLED === 'true') {
 *   const { worker } = await import('./mocks/browser');
 *   await worker.start();
 * }
 * ```
 */
export async function startMSW() {
  if (typeof window === "undefined") {
    console.warn("MSW browser worker can only run in browser environment");
    return;
  }

  try {
    await worker.start({
      onUnhandledRequest: "bypass", // Let unhandled requests pass through
      serviceWorker: {
        url: "/mockServiceWorker.js",
      },
    });

    console.log("[MSW] Service Worker started with backend proxy handlers");
    console.log("[MSW] Contract validation enabled for API endpoints");
  } catch (error) {
    console.error("[MSW] Failed to start:", error);
  }
}

/**
 * Stop MSW worker
 */
export async function stopMSW() {
  worker.stop();
  console.log("[MSW] Service Worker stopped");
}
