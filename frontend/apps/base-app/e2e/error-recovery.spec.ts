import { test, expect, Page } from '@playwright/test';

// Helper to login
async function loginUser(page: Page, username = 'admin', password = 'admin123') {
  await page.route('**/api/v1/auth/login', (route) => {
    route.fulfill({
      status: 200,
      json: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'bearer',
        expires_in: 3600,
      },
    });
  });

  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', username);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="submit-button"]');
  await page.waitForTimeout(1000);
}

test.describe('Session Expiry Handling', () => {
  test('should detect expired token and redirect to login', async ({ page }) => {
    await loginUser(page);

    // Navigate to dashboard
    await page.goto('/dashboard');

    // Mock API call with 401 (expired token)
    await page.route('**/api/v1/**', (route) => {
      if (route.request().url().includes('/auth/login')) {
        route.continue();
      } else {
        route.fulfill({
          status: 401,
          json: { detail: 'Token expired' },
        });
      }
    });

    // Try to access a protected resource
    await page.goto('/dashboard/customers');

    // Should redirect to login with message
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/.*login/);

    // Should show session expired message
    await expect(
      page.locator('text=/session.*expired|logged out|sign in again/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should auto-refresh token before expiry', async ({ page }) => {
    let tokenRefreshed = false;

    // Mock initial login
    await page.route('**/api/v1/auth/login', (route) => {
      route.fulfill({
        status: 200,
        json: {
          access_token: 'initial-token',
          refresh_token: 'refresh-token',
          token_type: 'bearer',
          expires_in: 5, // Very short expiry for testing
        },
      });
    });

    // Mock token refresh
    await page.route('**/api/v1/auth/refresh', (route) => {
      tokenRefreshed = true;
      route.fulfill({
        status: 200,
        json: {
          access_token: 'refreshed-token',
          refresh_token: 'new-refresh-token',
          token_type: 'bearer',
          expires_in: 3600,
        },
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="submit-button"]');

    // Wait for potential token refresh
    await page.waitForTimeout(6000);

    // Token should have been refreshed
    expect(tokenRefreshed).toBe(true);
  });

  test('should handle refresh token failure gracefully', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) => {
      route.fulfill({
        status: 200,
        json: {
          access_token: 'initial-token',
          refresh_token: 'invalid-refresh',
          token_type: 'bearer',
          expires_in: 1,
        },
      });
    });

    // Mock failed refresh
    await page.route('**/api/v1/auth/refresh', (route) => {
      route.fulfill({
        status: 401,
        json: { detail: 'Refresh token expired' },
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="submit-button"]');

    await page.goto('/dashboard');

    // Wait for refresh attempt and failure
    await page.waitForTimeout(3000);

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
  });

  test('should preserve redirect path after login', async ({ page }) => {
    // Try to access protected page while logged out
    await page.goto('/dashboard/settings/security');

    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);

    // Login
    await loginUser(page);

    // Should redirect back to originally requested page
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/.*settings.*security/);
  });
});

test.describe('Network Error Recovery', () => {
  test('should show offline indicator when network is unavailable', async ({ page }) => {
    await loginUser(page);
    await page.goto('/dashboard');

    // Simulate offline
    await page.context().setOffline(true);

    // Try to perform action
    await page.click('text=Manage Customers').catch(() => {});

    await page.waitForTimeout(1000);

    // Should show offline message
    await expect(
      page.locator('text=/offline|no connection|check.*connection/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should retry failed requests when back online', async ({ page }) => {
    await loginUser(page);

    let requestCount = 0;

    await page.route('**/api/v1/customers', (route) => {
      requestCount++;
      if (requestCount === 1) {
        // First request fails
        route.abort('failed');
      } else {
        // Retry succeeds
        route.fulfill({
          status: 200,
          json: { customers: [], total: 0 },
        });
      }
    });

    await page.goto('/dashboard/customers');

    // Wait for retry
    await page.waitForTimeout(3000);

    // Request should have been retried
    expect(requestCount).toBeGreaterThan(1);

    // Page should load successfully
    await expect(page.locator('text=Customers')).toBeVisible();
  });

  test('should handle slow network gracefully', async ({ page }) => {
    await loginUser(page);

    // Simulate slow API response
    await page.route('**/api/v1/dashboard/stats', async (route) => {
      await page.waitForTimeout(5000); // 5 second delay
      route.fulfill({
        status: 200,
        json: { stats: {} },
      });
    });

    await page.goto('/dashboard');

    // Should show loading state
    await expect(
      page.locator('text=/loading|please wait/i')
    ).toBeVisible({ timeout: 2000 });

    // Eventually should load
    await page.waitForTimeout(6000);
  });

  test('should show timeout error for very slow requests', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/customers', async (route) => {
      // Never respond
      await page.waitForTimeout(100000);
    });

    await page.goto('/dashboard/customers');

    // Should show timeout error
    await expect(
      page.locator('text=/timeout|taking too long|try again/i')
    ).toBeVisible({ timeout: 35000 }); // Wait up to 35s for timeout
  });
});

test.describe('Server Error Handling', () => {
  test('should display 500 error gracefully', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/customers', (route) => {
      route.fulfill({
        status: 500,
        json: { detail: 'Internal server error' },
      });
    });

    await page.goto('/dashboard/customers');

    // Should show error message
    await expect(
      page.locator('text=/error occurred|something went wrong|try again later/i')
    ).toBeVisible({ timeout: 5000 });

    // Should have retry button
    const retryButton = page.locator('button:has-text("Retry")').first();
    await expect(retryButton).toBeVisible();
  });

  test('should handle 403 forbidden errors', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/admin/**', (route) => {
      route.fulfill({
        status: 403,
        json: { detail: 'Insufficient permissions' },
      });
    });

    await page.goto('/dashboard/admin/settings');

    // Should show permission error
    await expect(
      page.locator('text=/permission|access denied|not authorized/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should handle 404 not found errors', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/customers/non-existent-id', (route) => {
      route.fulfill({
        status: 404,
        json: { detail: 'Customer not found' },
      });
    });

    await page.goto('/dashboard/customers/non-existent-id');

    // Should show not found message
    await expect(
      page.locator('text=/not found|doesn.*exist/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should handle 429 rate limit errors', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/**', (route) => {
      route.fulfill({
        status: 429,
        headers: { 'Retry-After': '60' },
        json: { detail: 'Too many requests' },
      });
    });

    await page.goto('/dashboard/customers');

    // Should show rate limit message
    await expect(
      page.locator('text=/too many requests|rate limit|slow down/i')
    ).toBeVisible({ timeout: 5000 });

    // Should show retry time
    await expect(page.locator('text=/minute|60.*second/i')).toBeVisible();
  });
});

test.describe('Form Validation & Error Recovery', () => {
  test('should handle validation errors and allow correction', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/customers', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 422,
          json: {
            detail: [
              {
                loc: ['body', 'email'],
                msg: 'Invalid email format',
                type: 'value_error.email',
              },
            ],
          },
        });
      }
    });

    await page.goto('/dashboard/customers/new');

    // Fill invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="name"]', 'John Doe');
    await page.click('button[type="submit"]');

    // Should show validation error
    await expect(page.locator('text=/invalid email/i')).toBeVisible();

    // Mock successful submission
    await page.route('**/api/v1/customers', (route) => {
      route.fulfill({
        status: 201,
        json: { id: '123', name: 'John Doe', email: 'valid@example.com' },
      });
    });

    // Correct the error
    await page.fill('input[name="email"]', 'valid@example.com');
    await page.click('button[type="submit"]');

    // Should succeed
    await expect(page.locator('text=/success|created/i')).toBeVisible();
  });

  test('should prevent duplicate submissions', async ({ page }) => {
    await loginUser(page);

    let submissionCount = 0;

    await page.route('**/api/v1/customers', async (route) => {
      submissionCount++;
      await page.waitForTimeout(2000); // Slow response
      route.fulfill({
        status: 201,
        json: { id: '123', name: 'John Doe' },
      });
    });

    await page.goto('/dashboard/customers/new');

    // Fill form
    await page.fill('input[name="name"]', 'John Doe');
    await page.fill('input[name="email"]', 'john@example.com');

    // Click submit button multiple times rapidly
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await submitButton.click();
    await submitButton.click();

    await page.waitForTimeout(3000);

    // Should only submit once
    expect(submissionCount).toBe(1);

    // Button should be disabled during submission
    const isDisabled = await submitButton.isDisabled();
    expect(isDisabled).toBeTruthy();
  });

  test('should preserve form data after error', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/customers', (route) => {
      route.fulfill({
        status: 500,
        json: { detail: 'Internal server error' },
      });
    });

    await page.goto('/dashboard/customers/new');

    // Fill form
    const testData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
    };

    await page.fill('input[name="name"]', testData.name);
    await page.fill('input[name="email"]', testData.email);
    await page.fill('input[name="phone"]', testData.phone);

    // Submit (will fail)
    await page.click('button[type="submit"]');

    await page.waitForTimeout(1000);

    // Data should still be in form
    await expect(page.locator('input[name="name"]')).toHaveValue(testData.name);
    await expect(page.locator('input[name="email"]')).toHaveValue(testData.email);
    await expect(page.locator('input[name="phone"]')).toHaveValue(testData.phone);
  });
});

