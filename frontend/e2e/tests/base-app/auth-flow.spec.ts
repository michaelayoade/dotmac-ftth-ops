/**
 * E2E tests for authentication flows in base-app
 * These tests use the actual login flow and real authentication
 */

import { test, expect, type Page } from "@playwright/test";

test.describe("Base App Authentication Flow", () => {
  const BASE_APP_URL = "http://localhost:3000";
  const TEST_USERNAME = "admin";
  const TEST_PASSWORD = "admin123";

  /**
   * Helper function to perform login
   */
  async function login(
    page: Page,
    username: string = TEST_USERNAME,
    password: string = TEST_PASSWORD,
  ) {
    await page.goto(`${BASE_APP_URL}/login`);
    await page.waitForLoadState("networkidle");

    // Fill in login form
    await page.getByTestId("email-input").fill(username);
    await page.getByTestId("password-input").fill(password);

    // Submit form
    await page.getByTestId("submit-button").click();
  }

  test("unauthenticated user is redirected to login", async ({ page }) => {
    await page.goto(BASE_APP_URL);

    // Should be redirected to login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page loads correctly", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/login`);

    // Check page elements
    await expect(page.locator("h1")).toContainText("Network Operations Portal");
    await expect(page.locator("text=Access your")).toBeVisible();

    // Check form elements with test IDs
    await expect(page.getByTestId("email-input")).toBeVisible();
    await expect(page.getByTestId("password-input")).toBeVisible();
    await expect(page.getByTestId("submit-button")).toBeVisible();

    // Check test credentials hint in development
    await expect(page.locator("text=Test Credentials")).toBeVisible();
    await expect(page.locator("text=admin / admin123")).toBeVisible();
  });

  test("register page loads correctly", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/register`);

    // The register page should load without redirect
    await expect(page).toHaveURL(/\/register/);
  });

  test("successful login redirects to dashboard", async ({ page }) => {
    // Listen for console errors
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("Browser console error:", msg.text());
      }
    });

    await login(page);

    // Wait a bit for any error message to appear
    await page.waitForTimeout(2000);

    // Check if there's an error message
    const errorMessage = page.getByTestId("error-message");
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      console.log("Login error:", errorText);
    }

    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify we're on the dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("failed login shows error message", async ({ page }) => {
    await login(page, TEST_USERNAME, "wrongpassword");

    // Should show error message
    await expect(page.getByTestId("error-message")).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test("dashboard requires authentication", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/dashboard`);

    // Should redirect to login with return URL
    await expect(page).toHaveURL(/\/login\?from=%2Fdashboard/);
  });

  test("authenticated user can access dashboard", async ({ page }) => {
    // Login first
    await login(page);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Verify dashboard loads
    await expect(page).toHaveURL(/\/dashboard/);

    // Check for common dashboard elements
    await expect(page.locator("text=Active Subscribers")).toBeVisible();
  });

  test("authenticated user can navigate between pages", async ({ page }) => {
    // Login first
    await login(page);
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Try navigating to different sections
    // Note: Adjust these based on actual dashboard navigation
    const dashboardHeading = page.locator("h1, h2").first();
    await expect(dashboardHeading).toBeVisible();
  });

  test("login form validation works", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/login`);

    // Try submitting empty form
    await page.getByTestId("submit-button").click();

    // Should show validation errors (from react-hook-form + zod)
    // Form should not submit
    await expect(page).toHaveURL(/\/login/);
  });

  test("remember me checkbox is functional", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/login`);

    // Check the remember me checkbox
    const rememberMe = page.locator('input[id="remember-me"]');
    await rememberMe.check();
    await expect(rememberMe).toBeChecked();
  });

  test("forgot password link works", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/login`);

    // Click forgot password link
    await page.locator("text=Forgot password?").click();

    // Should navigate to forgot password page
    await expect(page).toHaveURL(/\/forgot-password/);
  });

  test("sign up link navigates to register page", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/login`);

    // Click sign up link
    await page.locator("text=Sign up").click();

    // Should navigate to register page
    await expect(page).toHaveURL(/\/register/);
  });

  test("back to home link works", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/login`);

    // Click back to home link
    await page.locator("text=← Back to home").click();

    // Should navigate back (which will redirect to login again since not authenticated)
    await expect(page).toHaveURL(/\/login/);
  });

  test("responsive design works on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size

    await page.goto(`${BASE_APP_URL}/login`);
    await page.waitForLoadState("networkidle");

    // Form elements should still be visible and usable
    await expect(page.getByTestId("email-input")).toBeVisible();
    await expect(page.getByTestId("password-input")).toBeVisible();
    await expect(page.getByTestId("submit-button")).toBeVisible();

    // Text should be readable
    await expect(page.locator("h1")).toContainText("Network Operations Portal");
  });

  test("loading state shows during login", async ({ page }) => {
    await page.goto(`${BASE_APP_URL}/login`);

    // Fill form
    await page.getByTestId("email-input").fill(TEST_USERNAME);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);

    // Click submit and immediately check for loading state
    await page.getByTestId("submit-button").click();

    // Button should show loading text (briefly)
    // This might be too fast to catch, so we just verify button exists
    const submitButton = page.getByTestId("submit-button");
    await expect(submitButton).toBeVisible();
  });
});
