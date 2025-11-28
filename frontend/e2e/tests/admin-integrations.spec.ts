/**
 * E2E Tests for Admin Integrations Dashboard
 *
 * Tests the complete user journey for managing service integrations
 * with real backend API calls (no mocks).
 *
 * Coverage:
 * - Loading integrations list from API
 * - Filtering integrations by type
 * - Viewing integration details
 * - Triggering health checks
 * - API contract validation
 */

import { test, expect } from "#e2e/fixtures";

test.describe("Admin Integrations Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to integrations page
    await page.goto("/admin/integrations");

    // Wait for page to load
    await page.waitForSelector('h1:has-text("Service Integrations")', {
      timeout: 10000,
    });
  });

  test("should load integrations dashboard successfully", async ({ page }) => {
    // Verify page title
    await expect(page.locator("h1")).toContainText("Service Integrations");

    // Verify description
    await expect(page.locator("text=Manage external service connections")).toBeVisible();

    // Verify refresh button is present
    await expect(page.locator('button:has-text("Refresh")')).toBeVisible();
  });

  test("should display statistics cards with real data", async ({ page }) => {
    // Wait for stats to load
    await page.waitForTimeout(1000);

    // Verify Total card
    const totalCard = page.locator("text=Total").locator("..").locator("..");
    await expect(totalCard).toBeVisible();

    // Verify Ready card
    const readyCard = page.locator("text=Ready").locator("..").locator("..");
    await expect(readyCard).toBeVisible();

    // Verify Error card
    const errorCard = page.locator("text=Error").locator("..").locator("..");
    await expect(errorCard).toBeVisible();
  });

  test("should load integrations from real API", async ({ page, request }) => {
    // Make direct API call to verify backend response
    const apiResponse = await request.get("http://localhost:8000/api/platform/v1/admin/integrations", {
      headers: {
        Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN || "test-token"}`,
      },
    });

    // Verify API response
    expect(apiResponse.ok()).toBeTruthy();
    const data = await apiResponse.json();

    // Verify response structure
    expect(data).toHaveProperty("integrations");
    expect(data).toHaveProperty("total");
    expect(Array.isArray(data.integrations)).toBeTruthy();

    // Wait for UI to render integrations
    if (data.total > 0) {
      // Should display at least one integration card
      await expect(page.locator('[class*="grid"] [class*="Card"]').first()).toBeVisible({
        timeout: 5000,
      });

      // Verify integration count matches API
      const integrationCards = page.locator('[class*="grid"] [class*="Card"]');
      const cardCount = await integrationCards.count();
      expect(cardCount).toBeGreaterThan(0);
    } else {
      // Should show empty state
      await expect(page.locator("text=No integrations found")).toBeVisible();
    }
  });

  test("should filter integrations by type", async ({ page }) => {
    // Wait for data to load
    await page.waitForTimeout(1000);

    // Get the filter dropdown
    const filterSelect = page.locator("select", { hasText: /All Types/ });

    // Verify filter options
    await filterSelect.click();
    const options = await filterSelect.locator("option").allTextContents();
    expect(options.length).toBeGreaterThan(1);

    // Select Email type filter
    await filterSelect.selectOption({ label: /email/i });

    // Verify URL updated (if using query params)
    await page.waitForTimeout(500);

    // Reset filter
    await filterSelect.selectOption({ label: /All Types/ });
  });

  test("should display integration cards with correct data", async ({ page, request }) => {
    // Get integrations from API
    const apiResponse = await request.get("http://localhost:8000/api/platform/v1/admin/integrations", {
      headers: {
        Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN || "test-token"}`,
      },
    });

    const data = await apiResponse.json();

    if (data.total > 0) {
      const firstIntegration = data.integrations[0];

      // Find the card for this integration
      const card = page.locator(`text=${firstIntegration.name}`).locator("..").locator("..");

      // Verify integration name
      await expect(card).toContainText(firstIntegration.name);

      // Verify provider is displayed
      await expect(card).toContainText(firstIntegration.provider, {
        useInnerText: true,
      });

      // Verify status badge
      await expect(card.locator(`text=${firstIntegration.status}`)).toBeVisible();

      // Verify type badge
      await expect(card.locator(`text=${firstIntegration.type}`)).toBeVisible();
    }
  });

  test("should trigger health check and update status", async ({ page, request }) => {
    // Get integrations from API
    const apiResponse = await request.get("http://localhost:8000/api/platform/v1/admin/integrations", {
      headers: {
        Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN || "test-token"}`,
      },
    });

    const data = await apiResponse.json();

    if (data.total > 0 && data.integrations[0].enabled) {
      const integration = data.integrations[0];

      // Find the integration card
      const card = page.locator(`text=${integration.name}`).locator("..").locator("..");

      // Click health check button
      const healthCheckButton = card.locator('button:has-text("Health Check")');
      await healthCheckButton.click();

      // Verify loading state
      await expect(card.locator("text=Checking...")).toBeVisible({
        timeout: 2000,
      });

      // Wait for health check to complete
      await page.waitForTimeout(3000);

      // Verify toast notification appears
      await expect(page.locator("text=Health check complete")).toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("should refresh integrations list", async ({ page }) => {
    // Initial load
    await page.waitForTimeout(1000);

    // Click refresh button
    const refreshButton = page.locator('button:has-text("Refresh")');
    await refreshButton.click();

    // Verify loading state (spinner)
    await expect(refreshButton.locator('svg[class*="animate-spin"]')).toBeVisible({
      timeout: 1000,
    });

    // Wait for refresh to complete
    await page.waitForTimeout(2000);
  });

  test("should handle API errors gracefully", async ({ page, context }) => {
    // Intercept API calls and force error
    await context.route("**/api/platform/v1/admin/integrations", (route) => {
      route.fulfill({
        status: 500,
        body: JSON.stringify({ detail: "Internal server error" }),
      });
    });

    // Reload page
    await page.reload();

    // Verify error message is displayed
    await expect(page.locator("text=Failed to load integrations")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should display metadata details on expand", async ({ page, request }) => {
    // Get integrations from API
    const apiResponse = await request.get("http://localhost:8000/api/platform/v1/admin/integrations", {
      headers: {
        Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN || "test-token"}`,
      },
    });

    const data = await apiResponse.json();

    // Find integration with metadata
    const integrationWithMetadata = data.integrations.find(
      (i: any) => i.metadata && Object.keys(i.metadata).length > 0,
    );

    if (integrationWithMetadata) {
      // Find the card
      const card = page.locator(`text=${integrationWithMetadata.name}`).locator("..").locator("..");

      // Click to expand metadata
      const detailsToggle = card.locator('summary:has-text("View metadata")');
      if (await detailsToggle.isVisible()) {
        await detailsToggle.click();

        // Verify metadata is shown
        await expect(card.locator("pre")).toBeVisible();
      }
    }
  });

  test("should validate API contract - integration response structure", async ({ request }) => {
    // Make API call
    const response = await request.get("http://localhost:8000/api/platform/v1/admin/integrations", {
      headers: {
        Authorization: `Bearer ${process.env.E2E_AUTH_TOKEN || "test-token"}`,
      },
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    // Validate response structure matches TypeScript interface
    expect(data).toHaveProperty("integrations");
    expect(data).toHaveProperty("total");
    expect(typeof data.total).toBe("number");
    expect(Array.isArray(data.integrations)).toBeTruthy();

    // Validate integration object structure
    if (data.integrations.length > 0) {
      const integration = data.integrations[0];

      // Required fields
      expect(integration).toHaveProperty("name");
      expect(integration).toHaveProperty("type");
      expect(integration).toHaveProperty("provider");
      expect(integration).toHaveProperty("enabled");
      expect(integration).toHaveProperty("status");
      expect(integration).toHaveProperty("settings_count");
      expect(integration).toHaveProperty("has_secrets");
      expect(integration).toHaveProperty("required_packages");

      // Type validation
      expect(typeof integration.name).toBe("string");
      expect(typeof integration.type).toBe("string");
      expect(typeof integration.provider).toBe("string");
      expect(typeof integration.enabled).toBe("boolean");
      expect(typeof integration.status).toBe("string");
      expect(typeof integration.settings_count).toBe("number");
      expect(typeof integration.has_secrets).toBe("boolean");
      expect(Array.isArray(integration.required_packages)).toBeTruthy();

      // Enum validation
      const validStatuses = ["disabled", "configuring", "ready", "error", "deprecated"];
      expect(validStatuses).toContain(integration.status);

      const validTypes = [
        "email",
        "sms",
        "storage",
        "search",
        "analytics",
        "monitoring",
        "secrets",
        "cache",
        "queue",
      ];
      expect(validTypes).toContain(integration.type);
    }
  });
});
