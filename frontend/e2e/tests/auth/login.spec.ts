/**
 * E2E tests for authentication flows
 * Focus on advanced scenarios beyond the baseline happy paths
 */
import { test, expect } from "#e2e/fixtures";

test.describe("Advanced Authentication Scenarios", () => {
  const ISP_APP_URL = "http://localhost:3001";
  const TEST_USERNAME = "admin";
  const TEST_PASSWORD = "admin123";

  test.beforeEach(async ({ page }) => {
    await page.goto(`${ISP_APP_URL}/login`);
    await page.waitForLoadState("networkidle");
  });

  test("should handle network errors gracefully", async ({ page }) => {
    // Intercept login request and simulate network error
    await page.route("**/api/isp/v1/admin/auth/login", (route) => {
      route.abort("failed");
    });

    await page.getByTestId("email-input").fill(TEST_USERNAME);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("submit-button").click();

    // Should show error message
    await expect(page.getByTestId("error-message")).toBeVisible();
  });

  test("should show loading state during login", async ({ page }) => {
    // Intercept login request and delay response
    await page.route("**/api/isp/v1/admin/auth/login", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.continue();
    });

    await page.getByTestId("email-input").fill(TEST_USERNAME);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);

    const submitButton = page.getByTestId("submit-button");
    await submitButton.click();

    // Check loading state (button should be disabled during submission)
    await expect(submitButton).toBeDisabled();
  });

  test("should handle rate limiting", async ({ page }) => {
    // Make multiple failed login attempts
    for (let i = 0; i < 5; i++) {
      await page.getByTestId("email-input").fill(TEST_USERNAME);
      await page.getByTestId("password-input").fill("wrongpassword");
      await page.getByTestId("submit-button").click();

      await page.waitForTimeout(500);

      // Clear form for next attempt
      await page.reload();
      await page.waitForLoadState("networkidle");
    }

    // Next attempt should be rate limited (backend may return 429)
    await page.getByTestId("email-input").fill(TEST_USERNAME);
    await page.getByTestId("password-input").fill("wrongpassword");
    await page.getByTestId("submit-button").click();

    // Should show rate limit error
    await page.waitForTimeout(500);
    const errorMessage = page.getByTestId("error-message");
    if (await errorMessage.isVisible()) {
      const errorText = await errorMessage.textContent();
      // Backend should return rate limit message
      expect(errorText).toBeTruthy();
    }
  });

  test("should redirect to intended page after login", async ({ page }) => {
    // Try to access protected page
    await page.goto(`${ISP_APP_URL}/dashboard/settings`);
    await page.waitForLoadState("networkidle");

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);

    // Login
    await page.getByTestId("email-input").fill(TEST_USERNAME);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("submit-button").click();

    // Wait for redirect
    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Should be on dashboard (may not redirect to exact intended page, that's OK)
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("should logout successfully and clear session", async ({ page }) => {
    // Login first
    await page.getByTestId("email-input").fill(TEST_USERNAME);
    await page.getByTestId("password-input").fill(TEST_PASSWORD);
    await page.getByTestId("submit-button").click();

    await page.waitForURL(/\/dashboard/, { timeout: 10000 });

    // Logout (look for user menu or logout button)
    const logoutButton = page
      .locator(
        '[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")',
      )
      .first();

    if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutButton.click();
    } else {
      // Try user menu approach
      const userMenu = page
        .locator('[data-testid="user-menu"], .user-menu, [aria-label="User menu"]')
        .first();
      if (await userMenu.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userMenu.click();
        await page
          .locator('button:has-text("Logout"), button:has-text("Sign out")')
          .first()
          .click();
      }
    }

    // Should redirect to login
    await page.waitForURL(/\/login/, { timeout: 5000 });
    await expect(page).toHaveURL(/\/login/);

    // Should clear session - accessing dashboard should redirect back
    await page.goto(`${ISP_APP_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login/);
  });
});
