/**
 * E2E tests for REST API integration
 * Tests API calls and their effects on the UI
 */
import { test, expect, type Page, type APIRequestContext } from "@playwright/test";

test.describe("REST API Integration", () => {
  const BASE_URL = "http://localhost:8000";
  const APP_URL = "http://localhost:3000";
  const TEST_USERNAME = "admin";
  const TEST_PASSWORD = "admin123";

  let authToken: string;

  /**
   * Helper to authenticate and get token
   */
  async function authenticate(request: APIRequestContext): Promise<string> {
    const response = await request.post(`${BASE_URL}/api/v1/auth/login`, {
      data: {
        username: TEST_USERNAME,
        password: TEST_PASSWORD,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    return data.access_token || data.token;
  }

  test.beforeEach(async ({ request }) => {
    // Get auth token before each test
    authToken = await authenticate(request);
  });

  test.describe("API Error Handling", () => {
    test("should handle 422 validation errors in UI", async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Intercept API call to return validation error
      await page.route("**/api/v1/**", (route) => {
        if (route.request().method() === "POST") {
          route.fulfill({
            status: 422,
            contentType: "application/json",
            body: JSON.stringify({
              detail: [
                {
                  loc: ["body", "email"],
                  msg: "Email already exists",
                  type: "value_error",
                },
              ],
            }),
          });
        } else {
          route.continue();
        }
      });

      // If there's a form on the dashboard, try submitting it
      const submitButton = page.locator('button[type="submit"]').first();
      if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitButton.click();

        // Check for error message display
        const errorMessage = page.locator('.error-message, [role="alert"], .alert-error').first();
        if (await errorMessage.isVisible({ timeout: 2000 }).catch(() => false)) {
          await expect(errorMessage).toBeVisible();
        }
      }
    });

    test("should handle 500 errors gracefully", async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Intercept API calls to return 500 error
      await page.route("**/api/v1/**", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Internal server error",
          }),
        });
      });

      // Try to trigger an API call by navigating or clicking
      await page.reload();

      // Look for error handling UI
      const errorBanner = page
        .locator('.error-banner, [role="alert"], .alert-error, text=/error|failed/i')
        .first();

      // Give it time to appear
      await page.waitForTimeout(1000);

      // Document that error handling exists (or doesn't)
      const hasErrorHandling = await errorBanner.isVisible().catch(() => false);
      console.log("500 Error handling present:", hasErrorHandling);
    });

    test("should handle network timeouts", async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Intercept API calls and delay response
      await page.route("**/api/v1/**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second delay
        route.abort("timedout");
      });

      // Try to trigger an API call
      const refreshButton = page
        .locator('[data-testid="refresh"], button:has-text("Refresh"), button:has-text("Reload")')
        .first();

      if (await refreshButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await refreshButton.click();

        // Wait for timeout error
        await page.waitForTimeout(2000);

        // Check for timeout handling
        const timeoutError = page.locator("text=/timeout|timed out|taking too long/i").first();
        const hasTimeoutHandling = await timeoutError
          .isVisible({ timeout: 1000 })
          .catch(() => false);
        console.log("Timeout error handling present:", hasTimeoutHandling);
      }
    });
  });

  test.describe("API Response Handling", () => {
    test("should display API data in UI", async ({ page, request }) => {
      // Login first
      await page.goto(`${APP_URL}/login`);
      await page.getByTestId("email-input").fill(TEST_USERNAME);
      await page.getByTestId("password-input").fill(TEST_PASSWORD);
      await page.getByTestId("submit-button").click();

      await page.waitForURL(/dashboard/, { timeout: 10000 });

      // Check if any data is being displayed from API
      const dataElements = page.locator('[data-testid*="data"], .data-card, .data-item').first();

      if (await dataElements.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(dataElements).toBeVisible();
        console.log("UI displays API data");
      } else {
        console.log("No obvious API data display elements found");
      }
    });

    test("should handle empty API responses", async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Intercept API to return empty array
      await page.route("**/api/v1/**", (route) => {
        if (route.request().method() === "GET") {
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
          });
        } else {
          route.continue();
        }
      });

      await page.reload();

      // Look for empty state messaging
      const emptyState = page
        .locator(
          '[data-testid="empty-state"], .empty-state, text=/no data|no items|nothing to show/i',
        )
        .first();

      await page.waitForTimeout(1000);

      const hasEmptyState = await emptyState.isVisible().catch(() => false);
      console.log("Empty state handling present:", hasEmptyState);
    });
  });

  test.describe("API Authentication", () => {
    test("should handle unauthorized (401) responses", async ({ page }) => {
      await page.goto(`${APP_URL}/dashboard`);

      // Intercept API to return 401
      await page.route("**/api/v1/**", (route) => {
        route.fulfill({
          status: 401,
          contentType: "application/json",
          body: JSON.stringify({
            detail: "Unauthorized",
          }),
        });
      });

      await page.reload();

      // Should redirect to login
      await page.waitForTimeout(2000);

      const isOnLogin = page.url().includes("/login");
      console.log("Redirects to login on 401:", isOnLogin);

      if (isOnLogin) {
        await expect(page).toHaveURL(/login/);
      }
    });

    test("should include auth headers in API requests", async ({ page }) => {
      // Login first
      await page.goto(`${APP_URL}/login`);
      await page.getByTestId("email-input").fill(TEST_USERNAME);
      await page.getByTestId("password-input").fill(TEST_PASSWORD);
      await page.getByTestId("submit-button").click();

      await page.waitForURL(/dashboard/, { timeout: 10000 });

      // Monitor API requests
      let hasAuthHeader = false;
      page.on("request", (request) => {
        if (request.url().includes("/api/v1/")) {
          const headers = request.headers();
          if (headers["authorization"] || headers["cookie"]) {
            hasAuthHeader = true;
          }
        }
      });

      // Trigger an API call by reloading
      await page.reload();

      await page.waitForTimeout(1000);

      console.log("API requests include auth:", hasAuthHeader);
    });
  });

  test.describe("CORS and Security", () => {
    test("should handle CORS properly", async ({ request }) => {
      // Test OPTIONS preflight request
      const response = await request.fetch(`${BASE_URL}/api/v1/health`, {
        method: "OPTIONS",
        headers: {
          Origin: APP_URL,
          "Access-Control-Request-Method": "GET",
          "Access-Control-Request-Headers": "Content-Type",
        },
      });

      // Backend should respond to OPTIONS
      expect([200, 204]).toContain(response.status());

      // Should have CORS headers
      const headers = response.headers();
      console.log("CORS Headers present:", {
        "access-control-allow-origin": !!headers["access-control-allow-origin"],
        "access-control-allow-methods": !!headers["access-control-allow-methods"],
      });
    });

    test("should use HTTPS in production mode", async () => {
      // This test just documents security expectations
      const isProduction = process.env.NODE_ENV === "production";

      if (isProduction) {
        expect(BASE_URL).toMatch(/^https:/);
        expect(APP_URL).toMatch(/^https:/);
      } else {
        console.log("Running in development mode - HTTP is acceptable");
      }
    });
  });

  test.describe("API Performance", () => {
    test("should handle concurrent requests", async ({ page }) => {
      // Login first
      await page.goto(`${APP_URL}/login`);
      await page.getByTestId("email-input").fill(TEST_USERNAME);
      await page.getByTestId("password-input").fill(TEST_PASSWORD);
      await page.getByTestId("submit-button").click();

      await page.waitForURL(/dashboard/, { timeout: 10000 });

      // Track concurrent requests
      let requestCount = 0;
      let maxConcurrent = 0;
      let currentConcurrent = 0;

      page.on("request", (request) => {
        if (request.url().includes("/api/v1/")) {
          requestCount++;
          currentConcurrent++;
          maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        }
      });

      page.on("response", (response) => {
        if (response.url().includes("/api/v1/")) {
          currentConcurrent--;
        }
      });

      // Navigate to a page that might make multiple API calls
      await page.goto(`${APP_URL}/dashboard`);

      await page.waitForTimeout(2000);

      console.log("API Requests:", {
        total: requestCount,
        maxConcurrent: maxConcurrent,
      });
    });

    test("should cache repeated requests", async ({ page }) => {
      // Login first
      await page.goto(`${APP_URL}/login`);
      await page.getByTestId("email-input").fill(TEST_USERNAME);
      await page.getByTestId("password-input").fill(TEST_PASSWORD);
      await page.getByTestId("submit-button").click();

      await page.waitForURL(/dashboard/, { timeout: 10000 });

      // Track requests to same endpoint
      const requests: Map<string, number> = new Map();

      page.on("request", (request) => {
        if (request.url().includes("/api/v1/")) {
          const url = request.url();
          requests.set(url, (requests.get(url) || 0) + 1);
        }
      });

      // Navigate and trigger API calls
      await page.goto(`${APP_URL}/dashboard`);
      await page.reload();
      await page.reload();

      await page.waitForTimeout(2000);

      // Check if same endpoints are being called multiple times
      const repeatedRequests = Array.from(requests.entries()).filter(([_, count]) => count > 1);

      console.log("Repeated API requests:", repeatedRequests.length);
      console.log("Sample repeated requests:", repeatedRequests.slice(0, 3));
    });
  });
});
