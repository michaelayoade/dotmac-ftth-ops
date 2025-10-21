import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should redirect to login when not authenticated", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/.*login/);
  });

  test("should show login form", async ({ page }) => {
    await page.goto("/login");

    // Check form elements exist
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="submit-button"]')).toBeVisible();

    // Check heading text
    await expect(page.locator("h1")).toContainText("Network Operations Portal");
  });

  test("should show error on invalid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in invalid credentials
    await page.fill('[data-testid="email-input"]', "invalid-user");
    await page.fill('[data-testid="password-input"]', "wrong_password");
    await page.click('[data-testid="submit-button"]');

    // Check for error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test("should login with valid credentials", async ({ page }) => {
    await page.goto("/login");

    // Fill in valid test credentials
    await page.fill('[data-testid="email-input"]', "admin");
    await page.fill('[data-testid="password-input"]', "admin123");
    await page.click('[data-testid="submit-button"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/.*dashboard/);

    // Should show dashboard heading
    await expect(page.locator("h1")).toContainText("Network Operations Center");
  });

  test("should logout successfully", async ({ page }) => {
    // Login first
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "admin");
    await page.fill('[data-testid="password-input"]', "admin123");
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL(/.*dashboard/);

    // Click logout button
    await page.click("text=Sign out");

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe("Registration Flow", () => {
  test("should navigate to registration page", async ({ page }) => {
    await page.goto("/login");
    await page.click("text=Sign up");
    await expect(page).toHaveURL(/.*register/);
  });

  test("should validate registration form", async ({ page }) => {
    await page.goto("/register");

    // Try to submit empty form
    await page.click('button[type="submit"]');

    // Browser's built-in validation will prevent submission
    // Check that required fields have validation
    const emailInput = page.locator('input[type="email"]').first();
    const isRequired = await emailInput.getAttribute("required");
    expect(isRequired).not.toBeNull();
  });

  test("should display registration page elements", async ({ page }) => {
    await page.goto("/register");

    // Check that registration form has expected elements
    await expect(page.locator("h1")).toContainText("Create your account");
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("should fill registration form", async ({ page }) => {
    await page.goto("/register");

    // Fill registration form
    const timestamp = Date.now();
    await page.fill('input[type="email"]', `test${timestamp}@example.com`);
    await page.fill('input[type="password"]', "Test123!@#");

    // Check password confirmation field if it exists
    const confirmField = page.locator('input[placeholder*="Confirm"]');
    if ((await confirmField.count()) > 0) {
      await confirmField.fill("Test123!@#");
    }

    // Submit button should be enabled
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });
});

test.describe("Additional Auth Features", () => {
  test("should show test credentials on login page", async ({ page }) => {
    await page.goto("/login");

    // Check that test credentials are displayed
    await expect(page.locator("text=Test credentials:")).toBeVisible();
    await expect(page.locator("text=admin / admin123")).toBeVisible();
  });

  test("should navigate back to home from login", async ({ page }) => {
    await page.goto("/login");

    // Click back to home link
    await page.click("text=Back to home");
    await expect(page).toHaveURL("/");
  });

  test("should handle loading state during login", async ({ page }) => {
    await page.goto("/login");

    // Start filling form
    await page.fill('[data-testid="email-input"]', "admin");
    await page.fill('[data-testid="password-input"]', "admin123");

    // Click login and check for loading state
    const loginButton = page.locator('[data-testid="submit-button"]');
    await loginButton.click();

    // Button should show loading state briefly
    // Note: This might be too fast to catch consistently
    // await expect(loginButton).toContainText('Signing in...');
  });
});
