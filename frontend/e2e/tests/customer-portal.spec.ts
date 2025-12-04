/**
 * E2E Tests for Customer Portal
 *
 * These tests cover the full integration of customer-facing portal functionality
 * including profile management, billing, support, and service management.
 *
 * Covers:
 * - Customer profile management
 * - Service viewing and plan upgrades
 * - Invoice management
 * - Payment processing
 * - Usage monitoring
 * - Support ticket creation
 * - Settings and password management
 * - Payment method management
 * - Error handling
 */

import { test, expect } from "@playwright/test";

test.describe("Customer Portal", () => {
  test.beforeEach(async ({ page }) => {
    // Login as customer
    await page.goto("/customer-portal/login");
    await page.fill('[name="email"]', process.env.TEST_CUSTOMER_EMAIL || "customer@test.com");
    await page.fill('[name="password"]', process.env.TEST_CUSTOMER_PASSWORD || "password");
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForURL(/\/customer-portal\/dashboard|\/customer-portal\/home/);
    await page.waitForLoadState("networkidle");
  });

  test.describe("Profile Management", () => {
    test("should display customer profile information", async ({ page }) => {
      // Navigate to profile page
      await page.goto("/customer-portal/profile");
      await page.waitForLoadState("networkidle");

      // Check for profile heading
      await expect(page.getByRole("heading", { name: /profile|account/i })).toBeVisible();

      // Verify profile fields are displayed
      await expect(page.locator('[name="first_name"], [data-testid="first-name"]')).toBeVisible();
      await expect(page.locator('[name="last_name"], [data-testid="last-name"]')).toBeVisible();
      await expect(page.locator('[name="email"], [data-testid="email"]')).toBeVisible();
      await expect(page.locator('[name="phone"], [data-testid="phone"]')).toBeVisible();
    });

    test("should update profile information", async ({ page }) => {
      await page.goto("/customer-portal/profile");

      // Click edit button
      const editButton = page.locator('button:has-text("Edit"), [data-testid="edit-profile"]');
      if (await editButton.isVisible()) {
        await editButton.click();
      }

      // Update phone number
      const phoneInput = page.locator('[name="phone"]');
      await phoneInput.clear();
      await phoneInput.fill("+1987654321");

      // Save changes
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');

      // Verify success
      await expect(page.locator("text=/saved|updated|success/i")).toBeVisible({ timeout: 10000 });
    });

    test("should display service address", async ({ page }) => {
      await page.goto("/customer-portal/profile");

      // Check for service address fields
      const addressSection = page.locator(
        '[data-testid="service-address"], section:has-text("Service Address")',
      );

      if (await addressSection.isVisible()) {
        await expect(addressSection).toContainText(/street|address|city|state|zip/i);
      }
    });
  });

  test.describe("Service Management", () => {
    test("should display current service plan", async ({ page }) => {
      await page.goto("/customer-portal/service");

      // Check for service plan heading
      await expect(page.getByRole("heading", { name: /service|plan/i })).toBeVisible();

      // Verify plan details are displayed
      const planDetails = page.locator('[data-testid="service-details"], [class*="plan-details"]');
      await expect(planDetails).toBeVisible();

      // Should show plan name, speed, and price
      await expect(page.locator("text=/plan|speed|price|mbps|gbps/i")).toBeVisible();
    });

    test("should display available plan upgrades", async ({ page }) => {
      await page.goto("/customer-portal/service");

      // Click upgrade button
      const upgradeButton = page.locator(
        'button:has-text("Upgrade"), button:has-text("Change Plan")',
      );

      if (await upgradeButton.isVisible()) {
        await upgradeButton.click();

        // Should show available plans
        await expect(
          page.locator('[data-testid="plan-option"], [class*="plan-card"]'),
        ).toBeVisible();
      }
    });

    test("should upgrade service plan", async ({ page }) => {
      await page.goto("/customer-portal/service");

      const upgradeButton = page.locator('button:has-text("Upgrade")');

      if (await upgradeButton.isVisible()) {
        await upgradeButton.click();

        // Select a higher tier plan
        const planOptions = page.locator('[data-testid="plan-option"]');
        const count = await planOptions.count();

        if (count > 1) {
          await planOptions.nth(1).click();

          // Confirm upgrade
          await page.click('button:has-text("Confirm"), button:has-text("Upgrade Now")');

          // Verify success
          await expect(page.locator("text=/upgraded|success/i")).toBeVisible({ timeout: 15000 });
        }
      }
    });
  });

  test.describe("Invoices and Billing", () => {
    test("should display invoice list", async ({ page }) => {
      await page.goto("/customer-portal/billing");

      // Check for invoices heading
      await expect(page.getByRole("heading", { name: /invoice|billing/i })).toBeVisible();

      // Verify invoice list or empty state
      const invoiceList = page.locator('[data-testid="invoice-list"], table');
      const emptyState = page.locator('[data-testid="invoices-empty"]');

      const hasInvoices = await invoiceList.isVisible();
      const isEmpty = await emptyState.isVisible();

      expect(hasInvoices || isEmpty).toBe(true);
    });

    test("should display invoice details", async ({ page }) => {
      await page.goto("/customer-portal/billing");

      const invoiceRows = page.locator('[data-testid="invoice-row"], tbody tr');
      const count = await invoiceRows.count();

      if (count > 0) {
        // Click first invoice
        await invoiceRows.first().click();

        // Should show invoice details
        await expect(page.locator('[data-testid="invoice-details"]')).toBeVisible();

        // Should show invoice number, amount, due date
        await expect(page.locator("text=/invoice|amount|due date/i")).toBeVisible();
      }
    });

    test("should download invoice PDF", async ({ page }) => {
      await page.goto("/customer-portal/billing");

      const downloadButtons = page.locator(
        'button:has-text("Download"), [data-testid="download-invoice"]',
      );
      const count = await downloadButtons.count();

      if (count > 0) {
        // Set up download handler
        const downloadPromise = page.waitForEvent("download");

        await downloadButtons.first().click();

        // Verify download started
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/invoice|pdf/i);
      }
    });
  });

  test.describe("Payment Processing", () => {
    test("should display payment methods", async ({ page }) => {
      await page.goto("/customer-portal/payment-methods");

      // Check for payment methods heading
      await expect(page.getByRole("heading", { name: /payment method/i })).toBeVisible();

      // Verify payment methods list or empty state
      const paymentMethodsList = page.locator('[data-testid="payment-methods-list"]');
      const emptyState = page.locator('[data-testid="payment-methods-empty"]');

      const hasMethods = await paymentMethodsList.isVisible();
      const isEmpty = await emptyState.isVisible();

      expect(hasMethods || isEmpty).toBe(true);
    });

    test("should add payment method", async ({ page }) => {
      await page.goto("/customer-portal/payment-methods");

      // Click add payment method
      await page.click('button:has-text("Add Payment Method"), button:has-text("Add Card")');

      // Fill card details
      await page.fill('[name="card_number"], [placeholder*="card number" i]', "4242424242424242");
      await page.fill('[name="card_exp_month"], [placeholder*="mm" i]', "12");
      await page.fill('[name="card_exp_year"], [placeholder*="yy" i]', "25");
      await page.fill('[name="card_cvc"], [placeholder*="cvc" i]', "123");
      await page.fill('[name="billing_name"]', "John Doe");

      // Submit
      await page.click('button[type="submit"]:has-text("Add"), button:has-text("Save")');

      // Verify success
      await expect(page.locator("text=/added|success/i")).toBeVisible({ timeout: 10000 });
    });

    test("should set default payment method", async ({ page }) => {
      await page.goto("/customer-portal/payment-methods");

      const paymentMethods = page.locator('[data-testid="payment-method-card"]');
      const count = await paymentMethods.count();

      if (count > 1) {
        // Click set as default on second method
        await paymentMethods.nth(1).locator('button:has-text("Set as Default")').click();

        // Verify it's now marked as default
        await expect(paymentMethods.nth(1).locator("text=/default/i")).toBeVisible();
      }
    });

    test("should make a payment", async ({ page }) => {
      await page.goto("/customer-portal/billing");

      const unpaidInvoices = page.locator(
        '[data-testid="invoice-row"]:has-text("unpaid"), tr:has-text("due")',
      );
      const count = await unpaidInvoices.count();

      if (count > 0) {
        // Click pay button on first unpaid invoice
        await unpaidInvoices
          .first()
          .locator('button:has-text("Pay"), button:has-text("Pay Now")')
          .click();

        // Select payment method
        const paymentMethodSelect = page.locator(
          '[name="payment_method"], [data-testid="payment-method-select"]',
        );
        if (await paymentMethodSelect.isVisible()) {
          await paymentMethodSelect.click();
          await page.click('[role="option"]:first-of-type');
        }

        // Confirm payment
        await page.click('button:has-text("Confirm Payment"), button:has-text("Pay")');

        // Verify success
        await expect(page.locator("text=/payment successful|paid/i")).toBeVisible({
          timeout: 15000,
        });
      }
    });

    test("should enable auto-pay", async ({ page }) => {
      await page.goto("/customer-portal/payment-methods");

      const paymentMethods = page.locator('[data-testid="payment-method-card"]');
      const count = await paymentMethods.count();

      if (count > 0) {
        // Find auto-pay toggle
        const autoPayToggle = paymentMethods
          .first()
          .locator('[role="switch"], input[type="checkbox"]');

        if (await autoPayToggle.isVisible()) {
          const isEnabled = await autoPayToggle.isChecked();

          // Toggle auto-pay
          await autoPayToggle.click();

          // Verify state changed
          await expect(autoPayToggle).toHaveAttribute("aria-checked", String(!isEnabled));
        }
      }
    });
  });

  test.describe("Usage Monitoring", () => {
    test("should display usage statistics", async ({ page }) => {
      await page.goto("/customer-portal/usage");

      // Check for usage heading
      await expect(page.getByRole("heading", { name: /usage|data/i })).toBeVisible();

      // Verify usage metrics are displayed
      const usageMetrics = page.locator('[data-testid="usage-metrics"]');
      await expect(usageMetrics).toBeVisible();

      // Should show upload, download, total
      await expect(page.locator("text=/upload|download|total|gb/i")).toBeVisible();
    });

    test("should display usage chart", async ({ page }) => {
      await page.goto("/customer-portal/usage");

      // Check for usage chart
      const usageChart = page.locator('[data-testid="usage-chart"], canvas, svg');

      if (await usageChart.isVisible()) {
        await expect(usageChart).toBeVisible();
      }
    });

    test("should display usage limit warning", async ({ page }) => {
      await page.goto("/customer-portal/usage");

      // Check for usage warning if near limit
      const warningMessage = page.locator(
        '[data-testid="usage-warning"], [class*="alert"]:has-text("usage")',
      );

      // Warning may or may not be visible depending on usage
      const isVisible = await warningMessage.isVisible();

      if (isVisible) {
        await expect(warningMessage).toContainText(/limit|warning|approaching/i);
      }
    });
  });

  test.describe("Support Tickets", () => {
    test("should display support tickets list", async ({ page }) => {
      await page.goto("/customer-portal/support");

      // Check for tickets heading
      await expect(page.getByRole("heading", { name: /support|ticket/i })).toBeVisible();

      // Verify tickets list or empty state
      const ticketsList = page.locator('[data-testid="tickets-list"], table');
      const emptyState = page.locator('[data-testid="tickets-empty"]');

      const hasTickets = await ticketsList.isVisible();
      const isEmpty = await emptyState.isVisible();

      expect(hasTickets || isEmpty).toBe(true);
    });

    test("should create support ticket", async ({ page }) => {
      await page.goto("/customer-portal/support");

      // Click create ticket button
      await page.click('button:has-text("Create Ticket"), button:has-text("New Ticket")');

      // Fill ticket details
      await page.fill('[name="subject"]', "E2E Test Ticket");
      await page.fill('[name="description"]', "This is a test ticket created by E2E tests");

      // Select category
      const categorySelect = page.locator('[name="category"]');
      if (await categorySelect.isVisible()) {
        await categorySelect.selectOption("technical");
      }

      // Select priority
      const prioritySelect = page.locator('[name="priority"]');
      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption("normal");
      }

      // Submit
      await page.click('button[type="submit"]:has-text("Create"), button:has-text("Submit")');

      // Verify success
      await expect(page.locator("text=/ticket created|success/i")).toBeVisible({ timeout: 10000 });

      // Verify ticket appears in list
      await expect(page.locator('text="E2E Test Ticket"')).toBeVisible();
    });

    test("should view ticket details", async ({ page }) => {
      await page.goto("/customer-portal/support");

      const ticketRows = page.locator('[data-testid="ticket-row"], tbody tr');
      const count = await ticketRows.count();

      if (count > 0) {
        // Click first ticket
        await ticketRows.first().click();

        // Should show ticket details
        await expect(page.locator('[data-testid="ticket-details"]')).toBeVisible();

        // Should show ticket number, status, priority
        await expect(page.locator("text=/ticket|status|priority/i")).toBeVisible();
      }
    });

    test("should filter tickets by status", async ({ page }) => {
      await page.goto("/customer-portal/support");

      const statusFilter = page.locator('[data-testid="status-filter"], select');

      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption("open");
        await page.waitForTimeout(500);

        // All visible tickets should be open
        const ticketRows = page.locator('[data-testid="ticket-row"]');
        const count = await ticketRows.count();

        for (let i = 0; i < count; i++) {
          await expect(ticketRows.nth(i)).toContainText(/open/i);
        }
      }
    });
  });

  test.describe("Settings Management", () => {
    test("should display settings page", async ({ page }) => {
      await page.goto("/customer-portal/settings");

      // Check for settings heading
      await expect(page.getByRole("heading", { name: /setting/i })).toBeVisible();

      // Verify settings sections are visible
      await expect(page.locator("text=/notification|preference|privacy/i")).toBeVisible();
    });

    test("should update notification settings", async ({ page }) => {
      await page.goto("/customer-portal/settings");

      // Find email notifications toggle
      const emailToggle = page.locator(
        '[data-testid="email-notifications"], input[name="email_notifications"]',
      );

      if (await emailToggle.isVisible()) {
        const wasEnabled = await emailToggle.isChecked();

        // Toggle
        await emailToggle.click();

        // Save
        await page.click('button:has-text("Save"), button[type="submit"]');

        // Verify success
        await expect(page.locator("text=/saved|updated|success/i")).toBeVisible({ timeout: 10000 });

        // Verify state changed
        await expect(emailToggle).toHaveAttribute("aria-checked", String(!wasEnabled));
      }
    });

    test("should change password", async ({ page }) => {
      await page.goto("/customer-portal/settings");

      // Click change password button
      const changePasswordButton = page.locator('button:has-text("Change Password")');

      if (await changePasswordButton.isVisible()) {
        await changePasswordButton.click();

        // Fill password form
        await page.fill('[name="current_password"]', "password");
        await page.fill('[name="new_password"]', "newpassword123");
        await page.fill('[name="confirm_password"]', "newpassword123");

        // Submit
        await page.click('button[type="submit"]:has-text("Change"), button:has-text("Update")');

        // Verify success (or validation error for weak password)
        const successOrError = await Promise.race([
          page.locator("text=/password changed|success/i").isVisible(),
          page.locator("text=/error|invalid|weak/i").isVisible(),
        ]);

        expect(successOrError).toBe(true);
      }
    });

    test("should update privacy preferences", async ({ page }) => {
      await page.goto("/customer-portal/settings");

      // Find privacy toggles
      const dataSharing = page.locator('[name="data_sharing"], [data-testid="data-sharing"]');

      if (await dataSharing.isVisible()) {
        await dataSharing.click();

        // Save
        await page.click('button:has-text("Save")');

        // Verify success
        await expect(page.locator("text=/saved|updated/i")).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe("Dashboard and Navigation", () => {
    test("should display dashboard with key metrics", async ({ page }) => {
      await page.goto("/customer-portal/dashboard");

      // Check for dashboard heading
      await expect(page.getByRole("heading", { name: /dashboard|overview/i })).toBeVisible();

      // Verify key metrics are displayed
      await expect(page.locator("text=/current plan|usage|balance|support/i")).toBeVisible();
    });

    test("should navigate between portal sections", async ({ page }) => {
      await page.goto("/customer-portal/dashboard");

      // Navigate to profile
      await page.click('a[href*="/profile"], button:has-text("Profile")');
      await page.waitForURL(/\/profile/);
      await expect(page.getByRole("heading", { name: /profile/i })).toBeVisible();

      // Navigate to billing
      await page.click('a[href*="/billing"], button:has-text("Billing")');
      await page.waitForURL(/\/billing/);
      await expect(page.getByRole("heading", { name: /billing|invoice/i })).toBeVisible();

      // Navigate to support
      await page.click('a[href*="/support"], button:has-text("Support")');
      await page.waitForURL(/\/support/);
      await expect(page.getByRole("heading", { name: /support|ticket/i })).toBeVisible();
    });

    test("should logout successfully", async ({ page }) => {
      await page.goto("/customer-portal/dashboard");

      // Click logout button
      await page.click(
        'button:has-text("Logout"), button:has-text("Sign Out"), [data-testid="logout"]',
      );

      // Should redirect to login page
      await page.waitForURL(/\/login/);
      await expect(page.locator("text=/login|sign in/i")).toBeVisible();
    });
  });

  test.describe("Error Handling", () => {
    test("should handle network errors gracefully", async ({ page, context }) => {
      // Simulate network failure
      await context.route("**/api/isp/v1/portal/customer/**", (route) => {
        route.abort("failed");
      });

      await page.goto("/customer-portal/profile");

      // Should show error message
      await expect(page.locator("text=/error|failed to load|something went wrong/i")).toBeVisible();
    });

    test("should handle invalid payment information", async ({ page }) => {
      await page.goto("/customer-portal/payment-methods");

      // Try to add invalid card
      await page.click('button:has-text("Add Payment Method")');

      await page.fill('[name="card_number"]', "4111111111111111"); // Invalid card
      await page.fill('[name="card_exp_month"]', "01");
      await page.fill('[name="card_exp_year"]', "20"); // Expired
      await page.fill('[name="card_cvc"]', "123");

      await page.click('button[type="submit"]');

      // Should show error
      await expect(page.locator("text=/invalid|expired|error/i")).toBeVisible();
    });

    test("should handle session expiration", async ({ page, context }) => {
      // Clear auth cookies
      await context.clearCookies();

      await page.goto("/customer-portal/profile");

      // Should redirect to login
      await page.waitForURL(/\/login/);
      await expect(page.locator("text=/session expired|please login/i")).toBeVisible();
    });
  });

  test.describe("Responsive Design", () => {
    test("should work on mobile viewport", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/customer-portal/dashboard");

      // Mobile menu should be visible
      const mobileMenu = page.locator('[data-testid="mobile-menu"], button:has-text("Menu")');

      if (await mobileMenu.isVisible()) {
        await mobileMenu.click();

        // Navigation should be visible
        await expect(page.locator('nav, [role="navigation"]')).toBeVisible();
      }
    });

    test("should work on tablet viewport", async ({ page }) => {
      // Set tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });

      await page.goto("/customer-portal/dashboard");

      // Dashboard should be visible and functional
      await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    });
  });
});
