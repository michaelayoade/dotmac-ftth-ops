import { defineConfig, devices } from "@playwright/test";

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"],
    ["json", { outputFile: "test-results/results.json" }],
    ["junit", { outputFile: "test-results/results.xml" }],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",

    /* Record video on failure */
    video: "retain-on-failure",

    /* API base URL for backend calls */
    extraHTTPHeaders: {
      Accept: "application/json",
    },
  },

  /* Configure projects for major browsers */
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

    /* Test against mobile viewports. */
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 12"] },
    },

    /* Test against branded browsers. */
    {
      name: "Microsoft Edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
    {
      name: "Google Chrome",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],

  /* Global setup and teardown */
  // Re-enable after backend API is fixed (see TEST_RESULTS.md)
  // globalSetup: require.resolve('./global-setup'),
  // globalTeardown: require.resolve('./global-teardown'),

  /* Run your local dev server before starting the tests */
  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : [
        {
          command: "poetry run uvicorn src.dotmac.platform.main:app --host 0.0.0.0 --port 8000",
          port: 8000,
          reuseExistingServer: true, // Always reuse for local dev
          cwd: "../..",
          env: {
            NODE_ENV: "test",
            DOTMAC_JWT_SECRET_KEY: "test-secret-key-for-e2e-tests-playwright-suite",
            DOTMAC_REDIS_URL: "redis://localhost:6379/1",
            // Use PostgreSQL for e2e tests (same as development)
            DOTMAC_DATABASE_URL_ASYNC:
              "postgresql+asyncpg://dotmac_user:change-me-in-production@localhost:5432/dotmac",
            DATABASE_URL: "postgresql://dotmac_user:change-me-in-production@localhost:5432/dotmac",
            // Override individual database settings (Pydantic reads these with DATABASE__ prefix)
            DATABASE__HOST: "localhost",
            DATABASE__PORT: "5432",
            DATABASE__DATABASE: "dotmac",
            DATABASE__USERNAME: "dotmac_user",
            DATABASE__PASSWORD: "change-me-in-production",
            // Disable Vault for e2e tests
            DOTMAC_VAULT_ENABLED: "false",
            // Disable MinIO for e2e tests - use local storage
            DOTMAC_STORAGE_PROVIDER: "local",
            DOTMAC_STORAGE_LOCAL_PATH: "/tmp/e2e_test_storage",
            // Disable observability dependencies when running outside Docker
            OBSERVABILITY__OTEL_ENABLED: "false",
            OBSERVABILITY__ALERTMANAGER_BASE_URL: "",
            OBSERVABILITY__PROMETHEUS_BASE_URL: "",
            OBSERVABILITY__GRAFANA_BASE_URL: "",
          },
          timeout: 120000,
        },
        {
          command: "pnpm dev",
          port: 3001,
          reuseExistingServer: true, // Always reuse for local dev
          cwd: "../apps/isp-ops-app",
          env: {
            NODE_ENV: "test",
            E2E_TEST: "true",
          },
          timeout: 120000,
        },
      ],

  /* Test timeout */
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  /* Output folder for test artifacts */
  outputDir: "test-results/",
});
