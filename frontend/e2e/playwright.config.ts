import { defineConfig, devices } from "@playwright/test";

const ISP_BASE_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
const useExternalServers = process.env.E2E_USE_DEV_SERVER === "true";
// Reduced timeouts to catch real issues (can be overridden via env vars)
const testTimeout = parseInt(process.env.E2E_TEST_TIMEOUT || "30000", 10);
const expectTimeout = parseInt(process.env.E2E_EXPECT_TIMEOUT || "5000", 10);
const actionTimeout = parseInt(process.env.E2E_ACTION_TIMEOUT || "10000", 10);
const navigationTimeout = parseInt(process.env.E2E_NAV_TIMEOUT || "30000", 10);
const webServerTimeout = parseInt(process.env.E2E_WEB_SERVER_TIMEOUT || "120000", 10);
const defaultMSWMode = process.env.MSW_MODE || "proxy";
const enableMSWWorkers = process.env.E2E_DISABLE_MSW !== "true";
const reuseExistingServer = process.env.E2E_REUSE_SERVER === "true";

process.env.MSW_MODE = defaultMSWMode;

const sharedWebServerEnv: Record<string, string> = {
  MSW_MODE: defaultMSWMode,
  NEXT_PUBLIC_MSW_ENABLED: enableMSWWorkers ? "true" : "false",
};

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
    launchOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      chromiumSandbox: false,
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],

  webServer: useExternalServers
    ? undefined
    : [
        {
          command: "pnpm --filter @dotmac/isp-ops-app dev",
          url: "http://localhost:3001",
          reuseExistingServer: reuseExistingServer && !process.env.CI,
          timeout: webServerTimeout,
          env: sharedWebServerEnv,
        },
        {
          command: "pnpm --filter @dotmac/platform-admin-app dev",
          url: "http://localhost:3002",
          reuseExistingServer: reuseExistingServer && !process.env.CI,
          timeout: webServerTimeout,
          env: sharedWebServerEnv,
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
