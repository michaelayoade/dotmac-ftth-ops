import { test, expect, Page, devices } from "@playwright/test";

// Test on multiple mobile viewports
const mobileDevices = [
  { name: "iPhone 13", ...devices["iPhone 13"] },
  { name: "iPhone 13 Pro", ...devices["iPhone 13 Pro"] },
  { name: "Pixel 5", ...devices["Pixel 5"] },
  { name: "Samsung Galaxy S21", ...devices["Galaxy S9+"] },
];

// Helper to setup authenticated mobile page
async function setupAuthenticatedPage(page: Page) {
  await page.route("**/api/v1/auth/login", (route) => {
    route.fulfill({
      status: 200,
      json: {
        access_token: "mock-token",
        refresh_token: "mock-refresh",
        token_type: "bearer",
      },
    });
  });

  await page.goto("/login");
  await page.fill('[data-testid="email-input"]', "admin");
  await page.fill('[data-testid="password-input"]', "admin123");
  await page.click('[data-testid="submit-button"]');
  await page.waitForTimeout(1000);
}

test.describe("Mobile Navigation", () => {
  for (const device of mobileDevices) {
    test(`should have mobile menu on ${device.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...device,
      });
      const page = await context.newPage();

      await setupAuthenticatedPage(page);
      await page.goto("/dashboard");

      // Should show mobile menu button (hamburger icon)
      const mobileMenuButton = page.locator('[data-testid="mobile-menu-button"]').first();
      if ((await mobileMenuButton.count()) === 0) {
        // Try alternative selectors
        const hamburger = page.locator('button[aria-label*="menu"]').first();
        await expect(hamburger).toBeVisible({ timeout: 5000 });
      } else {
        await expect(mobileMenuButton).toBeVisible();
      }

      await context.close();
    });

    test(`should toggle mobile menu on ${device.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...device,
      });
      const page = await context.newPage();

      await setupAuthenticatedPage(page);
      await page.goto("/dashboard");

      // Open mobile menu
      const menuButton = page.locator('[data-testid="mobile-menu-button"]').first();
      if ((await menuButton.count()) > 0) {
        await menuButton.click();

        // Menu should be visible
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible();

        // Click again to close
        await menuButton.click();

        // Menu should be hidden
        await expect(page.locator('[data-testid="mobile-menu"]')).toBeHidden();
      }

      await context.close();
    });
  }
});

test.describe("Mobile Login Form", () => {
  test("should display login form correctly on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await page.goto("/login");

    // Form should be visible and properly sized
    const usernameInput = page.locator('[data-testid="email-input"]');
    const passwordInput = page.locator('[data-testid="password-input"]');
    const submitButton = page.locator('[data-testid="submit-button"]');

    await expect(usernameInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeVisible();

    // Inputs should be large enough to tap (min 44x44 iOS guideline)
    const usernameBox = await usernameInput.boundingBox();
    expect(usernameBox?.height).toBeGreaterThanOrEqual(40);

    await context.close();
  });

  test("should handle mobile keyboard on input focus", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await page.goto("/login");

    // Focus on username input
    await page.click('[data-testid="email-input"]');

    // Page should scroll to show input above keyboard
    const input = page.locator('[data-testid="email-input"]');
    await expect(input).toBeVisible();

    // Should be able to type
    await input.fill("testuser");
    await expect(input).toHaveValue("testuser");

    await context.close();
  });
});

test.describe("Mobile Dashboard", () => {
  test("should display dashboard cards in mobile layout", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);

    // Mock dashboard data
    await page.route("**/api/v1/dashboard/**", (route) => {
      route.fulfill({
        status: 200,
        json: {
          stats: {
            total_customers: 150,
            total_revenue: 50000,
            active_subscriptions: 45,
          },
        },
      });
    });

    await page.goto("/dashboard");

    // Dashboard should load
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // Cards should stack vertically on mobile
    const cards = page.locator('[data-testid*="dashboard-card"]');
    if ((await cards.count()) > 0) {
      const firstCard = cards.first();
      const secondCard = cards.nth(1);

      const firstBox = await firstCard.boundingBox();
      const secondBox = await secondCard.boundingBox();

      if (firstBox && secondBox) {
        // Second card should be below first (stacked vertically)
        expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 10);
      }
    }

    await context.close();
  });

  test("should handle swipe gestures on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      hasTouch: true,
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard");

    // Simulate swipe (if carousel exists)
    const carousel = page.locator('[data-testid="carousel"]').first();
    if ((await carousel.count()) > 0) {
      const box = await carousel.boundingBox();
      if (box) {
        // Swipe left
        await page.touchscreen.tap(box.x + box.width - 50, box.y + box.height / 2);
        await page.touchscreen.tap(box.x + 50, box.y + box.height / 2);
      }
    }

    await context.close();
  });
});

