import { server } from "./msw-setup";

/**
 * Playwright global teardown to ensure MSW shuts down cleanly.
 */
export default async function globalTeardown() {
  server.close();
}
