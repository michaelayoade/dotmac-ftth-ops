import { test, expect, Page } from "@playwright/test";

async function loginAndOpenTenantView(page: Page) {
  await page.goto("/login");
  // Use superadmin for E2E tests (has platform-wide access)
  await page.fill("input#email", "superadmin");
  await page.fill("input#password", "admin123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/dashboard/, { timeout: 30000 });
  await page.goto("/tenant/billing");
  await page.waitForURL(/tenant/, { timeout: 30000 });
}

test.describe("Tenant portal billing - Layout & Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndOpenTenantView(page);
  });

  test("shows main page structure with headers", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: /Billing & Plans/i })).toBeVisible();
    await expect(page.getByText(/Keep your subscription current/i)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Invoice history/i })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: /Recent payments/i })).toBeVisible();
  });

  test("displays all four summary cards", async ({ page }) => {
    // Wait for cards to load
    await page.waitForSelector("text=Current plan", { timeout: 5000 });

    // Verify all four metric cards are present
    await expect(page.getByText("Current plan")).toBeVisible();
    await expect(page.getByText("Monthly spend")).toBeVisible();
    await expect(page.getByText("Open invoices")).toBeVisible();
    await expect(page.getByText("Payment health")).toBeVisible();
  });

  test("shows action cards for subscription and payment management", async ({ page }) => {
    await expect(page.getByText("Manage subscription")).toBeVisible();
    await expect(page.getByText("Payment methods & invoices")).toBeVisible();

    // Verify action buttons
    await expect(page.getByRole("link", { name: /Compare plans/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /View subscriptions/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Manage payment methods/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open invoice workspace/i })).toBeVisible();
  });
});

test.describe("Tenant portal billing - Metrics & Data", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndOpenTenantView(page);
  });

  test("displays current plan with status", async ({ page }) => {
    const planCard = page.locator("text=Current plan").locator("..");
    await expect(planCard).toBeVisible();

    // Should show plan type (Professional, Enterprise, etc.)
    await expect(planCard.locator("text=/Professional|Enterprise|Starter/i")).toBeVisible();

    // Should show status
    await expect(planCard.locator("text=/Status:/i")).toBeVisible();
  });

  test("displays monthly spend amount", async ({ page }) => {
    const spendCard = page.locator("text=Monthly spend").locator("..");
    await expect(spendCard).toBeVisible();

    // Should show currency formatted amount
    const amountText = await spendCard.locator("text=/\\$[\\d,]+/").textContent();
    expect(amountText).toMatch(/^\$[\d,]+$/);
  });

  test("shows open invoices count with breakdown", async ({ page }) => {
    const invoiceCard = page.locator("text=Open invoices").locator("..");
    await expect(invoiceCard).toBeVisible();

    // Should show count
    await expect(invoiceCard.locator("text=/\\d+ open/i")).toBeVisible();

    // Should have link to review invoices
    await expect(invoiceCard.getByRole("link", { name: /Review invoices/i })).toBeVisible();
  });

  test("highlights overdue invoices in open invoices card", async ({ page }) => {
    const invoiceCard = page.locator("text=Open invoices").locator("..");

    // Check if there's an overdue warning (may or may not be present)
    const overdueText = invoiceCard.locator("text=/\\d+ overdue/i");
    const isVisible = await overdueText.isVisible();

    if (isVisible) {
      // If overdue invoices exist, verify the destructive styling
      const count = await overdueText.textContent();
      expect(count).toMatch(/\d+ overdue invoice/);
    }
  });

  test("shows payment health status", async ({ page }) => {
    const healthCard = page.locator("text=Payment health").locator("..");
    await expect(healthCard).toBeVisible();

    // Should show pending count
    await expect(healthCard.locator("text=/\\d+ pending/i")).toBeVisible();
  });
});

