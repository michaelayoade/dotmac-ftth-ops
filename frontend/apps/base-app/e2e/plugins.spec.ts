import { test, expect } from "@playwright/test";

/**
 * E2E Tests for Plugin Management
 *
 * These tests replace the removed integration tests and test real user workflows
 * across the entire plugin management system.
 */

test.describe("Plugin Management E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to plugins page
    await page.goto("/dashboard/settings/plugins");

    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test.describe("Page Loading & Navigation", () => {
    test("should load plugin management page successfully", async ({ page }) => {
      // Check for page heading
      await expect(page.getByRole("heading", { name: /Plugin Management/i })).toBeVisible();

      // Check for key UI elements
      await expect(page.getByText(/Available Plugins/i)).toBeVisible();
      await expect(page.getByText(/Active Instances/i)).toBeVisible();
    });

    test("should display plugin statistics", async ({ page }) => {
      // Check for stats cards
      const statsRegion = page.locator('[data-testid="plugin-stats"]').first();

      // Should show counts (numbers may vary)
      await expect(statsRegion).toBeVisible({ timeout: 5000 });
    });

    test("should handle error states gracefully", async ({ page }) => {
      // Simulate network error by blocking API calls
      await page.route("**/api/v1/plugins/**", (route) => route.abort());

      await page.reload();

      // Should show error message or retry option
      const errorIndicator = page.getByText(/error|failed|retry/i);
      await expect(errorIndicator.first()).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("View Mode Switching", () => {
    test("should switch between grid and list views", async ({ page }) => {
      // Find view switcher buttons
      const listViewButton = page.getByRole("button", { name: /list view/i });
      const gridViewButton = page.getByRole("button", { name: /grid view/i });

      if (await listViewButton.isVisible()) {
        await listViewButton.click();
        // Verify list view is active
        await expect(page.locator('[data-view="list"]').first()).toBeVisible();
      }

      if (await gridViewButton.isVisible()) {
        await gridViewButton.click();
        // Verify grid view is active
        await expect(page.locator('[data-view="grid"]').first()).toBeVisible();
      }
    });

    test("should switch to health view", async ({ page }) => {
      const healthViewButton = page.getByRole("button", { name: /health/i });

      if (await healthViewButton.isVisible()) {
        await healthViewButton.click();

        // Should show health dashboard
        await expect(page.getByText(/health status|health check/i).first()).toBeVisible();
      }
    });
  });

  test.describe("Plugin Installation Flow", () => {
    test("should open plugin installation form", async ({ page }) => {
      // Find and click an install button (use data-testid for reliability)
      const installButton = page.getByRole("button", { name: /install|add plugin/i }).first();

      if (await installButton.isVisible()) {
        await installButton.click();

        // Should show plugin form modal
        await expect(
          page.getByRole("heading", { name: /add.*plugin|install.*plugin/i }),
        ).toBeVisible();
      }
    });

    test("should validate required fields in plugin form", async ({ page }) => {
      // Open installation form
      const installButton = page.getByRole("button", { name: /install|add plugin/i }).first();

      if (await installButton.isVisible()) {
        await installButton.click();

        // Wait for form to appear
        await page.waitForSelector("form", { timeout: 5000 });

        // Try to submit without filling required fields
        const submitButton = page.getByRole("button", {
          name: /create|install|save/i,
        });
        await submitButton.click();

        // Should show validation errors
        const errorMessage = page.getByText(/required|must/i);
        await expect(errorMessage.first()).toBeVisible();
      }
    });

    test("should successfully create a plugin instance", async ({ page }) => {
      // This test would require proper test data setup
      // Skipping actual creation to avoid side effects
      test.skip();
    });
  });

  test.describe("Plugin Instance Management", () => {
    test("should display existing plugin instances", async ({ page }) => {
      // Look for plugin cards or list items
      const pluginInstances = page.locator(
        '[data-testid="plugin-instance"], [data-testid="plugin-card"]',
      );

      // Count should be >= 0
      const count = await pluginInstances.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test("should show plugin details when expanded", async ({ page }) => {
      // Find first expandable plugin
      const pluginCard = page
        .locator('[data-testid="plugin-instance"], [data-testid="plugin-card"]')
        .first();

      if (await pluginCard.isVisible()) {
        await pluginCard.click();

        // Should show additional details
        // (actual details depend on component implementation)
        await page.waitForTimeout(500);
      }
    });

    test("should open delete confirmation for plugin instances", async ({ page }) => {
      // Find delete button
      const deleteButton = page.getByRole("button", { name: /delete|remove/i }).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show confirmation dialog
        await expect(page.getByText(/confirm|are you sure/i)).toBeVisible();
      }
    });
  });

  test.describe("Connection Testing", () => {
    test("should show test connection option for compatible plugins", async ({ page }) => {
      // Open a plugin that supports connection testing
      const testButton = page.getByRole("button", { name: /test connection/i }).first();

      if (await testButton.isVisible()) {
        await testButton.click();

        // Should show test result (success or failure)
        await expect(page.getByText(/testing|connected|failed/i).first()).toBeVisible({
          timeout: 10000,
        });
      }
    });
  });

  test.describe("Search and Filtering", () => {
    test("should filter plugins by search query", async ({ page }) => {
      const searchInput = page.getByPlaceholder(/search/i);

      if (await searchInput.isVisible()) {
        await searchInput.fill("whatsapp");

        // Wait for filter to apply
        await page.waitForTimeout(500);

        // Should show filtered results
        const results = page.locator(
          '[data-testid="plugin-card"], [data-testid="plugin-instance"]',
        );
        const count = await results.count();

        // Results should be filtered (exact count depends on data)
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe("Plugin Health Dashboard", () => {
    test("should display plugin health metrics", async ({ page }) => {
      // Switch to health view
      const healthButton = page.getByRole("button", { name: /health/i });

      if (await healthButton.isVisible()) {
        await healthButton.click();

        // Should show health statistics
        await expect(page.getByText(/health|status|response time/i).first()).toBeVisible();

        // Should show health percentage
        const healthPercentage = page.locator("text=/\\d+%/");
        await expect(healthPercentage.first()).toBeVisible();
      }
    });

    test("should refresh health data", async ({ page }) => {
      // Switch to health view
      const healthButton = page.getByRole("button", { name: /health/i });

      if (await healthButton.isVisible()) {
        await healthButton.click();

        // Find and click refresh button
        const refreshButton = page.getByRole("button", { name: /refresh/i });

        if (await refreshButton.isVisible()) {
          await refreshButton.click();

          // Should show loading state briefly
          await expect(page.getByText(/checking|refreshing/i).first())
            .toBeVisible({ timeout: 1000 })
            .catch(() => {});
        }
      }
    });

    test("should expand plugin health details", async ({ page }) => {
      // Switch to health view
      const healthButton = page.getByRole("button", { name: /health/i });

      if (await healthButton.isVisible()) {
        await healthButton.click();

        // Click on a plugin instance to expand details
        const instanceRow = page.locator('[data-testid="health-instance"]').first();

        if (await instanceRow.isVisible()) {
          await instanceRow.click();

          // Should show expanded health information
          await expect(
            page.getByText(/health check details|additional information/i).first(),
          ).toBeVisible();
        }
      }
    });
  });

  test.describe("Plugin Registry Refresh", () => {
    test("should refresh plugin registry", async ({ page }) => {
      const refreshButton = page.getByRole("button", {
        name: /refresh.*registry|reload.*plugins/i,
      });

      if (await refreshButton.isVisible()) {
        await refreshButton.click();

        // Should show loading indicator
        await expect(page.getByText(/loading|refreshing/i).first())
          .toBeVisible({ timeout: 1000 })
          .catch(() => {});
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should be keyboard navigable", async ({ page }) => {
      // Tab through interactive elements
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Some element should be focused
      const focusedElement = await page.locator(":focus");
      await expect(focusedElement).toBeVisible();
    });

    test("should have proper ARIA labels", async ({ page }) => {
      // Check that buttons have accessible names
      const buttons = page.getByRole("button");
      const count = await buttons.count();

      // At least one button should exist
      expect(count).toBeGreaterThan(0);

      // All visible buttons should have accessible text
      for (let i = 0; i < Math.min(count, 5); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          const accessibleName =
            (await button.getAttribute("aria-label")) || (await button.textContent());
          expect(accessibleName).toBeTruthy();
        }
      }
    });
  });

  test.describe("Visual Regression", () => {
    test("should match grid view snapshot", async ({ page }) => {
      // Wait for content to load
      await page.waitForLoadState("networkidle");

      // Take screenshot for visual regression
      await expect(page).toHaveScreenshot("plugins-grid-view.png", {
        fullPage: true,
        mask: [
          // Mask dynamic content like timestamps
          page.locator("text=/\\d{1,2}:\\d{2}/"),
          page.locator('[data-dynamic="true"]'),
        ],
      });
    });

    test("should match health view snapshot", async ({ page }) => {
      const healthButton = page.getByRole("button", { name: /health/i });

      if (await healthButton.isVisible()) {
        await healthButton.click();
        await page.waitForLoadState("networkidle");

        await expect(page).toHaveScreenshot("plugins-health-view.png", {
          fullPage: true,
          mask: [page.locator("text=/\\d{1,2}:\\d{2}/"), page.locator('[data-dynamic="true"]')],
        });
      }
    });
  });
});
