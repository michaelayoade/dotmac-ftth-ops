import { test, expect, Page } from "@playwright/test";

/**
 * Visual Regression Testing with Playwright
 *
 * This file demonstrates Playwright's built-in visual comparison using
 * `expect(page).toHaveScreenshot()`. Playwright automatically:
 * - Captures screenshots on first run (creates baseline)
 * - Compares subsequent runs against baseline
 * - Highlights visual differences in HTML report
 * - Stores screenshots in e2e/__screenshots__/
 */

// Helper to login before tests
async function loginAsUser(page: Page, username = "admin", password = "admin123") {
  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', username);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="submit-button"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe("Visual Regression Tests", () => {
  // ============================================================================
  // Full Page Screenshots
  // ============================================================================

  test("login page - full page screenshot", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Capture full page screenshot
    await expect(page).toHaveScreenshot("login-page.png", {
      fullPage: true,
    });
  });

  test("dashboard - full page screenshot", async ({ page }) => {
    await loginAsUser(page);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("dashboard-page.png", {
      fullPage: true,
    });
  });

  // ============================================================================
  // Component Screenshots
  // ============================================================================

  test("dashboard - user profile card", async ({ page }) => {
    await loginAsUser(page);

    // Capture specific component
    const profileCard = page.locator("text=User Profile").locator("..");
    await expect(profileCard).toHaveScreenshot("user-profile-card.png");
  });

  test("dashboard - platform services grid", async ({ page }) => {
    await loginAsUser(page);

    const servicesGrid = page.locator("text=Platform Services").locator("..");
    await expect(servicesGrid).toHaveScreenshot("platform-services-grid.png");
  });

  test("dashboard - api status card", async ({ page }) => {
    await loginAsUser(page);

    const statusCard = page.locator("text=API Status").locator("..");
    await expect(statusCard).toHaveScreenshot("api-status-card.png");
  });

  // ============================================================================
  // Responsive Screenshots - Different Viewports
  // ============================================================================

  test("dashboard - mobile viewport (375px)", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await loginAsUser(page);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("dashboard-mobile-375.png", {
      fullPage: true,
    });
  });

  test("dashboard - tablet viewport (768px)", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAsUser(page);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("dashboard-tablet-768.png", {
      fullPage: true,
    });
  });

  test("dashboard - desktop viewport (1440px)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAsUser(page);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("dashboard-desktop-1440.png", {
      fullPage: true,
    });
  });

  // ============================================================================
  // Dark Mode Screenshots
  // ============================================================================

  test("dashboard - dark mode", async ({ page }) => {
    // Set dark mode preference
    await page.emulateMedia({ colorScheme: "dark" });
    await loginAsUser(page);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("dashboard-dark-mode.png", {
      fullPage: true,
    });
  });

  test("login page - dark mode", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("login-dark-mode.png", {
      fullPage: true,
    });
  });

  // ============================================================================
  // Interactive State Screenshots
  // ============================================================================

  test("login page - form filled state", async ({ page }) => {
    await page.goto("/login");

    // Fill form but don't submit
    await page.fill('[data-testid="email-input"]', "test-user");
    await page.fill('[data-testid="password-input"]', "password123");

    await expect(page).toHaveScreenshot("login-form-filled.png");
  });

  test("dashboard - navigation hover states", async ({ page }) => {
    await loginAsUser(page);

    // Hover over navigation item
    const navItem = page.locator("text=Manage Customers").first();
    await navItem.hover();

    await expect(page).toHaveScreenshot("dashboard-nav-hover.png");
  });

  // ============================================================================
  // Error State Screenshots
  // ============================================================================

  test("dashboard - api error state", async ({ page }) => {
    await loginAsUser(page);

    // Mock API error
    await page.route("**/health", (route) => {
      route.fulfill({
        status: 500,
        json: { error: "Internal server error" },
      });
    });

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveScreenshot("dashboard-api-error.png", {
      fullPage: true,
    });
  });

  // ============================================================================
  // Empty State Screenshots
  // ============================================================================

  test("customers page - empty state", async ({ page }) => {
    await loginAsUser(page);
    await page.goto("/dashboard/customers");

    // Wait for empty state to render
    await page.waitForSelector("text=No customers found", { timeout: 5000 }).catch(() => {});

    await expect(page).toHaveScreenshot("customers-empty-state.png", {
      fullPage: true,
    });
  });

  // ============================================================================
  // Custom Screenshot Options
  // ============================================================================

  test("dashboard - high precision screenshot", async ({ page }) => {
    await loginAsUser(page);

    await expect(page).toHaveScreenshot("dashboard-high-precision.png", {
      fullPage: true,
      // Override config for this specific test
      maxDiffPixels: 10, // Stricter pixel difference
      threshold: 0.1, // Stricter threshold
    });
  });

  test("dashboard - mask dynamic content", async ({ page }) => {
    await loginAsUser(page);

    await expect(page).toHaveScreenshot("dashboard-masked.png", {
      fullPage: true,
      // Mask elements that change frequently (timestamps, etc.)
      mask: [
        page.locator("text=User ID:").locator(".."), // Mask user ID
        page.locator("time"), // Mask timestamps
      ],
    });
  });

  // ============================================================================
  // Multi-Page Workflow Screenshots
  // ============================================================================

  test("customer creation workflow", async ({ page }) => {
    await loginAsUser(page);

    // Step 1: Navigate to customers
    await page.goto("/dashboard/customers");
    await expect(page).toHaveScreenshot("workflow-1-customers-list.png");

    // Step 2: Click create button
    await page.click("text=Create Customer").catch(() => {});
    await expect(page).toHaveScreenshot("workflow-2-create-form.png");

    // Step 3: Fill form
    await page.fill('input[name="name"]', "Test Customer").catch(() => {});
    await page.fill('input[name="email"]', "test@customer.com").catch(() => {});
    await expect(page).toHaveScreenshot("workflow-3-form-filled.png");
  });

  // ============================================================================
  // Loading State Screenshots
  // ============================================================================

  test("dashboard - loading state", async ({ page }) => {
    await loginAsUser(page);

    // Intercept API to delay response
    await page.route("**/api/**", (route) => {
      setTimeout(() => route.continue(), 2000);
    });

    await page.goto("/dashboard");

    // Capture loading state
    await page.waitForSelector(".animate-pulse", { timeout: 1000 }).catch(() => {});
    await expect(page).toHaveScreenshot("dashboard-loading.png");
  });
});

/**
 * USAGE NOTES:
 *
 * 1. First run: Generates baseline screenshots in e2e/__screenshots__/
 * 2. Subsequent runs: Compares against baseline, fails if different
 * 3. Update baselines: npm run test:e2e -- --update-snapshots
 * 4. View differences: Open playwright-report/index.html after test failure
 *
 * BEST PRACTICES:
 *
 * - Wait for 'networkidle' or 'load' states before screenshots
 * - Mask dynamic content (timestamps, IDs) that change on every run
 * - Use descriptive filenames for easy identification
 * - Test responsive layouts at key breakpoints
 * - Capture both light and dark modes
 * - Test error states and edge cases
 * - Keep screenshot scope focused (full page vs component)
 *
 * CONFIGURATION:
 *
 * Global config in playwright.config.ts:
 * - maxDiffPixels: Maximum pixel difference before failure
 * - threshold: Pixel similarity threshold (0-1)
 * - animations: 'disabled' prevents animation-related flakiness
 *
 * TROUBLESHOOTING:
 *
 * - Flaky tests: Increase threshold or maxDiffPixels
 * - Font rendering: May differ across OS, consider masking text
 * - Dynamic content: Use mask option to exclude changing elements
 * - Animations: Ensure animations are disabled in config
 */
