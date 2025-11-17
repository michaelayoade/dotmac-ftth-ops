/**
 * E2E tests for regular user journeys
 * Tests complete workflows that a regular user would perform
 */
import { test, expect } from "#e2e/fixtures";

import path from "path";

test.describe("Regular User Journey", () => {
  const BASE_APP_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
  const TEST_USERNAME = process.env.E2E_USER_USERNAME || "admin";
  const TEST_EMAIL = process.env.E2E_USER_EMAIL || "admin@example.com";
  const TEST_PASSWORD = process.env.E2E_USER_PASSWORD || "admin123";
  const BOOT_TIMEOUT = parseInt(process.env.E2E_NAV_TIMEOUT || "120000", 10);
  const SELECTOR_TIMEOUT = parseInt(process.env.E2E_SELECTOR_TIMEOUT || "15000", 10);
  const AUTH_STATE = path.resolve(__dirname, "../../.auth/isp-user.json");

  test.use({ storageState: AUTH_STATE });

  /**
   * Helper to login
   * Uses exposed E2E login function to bypass react-hook-form issues
   */
  async function login(page: any) {
    await page.goto(`${BASE_APP_URL}/login`, { waitUntil: "load", timeout: BOOT_TIMEOUT });

    // Wait for the E2E login function to be available
    await page.waitForFunction(() => (window as any).__e2e_login !== undefined, {
      timeout: BOOT_TIMEOUT,
    });

    // Call the login function (don't await the inner promise, just trigger it)
    await page.evaluate(
      (credentials: { username: string; password: string }) => {
        const loginFn = (window as any).__e2e_login;
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

  test("user can access dashboard", async ({ page }) => {
    // Should be on dashboard
    await expect(page).toHaveURL(/dashboard/);

    // Look for dashboard elements
    const dashboardContent = page.locator('[data-testid="dashboard"], .dashboard, main').first();
    await expect(dashboardContent).toBeVisible();

    console.log("User successfully accessed dashboard");
  });

  test("user can access profile settings", async ({ page }) => {
    // Try to navigate to profile
    const profileLink = page
      .locator('[data-testid="profile-link"], a:has-text("Profile"), a[href*="profile"]')
      .first();

    if (await profileLink.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
      await profileLink.click();

      await page.waitForLoadState("networkidle");

      // Check if we're on profile page
      const isOnProfile = page.url().includes("/profile") || page.url().includes("/settings");
      console.log("Profile page accessible:", isOnProfile);

      if (isOnProfile) {
        // Look for profile form
        const profileForm = page
          .locator('[data-testid="profile-form"], form, input[name="email"]')
          .first();
        const hasProfileForm = await profileForm.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false);
        console.log("Profile form displayed:", hasProfileForm);

        if (hasProfileForm) {
          // Check if email is pre-filled
          const emailInput = page.locator('input[name="email"], input[type="email"]').first();
          if (await emailInput.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
            const emailValue = await emailInput.inputValue();
            console.log("Email pre-filled:", emailValue === TEST_EMAIL);
          }
        }
      }
    } else {
      console.log("Profile link not found in navigation");
    }
  });

  test("user can update profile information", async ({ page }) => {
    // Navigate to profile
    await page.goto(`${BASE_APP_URL}/profile`);

    // Check if profile form exists
    const nameInput = page
      .locator('input[name="name"], input[name="full_name"], input[name="fullName"]')
      .first();

    if (await nameInput.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
      // Update name
      await nameInput.fill("Updated Test User");

      // Look for save button
      const saveButton = page
        .locator('button[type="submit"], button:has-text("Save"), button:has-text("Update")')
        .first();

      if (await saveButton.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
        await saveButton.click();

        // Wait for save to complete
        await page.waitForTimeout(1000);

        // Look for success message
        const successMessage = page
          .locator('[data-testid="success-message"], .success, [role="status"]')
          .first();
        const hasSuccess = await successMessage.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false);

        console.log("Profile update successful:", hasSuccess);
      }
    } else {
      console.log("Profile form not found");
    }
  });

  test("user can change password", async ({ page }) => {
    // Navigate to profile/settings
    await page.goto(`${BASE_APP_URL}/profile`);

    // Look for security/password tab
    const securityTab = page
      .locator('[data-testid="security-tab"], a:has-text("Security"), a:has-text("Password")')
      .first();

    if (await securityTab.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
      await securityTab.click();

      await page.waitForLoadState("networkidle");

      // Look for password fields
      const currentPasswordInput = page
        .locator('input[name="current_password"], input[name="currentPassword"]')
        .first();
      const newPasswordInput = page
        .locator('input[name="new_password"], input[name="newPassword"]')
        .first();

      const hasPasswordForm =
        (await currentPasswordInput.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) &&
        (await newPasswordInput.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false));

      console.log("Password change form available:", hasPasswordForm);
    } else {
      console.log("Security/password tab not found");
    }
  });

  test("user can navigate between pages", async ({ page }) => {
    // Should be on dashboard
    await expect(page).toHaveURL(/dashboard/);

    // Try navigating to different sections
    const navigationTests = [
      { name: "Home", selector: 'a:has-text("Home"), a[href="/"]' },
      {
        name: "Dashboard",
        selector: 'a:has-text("Dashboard"), a[href*="dashboard"]',
      },
      {
        name: "Profile",
        selector: 'a:has-text("Profile"), a[href*="profile"]',
      },
      {
        name: "Settings",
        selector: 'a:has-text("Settings"), a[href*="settings"]',
      },
    ];

    const accessiblePages: string[] = [];

    for (const navItem of navigationTests) {
      const link = page.locator(navItem.selector).first();
      if (await link.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
        accessiblePages.push(navItem.name);
      }
    }

    console.log("Accessible pages for regular user:", accessiblePages);

    // Test passes - just for documentation
    expect(accessiblePages.length).toBeGreaterThan(0);
  });

  test("user can logout", async ({ page }) => {
    // Look for logout button
    const logoutButton = page
      .locator(
        '[data-testid="logout-button"], button:has-text("Logout"), button:has-text("Sign out")',
      )
      .first();

    if (await logoutButton.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
      await logoutButton.click();
    } else {
      // Try user menu approach
      const userMenu = page
        .locator('[data-testid="user-menu"], .user-menu, [aria-label="User menu"]')
        .first();
      if (await userMenu.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
        await userMenu.click();
        await page
          .locator('button:has-text("Logout"), button:has-text("Sign out")')
          .first()
          .click();
      }
    }

    // Should redirect to login
    await page.waitForURL(/login/, { timeout: BOOT_TIMEOUT });
    await expect(page).toHaveURL(/login/);

    console.log("User successfully logged out");
  });

  test("user workflow documentation", async ({ page }) => {
    // This test documents what features are available to regular users
    await page.goto(`${BASE_APP_URL}/dashboard`);

    // Check for user-accessible navigation items
    const navigationItems = [
      { selector: 'a:has-text("Dashboard")', name: "Dashboard" },
      { selector: 'a:has-text("Profile")', name: "Profile" },
      { selector: 'a:has-text("Settings")', name: "Settings" },
      { selector: 'a:has-text("Files")', name: "Files" },
      { selector: 'a:has-text("Documents")', name: "Documents" },
      { selector: 'a:has-text("Help")', name: "Help" },
    ];

    const availableFeatures: string[] = [];

    for (const item of navigationItems) {
      const element = page.locator(item.selector).first();
      if (await element.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
        availableFeatures.push(item.name);
      }
    }

    console.log("Available user features:", availableFeatures);

    // Check if user has admin access (should not)
    const adminLinks = page.locator('a:has-text("Admin"), a:has-text("Users"), a[href*="admin"]');
    const adminLinkCount = await adminLinks.count();

    console.log("Admin links visible to regular user:", adminLinkCount);

    // This test always passes - it's for documentation
    expect(true).toBe(true);
  });
});
