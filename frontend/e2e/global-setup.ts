/**
 * Playwright global setup that ensures the Node-based MSW server
 * is running before any workers execute tests.
 */

import { ensureStoragePolyfill } from "./polyfills";

// Ensure storage polyfill exists before MSW touches it
ensureStoragePolyfill();

export default async function globalSetup() {
  // Use dynamic require to ensure localStorage polyfill is set up first
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { setupMSW } = require("./msw-setup");
  setupMSW();
}
