import { defineConfig, devices } from "@playwright/test";

/**
 * Root Playwright E2E Configuration
 *
 * This config runs E2E tests from multiple locations:
 * - /e2e/tests/*.spec.ts - Shared E2E tests
 * - /apps/isp-ops-app/e2e/*.spec.ts - ISP ops E2E tests
 * - /apps/platform-admin-app/e2e/*.spec.ts - Platform admin E2E tests
 *
 * EXCLUDES:
 * - __tests__/ - Jest unit tests
 * - node_modules/ - Third-party code
 */
const ISP_BASE_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
const useDevServer = process.env.E2E_USE_DEV_SERVER === "true";
const testTimeout = parseInt(process.env.E2E_TEST_TIMEOUT || "120000", 10);
const expectTimeout = parseInt(process.env.E2E_EXPECT_TIMEOUT || "20000", 10);
const actionTimeout = parseInt(process.env.E2E_ACTION_TIMEOUT || "30000", 10);
const navigationTimeout = parseInt(process.env.E2E_NAV_TIMEOUT || "120000", 10);

export default defineConfig({
  // Match E2E test files only (*.spec.ts in e2e folders)
  testMatch: ["**/e2e/**/*.spec.ts"],

  // Ignore Jest unit test directories and Jest test files
  testIgnore: [
    "**/__tests__/**",
    "**/node_modules/**",
    "**/*.test.ts",
    "**/*.test.tsx",
    "**/*.test.js",
    "**/*.test.jsx",
  ],

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? [["github"], ["html"]] : "html",

  use: {
    baseURL: ISP_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout,
    navigationTimeout,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Additional browsers can be added here
  ],

  webServer: useDevServer
    ? {
        command: "pnpm dev:isp",
        url: "http://localhost:3001",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      }
    : undefined,

  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",

  timeout: testTimeout,
  expect: {
    timeout: expectTimeout,
  },

  outputDir: "test-results/",
});
