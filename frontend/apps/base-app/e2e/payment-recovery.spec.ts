import { test, expect, Page } from "@playwright/test";

// Helper to setup authenticated billing page
async function setupBillingPage(page: Page) {
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

  await page.goto("/dashboard/billing");
}

test.describe("Payment Failure Scenarios", () => {
  test("should handle insufficient funds error and allow retry", async ({ page }) => {
    await setupBillingPage(page);

    let attemptCount = 0;

    await page.route("**/api/v1/billing/subscriptions/upgrade", (route) => {
      attemptCount++;
      if (attemptCount === 1) {
        // First attempt fails
        route.fulfill({
          status: 402,
          json: {
            detail: "Payment failed: Insufficient funds",
            error_code: "insufficient_funds",
            retry_allowed: true,
          },
        });
      } else {
        // Retry succeeds
        route.fulfill({
          status: 200,
          json: {
            subscription_id: "sub-123",
            status: "active",
            message: "Subscription upgraded successfully",
          },
        });
      }
    });

    // Attempt upgrade
    await page.click('[data-testid="upgrade-plan-btn"]');
    await page.click('[data-testid="plan-professional"]');
    await page.click('[data-testid="confirm-upgrade"]');

    // Should show payment error
    await expect(page.locator("text=/insufficient funds|payment.*failed/i")).toBeVisible({
      timeout: 5000,
    });

    // Should show retry button
    await expect(page.locator('button:has-text("Retry Payment")')).toBeVisible();

    // Click retry
    await page.click('button:has-text("Retry")');

    // Should succeed on retry
    await expect(page.locator("text=/success|upgraded/i")).toBeVisible();
  });

  test("should handle card declined and prompt for different card", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/subscriptions/upgrade", (route) => {
      route.fulfill({
        status: 402,
        json: {
          detail: "Payment failed: Card declined",
          error_code: "card_declined",
          retry_allowed: true,
        },
      });
    });

    await page.click('[data-testid="upgrade-plan-btn"]');
    await page.click('[data-testid="plan-professional"]');
    await page.click('[data-testid="confirm-upgrade"]');

    // Should show card declined error
    await expect(page.locator("text=/card.*declined|payment.*declined/i")).toBeVisible();

    // Should offer to use different payment method
    await expect(page.locator('button:has-text("Use Different Card")')).toBeVisible();

    // Click to change card
    await page.click('button:has-text("Use Different Card")');

    // Should show payment method selection
    await expect(page.locator("text=/payment method|add.*card/i")).toBeVisible();
  });

  test("should handle expired card error", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/payment-methods", (route) => {
      route.fulfill({
        status: 200,
        json: {
          payment_methods: [
            {
              id: "pm-123",
              type: "card",
              last4: "4242",
              expired: true,
              exp_month: 12,
              exp_year: 2023,
            },
          ],
        },
      });
    });

    await page.goto("/dashboard/billing/payment-methods");

    // Should show expired card warning
    await expect(page.locator("text=/expired|update.*card/i")).toBeVisible();

    // Should have update button
    await expect(page.locator('button:has-text("Update Card")')).toBeVisible();
  });

  test("should handle 3D Secure authentication flow", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/subscriptions/upgrade", (route) => {
      route.fulfill({
        status: 200,
        json: {
          requires_action: true,
          client_secret: "pi_123_secret_456",
          redirect_url: "https://bank.example.com/3ds",
          status: "requires_confirmation",
        },
      });
    });

    await page.click('[data-testid="upgrade-plan-btn"]');
    await page.click('[data-testid="plan-professional"]');
    await page.click('[data-testid="confirm-upgrade"]');

    // Should show 3DS authentication prompt
    await expect(
      page.locator("text=/additional.*verification|confirm.*payment|3D Secure/i"),
    ).toBeVisible({ timeout: 5000 });

    // In a real test, you would simulate the 3DS flow
    // For now, just verify the prompt appears
  });
});

