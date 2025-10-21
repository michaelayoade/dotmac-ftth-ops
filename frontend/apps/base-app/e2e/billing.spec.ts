import { test, expect, Page } from "@playwright/test";

// Helper to setup billing page
async function setupBillingPage(page: Page) {
  // Login as admin
  await page.goto("/login");
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "Admin123!@#");
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);

  // Navigate to billing
  await page.click('a[href="/dashboard/billing"]');
  await page.waitForURL(/.*billing/);
}

test.describe("Subscription Management", () => {
  test.beforeEach(async ({ page }) => {
    await setupBillingPage(page);
  });

  test("should display current subscription", async ({ page }) => {
    // Check subscription card exists
    await expect(page.locator('[data-testid="subscription-card"]')).toBeVisible();

    // Check plan details
    await expect(page.locator('[data-testid="plan-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="plan-price"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-cycle"]')).toBeVisible();
    await expect(page.locator('[data-testid="next-billing-date"]')).toBeVisible();
  });

  test("should upgrade subscription plan", async ({ page }) => {
    // Click upgrade button
    await page.click('[data-testid="upgrade-plan-btn"]');

    // Select higher tier plan
    await page.click('[data-testid="plan-professional"]');

    // Review changes
    await expect(page.locator('[data-testid="price-difference"]')).toBeVisible();
    await expect(page.locator('[data-testid="proration-amount"]')).toBeVisible();

    // Confirm upgrade
    await page.click('[data-testid="confirm-upgrade"]');

    // Enter payment if required
    const paymentRequired = await page.locator('[data-testid="payment-form"]').isVisible();
    if (paymentRequired) {
      await page.fill('[data-testid="card-number"]', "4242424242424242");
      await page.fill('[data-testid="card-expiry"]', "12/25");
      await page.fill('[data-testid="card-cvc"]', "123");
      await page.click('[data-testid="submit-payment"]');
    }

    // Check success
    await expect(page.locator(".success-toast")).toContainText(
      "Subscription upgraded successfully",
    );
    await expect(page.locator('[data-testid="plan-name"]')).toContainText("Professional");
  });

  test("should downgrade subscription plan", async ({ page }) => {
    // Click change plan
    await page.click('[data-testid="change-plan-btn"]');

    // Select lower tier
    await page.click('[data-testid="plan-basic"]');

    // Review downgrade implications
    await expect(page.locator('[data-testid="downgrade-warning"]')).toBeVisible();
    await expect(page.locator('[data-testid="feature-loss-list"]')).toBeVisible();

    // Schedule downgrade
    await page.check('[data-testid="acknowledge-downgrade"]');
    await page.click('[data-testid="schedule-downgrade"]');

    // Check confirmation
    await expect(page.locator(".info-toast")).toContainText(
      "Downgrade scheduled for next billing cycle",
    );
    await expect(page.locator('[data-testid="pending-change"]')).toBeVisible();
  });

  test("should cancel subscription", async ({ page }) => {
    // Click cancel subscription
    await page.click('[data-testid="cancel-subscription-btn"]');

    // Fill cancellation survey
    await page.selectOption('[data-testid="cancel-reason"]', "too-expensive");
    await page.fill('[data-testid="cancel-feedback"]', "Testing cancellation flow");

    // Confirm cancellation
    await page.click('[data-testid="confirm-cancel"]');

    // Check for retention offer
    const offerVisible = await page.locator('[data-testid="retention-offer"]').isVisible();
    if (offerVisible) {
      // Decline offer
      await page.click('[data-testid="decline-offer"]');
    }

    // Final confirmation
    await page.click('[data-testid="final-cancel-confirm"]');

    // Check cancellation scheduled
    await expect(page.locator(".warning-toast")).toContainText("Subscription will be canceled");
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText("Canceling");
  });

  test("should reactivate canceled subscription", async ({ page }) => {
    // Find canceled subscription
    await page.click('[data-testid="view-canceled-subscriptions"]');

    // Click reactivate on first canceled subscription
    await page.click(
      '[data-testid="canceled-subscription"]:first-child [data-testid="reactivate-btn"]',
    );

    // Confirm reactivation
    await page.click('[data-testid="confirm-reactivate"]');

    // Check success
    await expect(page.locator(".success-toast")).toContainText("Subscription reactivated");
    await expect(page.locator('[data-testid="subscription-status"]')).toContainText("Active");
  });
});

