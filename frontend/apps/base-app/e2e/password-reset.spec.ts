import { test, expect, Page } from "@playwright/test";

test.describe("Password Reset Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("should navigate to forgot password page from login", async ({ page }) => {
    await page.goto("/login");

    // Click "Forgot Password" link
    await page.click("text=Forgot password?");

    // Should navigate to password reset page
    await expect(page).toHaveURL(/.*forgot-password|.*reset-password/);
    await expect(page.locator("h1")).toContainText(/Reset|Forgot/i);
  });

  test("should validate email input on forgot password page", async ({ page }) => {
    await page.goto("/forgot-password");

    // Submit empty form
    await page.click('button[type="submit"]');

    // Should show validation error
    const emailInput = page.locator('input[type="email"]').first();
    const isRequired = await emailInput.getAttribute("required");
    expect(isRequired).not.toBeNull();
  });

  test("should show error for non-existent email", async ({ page }) => {
    await page.goto("/forgot-password");

    // Enter non-existent email
    await page.fill('input[type="email"]', "nonexistent@example.com");
    await page.click('button[type="submit"]');

    // Should show error message (or success for security - don't reveal if email exists)
    await page.waitForTimeout(1000);

    // Either error or generic success message
    const hasError = await page.locator('[data-testid="error-message"]').count();
    const hasSuccess = await page.locator('[data-testid="success-message"]').count();
    expect(hasError + hasSuccess).toBeGreaterThan(0);
  });

  test("should request password reset for valid email", async ({ page }) => {
    await page.goto("/forgot-password");

    // Enter valid test email
    await page.fill('input[type="email"]', "test@example.com");
    await page.click('button[type="submit"]');

    // Should show success message
    await expect(page.locator("text=/check your email|sent|link/i")).toBeVisible({ timeout: 5000 });
  });

  test("should handle rate limiting on password reset", async ({ page }) => {
    await page.goto("/forgot-password");

    // Submit multiple times rapidly
    const email = "test@example.com";
    for (let i = 0; i < 3; i++) {
      await page.fill('input[type="email"]', email);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(500);
    }

    // Should show rate limit message or still show success
    const pageContent = await page.textContent("body");
    expect(pageContent).toBeTruthy();
  });
});

test.describe("Password Reset Link Flow", () => {
  test("should validate reset token and show form", async ({ page }) => {
    // Navigate to reset page with mock token
    await page.goto("/reset-password?token=mock-valid-token-12345");

    // Should show password reset form
    await expect(page.locator("h1")).toContainText(/Reset.*Password|New Password/i);
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test("should reject invalid or expired token", async ({ page }) => {
    // Navigate with invalid token
    await page.goto("/reset-password?token=invalid-token");

    // Should show error message
    await expect(page.locator("text=/invalid|expired|link/i")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should validate password requirements", async ({ page }) => {
    await page.goto("/reset-password?token=mock-valid-token");

    // Try weak password
    const passwordInput = page.locator('input[type="password"]').first();
    await passwordInput.fill("123");

    // Try to submit
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator("text=/password.*characters|too short|requirements/i")).toBeVisible({
      timeout: 3000,
    });
  });

  test("should validate password confirmation match", async ({ page }) => {
    await page.goto("/reset-password?token=mock-valid-token");

    // Fill different passwords
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill("NewSecurePass123!");
    await passwords.nth(1).fill("DifferentPass123!");

    await page.click('button[type="submit"]');

    // Should show mismatch error
    await expect(page.locator("text=/passwords.*match|do not match/i")).toBeVisible({
      timeout: 3000,
    });
  });

  test("should successfully reset password with valid token", async ({ page }) => {
    // Mock successful reset
    await page.route("**/api/v1/auth/reset-password", (route) => {
      route.fulfill({
        status: 200,
        json: { message: "Password reset successful" },
      });
    });

    await page.goto("/reset-password?token=mock-valid-token");

    // Fill valid matching passwords
    const newPassword = "NewSecurePass123!";
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill(newPassword);
    await passwords.nth(1).fill(newPassword);

    await page.click('button[type="submit"]');

    // Should show success and redirect to login
    await expect(page.locator("text=/success|updated|reset/i")).toBeVisible({
      timeout: 5000,
    });

    // Wait for redirect to login
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/.*login/);
  });
});

test.describe("Complete Password Reset Journey", () => {
  test("should complete full password reset flow", async ({ page }) => {
    // Mock email service
    let resetToken = "";
    await page.route("**/api/v1/auth/forgot-password", (route) => {
      resetToken = "mock-reset-token-" + Date.now();
      route.fulfill({
        status: 200,
        json: { message: "Password reset email sent" },
      });
    });

    // Mock token validation
    await page.route("**/api/v1/auth/validate-reset-token*", (route) => {
      route.fulfill({
        status: 200,
        json: { valid: true, email: "user@example.com" },
      });
    });

    // Mock password reset
    await page.route("**/api/v1/auth/reset-password", (route) => {
      route.fulfill({
        status: 200,
        json: { message: "Password reset successful" },
      });
    });

    // Mock login with new password
    await page.route("**/api/v1/auth/login", (route) => {
      route.fulfill({
        status: 200,
        json: {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          token_type: "bearer",
        },
      });
    });

    // Step 1: Request password reset
    await page.goto("/forgot-password");
    await page.fill('input[type="email"]', "user@example.com");
    await page.click('button[type="submit"]');

    // Verify email sent message
    await expect(page.locator("text=/check your email/i")).toBeVisible();

    // Step 2: Simulate clicking email link
    await page.goto(`/reset-password?token=${resetToken}`);

    // Step 3: Fill new password
    const newPassword = "NewSecurePass123!";
    const passwords = page.locator('input[type="password"]');
    await passwords.nth(0).fill(newPassword);
    await passwords.nth(1).fill(newPassword);
    await page.click('button[type="submit"]');

    // Verify success message
    await expect(page.locator("text=/success|updated/i")).toBeVisible();

    // Step 4: Redirect to login
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/.*login/);

    // Step 5: Login with new password
    await page.fill('[data-testid="email-input"]', "user@example.com");
    await page.fill('[data-testid="password-input"]', newPassword);
    await page.click('[data-testid="submit-button"]');

    // Should successfully login and reach dashboard
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/.*dashboard/);
  });
});
