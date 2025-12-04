/**
 * E2E tests for admin user journeys
 * Tests complete workflows that an admin would perform
 *
 * Configuration via environment variables:
 * - ISP_OPS_URL: Base URL for the ISP app (default: http://localhost:3001)
 * - E2E_ADMIN_USERNAME: Admin username (default: admin)
 * - E2E_ADMIN_PASSWORD: Admin password (default: admin123)
 */
import { test, expect } from "#e2e/fixtures";

import path from "path";

test.describe("Admin User Journey", () => {
  // Use environment variables with fallbacks
  const BASE_APP_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
  const TEST_USERNAME = process.env.E2E_ADMIN_USERNAME || "admin";
  const TEST_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin123";
  const BOOT_TIMEOUT = parseInt(process.env.E2E_NAV_TIMEOUT || "120000", 10);
  const SELECTOR_TIMEOUT = parseInt(process.env.E2E_SELECTOR_TIMEOUT || "15000", 10);
  const AUTH_STATE = path.resolve(__dirname, "../../.auth/isp-admin.json");

  test.use({ storageState: AUTH_STATE });

  /**
   * Helper to login using test E2E hook
   *
   * NOTE: This uses a custom __e2e_login function exposed by the app for testing.
   * This bypasses react-hook-form to avoid flakiness in E2E tests.
   *
   * For testing the actual login form UI, see login-form.spec.ts
   */
  async function login(page: any) {
    await page.goto(`${BASE_APP_URL}/login`, { waitUntil: "load", timeout: BOOT_TIMEOUT });

    // Listen for console logs
    page.on("console", (msg) => console.log(`[Browser Console] ${msg.text()}`));

    // Listen for all network requests
    page.on("request", (request: any) => {
      if (request.url().includes("/auth/login")) {
        console.log(`[Network Request] POST /auth/login`);
      }
    });
    page.on("response", async (response: any) => {
      if (response.url().includes("/auth/login")) {
        const status = response.status();
        console.log(`[Network Response] ${status} /auth/login`);
      }
    });

    // Wait for the E2E login function to be available
    await page.waitForFunction(() => (window as any).__e2e_login !== undefined, {
      timeout: BOOT_TIMEOUT,
    });

    // Call the login function (don't await the inner promise, just trigger it)
    await page.evaluate(
      (credentials: { username: string; password: string }) => {
        const loginFn = (window as any).__e2e_login;
        console.log("[E2E] Calling __e2e_login function");
        // Trigger login but don't await - let it run asynchronously
        loginFn(credentials.username, credentials.password);
      },
      { username: TEST_USERNAME, password: TEST_PASSWORD },
    );

    // Wait for redirect to dashboard (this happens after login completes)
    await page.waitForURL(/dashboard/, { timeout: BOOT_TIMEOUT });
  }

  async function ensureAuthenticated(page: any) {
    await page.goto(`${BASE_APP_URL}/dashboard`, {
      waitUntil: "load",
      timeout: BOOT_TIMEOUT,
    });

    if (page.url().includes("/login")) {
      await login(page);
    }
  }

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test("admin can navigate dashboard", async ({ page }) => {
    // Should be on dashboard
    await expect(page).toHaveURL(/dashboard/);

    // Look for dashboard elements
    const dashboardContent = page.locator('[data-testid="dashboard"], .dashboard, main').first();
    await expect(dashboardContent).toBeVisible();

    console.log("✅ Admin successfully accessed dashboard");
  });

  test("admin can access user management", async ({ page }) => {
    // Navigate to user management - assert the link exists
    const userManagementLink = page
      .locator('[data-testid="users-link"], a:has-text("Users"), a[href*="users"]')
      .first();

    // FIXED: Assert the link is visible instead of silently logging
    await expect(userManagementLink).toBeVisible({
      timeout: SELECTOR_TIMEOUT,
    });

    await userManagementLink.click();
    await page.waitForLoadState("networkidle");

    // Assert we navigated to user management page
    await expect(page).toHaveURL(/users/);

    // Look for user list - assert it exists
    const userList = page.locator('[data-testid="user-list"], table, .user-table').first();
    await expect(userList).toBeVisible({ timeout: SELECTOR_TIMEOUT });

    console.log("✅ User management page accessible and user list displayed");
  });

  test("admin can access settings", async ({ page }) => {
    // Navigate to settings - assert the link exists
    const settingsLink = page
      .locator('[data-testid="settings-link"], a:has-text("Settings"), a[href*="settings"]')
      .first();

    // FIXED: Assert the link is visible instead of silently logging
    await expect(settingsLink).toBeVisible({
      timeout: SELECTOR_TIMEOUT,
    });

    await settingsLink.click();
    await page.waitForLoadState("networkidle");

    // Assert we navigated to settings page
    await expect(page).toHaveURL(/settings/);

    // Look for settings content - assert it exists
    const settingsContent = page.locator('[data-testid="settings"], .settings, form').first();
    await expect(settingsContent).toBeVisible({ timeout: SELECTOR_TIMEOUT });

    console.log("✅ Settings page accessible and settings content displayed");
  });

  test("admin can logout", async ({ page }) => {
    // Look for logout button - assert it exists
    const logoutButton = page
      .locator(
        '[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")',
      )
      .first();

    // FIXED: Try both direct logout button and user menu, but fail if neither found
    const hasDirectLogout = await logoutButton
      .isVisible({ timeout: SELECTOR_TIMEOUT })
      .catch(() => false);

    if (hasDirectLogout) {
      await logoutButton.click();
    } else {
      // Try user menu approach - assert the menu exists
      const userMenu = page
        .locator('[data-testid="user-menu"], .user-menu, [aria-label="User menu"]')
        .first();

      await expect(userMenu).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });

      await userMenu.click();

      const logoutInMenu = page
        .locator('button:has-text("Logout"), button:has-text("Sign out")')
        .first();

      await expect(logoutInMenu).toBeVisible({ timeout: SELECTOR_TIMEOUT });
      await logoutInMenu.click();
    }

    // Assert redirect to login page
    await page.waitForURL(/login/, { timeout: BOOT_TIMEOUT });
    await expect(page).toHaveURL(/login/);

    console.log("✅ Admin successfully logged out");
  });

  test("admin has access to core features", async ({ page }) => {
    // FIXED: This test now validates that critical features are accessible
    await page.goto(`${BASE_APP_URL}/dashboard`);

    // Define critical admin features that MUST be available
    const criticalFeatures = [
      { selector: 'a:has-text("Dashboard"), a[href*="dashboard"]', name: "Dashboard" },
    ];

    // Define optional features to document
    const optionalFeatures = [
      { selector: 'a:has-text("Users"), a[href*="users"]', name: "User Management" },
      { selector: 'a:has-text("Settings"), a[href*="settings"]', name: "Settings" },
      { selector: 'a:has-text("Analytics"), a[href*="analytics"]', name: "Analytics" },
      { selector: 'a:has-text("Billing"), a[href*="billing"]', name: "Billing" },
      { selector: 'a:has-text("Admin"), a[href*="admin"]', name: "Admin Panel" },
    ];

    const availableFeatures: string[] = [];
    const missingCritical: string[] = [];

    // Validate critical features exist
    for (const feature of criticalFeatures) {
      const element = page.locator(feature.selector).first();
      const isVisible = await element.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false);

      if (isVisible) {
        availableFeatures.push(feature.name);
      } else {
        missingCritical.push(feature.name);
      }
    }

    // Document optional features
    for (const feature of optionalFeatures) {
      const element = page.locator(feature.selector).first();
      const isVisible = await element.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false);

      if (isVisible) {
        availableFeatures.push(feature.name);
      }
    }

    console.log("✅ Available admin features:", availableFeatures);

    // FIXED: Assert critical features are present instead of always passing
    expect(missingCritical).toHaveLength(0);
    expect(availableFeatures.length).toBeGreaterThan(0);

    // Additional assertion: should have at least Dashboard + 1 other feature
    expect(availableFeatures.length).toBeGreaterThanOrEqual(2);
  });
});
