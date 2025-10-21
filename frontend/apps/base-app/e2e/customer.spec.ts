import { test, expect, Page } from "@playwright/test";

// Helper to login and navigate to customer section
async function setupCustomerPage(page: Page) {
  // Login
  await page.goto("/login");
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "Admin123!@#");
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);

  // Navigate to customers
  await page.click('a[href="/dashboard/customers"]');
  await page.waitForURL(/.*customers/);
}

test.describe("Customer Management", () => {
  test.beforeEach(async ({ page }) => {
    await setupCustomerPage(page);
  });

  test("should display customer list", async ({ page }) => {
    // Check page title
    await expect(page.locator("h1")).toContainText("Customers");

    // Check table exists
    await expect(page.locator('[data-testid="customer-table"]')).toBeVisible();

    // Check for customer data
    await page.waitForSelector('[data-testid="customer-row"]');
    const customerRows = page.locator('[data-testid="customer-row"]');
    const count = await customerRows.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test("should search for customers", async ({ page }) => {
    // Enter search query
    await page.fill('[data-testid="customer-search"]', "john");
    await page.keyboard.press("Enter");

    // Wait for results
    await page.waitForTimeout(500);

    // Check filtered results
    const customerRows = page.locator('[data-testid="customer-row"]');
    const count = await customerRows.count();

    for (let i = 0; i < count; i++) {
      const row = customerRows.nth(i);
      const text = await row.textContent();
      expect(text?.toLowerCase()).toContain("john");
    }
  });

  test("should filter customers by status", async ({ page }) => {
    // Apply active filter
    await page.selectOption('[data-testid="customer-status-filter"]', "active");
    await page.waitForTimeout(500);

    // Check all displayed customers are active
    const statusBadges = page.locator('[data-testid="customer-status"]');
    const count = await statusBadges.count();

    for (let i = 0; i < count; i++) {
      await expect(statusBadges.nth(i)).toHaveText("Active");
    }

    // Apply inactive filter
    await page.selectOption('[data-testid="customer-status-filter"]', "inactive");
    await page.waitForTimeout(500);

    // Check for inactive customers
    const inactiveStatuses = page.locator('[data-testid="customer-status"]');
    if ((await inactiveStatuses.count()) > 0) {
      await expect(inactiveStatuses.first()).toHaveText("Inactive");
    }
  });

  test("should view customer details", async ({ page }) => {
    // Click first customer
    await page.click('[data-testid="customer-row"]:first-child [data-testid="view-customer"]');

    // Check customer detail page
    await expect(page).toHaveURL(/.*customers\/\d+/);
    await expect(page.locator('[data-testid="customer-details"]')).toBeVisible();

    // Check key information sections
    await expect(page.locator('[data-testid="contact-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="billing-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="subscription-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="transaction-history"]')).toBeVisible();
  });

  test("should create new customer", async ({ page }) => {
    // Click create button
    await page.click('[data-testid="create-customer-btn"]');

    // Fill customer form
    const timestamp = Date.now();
    await page.fill('input[name="email"]', `customer${timestamp}@example.com`);
    await page.fill('input[name="firstName"]', "Test");
    await page.fill('input[name="lastName"]', "Customer");
    await page.fill('input[name="company"]', "Test Company");
    await page.fill('input[name="phone"]', "+1234567890");

    // Billing address
    await page.fill('input[name="billingAddress.line1"]', "123 Test Street");
    await page.fill('input[name="billingAddress.city"]', "Test City");
    await page.fill('input[name="billingAddress.state"]', "CA");
    await page.fill('input[name="billingAddress.postalCode"]', "12345");
    await page.selectOption('select[name="billingAddress.country"]', "US");

    // Tax settings
    await page.selectOption('select[name="taxExempt"]', "false");

    // Submit form
    await page.click('[data-testid="save-customer"]');

    // Check success message
    await expect(page.locator(".success-toast")).toContainText("Customer created successfully");

    // Verify redirect to customer detail
    await expect(page).toHaveURL(/.*customers\/\d+/);
  });

  test("should edit customer information", async ({ page }) => {
    // Navigate to first customer
    await page.click('[data-testid="customer-row"]:first-child [data-testid="view-customer"]');
    await page.waitForURL(/.*customers\/\d+/);

    // Click edit button
    await page.click('[data-testid="edit-customer-btn"]');

    // Update information
    await page.fill('input[name="company"]', "Updated Company Name");
    await page.fill('input[name="phone"]', "+9876543210");

    // Save changes
    await page.click('[data-testid="save-customer"]');

    // Check success message
    await expect(page.locator(".success-toast")).toContainText("Customer updated successfully");

    // Verify changes persisted
    await page.reload();
    await expect(page.locator('input[name="company"]')).toHaveValue("Updated Company Name");
  });

  test("should manage customer payment methods", async ({ page }) => {
    // Navigate to customer
    await page.click('[data-testid="customer-row"]:first-child [data-testid="view-customer"]');

    // Go to payment methods tab
    await page.click('[data-testid="payment-methods-tab"]');

    // Add payment method
    await page.click('[data-testid="add-payment-method"]');

    // Fill card details (using Stripe test card)
    await page.fill('[data-testid="card-number"]', "4242424242424242");
    await page.fill('[data-testid="card-expiry"]', "12/25");
    await page.fill('[data-testid="card-cvc"]', "123");
    await page.fill('[data-testid="card-name"]', "Test Card");

    // Set as default
    await page.check('[data-testid="set-default-payment"]');

    // Save
    await page.click('[data-testid="save-payment-method"]');

    // Check success
    await expect(page.locator(".success-toast")).toContainText("Payment method added");
    await expect(page.locator('[data-testid="payment-method-card"]')).toContainText("•••• 4242");
  });

  test("should export customer data", async ({ page }) => {
    // Trigger export
    const downloadPromise = page.waitForEvent("download");
    await page.click('[data-testid="export-customers"]');

    // Select format
    await page.selectOption('[data-testid="export-format"]', "csv");
    await page.click('[data-testid="confirm-export"]');

    // Verify download
    const downloadedFile = await downloadPromise;
    expect(downloadedFile.suggestedFilename()).toMatch(/customers.*\.csv$/);
  });

  test("should handle customer deletion", async ({ page }) => {
    // Navigate to customer
    await page.click('[data-testid="customer-row"]:last-child [data-testid="view-customer"]');

    // Click delete button
    await page.click('[data-testid="delete-customer-btn"]');

    // Confirm deletion
    await expect(page.locator('[role="dialog"]')).toContainText("Are you sure");
    await page.click('[data-testid="confirm-delete"]');

    // Check success message
    await expect(page.locator(".success-toast")).toContainText("Customer deleted successfully");

    // Verify redirect to customer list
    await expect(page).toHaveURL(/.*customers$/);
  });

  test("should manage customer notes", async ({ page }) => {
    // Navigate to customer
    await page.click('[data-testid="customer-row"]:first-child [data-testid="view-customer"]');

    // Go to notes section
    await page.click('[data-testid="notes-tab"]');

    // Add a note
    await page.click('[data-testid="add-note-btn"]');
    await page.fill('[data-testid="note-content"]', "This is a test note about the customer");
    await page.click('[data-testid="save-note"]');

    // Check note appears
    await expect(page.locator('[data-testid="customer-note"]')).toContainText(
      "This is a test note",
    );

    // Edit note
    await page.click('[data-testid="edit-note-btn"]:first-child');
    await page.fill('[data-testid="note-content"]', "Updated note content");
    await page.click('[data-testid="save-note"]');

    // Verify update
    await expect(page.locator('[data-testid="customer-note"]:first-child')).toContainText(
      "Updated note content",
    );
  });
});

test.describe("Customer Portal Access", () => {
  test.beforeEach(async ({ page }) => {
    await setupCustomerPage(page);
  });

  test("should generate customer portal link", async ({ page }) => {
    // Navigate to customer
    await page.click('[data-testid="customer-row"]:first-child [data-testid="view-customer"]');

    // Click generate portal link
    await page.click('[data-testid="generate-portal-link"]');

    // Check link is generated
    await expect(page.locator('[data-testid="portal-link"]')).toBeVisible();
    const link = await page.locator('[data-testid="portal-link"]').inputValue();
    expect(link).toMatch(/^https?:\/\/.+\/portal\/.+/);

    // Copy link
    await page.click('[data-testid="copy-portal-link"]');
    await expect(page.locator(".success-toast")).toContainText("Link copied");
  });

  test("should revoke customer portal access", async ({ page }) => {
    // Navigate to customer with portal access
    await page.click('[data-testid="customer-row"]:first-child [data-testid="view-customer"]');

    // Revoke access
    await page.click('[data-testid="revoke-portal-access"]');

    // Confirm
    await page.click('[data-testid="confirm-revoke"]');

    // Check success
    await expect(page.locator(".success-toast")).toContainText("Portal access revoked");
    await expect(page.locator('[data-testid="portal-status"]')).toHaveText("Inactive");
  });
});

test.describe("Customer Metrics and Analytics", () => {
  test.beforeEach(async ({ page }) => {
    await setupCustomerPage(page);
  });

  test("should display customer lifetime value", async ({ page }) => {
    // Navigate to customer
    await page.click('[data-testid="customer-row"]:first-child [data-testid="view-customer"]');

    // Check metrics section
    await expect(page.locator('[data-testid="customer-ltv"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-spent"]')).toBeVisible();
    await expect(page.locator('[data-testid="average-order-value"]')).toBeVisible();
    await expect(page.locator('[data-testid="churn-risk"]')).toBeVisible();
  });

  test("should show customer activity timeline", async ({ page }) => {
    // Navigate to customer
    await page.click('[data-testid="customer-row"]:first-child [data-testid="view-customer"]');

    // Go to activity tab
    await page.click('[data-testid="activity-tab"]');

    // Check timeline exists
    await expect(page.locator('[data-testid="activity-timeline"]')).toBeVisible();

    // Check for activity items
    const activities = page.locator('[data-testid="activity-item"]');
    const activityCount = await activities.count();
    expect(activityCount).toBeGreaterThanOrEqual(1);

    // Filter by activity type
    await page.selectOption('[data-testid="activity-filter"]', "payment");
    await page.waitForTimeout(500);

    // Check filtered results
    const paymentActivities = page.locator('[data-testid="activity-type-payment"]');
    const allActivities = page.locator('[data-testid="activity-item"]');
    expect(await paymentActivities.count()).toBe(await allActivities.count());
  });
});
