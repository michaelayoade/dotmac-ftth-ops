/**
 * Audit Dashboard - Integration Tests
 *
 * Tests the audit & compliance dashboard integration with backend API.
 * Part of BSS Phase 1 UI implementation.
 */

import { test, expect } from "@playwright/test";

const AUDIT_PAGE = "/dashboard/platform-admin/audit";

test.describe("Audit Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Login as platform admin
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "admin");
    await page.fill('[data-testid="password-input"]', "admin123");
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL("/dashboard");
    await page.goto(AUDIT_PAGE);
  });

  test("should display audit page with tabs", async ({ page }) => {
    // Verify page loaded
    await expect(page.locator("h1")).toContainText("Audit");

    // Verify tabs exist
    await expect(page.locator('button:has-text("Summary Dashboard")')).toBeVisible();
    await expect(page.locator('button:has-text("Activity Log")')).toBeVisible();
  });

  test("should display summary dashboard with metrics", async ({ page }) => {
    // Click summary tab
    await page.click('button:has-text("Summary Dashboard")');

    // Wait for API response
    await page.waitForResponse((response) =>
      response.url().includes("/api/v1/audit/activities/summary"),
    );

    // Verify metric cards
    await expect(page.locator("text=Total Activities")).toBeVisible();
    await expect(page.locator("text=Critical Alerts")).toBeVisible();
    await expect(page.locator("text=High Priority")).toBeVisible();
    await expect(page.locator("text=Active Users")).toBeVisible();
  });

  test("should display severity distribution chart", async ({ page }) => {
    // Click summary tab
    await page.click('button:has-text("Summary Dashboard")');

    await page.waitForResponse((response) =>
      response.url().includes("/api/v1/audit/activities/summary"),
    );

    // Verify severity chart section
    await expect(page.locator("text=Activity Severity Distribution")).toBeVisible();
    await expect(page.locator("text=CRITICAL")).toBeVisible();
    await expect(page.locator("text=HIGH")).toBeVisible();
    await expect(page.locator("text=MEDIUM")).toBeVisible();
    await expect(page.locator("text=LOW")).toBeVisible();
  });

  test("should display top activity types", async ({ page }) => {
    await page.click('button:has-text("Summary Dashboard")');

    await page.waitForResponse((response) =>
      response.url().includes("/api/v1/audit/activities/summary"),
    );

    // Verify top activity types section
    await expect(page.locator("text=Top Activity Types")).toBeVisible();
  });

  test("should display activity timeline", async ({ page }) => {
    await page.click('button:has-text("Summary Dashboard")');

    await page.waitForResponse((response) =>
      response.url().includes("/api/v1/audit/activities/summary"),
    );

    // Verify timeline section
    await expect(page.locator("text=Activity Timeline")).toBeVisible();
  });

  test("should allow time range selection", async ({ page }) => {
    await page.click('button:has-text("Summary Dashboard")');

    await page.waitForResponse((response) =>
      response.url().includes("/api/v1/audit/activities/summary"),
    );

    // Click time range selector
    await page.click('[role="combobox"]');

    // Select 30 days
    await page.click("text=Last 30 days");

    // Wait for new data
    await page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/audit/activities/summary") &&
        response.url().includes("days=30"),
    );

    // Verify data refreshed
    await expect(page.locator("text=/Last 30 days/i")).toBeVisible();
  });

  test("should refresh summary data on button click", async ({ page }) => {
    await page.click('button:has-text("Summary Dashboard")');

    await page.waitForResponse((response) =>
      response.url().includes("/api/v1/audit/activities/summary"),
    );

    // Click refresh button
    await page.click('button:has-text("Refresh")');

    // Verify loading state
    await expect(page.locator(".animate-spin")).toBeVisible({ timeout: 1000 });

    // Wait for refresh
    await page.waitForResponse((response) =>
      response.url().includes("/api/v1/audit/activities/summary"),
    );
  });
});