test.describe('Concurrent Request Handling', () => {
  test('should handle multiple simultaneous API calls', async ({ page }) => {
    await loginUser(page);

    // Mock multiple endpoints
    await page.route('**/api/v1/customers', (route) =>
      route.fulfill({ status: 200, json: { customers: [], total: 0 } })
    );
    await page.route('**/api/v1/dashboard/stats', (route) =>
      route.fulfill({ status: 200, json: { stats: {} } })
    );
    await page.route('**/api/v1/notifications', (route) =>
      route.fulfill({ status: 200, json: { notifications: [] } })
    );

    // Navigate to page that makes multiple API calls
    await page.goto('/dashboard');

    // All should load successfully
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should cancel in-flight requests on navigation', async ({ page }) => {
    await loginUser(page);

    let slowRequestCompleted = false;

    await page.route('**/api/v1/slow-endpoint', async (route) => {
      await page.waitForTimeout(10000);
      slowRequestCompleted = true;
      route.fulfill({ status: 200, json: {} });
    });

    // Start slow request
    await page.goto('/dashboard/slow-page');

    // Navigate away quickly
    await page.waitForTimeout(500);
    await page.goto('/dashboard');

    await page.waitForTimeout(2000);

    // Slow request should have been cancelled
    expect(slowRequestCompleted).toBe(false);
  });
});
