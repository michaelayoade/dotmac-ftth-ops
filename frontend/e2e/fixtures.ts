import { ensureStoragePolyfill } from "./polyfills";
import { test as base, expect, type Page } from "@playwright/test";
import { server } from "./msw-setup";

ensureStoragePolyfill();

type TestFixtures = {
  login: (page: Page) => Promise<void>;
};

/**
 * Shared Playwright fixtures that ensure MSW handlers are reset
 * between tests to avoid state bleed.
 */
export const test = base.extend<TestFixtures>({
  login: async ({}, use) => {
    const loginHelper = async (page: Page) => {
      const email = process.env.E2E_USER_EMAIL || "admin@test.com";
      const password = process.env.E2E_USER_PASSWORD || "testpassword";

      await page.goto("/login");
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      await page.waitForURL("**/dashboard**");
    };

    await use(loginHelper);
  },
});

test.beforeEach(async () => {
  ensureStoragePolyfill();
  server.resetHandlers();
});

export { expect };
export type { Page, APIRequestContext, BrowserContext, Locator } from "@playwright/test";
