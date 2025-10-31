import { defineConfig, devices } from "@playwright/test";

/**
 * Root Playwright E2E Configuration
 *
 * This config runs E2E tests from multiple locations:
 * - /e2e/tests/*.spec.ts - Shared E2E tests
 * - /apps/base-app/e2e/*.spec.ts - Base app E2E tests
 * - /apps/isp-ops-app/e2e/*.spec.ts - ISP ops E2E tests
 * - /apps/platform-admin-app/e2e/*.spec.ts - Platform admin E2E tests
 *
 * EXCLUDES:
 * - __tests__/ - Jest unit tests
 * - node_modules/ - Third-party code
 */
export default defineConfig({
  // Match E2E test files only (*.spec.ts in e2e folders)
  testMatch: [
    "**/e2e/**/*.spec.ts",
  ],

  // Ignore Jest unit test directories and Jest test files
  testIgnore: [
    "**/__tests__/**",
    "**/tests/**", // Ignore Jest tests/ directories
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
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Additional browsers can be added here
  ],

  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: "pnpm dev:base-app",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
      },

  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  outputDir: "test-results/",
});
