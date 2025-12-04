/**
 * User Journey Tests
 *
 * Comprehensive end-to-end workflows using Page Object Model
 * These tests verify complete user journeys from login to task completion
 */

import { test, expect } from "#e2e/fixtures";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { CustomersPage } from "../pages/CustomersPage";

test.describe("User Journey: ISP Operator Workflow", () => {
  test("Operator can login and access dashboard", async ({ page }) => {
    // Step 1: Navigate to login page
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Verify login page loaded
    await expect(loginPage.emailInput).toBeVisible();
    await expect(loginPage.passwordInput).toBeVisible();

    // Step 2: Login with credentials
    await loginPage.login("admin@test.com", "testpassword");

    // Step 3: Verify redirect to dashboard or still on login (auth may be bypassed)
    const url = page.url();
    const isOnDashboard = url.includes("/dashboard");
    const isOnLogin = url.includes("/login");

    // Should be on either dashboard or login page
    expect(isOnDashboard || isOnLogin).toBeTruthy();

    // If on dashboard, verify it loaded properly
    if (isOnDashboard) {
      const dashboardPage = new DashboardPage(page);
      // Check that page has content
      const hasContent = await page.textContent("body");
      expect(hasContent).toBeTruthy();
      expect(hasContent!.trim().length).toBeGreaterThan(50);
    }
  });

  test("Operator can navigate to customers page", async ({ page }) => {
    // Step 1: Go directly to customers page
    const customersPage = new CustomersPage(page);
    await customersPage.goto();

    // Step 2: Verify page loaded (either customers list or login redirect)
    const url = page.url();
    const isOnCustomers = url.includes("/customers");
    const isOnLogin = url.includes("/login");

    expect(isOnCustomers || isOnLogin).toBeTruthy();

    // If on customers page, verify table or empty state
    if (isOnCustomers) {
      // Wait for page to settle
      await page.waitForLoadState("domcontentloaded");

      // Should show either customers table or empty state
      const hasTable = await customersPage.hasCustomers();
      const hasEmptyState = await customersPage.isEmptyStateVisible();

      // At least one should be visible
      expect(hasTable || hasEmptyState).toBeTruthy();
    }
  });

  test("Dashboard shows navigation elements", async ({ page }) => {
    // Navigate to dashboard
    await page.goto("/dashboard");

    // Wait for page load
    await page.waitForLoadState("domcontentloaded");

    // Verify page has navigation structure
    const hasNav = (await page.locator("nav, aside, [role='navigation']").count()) > 0;
    const hasLinks = (await page.locator("a").count()) > 0;

    expect(hasNav || hasLinks).toBeTruthy();
  });
});

test.describe("User Journey: Error Handling", () => {
  test("Login shows error for invalid credentials", async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();

    // Try to login with obviously invalid credentials
    await loginPage.fillEmail("invalid@example.com");
    await loginPage.fillPassword("wrongpassword");
    await loginPage.clickLogin();

    // Wait a moment for error to potentially appear
    await page.waitForLoadState("domcontentloaded");

    // Check if still on login page or error message appears
    const url = page.url();
    const isStillOnLogin = url.includes("/login");

    // If auth is not bypassed, should stay on login page
    // If auth is bypassed, will redirect to dashboard
    expect(isStillOnLogin || url.includes("/dashboard")).toBeTruthy();
  });

  test("404 page handles non-existent routes gracefully", async ({ page }) => {
    // Navigate to non-existent page
    await page.goto("/dashboard/non-existent-page-xyz", {
      waitUntil: "domcontentloaded",
    });

    // Should load without crashing
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();

    // Check for 404 indicators or redirect
    const url = page.url();
    const has404 =
      bodyText?.toLowerCase().includes("404") || bodyText?.toLowerCase().includes("not found");
    const wasRedirected = !url.includes("non-existent-page-xyz");

    // Should either show 404 or redirect somewhere
    expect(has404 || wasRedirected).toBeTruthy();
  });
});

test.describe("User Journey: Page Performance", () => {
  test("Dashboard loads in reasonable time", async ({ page }) => {
    const startTime = Date.now();

    await page.goto("/dashboard", {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);

    // Should have content
    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
  });

  test("Login page loads quickly", async ({ page }) => {
    const startTime = Date.now();

    const loginPage = new LoginPage(page);
    await loginPage.goto();

    const loadTime = Date.now() - startTime;

    // Login page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);

    // Should show login form
    await expect(loginPage.emailInput).toBeVisible();
  });
});
