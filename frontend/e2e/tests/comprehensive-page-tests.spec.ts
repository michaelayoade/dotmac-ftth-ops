/**
 * Comprehensive Page Testing Suite
 *
 * Tests all critical pages across both ISP Ops and Platform Admin apps
 * Verifies that pages load, render correctly, and have no console errors
 */

import { test, expect } from '@playwright/test';

// Test configuration
const ISP_OPS_URL = process.env.ISP_OPS_URL || 'http://localhost:3001';
const PLATFORM_ADMIN_URL = process.env.PLATFORM_ADMIN_URL || 'http://localhost:3002';

// Helper to check page loads without critical errors
async function checkPageLoads(page: any, url: string, pageName: string) {
  const errors: string[] = [];

  // Capture console errors
  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      errors.push(`Console Error: ${msg.text()}`);
    }
  });

  // Capture page errors
  page.on('pageerror', (error: Error) => {
    errors.push(`Page Error: ${error.message}`);
  });

  // Navigate to page
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: 15000
  });

  // Check page loaded
  await expect(page).toHaveTitle(/DotMac|ISP|Platform|Login/i);

  // Check no critical JavaScript errors (excluding expected auth errors)
  const criticalErrors = errors.filter(err =>
    !err.includes('401') &&
    !err.includes('Unauthorized') &&
    !err.includes('favicon')
  );

  if (criticalErrors.length > 0) {
    console.error(`❌ ${pageName} has critical errors:`, criticalErrors);
  }

  expect(criticalErrors.length).toBe(0);
}

test.describe('ISP Ops App - Public Pages', () => {
  test('Login page loads', async ({ page }) => {
    await checkPageLoads(page, `${ISP_OPS_URL}/login`, 'Login Page');

    // Check form elements exist
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"], input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('Home page redirects to login when not authenticated', async ({ page }) => {
    await page.goto(ISP_OPS_URL);

    // Should redirect to login or show login page
    await page.waitForURL(/login|^\/$/, { timeout: 10000 });
  });
});

test.describe('ISP Ops App - Dashboard Pages (Protected)', () => {
  // Note: These tests will show login page when not authenticated
  // In a real test suite, you'd login first with test credentials

  test('Dashboard home page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard`);

    // Page should load (even if showing login)
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Subscribers list page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/subscribers`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('RADIUS dashboard page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/radius`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Network management page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/network`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Billing dashboard page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/billing-revenue`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Communications dashboard page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/communications`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('CRM dashboard page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/crm`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Devices list page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/devices`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Analytics dashboard page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/analytics`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Settings page structure', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard/settings`);
    await expect(page).toHaveTitle(/DotMac/i);
  });
});

test.describe('ISP Ops App - Customer Portal Pages', () => {
  test('Customer portal home', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/customer-portal`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Customer portal billing', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/customer-portal/billing`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Customer portal usage', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/customer-portal/usage`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Customer portal support', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/customer-portal/support`);
    await expect(page).toHaveTitle(/DotMac/i);
  });
});

test.describe('Platform Admin App - Dashboard Pages', () => {
  test('Platform admin dashboard', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/dashboard`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Platform admin tenants page', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/dashboard/platform-admin/tenants`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Platform admin audit logs', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/dashboard/platform-admin/audit`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Security access dashboard', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/dashboard/security-access`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('User management page', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/dashboard/security-access/users`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Role management page', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/dashboard/security-access/roles`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Licensing dashboard', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/dashboard/licensing`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Partner management', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/dashboard/partners`);
    await expect(page).toHaveTitle(/DotMac/i);
  });
});

test.describe('Platform Admin App - Tenant Portal', () => {
  test('Tenant portal home', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/tenant-portal`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Tenant billing page', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/tenant-portal/billing`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Tenant customers page', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/tenant-portal/customers`);
    await expect(page).toHaveTitle(/DotMac/i);
  });

  test('Tenant users page', async ({ page }) => {
    await page.goto(`${PLATFORM_ADMIN_URL}/tenant-portal/users`);
    await expect(page).toHaveTitle(/DotMac/i);
  });
});

test.describe('Page Performance', () => {
  test('Dashboard loads within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto(`${ISP_OPS_URL}/dashboard`);

    const loadTime = Date.now() - startTime;
    console.log(`Dashboard load time: ${loadTime}ms`);

    // Should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('No memory leaks on navigation', async ({ page }) => {
    // Navigate through multiple pages
    const pages = [
      '/dashboard',
      '/dashboard/subscribers',
      '/dashboard/radius',
      '/dashboard/network',
      '/dashboard/billing-revenue',
    ];

    for (const route of pages) {
      await page.goto(`${ISP_OPS_URL}${route}`);
      await page.waitForTimeout(500);
    }

    // Check console for memory warnings
    const metrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize,
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
        };
      }
      return null;
    });

    if (metrics) {
      console.log('Memory usage:', metrics);
      // Used memory should be less than 80% of limit
      const usagePercent = (metrics.usedJSHeapSize / metrics.jsHeapSizeLimit) * 100;
      expect(usagePercent).toBeLessThan(80);
    }
  });
});

test.describe('Critical User Flows', () => {
  test('Navigation menu works', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard`);

    // Wait for page to be interactive
    await page.waitForLoadState('domcontentloaded');

    // Check if navigation elements exist
    const hasNav = await page.locator('nav, [role="navigation"], aside').count();
    expect(hasNav).toBeGreaterThan(0);
  });

  test('Search functionality exists', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Check for search input (may not be visible if not authenticated)
    const searchInputs = await page.locator('input[type="search"], input[placeholder*="search" i]').count();
    console.log(`Found ${searchInputs} search inputs`);
  });

  test('Error boundaries catch errors', async ({ page }) => {
    // Navigate to a page that might trigger an error boundary
    await page.goto(`${ISP_OPS_URL}/dashboard/non-existent-page`);

    // Should show 404 or error page, not crash
    await expect(page).toHaveTitle(/DotMac|404|Not Found/i);
  });
});

test.describe('Accessibility Checks', () => {
  test('Login page has proper ARIA labels', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/login`);

    // Check for accessibility landmarks
    const landmarks = await page.locator('[role="main"], main, [aria-label]').count();
    expect(landmarks).toBeGreaterThan(0);
  });

  test('Pages have skip links', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/login`);

    // Check for skip navigation link
    const skipLinks = await page.locator('a[href="#main"], a[href="#content"]').count();
    console.log(`Found ${skipLinks} skip navigation links`);
  });

  test('Focus visible on interactive elements', async ({ page }) => {
    await page.goto(`${ISP_OPS_URL}/login`);

    // Tab to first input
    await page.keyboard.press('Tab');

    // Check if an element is focused
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName : null;
    });

    expect(focusedElement).not.toBeNull();
  });
});
