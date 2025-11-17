import { test as base, expect } from "@playwright/test";
import { server } from "./msw-setup";

/**
 * Shared Playwright fixtures that ensure MSW handlers are reset
 * between tests to avoid state bleed.
 */
export const test = base.extend({});

test.beforeEach(async () => {
  server.resetHandlers();
});

export { expect };
export type { Page, APIRequestContext, BrowserContext, Locator } from "@playwright/test";
