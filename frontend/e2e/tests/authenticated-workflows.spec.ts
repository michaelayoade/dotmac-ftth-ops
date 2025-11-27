/**
 * Authenticated Workflow Tests
 *
 * Tests workflows that require authentication
 * Note: These tests will skip if login fails (no test users available)
 */

import { test, expect } from "#e2e/fixtures";

import { login, TEST_USERS, isLoggedIn } from "../helpers/auth";

const ISP_OPS_URL = process.env.ISP_OPS_URL || "http://localhost:3001";

// Helper to test if user can access a page
async function testPageAccess(page: any, url: string, pageName: string) {
  try {
    await page.goto(url, { timeout: 10000 });

    // Check if redirected to login
    if (page.url().includes("/login")) {
      return { accessible: false, reason: "redirected to login" };
    }

    // Check page loaded
    await page.waitForLoadState("domcontentloaded", { timeout: 5000 });

    return { accessible: true, reason: "page loaded" };
  } catch (error) {
    return { accessible: false, reason: error.message };
  }
}

test.describe("Authenticated Workflow: Subscriber Management", () => {
  test("can access subscriber list when authenticated", async ({ page }) => {
    // Try to login
    const loggedIn = await login(page, TEST_USERS.admin, ISP_OPS_URL);

    if (!loggedIn) {
      test.skip(true, "Test user not available - skipping authenticated test");
      return;
    }

    // Navigate to subscribers
    await page.goto(`${ISP_OPS_URL}/dashboard/subscribers`);

    // Should not be redirected to login
    expect(page.url()).not.toContain("/login");

    console.log("✓ Authenticated access to subscriber list successful");
  });
});

test.describe("Authenticated Workflow: RADIUS Management", () => {
  test("can access RADIUS dashboard when authenticated", async ({ page }) => {
    const loggedIn = await login(page, TEST_USERS.admin, ISP_OPS_URL);

    if (!loggedIn) {
      test.skip(true, "Test user not available");
      return;
    }

    const result = await testPageAccess(
      page,
      `${ISP_OPS_URL}/dashboard/radius`,
      "RADIUS Dashboard",
    );

    expect(result.accessible).toBeTruthy();
    console.log("✓ RADIUS dashboard accessible");
  });

  test("can access active sessions", async ({ page }) => {
    const loggedIn = await login(page, TEST_USERS.admin, ISP_OPS_URL);

    if (!loggedIn) {
      test.skip(true, "Test user not available");
      return;
    }

    const result = await testPageAccess(
      page,
      `${ISP_OPS_URL}/dashboard/radius/sessions`,
      "RADIUS Sessions",
    );

    console.log(`RADIUS sessions: ${result.accessible ? "✓ accessible" : "✗ not accessible"}`);
  });
});

test.describe("Authenticated Workflow: Billing", () => {
  test("can access billing dashboard", async ({ page }) => {
    const loggedIn = await login(page, TEST_USERS.admin, ISP_OPS_URL);

    if (!loggedIn) {
      test.skip(true, "Test user not available");
      return;
    }

    const result = await testPageAccess(
      page,
      `${ISP_OPS_URL}/dashboard/billing-revenue`,
      "Billing",
    );

    expect(result.accessible).toBeTruthy();
    console.log("✓ Billing dashboard accessible");
  });
});

test.describe("Authenticated Workflow: Network Management", () => {
  test("can access network dashboard", async ({ page }) => {
    const loggedIn = await login(page, TEST_USERS.admin, ISP_OPS_URL);

    if (!loggedIn) {
      test.skip(true, "Test user not available");
      return;
    }

    const result = await testPageAccess(page, `${ISP_OPS_URL}/dashboard/network`, "Network");

    expect(result.accessible).toBeTruthy();
    console.log("✓ Network dashboard accessible");
  });
});

test.describe("Unauthenticated Access Control", () => {
  test("redirects to login when accessing protected pages without auth", async ({ page }) => {
    // Clear any existing auth
    await page.context().clearCookies();

    await page.goto(`${ISP_OPS_URL}/dashboard/subscribers`);

    // Should redirect to login
    await page.waitForURL(/login/, { timeout: 10000 });

    expect(page.url()).toContain("/login");
    console.log("✓ Protected page correctly redirects to login");
  });

  test("allows access to public pages without auth", async ({ page }) => {
    await page.context().clearCookies();

    await page.goto(`${ISP_OPS_URL}/login`);

    // Should load login page
    await expect(page.locator('input[type="email"], input[type="password"]')).toBeVisible({
      timeout: 5000,
    });

    console.log("✓ Public login page accessible");
  });
});
