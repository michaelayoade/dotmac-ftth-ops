/**
 * MSW Setup for Playwright Tests
 *
 * This file configures MSW for Playwright E2E tests.
 * It can run in two modes:
 * 1. Proxy mode - Forward requests to real backend with contract validation
 * 2. Mock mode - Return deterministic data for UI testing
 */

import { setupServer } from "msw/node";
import { handlers, mockHandlers } from "../apps/base-app/mocks/handlers";

// Determine mode from environment variable
const MSW_MODE = process.env.MSW_MODE || "proxy";

// Select handlers based on mode
const selectedHandlers = MSW_MODE === "mock" ? mockHandlers : handlers;

// Create MSW server
export const server = setupServer(...selectedHandlers);

/**
 * Setup MSW for test suite
 */
export function setupMSW() {
  // Start server before all tests
  server.listen({
    onUnhandledRequest: "bypass", // Let unhandled requests pass through
  });

  console.log(`[MSW] Server started in ${MSW_MODE} mode`);

  // Reset handlers after each test
  return {
    reset: () => server.resetHandlers(),
    close: () => {
      server.close();
      console.log("[MSW] Server closed");
    },
  };
}

// Export for use in global setup
export { server };