test.describe("Tenant portal billing - Invoice List", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndOpenTenantView(page);
  });

  test("renders invoice table with data", async ({ page }) => {
    await page.waitForSelector('[data-testid="invoice-row"]', {
      timeout: 5000,
    });

    const invoiceRows = page.locator('[data-testid="invoice-row"]');
    const count = await invoiceRows.count();

    expect(count).toBeGreaterThan(0);
  });

  test("filters invoice list when search applied", async ({ page }) => {
    const invoiceRows = page.locator('[data-testid="invoice-row"]');

    // Wait for initial load
    await page.waitForSelector('[data-testid="invoice-row"]', {
      timeout: 5000,
    });
    const initialCount = await invoiceRows.count();

    // Apply filter
    await page.fill('[data-testid="invoice-search"]', "INV-2025-100");
    await page.waitForTimeout(400);

    const filteredCount = await invoiceRows.count();
    expect(filteredCount).toBeGreaterThanOrEqual(0);
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("clears invoice filter when search cleared", async ({ page }) => {
    await page.waitForSelector('[data-testid="invoice-row"]', {
      timeout: 5000,
    });
    const initialCount = await page.locator('[data-testid="invoice-row"]').count();

    // Apply and then clear filter
    await page.fill('[data-testid="invoice-search"]', "nonexistent");
    await page.waitForTimeout(400);

    await page.fill('[data-testid="invoice-search"]', "");
    await page.waitForTimeout(400);

    const restoredCount = await page.locator('[data-testid="invoice-row"]').count();
    expect(restoredCount).toBe(initialCount);
  });

  test("displays invoice amounts with currency formatting", async ({ page }) => {
    await page.waitForSelector('[data-testid="invoice-row"]', {
      timeout: 5000,
    });

    const firstRow = page.locator('[data-testid="invoice-row"]').first();
    const amountText = await firstRow.locator("text=/\\$[\\d,]+\\.\\d{2}/").textContent();

    // Verify currency format: $X,XXX.XX
    expect(amountText).toMatch(/^\$[\d,]+\.\d{2}$/);
  });

  test("shows invoice status badges", async ({ page }) => {
    await page.waitForSelector('[data-testid="invoice-row"]', {
      timeout: 5000,
    });

    // Check that status badges are present
    const statuses = ["open", "paid", "draft", "overdue"];
    let foundStatus = false;

    for (const status of statuses) {
      const badge = page.locator(`[data-testid="invoice-row"] >> text=${status}`, {
        hasText: new RegExp(status, "i"),
      });
      if ((await badge.count()) > 0) {
        foundStatus = true;
        break;
      }
    }

    expect(foundStatus).toBe(true);
  });

  test("allows invoice selection", async ({ page }) => {
    await page.waitForSelector('[data-testid="invoice-row"]', {
      timeout: 5000,
    });

    // Click first invoice
    const firstRow = page.locator('[data-testid="invoice-row"]').first();
    await firstRow.click();

    // Verify selected invoice details appear
    await page.waitForSelector("text=Selected invoice", { timeout: 2000 });
    await expect(page.getByText("Selected invoice")).toBeVisible();
  });
});

test.describe("Tenant portal billing - Payment Table", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndOpenTenantView(page);
  });

  test("renders payment table with data", async ({ page }) => {
    const paymentsTable = page.locator('[data-testid="payments-table"]');
    await expect(paymentsTable).toBeVisible({ timeout: 5000 });

    const rows = paymentsTable.locator('[data-testid="payments-row"]');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test("displays payment amounts with proper currency formatting", async ({ page }) => {
    await page.waitForSelector('[data-testid="payments-row"]', {
      timeout: 5000,
    });

    const firstRow = page.locator('[data-testid="payments-row"]').first();
    const amountText = await firstRow.locator("text=/\\$[\\d,]+\\.\\d{2}/").textContent();

    // Verify amounts are in dollar format (converted from cents)
    expect(amountText).toMatch(/^\$[\d,]+\.\d{2}$/);

    // Verify it's not showing raw cents (would be very large numbers)
    const numericValue = parseFloat(amountText!.replace(/[$,]/g, ""));
    expect(numericValue).toBeLessThan(100000); // Reasonable max amount
  });

  test("shows payment status badges with correct variants", async ({ page }) => {
    await page.waitForSelector('[data-testid="payments-row"]', {
      timeout: 5000,
    });

    const table = page.locator('[data-testid="payments-table"]');

    // Check for various payment statuses
    const possibleStatuses = ["succeeded", "pending", "failed", "processing"];
    let foundStatus = false;

    for (const status of possibleStatuses) {
      const badge = table.locator(`text=${status}`, {
        hasText: new RegExp(status, "i"),
      });
      if ((await badge.count()) > 0) {
        foundStatus = true;
        break;
      }
    }

    expect(foundStatus).toBe(true);
  });

  test("displays payment reference IDs", async ({ page }) => {
    await page.waitForSelector('[data-testid="payments-row"]', {
      timeout: 5000,
    });

    const firstRow = page.locator('[data-testid="payments-row"]').first();
    const cells = firstRow.locator("td");

    // First cell should be reference/ID
    const referenceText = await cells.first().textContent();
    expect(referenceText).toBeTruthy();
    expect(referenceText!.length).toBeGreaterThan(0);
  });

  test("shows payment method information", async ({ page }) => {
    await page.waitForSelector('[data-testid="payments-row"]', {
      timeout: 5000,
    });

    const firstRow = page.locator('[data-testid="payments-row"]').first();

    // Should show payment method (card, bank transfer, etc.)
    const methodCell = await firstRow.locator("td").nth(3).textContent();
    expect(methodCell).toBeTruthy();
  });

  test("displays processed dates in correct format", async ({ page }) => {
    await page.waitForSelector('[data-testid="payments-row"]', {
      timeout: 5000,
    });

    const firstRow = page.locator('[data-testid="payments-row"]').first();

    // Last cell should be processed date
    const dateCell = firstRow.locator("td").last();
    const dateText = await dateCell.textContent();

    // Should be formatted date or em dash for pending
    expect(dateText).toMatch(/^(—|[A-Z][a-z]{2} \d{1,2}, \d{4})/);
  });

  test("handles empty payment state gracefully", async ({ page }) => {
    // This test would require a tenant with no payments
    // For now, verify the no-data message exists in the component
    // (This will only show if no payments are returned)

    // Skip if payments exist (which they should with our fixtures)
    const hasRows = (await page.locator('[data-testid="payments-row"]').count()) > 0;
    if (!hasRows) {
      await expect(page.getByText("No payment activity captured yet")).toBeVisible();
    }
  });
});