test.describe("Invoice Management", () => {
  test.beforeEach(async ({ page }) => {
    await setupBillingPage(page);
    await page.click('[data-testid="invoices-tab"]');
  });

  test("should display invoice list", async ({ page }) => {
    // Check invoice table
    await expect(page.locator('[data-testid="invoice-table"]')).toBeVisible();

    // Check invoice rows
    const invoiceRows = page.locator('[data-testid="invoice-row"]');
    const invoiceCount = await invoiceRows.count();
    expect(invoiceCount).toBeGreaterThanOrEqual(1);

    // Check invoice details visible
    await expect(page.locator('[data-testid="invoice-number"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="invoice-amount"]').first()).toBeVisible();
    await expect(page.locator('[data-testid="invoice-status"]').first()).toBeVisible();
  });

  test("should filter invoices by status", async ({ page }) => {
    // Filter by paid
    await page.selectOption('[data-testid="invoice-status-filter"]', "paid");
    await page.waitForTimeout(500);

    // Check all are paid
    const statuses = page.locator('[data-testid="invoice-status"]');
    const count = await statuses.count();
    for (let i = 0; i < count; i++) {
      await expect(statuses.nth(i)).toHaveText("Paid");
    }

    // Filter by pending
    await page.selectOption('[data-testid="invoice-status-filter"]', "pending");
    await page.waitForTimeout(500);

    // Check for pending invoices
    const pendingStatuses = page.locator('[data-testid="invoice-status"]');
    if ((await pendingStatuses.count()) > 0) {
      await expect(pendingStatuses.first()).toHaveText("Pending");
    }
  });

  test("should view invoice details", async ({ page }) => {
    // Click view on first invoice
    await page.click('[data-testid="invoice-row"]:first-child [data-testid="view-invoice"]');

    // Check invoice detail page
    await expect(page.locator('[data-testid="invoice-detail"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-header"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-items"]')).toBeVisible();
    await expect(page.locator('[data-testid="invoice-total"]')).toBeVisible();
  });

  test("should download invoice PDF", async ({ page }) => {
    // Click download on first invoice
    const downloadPromise = page.waitForEvent("download");
    await page.click('[data-testid="invoice-row"]:first-child [data-testid="download-invoice"]');

    // Verify download
    const downloadedFile = await downloadPromise;
    expect(downloadedFile.suggestedFilename()).toMatch(/invoice.*\.pdf$/);
  });

  test("should pay pending invoice", async ({ page }) => {
    // Find pending invoice
    await page.selectOption('[data-testid="invoice-status-filter"]', "pending");
    await page.waitForTimeout(500);

    const pendingInvoice = page.locator('[data-testid="invoice-row"]').first();
    if (await pendingInvoice.isVisible()) {
      // Click pay button
      await page.click('[data-testid="pay-invoice-btn"]');

      // Select payment method
      await page.click('[data-testid="payment-method-saved"]');

      // Confirm payment
      await page.click('[data-testid="confirm-payment"]');

      // Check success
      await expect(page.locator(".success-toast")).toContainText("Payment successful");
      await expect(page.locator('[data-testid="invoice-status"]').first()).toHaveText("Paid");
    }
  });

  test("should request invoice refund", async ({ page }) => {
    // Find paid invoice
    await page.selectOption('[data-testid="invoice-status-filter"]', "paid");
    await page.waitForTimeout(500);

    // Click on first paid invoice
    await page.click('[data-testid="invoice-row"]:first-child [data-testid="view-invoice"]');

    // Click request refund
    await page.click('[data-testid="request-refund-btn"]');

    // Fill refund form
    await page.selectOption('[data-testid="refund-reason"]', "duplicate-charge");
    await page.fill('[data-testid="refund-amount"]', "50.00");
    await page.fill('[data-testid="refund-notes"]', "Duplicate charge for the same service");

    // Submit request
    await page.click('[data-testid="submit-refund-request"]');

    // Check confirmation
    await expect(page.locator(".info-toast")).toContainText("Refund request submitted");
    await expect(page.locator('[data-testid="refund-status"]')).toBeVisible();
  });
});

test.describe("Payment Methods", () => {
  test.beforeEach(async ({ page }) => {
    await setupBillingPage(page);
    await page.click('[data-testid="payment-methods-tab"]');
  });

  test("should display saved payment methods", async ({ page }) => {
    // Check payment methods section
    await expect(page.locator('[data-testid="payment-methods-list"]')).toBeVisible();

    // Check for existing cards
    const cards = page.locator('[data-testid="payment-method-card"]');
    const cardCount = await cards.count();

    if (cardCount > 0) {
      // Check card details are masked
      await expect(cards.first()).toContainText("•••• ");
      await expect(cards.first()).toContainText(/\d{2}\/\d{2}/); // Expiry format
    }
  });

  test("should add new payment method", async ({ page }) => {
    // Click add payment method
    await page.click('[data-testid="add-payment-method-btn"]');

    // Fill card details
    await page.fill('[data-testid="card-number"]', "5555555555554444"); // Mastercard test
    await page.fill('[data-testid="card-expiry"]', "12/26");
    await page.fill('[data-testid="card-cvc"]', "456");
    await page.fill('[data-testid="card-name"]', "Test User");
    await page.fill('[data-testid="card-zip"]', "12345");

    // Save card
    await page.click('[data-testid="save-payment-method"]');

    // Check success
    await expect(page.locator(".success-toast")).toContainText("Payment method added");
    await expect(page.locator('[data-testid="payment-method-card"]').last()).toContainText(
      "•••• 4444",
    );
  });

  test("should set default payment method", async ({ page }) => {
    const cards = page.locator('[data-testid="payment-method-card"]');
    const cardCount = await cards.count();

    if (cardCount > 1) {
      // Click make default on second card
      await page.click(
        '[data-testid="payment-method-card"]:nth-child(2) [data-testid="make-default-btn"]',
      );

      // Confirm
      await page.click('[data-testid="confirm-default"]');

      // Check success
      await expect(page.locator(".success-toast")).toContainText("Default payment method updated");
      await expect(page.locator('[data-testid="payment-method-card"]:nth-child(2)')).toContainText(
        "Default",
      );
    }
  });

  test("should remove payment method", async ({ page }) => {
    const cards = page.locator('[data-testid="payment-method-card"]');
    const initialCount = await cards.count();

    if (initialCount > 1) {
      // Remove last card (not default)
      await page.click('[data-testid="payment-method-card"]:last-child [data-testid="remove-btn"]');

      // Confirm removal
      await page.click('[data-testid="confirm-remove"]');

      // Check success
      await expect(page.locator(".success-toast")).toContainText("Payment method removed");
      await expect(cards).toHaveCount(initialCount - 1);
    }
  });
});

