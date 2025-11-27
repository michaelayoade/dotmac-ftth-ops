/**
 * E2E Tests for API Key Management
 *
 * These tests cover the full integration of API key management functionality
 * including UI interactions and data persistence.
 *
 * Covers:
 * - Viewing API keys list
 * - Creating new API keys
 * - Updating existing API keys
 * - Revoking API keys
 * - Pagination
 * - Error handling
 */

import { test, expect } from "@playwright/test";

test.describe("API Key Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin/operator
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL || "admin@test.com");
    await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD || "password");
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForURL(/\/dashboard|\/settings/);

    // Navigate to API keys page
    await page.goto("/settings/api-keys");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Viewing API Keys", () => {
    test("should display API keys list", async ({ page }) => {
      // Check for the API keys table/list
      await expect(page.getByRole("heading", { name: /api keys/i })).toBeVisible();

      // Verify key information is displayed (if any keys exist)
      const apiKeysList = page.locator('[data-testid="api-keys-list"], table');
      await expect(apiKeysList).toBeVisible();
    });

    test("should show empty state when no API keys exist", async ({ page }) => {
      // If no keys exist, should show empty state
      const emptyState = page.locator('[data-testid="api-keys-empty"]');
      const apiKeysList = page.locator('[data-testid="api-keys-list"] tbody tr, [role="row"]');

      const count = await apiKeysList.count();
      if (count === 0) {
        await expect(emptyState).toBeVisible();
      }
    });

    test("should display key properties correctly", async ({ page }) => {
      const apiKeyRows = page.locator('[data-testid="api-key-row"], tbody tr');
      const count = await apiKeyRows.count();

      if (count > 0) {
        // Check first API key displays expected fields
        const firstKey = apiKeyRows.first();

        // Should show: name, scopes, created date, status
        await expect(firstKey).toContainText(/read:|write:|delete:/); // Scopes
        await expect(firstKey.locator('[data-testid="api-key-status"]')).toBeVisible(); // Status
      }
    });
  });

  test.describe("Creating API Keys", () => {
    test("should create a new API key successfully", async ({ page }) => {
      // Click create button
      await page.click('button:has-text("Create API Key"), button:has-text("New API Key")');

      // Fill in API key details
      await page.fill('[name="name"], [placeholder*="name" i]', "E2E Test Key");
      await page.fill(
        '[name="description"], [placeholder*="description" i]',
        "Created by E2E test",
      );

      // Select scopes
      await page.click('[data-testid="scope-selector"], [role="combobox"]');
      await page.click("text=/read:subscribers/i");
      await page.click("text=/write:subscribers/i");

      // Submit
      await page.click('button[type="submit"]:has-text("Create")');

      // Should show success message with the API key
      await expect(
        page.locator('[data-testid="api-key-created-dialog"], [role="dialog"]'),
      ).toBeVisible();
      await expect(page.locator("text=/sk_test_|sk_prod_/")).toBeVisible(); // API key format

      // Copy button should be visible
      await expect(page.locator('button:has-text("Copy")')).toBeVisible();

      // Close dialog
      await page.click('button:has-text("Close"), button:has-text("Done")');

      // Verify key appears in list
      await expect(page.locator('text="E2E Test Key"')).toBeVisible();
    });

    test("should validate required fields", async ({ page }) => {
      // Click create button
      await page.click('button:has-text("Create API Key"), button:has-text("New API Key")');

      // Try to submit without filling required fields
      await page.click('button[type="submit"]:has-text("Create")');

      // Should show validation errors
      await expect(page.locator("text=/name is required|please enter a name/i")).toBeVisible();
    });

    test("should show the API key only once after creation", async ({ page }) => {
      // Create an API key
      await page.click('button:has-text("Create API Key"), button:has-text("New API Key")');
      await page.fill('[name="name"]', "One-Time View Test");
      await page.click('[data-testid="scope-selector"]');
      await page.click("text=/read:subscribers/i");
      await page.click('button[type="submit"]:has-text("Create")');

      // Get the API key value
      const apiKeyElement = page.locator(
        '[data-testid="api-key-value"], code, [class*="font-mono"]',
      );
      const apiKeyValue = await apiKeyElement.textContent();
      expect(apiKeyValue).toMatch(/^sk_(test|prod)_/);

      // Close dialog
      await page.click('button:has-text("Close"), button:has-text("Done")');

      // API key should not be visible in the list (only preview shown)
      await expect(page.locator(`text="${apiKeyValue}"`)).not.toBeVisible();
      await expect(page.locator("text=/sk_.*\*\*\*\*/i")).toBeVisible(); // Preview format
    });
  });

  test.describe("Updating API Keys", () => {
    test("should update API key name and description", async ({ page }) => {
      const apiKeyRows = page.locator('[data-testid="api-key-row"], tbody tr');
      const count = await apiKeyRows.count();

      if (count === 0) {
        test.skip(true, "No API keys available to update");
      }

      // Click edit/manage button on first key
      await apiKeyRows
        .first()
        .locator('button:has-text("Edit"), button:has-text("Manage"), [data-testid="edit-button"]')
        .click();

      // Update name
      await page.fill('[name="name"]', "Updated E2E Key");
      await page.fill('[name="description"]', "Updated by E2E test");

      // Save
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');

      // Verify update
      await expect(page.locator('text="Updated E2E Key"')).toBeVisible();
    });

    test("should toggle API key active status", async ({ page }) => {
      const apiKeyRows = page.locator('[data-testid="api-key-row"], tbody tr');
      const count = await apiKeyRows.count();

      if (count === 0) {
        test.skip(true, "No API keys available to toggle");
      }

      // Get current status
      const firstKey = apiKeyRows.first();
      const statusToggle = firstKey.locator('[role="switch"], input[type="checkbox"]');
      const initialState = await statusToggle.isChecked();

      // Toggle status
      await statusToggle.click();

      // Verify state changed
      await expect(statusToggle).toHaveAttribute("aria-checked", String(!initialState));
    });
  });

  test.describe("Revoking API Keys", () => {
    test.beforeEach(async ({ page }) => {
      // Create a test key to revoke
      await page.click('button:has-text("Create API Key"), button:has-text("New API Key")');
      await page.fill('[name="name"]', "Key to Revoke");
      await page.click('[data-testid="scope-selector"]');
      await page.click("text=/read:subscribers/i");
      await page.click('button[type="submit"]:has-text("Create")');
      await page.click('button:has-text("Close"), button:has-text("Done")');
      await page.waitForLoadState("networkidle");
    });

    test("should revoke an API key with confirmation", async ({ page }) => {
      // Find the key we just created
      const keyRow = page.locator(
        'tr:has-text("Key to Revoke"), [data-testid="api-key-row"]:has-text("Key to Revoke")',
      );

      // Click revoke/delete button
      await keyRow
        .locator(
          'button:has-text("Revoke"), button:has-text("Delete"), [data-testid="revoke-button"]',
        )
        .click();

      // Confirm revocation in dialog
      await expect(page.locator('[role="alertdialog"], [role="dialog"]')).toBeVisible();
      await expect(page.locator("text=/are you sure|confirm|revoke/i")).toBeVisible();

      // Confirm
      await page.click('button:has-text("Revoke"), button:has-text("Delete"):last-of-type');

      // Verify key is removed from list
      await expect(page.locator('text="Key to Revoke"')).not.toBeVisible();
    });

    test("should cancel revoke operation", async ({ page }) => {
      const keyRow = page.locator('tr:has-text("Key to Revoke")');

      // Click revoke button
      await keyRow.locator('button:has-text("Revoke"), button:has-text("Delete")').click();

      // Cancel in confirmation dialog
      await page.click('button:has-text("Cancel")');

      // Verify key still exists
      await expect(page.locator('text="Key to Revoke"')).toBeVisible();
    });
  });

  test.describe("Pagination", () => {
    test("should paginate API keys list when many keys exist", async ({ page }) => {
      const apiKeyRows = page.locator('[data-testid="api-key-row"], tbody tr');
      const count = await apiKeyRows.count();

      if (count < 10) {
        test.skip(true, "Not enough API keys to test pagination");
      }

      // Check for pagination controls
      const nextButton = page.locator('button:has-text("Next"), [aria-label="Next page"]');
      await expect(nextButton).toBeVisible();

      // Get first key name
      const firstKeyName = await apiKeyRows.first().textContent();

      // Go to next page
      await nextButton.click();
      await page.waitForLoadState("networkidle");

      // First key should be different
      const newFirstKeyName = await apiKeyRows.first().textContent();
      expect(newFirstKeyName).not.toBe(firstKeyName);
    });
  });

  test.describe("Error Handling", () => {
    test("should show error when network request fails", async ({ page, context }) => {
      // Simulate network failure
      await context.route("**/api/v1/auth/api-keys", (route) => {
        route.abort("failed");
      });

      // Try to load page
      await page.goto("/settings/api-keys");

      // Should show error message
      await expect(page.locator("text=/error|failed to load|something went wrong/i")).toBeVisible();
    });

    test("should handle duplicate API key names gracefully", async ({ page }) => {
      // Create first key
      await page.click('button:has-text("Create API Key")');
      await page.fill('[name="name"]', "Duplicate Test");
      await page.click('[data-testid="scope-selector"]');
      await page.click("text=/read:subscribers/i");
      await page.click('button[type="submit"]');
      await page.click('button:has-text("Close")');

      // Try to create another with same name
      await page.click('button:has-text("Create API Key")');
      await page.fill('[name="name"]', "Duplicate Test");
      await page.click('[data-testid="scope-selector"]');
      await page.click("text=/read:subscribers/i");
      await page.click('button[type="submit"]');

      // Should either succeed (if allowed) or show error
      // Most systems allow duplicate names but some may not
      const hasError = await page.locator("text=/already exists|duplicate/i").isVisible();
      if (!hasError) {
        // If allowed, both keys should exist
        await page.click('button:has-text("Close")');
        const duplicateKeys = page.locator('text="Duplicate Test"');
        expect(await duplicateKeys.count()).toBeGreaterThanOrEqual(2);
      }
    });
  });

  test.describe("Search and Filter", () => {
    test("should filter API keys by name", async ({ page }) => {
      const searchInput = page.locator('[placeholder*="Search" i], [type="search"]');

      if (!(await searchInput.isVisible())) {
        test.skip(true, "Search functionality not available");
      }

      // Search for specific key
      await searchInput.fill("Test");
      await page.waitForTimeout(500); // Debounce

      // Only matching keys should be visible
      const visibleRows = page.locator('[data-testid="api-key-row"], tbody tr');
      const count = await visibleRows.count();

      for (let i = 0; i < count; i++) {
        const text = await visibleRows.nth(i).textContent();
        expect(text?.toLowerCase()).toContain("test");
      }
    });
  });
});
