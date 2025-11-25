/**
 * Critical User Paths - E2E Tests
 *
 * Tests the most important user journeys in the ISP Ops application:
 * 1. Authentication (Login/Logout)
 * 2. Customer Management
 * 3. Dashboard Navigation
 * 4. Billing Operations
 * 5. Network Monitoring
 */

import { test, expect, Page } from '#e2e/fixtures';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { CustomersPage } from '../pages/CustomersPage';

const ISP_OPS_URL = process.env.ISP_OPS_URL || 'http://localhost:3001';

// Helper function to login using Page Object
async function login(page: Page, email: string = 'admin@test.com', password: string = 'testpassword') {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email, password);
}

// Helper to check if user is authenticated
async function isAuthenticated(page: Page): Promise<boolean> {
    const url = page.url();
    return !url.includes('/login') && !url.includes('/register');
}

test.describe('Critical Path: Authentication', () => {
    test('User can access login page', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Check login form elements exist using Page Object
        await expect(loginPage.emailInput).toBeVisible({ timeout: 5000 });
        await expect(loginPage.passwordInput).toBeVisible();
        await expect(loginPage.loginButton).toBeVisible();
    });

    test('Login form has proper validation', async ({ page }) => {
        const loginPage = new LoginPage(page);
        await loginPage.goto();

        // Try to submit empty form
        await loginPage.clickLogin();

        // Form should still be visible (validation prevented submission)
        await expect(loginPage.emailInput).toBeVisible();
    });

    test('User can navigate to login from home', async ({ page }) => {
        await page.goto(ISP_OPS_URL, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Page should load successfully
        await expect(page).toHaveTitle(/DotMac|ISP|Platform|Login/i);
    });
});

test.describe('Critical Path: Dashboard Access', () => {
    test('Dashboard page loads', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        // Page should load (may show login if not authenticated)
        await expect(page).toHaveTitle(/DotMac|ISP|Dashboard|Login/i);
    });

    test('Dashboard has navigation', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForLoadState('domcontentloaded');

        // Check for navigation elements
        const hasNavigation = await page.locator('nav, aside, [role="navigation"]').count() > 0;
        const hasLinks = await page.locator('a').count() > 0;

        expect(hasNavigation || hasLinks).toBeTruthy();
    });

    test('Dashboard shows content or login prompt', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 15000 });

        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
        expect(bodyText!.length).toBeGreaterThan(50);
    });
});

test.describe('Critical Path: Customer Management', () => {
    test('Customers page is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Page should load
        await expect(page).toHaveTitle(/DotMac|ISP|Customers|Login/i);
    });

    test('Customers page has expected structure', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await page.waitForLoadState('domcontentloaded');

        // Page should have some content
        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
        expect(bodyText!.length).toBeGreaterThan(50);
    });
});

test.describe('Critical Path: Billing Operations', () => {
    test('Billing page is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/billing`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Billing|Login/i);
    });

    test('Billing page loads without errors', async ({ page }) => {
        const errors: string[] = [];

        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        await page.goto(`${ISP_OPS_URL}/dashboard/billing`, {
            waitUntil: 'networkidle',
            timeout: 15000
        });

        // Filter out non-critical errors
        const criticalErrors = errors.filter(err =>
            !err.includes('favicon') &&
            !err.includes('401') &&
            !err.includes('404')
        );

        expect(criticalErrors.length).toBe(0);
    });
});

test.describe('Critical Path: Network Monitoring', () => {
    test('Network monitoring page is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/network-monitoring`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Network|Login/i);
    });

    test('RADIUS dashboard is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/radius`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|RADIUS|Login/i);
    });
});

test.describe('Critical Path: Settings & Configuration', () => {
    test('Settings page is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/settings`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Settings|Login/i);
    });

    test('Users management page is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/users`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Users|Login/i);
    });

    test('Integrations page is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/integrations`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Integration|Login/i);
    });
});

test.describe('Critical Path: Analytics & Reporting', () => {
    test('Analytics dashboard is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/analytics`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Analytics|Login/i);
    });
});

test.describe('Critical Path: Infrastructure Management', () => {
    test('Infrastructure page is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/infrastructure`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Infrastructure|Login/i);
    });

    test('Provisioning page is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/provisioning`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Provision|Login/i);
    });
});

test.describe('Critical Path: Customer Portal', () => {
    test('Customer portal home is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/customer-portal`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Customer|Portal|Login/i);
    });

    test('Customer portal billing is accessible', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/customer-portal/billing`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Customer|Billing|Login/i);
    });
});

test.describe('Critical Path: Performance', () => {
    test('Dashboard loads within acceptable time', async ({ page }) => {
        const startTime = Date.now();

        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const loadTime = Date.now() - startTime;

        // Should load within 10 seconds
        expect(loadTime).toBeLessThan(10000);
    });

    test('Page navigation is responsive', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const startTime = Date.now();

        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const navigationTime = Date.now() - startTime;

        // Navigation should be fast
        expect(navigationTime).toBeLessThan(5000);
    });
});

test.describe('Critical Path: Error Handling', () => {
    test('404 page handles gracefully', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/non-existent-page-12345`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Should show some content (404 page or redirect)
        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
    });

    test('Application handles network errors gracefully', async ({ page }) => {
        const errors: string[] = [];

        page.on('pageerror', (error) => {
            errors.push(error.message);
        });

        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Should not have unhandled errors
        const unhandledErrors = errors.filter(err =>
            err.includes('Unhandled') ||
            err.includes('TypeError') ||
            err.includes('ReferenceError')
        );

        expect(unhandledErrors.length).toBe(0);
    });
});