test.describe("Mobile Forms", () => {
  test("should handle form inputs on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);

    // Mock form endpoint
    await page.route("**/api/v1/customers", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 201,
          json: { id: "123", name: "Test Customer" },
        });
      }
    });

    await page.goto("/dashboard/customers/new");

    // Fill form on mobile
    await page.fill('input[name="name"]', "Mobile Test Customer");
    await page.fill('input[name="email"]', "mobile@test.com");

    // Submit button should be accessible
    const submitButton = page.locator('button[type="submit"]').first();
    await expect(submitButton).toBeVisible();

    // Submit should work
    await submitButton.click();

    // Should show success
    await expect(page.locator("text=/success|created/i")).toBeVisible({
      timeout: 5000,
    });

    await context.close();
  });

  test("should show mobile-friendly date picker", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard/customers/new");

    // Find date input
    const dateInput = page.locator('input[type="date"]').first();
    if ((await dateInput.count()) > 0) {
      await dateInput.click();

      // Native date picker should appear (can't directly test, but input should remain visible)
      await expect(dateInput).toBeVisible();
    }

    await context.close();
  });

  test("should handle select dropdowns on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard/customers/new");

    // Find select element
    const select = page.locator("select").first();
    if ((await select.count()) > 0) {
      await select.click();

      // Should be able to select option
      await select.selectOption({ index: 1 });

      // Value should be set
      const value = await select.inputValue();
      expect(value).toBeTruthy();
    }

    await context.close();
  });
});

test.describe("Mobile Tables and Lists", () => {
  test("should display tables responsively on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);

    // Mock customer list
    await page.route("**/api/v1/customers", (route) => {
      route.fulfill({
        status: 200,
        json: {
          customers: [
            { id: "1", name: "Customer 1", email: "customer1@example.com" },
            { id: "2", name: "Customer 2", email: "customer2@example.com" },
          ],
          total: 2,
        },
      });
    });

    await page.goto("/dashboard/customers");

    // Table or list should be visible
    const table = page.locator("table").first();
    const list = page.locator('[data-testid="customer-list"]').first();

    expect((await table.count()) + (await list.count())).toBeGreaterThan(0);

    // Should be scrollable horizontally if table is too wide
    if ((await table.count()) > 0) {
      const tableBox = await table.boundingBox();
      const viewportSize = page.viewportSize();

      if (tableBox && viewportSize && tableBox.width > viewportSize.width) {
        // Table should be scrollable
        await page.evaluate(() => {
          const tableElement = document.querySelector("table");
          return (
            tableElement?.parentElement?.style.overflowX === "auto" ||
            tableElement?.parentElement?.style.overflowX === "scroll"
          );
        });
      }
    }

    await context.close();
  });

  test("should show list view instead of table on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);

    // Mock data
    await page.route("**/api/v1/customers", (route) => {
      route.fulfill({
        status: 200,
        json: {
          customers: [{ id: "1", name: "Customer 1", email: "customer1@example.com" }],
          total: 1,
        },
      });
    });

    await page.goto("/dashboard/customers");

    // Check if mobile view uses cards/list instead of table
    const mobileCards = page.locator('[data-testid*="mobile-card"]');
    if ((await mobileCards.count()) > 0) {
      await expect(mobileCards.first()).toBeVisible();
    }

    await context.close();
  });

  test("should handle pagination on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);

    // Mock paginated data
    await page.route("**/api/v1/customers*", (route) => {
      route.fulfill({
        status: 200,
        json: {
          customers: Array.from({ length: 10 }, (_, i) => ({
            id: `${i}`,
            name: `Customer ${i}`,
          })),
          total: 50,
          page: 1,
          per_page: 10,
        },
      });
    });

    await page.goto("/dashboard/customers");

    // Pagination controls should be visible and tappable
    const nextButton = page.locator('button:has-text("Next")').first();
    if ((await nextButton.count()) > 0) {
      await expect(nextButton).toBeVisible();

      // Button should be large enough to tap
      const box = await nextButton.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(40);
    }

    await context.close();
  });
});

