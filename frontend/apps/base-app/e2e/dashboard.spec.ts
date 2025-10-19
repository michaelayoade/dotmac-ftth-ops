import { test, expect, Page } from '@playwright/test';

// Helper to login before tests
async function loginAsUser(page: Page, username = 'admin', password = 'admin123') {
  await page.goto('/login');
  await page.fill('[data-testid="email-input"]', username);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="submit-button"]');
  await page.waitForURL(/.*dashboard/);
}

test.describe('Dashboard Critical Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await loginAsUser(page);
  });

  test('should display dashboard overview', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.locator('h1')).toContainText('Network Operations Center');
    await expect(page.locator('text=User Profile')).toBeVisible();
    await expect(page.locator('text=API Status')).toBeVisible();
    await expect(page.locator('text=Quick Actions')).toBeVisible();
  });

  test('should navigate to different sections', async ({ page }) => {
    // Navigate to Customers
    await page.click('text=Manage Customers');
    await expect(page).toHaveURL(/.*dashboard\/customers/);

    // Navigate to Billing
    await page.goto('/dashboard');
    await page.click('text=Billing Overview');
    await expect(page).toHaveURL(/.*dashboard\/billing/);

    // Navigate to API Keys
    await page.goto('/dashboard');
    await page.click('text=Manage API Keys');
    await expect(page).toHaveURL(/.*dashboard\/api-keys/);
  });

  test('should load and display user data', async ({ page }) => {
    // Wait for user profile card
    await page.waitForSelector('text=User Profile');

    // Check user info is displayed
    await expect(page.locator('text=Email:')).toBeVisible();
    await expect(page.locator('text=User ID:')).toBeVisible();
    await expect(page.locator('text=admin@example.com')).toBeVisible();
  });

  test('should display platform services', async ({ page }) => {
    // Check Platform Services section
    await expect(page.locator('text=Platform Services')).toBeVisible();

    // Check service cards are displayed
    await expect(page.locator('text=Authentication')).toBeVisible();
    await expect(page.locator('text=File Storage')).toBeVisible();
    await expect(page.locator('text=Secrets Manager')).toBeVisible();
    await expect(page.locator('text=Analytics')).toBeVisible();
  });

  test('should handle logout', async ({ page }) => {
    // Click sign out button
    await page.click('text=Sign out');

    // Should redirect to login page
    await expect(page).toHaveURL(/.*login/);
  });

  test('should display API health status', async ({ page }) => {
    // Check API Status card
    await expect(page.locator('text=API Status')).toBeVisible();

    // Look for health indicators
    const healthIndicator = page.locator('.bg-emerald-400.rounded-full').first();
    await expect(healthIndicator).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API error for health endpoint
    await page.route('**/health', route => {
      route.fulfill({
        status: 500,
        json: { error: 'Internal server error' },
      });
    });

    await page.goto('/dashboard');

    // Should show fallback message
    await expect(page.locator('text=Unable to fetch status')).toBeVisible();
  });

  test('should display all platform services', async ({ page }) => {
    // Verify all 8 services are shown
    const services = [
      'Authentication',
      'File Storage',
      'Secrets Manager',
      'Analytics',
      'Communications',
      'Search',
      'Data Transfer',
      'API Gateway'
    ];

    for (const service of services) {
      await expect(page.locator(`text=${service}`)).toBeVisible();
    }
  });

  test('should display server status indicators', async ({ page }) => {
    // Check for API and Frontend status at bottom
    await expect(page.locator('text=API:')).toBeVisible();
    await expect(page.locator('text=localhost:8000')).toBeVisible();
    await expect(page.locator('text=Frontend:')).toBeVisible();
    await expect(page.locator('text=localhost:3001')).toBeVisible();
  });

});

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser(page);
    await page.goto('/dashboard/settings');
  });

  test('should display settings page', async ({ page }) => {
    // Check main heading
    await expect(page.locator('h1')).toContainText('Settings');

    // Check for settings sections
    await expect(page.locator('text=Account Settings')).toBeVisible();
  });

  test('should navigate through settings tabs', async ({ page }) => {
    // Check for different settings categories
    const categories = ['Profile', 'Notifications', 'Integrations', 'Organization', 'Billing', 'Plugins'];

    for (const category of categories) {
      const link = page.locator(`a:has-text("${category}")`).first();
      if (await link.count() > 0) {
        await link.click();
        await page.waitForTimeout(500); // Brief wait for navigation
      }
    }
  });
});
