import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E Test Configuration
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    // Set custom header to bypass authentication in E2E tests
    extraHTTPHeaders: {
      "x-e2e-test": "true",
    },
  },

  // Visual regression testing configuration
  expect: {
    toHaveScreenshot: {
      // Maximum pixel difference threshold
      maxDiffPixels: 100,
      // Threshold for considering pixels as different (0-1)
      threshold: 0.2,
      // Animations: "disabled" prevents flaky tests
      animations: "disabled",
      // CSS animations and transitions
      caret: "hide",
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Additional browsers disabled for faster local iterations.
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true, // Always reuse existing server
    timeout: 120 * 1000,
  },
});
