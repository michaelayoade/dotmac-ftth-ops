import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration for local development
 * Assumes backend (port 8000) and ISP frontend (port 3001) are already running
 *
 * Usage: pnpm exec playwright test --config=playwright.config.local.ts
 */
const LOCAL_BASE_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
const testTimeout = parseInt(process.env.E2E_TEST_TIMEOUT || "600000", 10);
const expectTimeout = parseInt(process.env.E2E_EXPECT_TIMEOUT || "20000", 10);
const actionTimeout = parseInt(process.env.E2E_ACTION_TIMEOUT || "60000", 10);
const navigationTimeout = parseInt(process.env.E2E_NAV_TIMEOUT || "480000", 10);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // No retries for local dev
  workers: 1, // Single worker for local dev

  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: LOCAL_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout,
    navigationTimeout,
    extraHTTPHeaders: {
      Accept: "application/json",
    },
  },

  /* Only test chromium for local dev speed */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Global setup and teardown */
  globalSetup: require.resolve("./global-setup"),
  globalTeardown: require.resolve("./global-teardown"),

  /* NO WEB SERVER - assumes services are already running */
  // webServer: undefined,

  /* Test timeout */
  timeout: testTimeout,
  expect: {
    timeout: expectTimeout,
  },

  /* Output folder for test artifacts */
  outputDir: "test-results/",
});