test.describe("Subscription Downgrade Scenarios", () => {
  test("should handle downgrade with data loss warning", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/subscriptions/*/downgrade", (route) => {
      route.fulfill({
        status: 200,
        json: {
          subscription_id: "sub-123",
          effective_date: "2025-11-01",
          warnings: [
            "You will lose access to advanced features",
            "Data export recommended before downgrade",
          ],
        },
      });
    });

    // Click downgrade
    await page.click('button:has-text("Change Plan")');
    await page.click('[data-testid="plan-basic"]');
    await page.click('[data-testid="confirm-downgrade"]');

    // Should show warnings
    await expect(page.locator("text=/lose access|data export/i")).toBeVisible();

    // Should require explicit confirmation
    await expect(
      page.locator('input[type="checkbox"]').filter({ hasText: /understand/i }),
    ).toBeVisible();
  });

  test("should offer data export before downgrade", async ({ page }) => {
    await setupBillingPage(page);

    await page.click('button:has-text("Change Plan")');
    await page.click('[data-testid="plan-basic"]');

    // Should offer data export
    await expect(page.locator("text=/export.*data/i")).toBeVisible();

    // Click export button
    const exportButton = page.locator('button:has-text("Export Data")').first();
    if ((await exportButton.count()) > 0) {
      await exportButton.click();

      // Should start export process
      await expect(page.locator("text=/exporting|preparing.*export/i")).toBeVisible({
        timeout: 5000,
      });
    }
  });
});

test.describe("Subscription Cancellation Flow", () => {
  test("should show cancellation confirmation dialog", async ({ page }) => {
    await setupBillingPage(page);

    // Click cancel subscription
    await page.click('button:has-text("Cancel Subscription")');

    // Should show confirmation dialog
    await expect(page.locator("text=/are you sure|confirm.*cancel/i")).toBeVisible();

    // Should show what will be lost
    await expect(page.locator("text=/access.*until|end.*billing period/i")).toBeVisible();
  });

  test("should offer retention discount before cancellation", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/subscriptions/*/cancel", (route) => {
      route.fulfill({
        status: 200,
        json: {
          retention_offer: {
            discount_percent: 25,
            duration_months: 3,
            message: "Stay with us! Get 25% off for 3 months",
          },
        },
      });
    });

    await page.click('button:has-text("Cancel Subscription")');
    await page.click('button:has-text("Confirm Cancellation")');

    // Should show retention offer
    await expect(page.locator("text=/25%.*off|special offer/i")).toBeVisible();

    // Should have accept offer button
    await expect(page.locator('button:has-text("Accept Offer")')).toBeVisible();

    // Should have decline button
    await expect(page.locator('button:has-text("No Thanks")')).toBeVisible();
  });

  test("should collect cancellation feedback", async ({ page }) => {
    await setupBillingPage(page);

    await page.click('button:has-text("Cancel Subscription")');

    // Should show feedback form
    await expect(page.locator("text=/why.*cancel|reason.*leaving/i")).toBeVisible();

    // Should have common reasons
    const reasons = ["Too expensive", "Not using enough", "Missing features", "Found alternative"];

    for (const reason of reasons.slice(0, 2)) {
      const option = page.locator(`text="${reason}"`).first();
      if ((await option.count()) > 0) {
        await expect(option).toBeVisible();
      }
    }

    // Should have optional comment field
    const commentField = page.locator("textarea").first();
    if ((await commentField.count()) > 0) {
      await expect(commentField).toBeVisible();
    }
  });

  test("should process immediate cancellation", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/subscriptions/*/cancel", (route) => {
      route.fulfill({
        status: 200,
        json: {
          subscription_id: "sub-123",
          status: "canceled",
          cancellation_date: "2025-10-12",
          access_until: "2025-11-01",
        },
      });
    });

    await page.click('button:has-text("Cancel Subscription")');
    await page.click('button:has-text("Confirm")');

    // Should show success message
    await expect(page.locator("text=/canceled|cancellation.*confirmed/i")).toBeVisible();

    // Should show access remaining
    await expect(page.locator("text=/access.*until|November/i")).toBeVisible();
  });
});

test.describe("Payment Method Management", () => {
  test("should add new payment method", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/payment-methods", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({
          status: 201,
          json: {
            id: "pm-new",
            type: "card",
            last4: "4242",
            brand: "visa",
          },
        });
      }
    });

    await page.goto("/dashboard/billing/payment-methods");
    await page.click('button:has-text("Add Payment Method")');

    // Fill card details
    await page.fill('input[name="card-number"]', "4242424242424242");
    await page.fill('input[name="card-expiry"]', "12/25");
    await page.fill('input[name="card-cvc"]', "123");
    await page.click('button:has-text("Add Card")');

    // Should show success
    await expect(page.locator("text=/added|saved/i")).toBeVisible();
  });

  test("should set default payment method", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/payment-methods/*/set-default", (route) => {
      route.fulfill({
        status: 200,
        json: { message: "Default payment method updated" },
      });
    });

    await page.goto("/dashboard/billing/payment-methods");

    // Click set as default on a card
    await page.locator('button:has-text("Set as Default")').first().click();

    // Should show confirmation
    await expect(page.locator("text=/default.*updated|primary.*method/i")).toBeVisible();
  });

  test("should remove payment method with confirmation", async ({ page }) => {
    await setupBillingPage(page);

    await page.goto("/dashboard/billing/payment-methods");

    // Click remove
    await page.locator('button:has-text("Remove")').first().click();

    // Should show confirmation
    await expect(page.locator("text=/remove.*method|delete.*card/i")).toBeVisible();

    // Mock removal
    await page.route("**/api/v1/billing/payment-methods/*", (route) => {
      if (route.request().method() === "DELETE") {
        route.fulfill({ status: 204 });
      }
    });

    await page.click('button:has-text("Confirm")');

    // Should show success
    await expect(page.locator("text=/removed|deleted/i")).toBeVisible();
  });
});