test.describe("Audit Activity Log", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "admin@example.com");
    await page.fill('[data-testid="password-input"]', "admin123");
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL("/dashboard");
    await page.goto(AUDIT_PAGE);
  });

  test("should display activity log with entries", async ({ page }) => {
    // Click activity log tab
    await page.click('button:has-text("Activity Log")');

    // Wait for activities API
    await page.waitForResponse((response) => response.url().includes("/api/v1/audit/activities"));

    // Verify activities displayed
    await expect(page.locator("text=Platform Audit Log")).toBeVisible();
  });

  test("should filter activities by severity", async ({ page }) => {
    await page.click('button:has-text("Activity Log")');

    await page.waitForResponse((response) => response.url().includes("/api/v1/audit/activities"));

    // Open severity filter
    await page.click('select[name*="severity" i], [role="combobox"]:has-text("Severity")');

    // Select CRITICAL
    await page.click("text=Critical");

    // Wait for filtered results
    await page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/audit/activities") &&
        response.url().includes("severity=critical"),
    );

    // Verify filtered results
    await expect(page.locator("text=CRITICAL").first()).toBeVisible();
  });

  test("should filter activities by activity type", async ({ page }) => {
    await page.click('button:has-text("Activity Log")');

    await page.waitForResponse((response) => response.url().includes("/api/v1/audit/activities"));

    // Open activity type filter
    await page.fill('input[placeholder*="activity type" i]', "user.login");

    // Wait for filtered results
    await page.waitForResponse(
      (response) =>
        response.url().includes("/api/v1/audit/activities") &&
        response.url().includes("activity_type"),
    );
  });

  test("should display activity details on expand", async ({ page }) => {
    await page.click('button:has-text("Activity Log")');

    await page.waitForResponse((response) => response.url().includes("/api/v1/audit/activities"));

    // Find and click "View Details" on first activity
    const detailsButton = page.locator('summary:has-text("View Details")').first();

    if (await detailsButton.isVisible()) {
      await detailsButton.click();

      // Verify details shown
      await expect(page.locator("pre").first()).toBeVisible();
    }
  });

  test("should paginate through activity log", async ({ page }) => {
    await page.click('button:has-text("Activity Log")');

    await page.waitForResponse((response) => response.url().includes("/api/v1/audit/activities"));

    // Check if next button exists
    const nextButton = page.locator('button:has-text("Next")');

    if (await nextButton.isEnabled()) {
      await nextButton.click();

      // Wait for page 2
      await page.waitForResponse(
        (response) =>
          response.url().includes("/api/v1/audit/activities") && response.url().includes("page=2"),
      );

      // Verify page changed
      await expect(page.locator("text=Page 2")).toBeVisible();
    }
  });

  test("should export audit logs to CSV", async ({ page }) => {
    await page.click('button:has-text("Activity Log")');

    await page.waitForResponse((response) => response.url().includes("/api/v1/audit/activities"));

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export CSV button
    await page.click('button:has-text("CSV")');

    // Wait for download
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/audit-log.*\.csv/);
  });

  test("should export audit logs to JSON", async ({ page }) => {
    await page.click('button:has-text("Activity Log")');

    await page.waitForResponse((response) => response.url().includes("/api/v1/audit/activities"));

    // Set up download listener
    const downloadPromise = page.waitForEvent("download");

    // Click export JSON button
    await page.click('button:has-text("JSON")');

    // Wait for download
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toMatch(/audit-log.*\.json/);
  });

  test("should display user activity link", async ({ page }) => {
    await page.click('button:has-text("Activity Log")');

    await page.waitForResponse((response) => response.url().includes("/api/v1/audit/activities"));

    // Find "View Activity" link
    const activityLink = page.locator('a:has-text("View Activity")').first();

    if (await activityLink.isVisible()) {
      await activityLink.click();

      // Verify navigation to user activity page
      await expect(page).toHaveURL(/\/audit\/user\/.+/);
    }
  });

  test("should handle empty state", async ({ page }) => {
    // Mock empty response
    await page.route("**/api/v1/audit/activities*", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          activities: [],
          total: 0,
          page: 1,
          per_page: 50,
          total_pages: 0,
        }),
      });
    });

    await page.click('button:has-text("Activity Log")');

    // Verify empty state
    await expect(page.locator("text=No audit activities found")).toBeVisible();
  });
});

test.describe("Audit Dashboard - Error Handling", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "admin@example.com");
    await page.fill('[data-testid="password-input"]', "admin123");
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL("/dashboard");
    await page.goto(AUDIT_PAGE);
  });

  test("should handle API errors gracefully", async ({ page }) => {
    // Mock API error
    await page.route("**/api/v1/audit/activities*", (route) => {
      route.fulfill({
        status: 500,
        body: "Internal Server Error",
      });
    });

    await page.click('button:has-text("Activity Log")');

    // Verify error message
    await expect(page.locator("text=/Unable to load|Failed|Error/i")).toBeVisible();
  });

  test("should handle unauthorized access", async ({ page }) => {
    // Mock 401 response
    await page.route("**/api/v1/audit/activities*", (route) => {
      route.fulfill({
        status: 401,
        body: "Unauthorized",
      });
    });

    await page.click('button:has-text("Activity Log")');

    // Should redirect to login or show error
    await page.waitForTimeout(1000);
    expect(page.url()).toMatch(/\/login|\/dashboard\/platform-admin\/audit/);
  });
});
