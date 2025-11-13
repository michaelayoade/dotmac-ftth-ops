import { defineConfig, devices } from "@playwright/test";

const ISP_BASE_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
const useExternalServers = process.env.E2E_USE_DEV_SERVER === "true";
const testTimeout = parseInt(process.env.E2E_TEST_TIMEOUT || "120000", 10);
const expectTimeout = parseInt(process.env.E2E_EXPECT_TIMEOUT || "20000", 10);
const actionTimeout = parseInt(process.env.E2E_ACTION_TIMEOUT || "30000", 10);
const navigationTimeout = parseInt(process.env.E2E_NAV_TIMEOUT || "120000", 10);

export default defineConfig({
  testDir: "./tests",
  testMatch: ["**/*.spec.ts"],

  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: process.env.CI ? [["github"], ["html"]] : "line",

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
  ],

  webServer: useExternalServers
    ? undefined
    : [
        {
          command: "pnpm --filter @dotmac/isp-ops-app dev",
          url: "http://localhost:3001",
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
        {
          command: "pnpm --filter @dotmac/platform-admin-app dev",
          url: "http://localhost:3002",
          reuseExistingServer: !process.env.CI,
          timeout: 120 * 1000,
        },
      ],

  globalSetup: require.resolve("./global-setup"),
  globalTeardown: require.resolve("./global-teardown"),

  timeout: testTimeout,
  expect: {
    timeout: expectTimeout,
  },

  outputDir: "test-results/",
});