test.describe("Billing History and Reports", () => {
  test.beforeEach(async ({ page }) => {
    await setupBillingPage(page);
  });

  test("should display billing history", async ({ page }) => {
    // Go to history tab
    await page.click('[data-testid="history-tab"]');

    // Check timeline
    await expect(page.locator('[data-testid="billing-timeline"]')).toBeVisible();

    // Check for history items
    const historyItems = page.locator('[data-testid="history-item"]');
    const historyCount = await historyItems.count();
    expect(historyCount).toBeGreaterThanOrEqual(1);

    // Check item details
    await expect(historyItems.first()).toContainText(/Payment|Invoice|Subscription/);
  });

  test("should generate billing report", async ({ page }) => {
    // Go to reports tab
    await page.click('[data-testid="reports-tab"]');

    // Select date range
    await page.fill('[data-testid="report-start-date"]', "2024-01-01");
    await page.fill('[data-testid="report-end-date"]', "2024-12-31");

    // Select report type
    await page.selectOption('[data-testid="report-type"]', "revenue-summary");

    // Generate report
    const downloadPromise = page.waitForEvent("download");
    await page.click('[data-testid="generate-report-btn"]');

    // Verify download
    const downloadedFile = await downloadPromise;
    expect(downloadedFile.suggestedFilename()).toMatch(/billing-report.*\.csv$/);
  });

  test("should display usage-based billing", async ({ page }) => {
    // Go to usage tab
    await page.click('[data-testid="usage-tab"]');

    // Check usage metrics
    await expect(page.locator('[data-testid="usage-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="api-calls-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="storage-usage"]')).toBeVisible();
    await expect(page.locator('[data-testid="bandwidth-usage"]')).toBeVisible();

    // Check overage warnings if any
    const overageWarning = page.locator('[data-testid="overage-warning"]');
    if (await overageWarning.isVisible()) {
      await expect(overageWarning).toContainText(/exceeding|overage/i);
    }
  });

  test("should manage billing alerts", async ({ page }) => {
    // Go to settings
    await page.click('[data-testid="billing-settings-tab"]');

    // Set spending alert
    await page.fill('[data-testid="spending-limit"]', "1000");
    await page.check('[data-testid="enable-spending-alert"]');

    // Set payment failure alert
    await page.check('[data-testid="payment-failure-alert"]');

    // Set invoice reminder
    await page.check('[data-testid="invoice-reminder"]');
    await page.selectOption('[data-testid="reminder-days"]', "3");

    // Save settings
    await page.click('[data-testid="save-billing-settings"]');

    // Check success
    await expect(page.locator(".success-toast")).toContainText("Billing settings updated");
  });
});

test.describe("Tax and Compliance", () => {
  test.beforeEach(async ({ page }) => {
    await setupBillingPage(page);
  });

  test("should manage tax exemption", async ({ page }) => {
    // Go to tax settings
    await page.click('[data-testid="tax-settings-tab"]');

    // Upload tax exemption certificate
    await page.setInputFiles('[data-testid="tax-cert-upload"]', "./test-assets/tax-exemption.pdf");

    // Fill exemption details
    await page.fill('[data-testid="tax-id"]', "TX123456789");
    await page.selectOption('[data-testid="exemption-type"]', "resale");
    await page.fill('[data-testid="exemption-state"]', "TX");

    // Submit
    await page.click('[data-testid="submit-tax-exemption"]');

    // Check success
    await expect(page.locator(".success-toast")).toContainText("Tax exemption applied");
    await expect(page.locator('[data-testid="tax-status"]')).toContainText("Exempt");
  });

  test("should download tax documents", async ({ page }) => {
    // Go to tax documents
    await page.click('[data-testid="tax-documents-tab"]');

    // Download W-9 or tax invoice
    const downloadPromise = page.waitForEvent("download");
    await page.click('[data-testid="download-tax-document"]');

    // Verify download
    const downloadedFile = await downloadPromise;
    expect(downloadedFile.suggestedFilename()).toMatch(/tax.*\.(pdf|xlsx)$/);
  });
});
