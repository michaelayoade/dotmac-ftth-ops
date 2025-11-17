import { setupMSW } from "./msw-setup";

/**
 * Playwright global setup that ensures the Node-based MSW server
 * is running before any workers execute tests.
 */
export default async function globalSetup() {
  setupMSW();
}
