/**
 * MSW Server Setup
 *
 * Configures Mock Service Worker for Node.js environment (tests).
 * Used by Jest, Vitest, and Playwright tests.
 */

import { setupServer } from "msw/node";
import { handlers, mockHandlers } from "./handlers";

/**
 * Create MSW server with proxy handlers (default)
 *
 * These handlers forward requests to real backend while validating contracts.
 */
export const server = setupServer(...handlers);

/**
 * Create MSW server with mock handlers (deterministic data)
 *
 * These handlers return fixed data for isolated UI component testing.
 */
export const mockServer = setupServer(...mockHandlers);

/**
 * Setup function for test suites
 *
 * Usage in test setup file:
 * ```typescript
 * import { server } from './mocks/server';
 *
 * beforeAll(() => server.listen());
 * afterEach(() => server.resetHandlers());
 * afterAll(() => server.close());
 * ```
 */
export function setupMSWServer(mode: "proxy" | "mock" = "proxy") {
  const selectedServer = mode === "proxy" ? server : mockServer;

  return {
    start: () => {
      selectedServer.listen({
        onUnhandledRequest: "bypass", // Let unhandled requests pass through
      });
      console.log(`[MSW] Server started in ${mode} mode`);
    },
    stop: () => {
      selectedServer.close();
      console.log("[MSW] Server stopped");
    },
    reset: () => {
      selectedServer.resetHandlers();
    },
  };
}
