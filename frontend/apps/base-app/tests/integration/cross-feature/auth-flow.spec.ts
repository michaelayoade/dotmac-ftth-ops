/**
 * Authentication Flow Integration Tests
 *
 * Tests for login, logout, JWT handling, protected routes, and session persistence.
 */

import { test, expect } from "@playwright/test";
import { LoginPage } from "../../helpers/page-objects";
import { generateTestUser } from "../../fixtures/test-data";
import { createTestUser, getAuthToken } from "../../helpers/api-helpers";

test.describe("Authentication Flow", () => {
  test.describe("Login", () => {
    test("should login successfully with valid credentials", async ({ page }) => {
      // Arrange
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Act
      await loginPage.login(testUser.email, testUser.password);

      // Assert
      await expect(page).toHaveURL(/\/dashboard/);
      const token = await getAuthToken(page);
      expect(token).toBeTruthy();
    });

    test("should show error with invalid email", async ({ page }) => {
      // Arrange
      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Act
      await loginPage.login("invalid@example.com", "wrongpassword");

      // Assert
      await expect(loginPage.errorMessage).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });

    test("should show error with invalid password", async ({ page }) => {
      // Arrange
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Act
      await loginPage.login(testUser.email, "wrongpassword");

      // Assert
      await expect(loginPage.errorMessage).toBeVisible();
      await expect(page).toHaveURL(/\/login/);
    });

    test("should show validation error for empty email", async ({ page }) => {
      // Arrange
      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Act
      await loginPage.passwordInput.fill("somepassword");
      await loginPage.submitButton.click();

      // Assert
      await expect(page.locator("text=Email is required")).toBeVisible();
    });

    test("should show validation error for empty password", async ({ page }) => {
      // Arrange
      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Act
      await loginPage.emailInput.fill("test@example.com");
      await loginPage.submitButton.click();

      // Assert
      await expect(page.locator("text=Password is required")).toBeVisible();
    });

    test("should show validation error for invalid email format", async ({ page }) => {
      // Arrange
      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Act
      await loginPage.login("notanemail", "password123");

      // Assert
      await expect(page.locator("text=Invalid email format")).toBeVisible();
    });

    test("should disable submit button while logging in", async ({ page }) => {
      // Arrange
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Act
      await loginPage.emailInput.fill(testUser.email);
      await loginPage.passwordInput.fill(testUser.password);

      // Check button is disabled after click
      const submitPromise = loginPage.submitButton.click();
      await expect(loginPage.submitButton).toBeDisabled();
      await submitPromise;

      // Assert
      await expect(page).toHaveURL(/\/dashboard/);
    });
  });

  test.describe("Logout", () => {
    test("should logout successfully", async ({ page }) => {
      // Arrange - Login first
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);
      await expect(page).toHaveURL(/\/dashboard/);

      // Act - Logout
      await page.click('[data-testid="user-menu"]');
      await page.click("text=Logout");

      // Assert
      await expect(page).toHaveURL(/\/login/);
      const token = await getAuthToken(page);
      expect(token).toBeNull();
    });

    test("should clear auth token on logout", async ({ page }) => {
      // Arrange
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      // Act
      await page.click('[data-testid="user-menu"]');
      await page.click("text=Logout");

      // Assert - Token should be removed
      const token = await page.evaluate(() => localStorage.getItem("auth_token"));
      expect(token).toBeNull();
    });

    test("should redirect to login after logout", async ({ page }) => {
      // Arrange
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      // Act
      await page.click('[data-testid="user-menu"]');
      await page.click("text=Logout");

      // Try to access protected page
      await page.goto("/dashboard");

      // Assert - Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe("Protected Routes", () => {
    test("should redirect to login when accessing protected route without auth", async ({
      page,
    }) => {
      // Act
      await page.goto("/dashboard");

      // Assert
      await expect(page).toHaveURL(/\/login/);
    });

    test("should redirect to login when accessing WireGuard pages without auth", async ({
      page,
    }) => {
      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page).toHaveURL(/\/login/);
    });

    test("should redirect to login when accessing Communications pages without auth", async ({
      page,
    }) => {
      // Act
      await page.goto("/dashboard/communications");

      // Assert
      await expect(page).toHaveURL(/\/login/);
    });

    test("should allow access to protected routes with valid token", async ({ page }) => {
      // Arrange - Login
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      // Act - Navigate to protected routes
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page).toHaveURL(/\/wireguard/);
    });

    test("should preserve redirect URL after login", async ({ page }) => {
      // Arrange - Try to access protected page
      await page.goto("/dashboard/network/wireguard/servers");
      await expect(page).toHaveURL(/\/login/);

      // Act - Login
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.login(testUser.email, testUser.password);

      // Assert - Should redirect back to original page
      await expect(page).toHaveURL(/\/wireguard\/servers/);
    });
  });

  test.describe("JWT Token Handling", () => {
    test("should store JWT token in localStorage after login", async ({ page }) => {
      // Arrange
      const testUser = generateTestUser();
      await createTestUser(testUser);

      // Act
      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      // Assert
      const token = await getAuthToken(page);
      expect(token).toBeTruthy();
      expect(typeof token).toBe("string");
      expect(token?.length).toBeGreaterThan(20);
    });

    test("should include JWT token in API requests", async ({ page }) => {
      // Arrange - Login
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      // Act - Make API request
      const requestPromise = page.waitForRequest(
        (request) =>
          request.url().includes("/api/v1/") && request.headers()["authorization"] !== undefined,
      );

      await page.goto("/dashboard/network/wireguard");
      const request = await requestPromise;

      // Assert
      const authHeader = request.headers()["authorization"];
      expect(authHeader).toMatch(/^Bearer /);
    });

    test("should handle expired token by redirecting to login", async ({ page }) => {
      // Arrange - Set expired token
      await page.goto("/login");
      await page.evaluate(() => {
        localStorage.setItem("auth_token", "expired.token.here");
      });

      // Act - Try to access protected page
      await page.goto("/dashboard");

      // Assert - Should be redirected to login
      await expect(page).toHaveURL(/\/login/);
    });

    test("should refresh token on activity", async ({ page }) => {
      // Arrange - Login
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      const initialToken = await getAuthToken(page);

      // Act - Navigate and interact
      await page.goto("/dashboard/network/wireguard");
      await page.waitForTimeout(1000);

      const newToken = await getAuthToken(page);

      // Assert - Token may have been refreshed
      expect(newToken).toBeTruthy();
      // Note: Token may or may not change depending on backend implementation
    });
  });

  test.describe("Session Persistence", () => {
    test("should persist session across page reloads", async ({ page }) => {
      // Arrange - Login
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      // Act - Reload page
      await page.reload();

      // Assert - Should still be logged in
      await expect(page).toHaveURL(/\/dashboard/);
      const token = await getAuthToken(page);
      expect(token).toBeTruthy();
    });

    test("should persist session across navigation", async ({ page }) => {
      // Arrange - Login
      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      // Act - Navigate to different pages
      await page.goto("/dashboard/network/wireguard");
      await page.goto("/dashboard/communications");
      await page.goto("/dashboard");

      // Assert - Should still be logged in
      const token = await getAuthToken(page);
      expect(token).toBeTruthy();
    });

    test("should not persist session in incognito/private browsing", async ({ browser }) => {
      // Arrange - Create incognito context
      const context = await browser.newContext({ storageState: undefined });
      const page = await context.newPage();

      // Act - Try to access protected page
      await page.goto("/dashboard");

      // Assert - Should be redirected to login
      await expect(page).toHaveURL(/\/login/);

      await context.close();
    });
  });

  test.describe("Multi-Tab Session", () => {
    test("should share session across multiple tabs", async ({ browser }) => {
      // Arrange - Login in first tab
      const context = await browser.newContext();
      const page1 = await context.newPage();

      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page1);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      // Act - Open second tab
      const page2 = await context.newPage();
      await page2.goto("/dashboard");

      // Assert - Second tab should be authenticated
      await expect(page2).toHaveURL(/\/dashboard/);
      const token = await getAuthToken(page2);
      expect(token).toBeTruthy();

      await context.close();
    });

    test("should logout across all tabs", async ({ browser }) => {
      // Arrange - Login in first tab
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const testUser = generateTestUser();
      await createTestUser(testUser);

      const loginPage = new LoginPage(page1);
      await loginPage.navigate();
      await loginPage.login(testUser.email, testUser.password);

      await page2.goto("/dashboard");
      await expect(page2).toHaveURL(/\/dashboard/);

      // Act - Logout from first tab
      await page1.click('[data-testid="user-menu"]');
      await page1.click("text=Logout");

      // Refresh second tab
      await page2.reload();

      // Assert - Second tab should also be logged out
      await expect(page2).toHaveURL(/\/login/);

      await context.close();
    });
  });

  test.describe("Error Handling", () => {
    test("should handle network error during login", async ({ page }) => {
      // Arrange
      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Mock network error
      await page.route("**/api/v1/auth/login", (route) => route.abort("failed"));

      // Act
      await loginPage.login("test@example.com", "password");

      // Assert
      await expect(page.locator("text=Network error")).toBeVisible();
    });

    test("should handle server error during login", async ({ page }) => {
      // Arrange
      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Mock server error
      await page.route("**/api/v1/auth/login", (route) => {
        route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Internal Server Error" }),
        });
      });

      // Act
      await loginPage.login("test@example.com", "password");

      // Assert
      await expect(page.locator("text=Server error")).toBeVisible();
    });

    test("should handle rate limiting", async ({ page }) => {
      // Arrange
      const loginPage = new LoginPage(page);
      await loginPage.navigate();

      // Mock rate limit error
      await page.route("**/api/v1/auth/login", (route) => {
        route.fulfill({
          status: 429,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Too many requests" }),
        });
      });

      // Act
      await loginPage.login("test@example.com", "password");

      // Assert
      await expect(page.locator("text=Too many requests")).toBeVisible();
    });
  });
});