test.describe("Invoice Payment Recovery", () => {
  test("should retry failed invoice payment", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/invoices", (route) => {
      route.fulfill({
        status: 200,
        json: {
          invoices: [
            {
              id: "inv-123",
              amount: 99.99,
              status: "payment_failed",
              currency: "USD",
              due_date: "2025-10-10",
            },
          ],
        },
      });
    });

    await page.goto("/dashboard/billing/invoices");

    // Should show failed invoice
    await expect(page.locator("text=/payment.*failed/i")).toBeVisible();

    // Should have pay now button
    await expect(page.locator('button:has-text("Pay Now")')).toBeVisible();

    // Mock successful payment
    await page.route("**/api/v1/billing/invoices/*/pay", (route) => {
      route.fulfill({
        status: 200,
        json: {
          invoice_id: "inv-123",
          status: "paid",
          payment_date: "2025-10-12",
        },
      });
    });

    await page.click('button:has-text("Pay Now")');

    // Should show success
    await expect(page.locator("text=/paid|payment.*successful/i")).toBeVisible();
  });

  test("should show overdue invoice warnings", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/invoices/overdue", (route) => {
      route.fulfill({
        status: 200,
        json: {
          overdue_count: 2,
          total_overdue: 199.98,
          oldest_due_date: "2025-09-15",
        },
      });
    });

    await page.goto("/dashboard");

    // Should show warning banner
    await expect(page.locator("text=/overdue.*invoice|payment.*overdue/i")).toBeVisible({
      timeout: 5000,
    });

    // Should have link to pay
    await expect(page.locator('a:has-text("Pay Now")')).toBeVisible();
  });

  test("should handle account suspension due to non-payment", async ({ page }) => {
    await page.route("**/api/v1/auth/login", (route) => {
      route.fulfill({
        status: 200,
        json: {
          access_token: "mock-token",
          refresh_token: "mock-refresh",
          token_type: "bearer",
          account_status: "suspended",
          suspension_reason: "payment_overdue",
        },
      });
    });

    await page.goto("/login");
    await page.fill('[data-testid="email-input"]', "suspended-user");
    await page.fill('[data-testid="password-input"]', "password123");
    await page.click('[data-testid="submit-button"]');

    // Should show suspension notice
    await expect(page.locator("text=/account.*suspended|payment.*required/i")).toBeVisible({
      timeout: 5000,
    });

    // Should have pay now option
    await expect(page.locator('button:has-text("Pay Now")')).toBeVisible();
  });
});

test.describe("Proration and Refund Scenarios", () => {
  test("should show proration calculation on upgrade", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/subscriptions/preview-change", (route) => {
      route.fulfill({
        status: 200,
        json: {
          proration_amount: 15.5,
          next_invoice_amount: 49.99,
          immediate_charge: 15.5,
          breakdown: {
            unused_time_credit: -4.5,
            new_plan_charge: 20.0,
          },
        },
      });
    });

    await page.click('[data-testid="upgrade-plan-btn"]');
    await page.click('[data-testid="plan-professional"]');

    // Should show proration details
    await expect(page.locator("text=/proration|prorated/i")).toBeVisible();
    await expect(page.locator("text=/\\$15.50/i")).toBeVisible();

    // Should show breakdown
    await expect(page.locator("text=/unused.*credit|breakdown/i")).toBeVisible();
  });

  test("should handle refund request for cancellation", async ({ page }) => {
    await setupBillingPage(page);

    await page.route("**/api/v1/billing/subscriptions/*/cancel", (route) => {
      route.fulfill({
        status: 200,
        json: {
          refund_eligible: true,
          refund_amount: 25.0,
          refund_days: 7,
        },
      });
    });

    await page.click('button:has-text("Cancel Subscription")');

    // Should show refund information
    await expect(page.locator("text=/refund.*\\$25|eligible.*refund/i")).toBeVisible();

    // Should explain refund process
    await expect(page.locator("text=/7.*days|business days/i")).toBeVisible();
  });
});