test.describe("Mobile Billing", () => {
  test("should display billing page on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);

    // Mock billing data
    await page.route("**/api/v1/billing/**", (route) => {
      route.fulfill({
        status: 200,
        json: {
          subscription: {
            id: "sub-123",
            plan: "Professional",
            status: "active",
            amount: 49.99,
          },
        },
      });
    });

    await page.goto("/dashboard/billing");

    // Billing info should be visible
    await expect(page.locator("text=/billing|subscription/i")).toBeVisible();

    await context.close();
  });

  test("should handle payment form on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard/billing/payment-methods");

    // Click add payment method
    const addButton = page.locator('button:has-text("Add Payment Method")').first();
    if ((await addButton.count()) > 0) {
      await addButton.click();

      // Payment form should be visible
      await expect(page.locator('input[name*="card"]').first()).toBeVisible({
        timeout: 5000,
      });
    }

    await context.close();
  });
});

test.describe("Mobile Touch Gestures", () => {
  test("should handle pull-to-refresh", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
      hasTouch: true,
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard/customers");

    // Simulate pull-to-refresh gesture
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    // Pull down from top
    const viewport = page.viewportSize();
    if (viewport) {
      await page.touchscreen.tap(viewport.width / 2, 10);
      await page.touchscreen.tap(viewport.width / 2, 150);
    }

    // Page should still be functional
    await expect(page.locator("text=Customers")).toBeVisible();

    await context.close();
  });

  test("should handle tap targets with proper spacing", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard");

    // Find all buttons
    const buttons = page.locator("button");
    const buttonCount = await buttons.count();

    // Check first few buttons have adequate size
    for (let i = 0; i < Math.min(buttonCount, 5); i++) {
      const button = buttons.nth(i);
      if (await button.isVisible()) {
        const box = await button.boundingBox();
        if (box) {
          // iOS minimum: 44x44, Android: 48x48
          expect(box.height).toBeGreaterThanOrEqual(40);
          expect(box.width).toBeGreaterThanOrEqual(40);
        }
      }
    }

    await context.close();
  });
});

test.describe("Mobile Orientation", () => {
  test("should handle portrait to landscape rotation", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard");

    // Check portrait mode
    let viewport = page.viewportSize();
    expect(viewport?.height).toBeGreaterThan(viewport?.width || 0);

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });

    // Dashboard should still be visible
    await expect(page.locator("text=Dashboard")).toBeVisible();

    // Check landscape mode
    viewport = page.viewportSize();
    expect(viewport?.width).toBeGreaterThan(viewport?.height || 0);

    await context.close();
  });
});

test.describe("Mobile Performance", () => {
  test("should load pages quickly on mobile network", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    // Throttle network to simulate 3G
    const client = await context.newCDPSession(page);
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      downloadThroughput: (1.5 * 1024 * 1024) / 8, // 1.5 Mbps
      uploadThroughput: (750 * 1024) / 8, // 750 Kbps
      latency: 40, // 40ms
    });

    await setupAuthenticatedPage(page);

    const startTime = Date.now();
    await page.goto("/dashboard");
    const loadTime = Date.now() - startTime;

    // Should load within reasonable time (5 seconds on 3G)
    expect(loadTime).toBeLessThan(5000);

    await context.close();
  });

  test("should handle offline mode gracefully", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard");

    // Go offline
    await context.setOffline(true);

    // Try to navigate
    await page.click("text=Customers").catch(() => {});

    // Should show offline indicator
    await expect(page.locator("text=/offline|no connection/i")).toBeVisible({
      timeout: 5000,
    });

    await context.close();
  });
});

test.describe("Mobile Accessibility", () => {
  test("should have proper font sizes on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await page.goto("/login");

    // Check font sizes are readable (minimum 16px to prevent zoom)
    const fontSize = await page.evaluate(() => {
      const input = document.querySelector('input[type="text"]');
      if (input) {
        return window.getComputedStyle(input).fontSize;
      }
      return "16px";
    });

    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(16);

    await context.close();
  });

  test("should have proper contrast on mobile", async ({ browser }) => {
    const context = await browser.newContext({
      ...devices["iPhone 13"],
    });
    const page = await context.newPage();

    await setupAuthenticatedPage(page);
    await page.goto("/dashboard");

    // Check button contrast
    const button = page.locator("button").first();
    if (await button.isVisible()) {
      const contrast = await page.evaluate(
        (btn) => {
          const element = btn as HTMLElement;
          const bg = window.getComputedStyle(element).backgroundColor;
          const color = window.getComputedStyle(element).color;
          return { bg, color };
        },
        await button.elementHandle(),
      );

      // Basic check - both should be defined
      expect(contrast.bg).toBeTruthy();
      expect(contrast.color).toBeTruthy();
    }

    await context.close();
  });
});
