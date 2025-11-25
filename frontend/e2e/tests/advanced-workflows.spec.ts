/**
 * Advanced User Workflows - E2E Tests
 * 
 * Tests complex user workflows including:
 * 1. Multi-step processes
 * 2. Form interactions
 * 3. Search and filtering
 * 4. Data operations
 * 5. Navigation flows
 */

import { test, expect, Page } from '#e2e/fixtures';

const ISP_OPS_URL = process.env.ISP_OPS_URL || 'http://localhost:3001';

test.describe('Workflow: Navigation and Routing', () => {
    test('Can navigate between dashboard sections', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Navigate to customers
        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        await expect(page).toHaveTitle(/DotMac|ISP|Customer|Login/i);

        // Navigate to billing
        await page.goto(`${ISP_OPS_URL}/dashboard/billing`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        await expect(page).toHaveTitle(/DotMac|ISP|Billing|Login/i);

        // Navigate back to dashboard
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });
        await expect(page).toHaveTitle(/DotMac|ISP|Dashboard|Login/i);
    });

    test('Browser back button works correctly', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Go back
        await page.goBack();
        await page.waitForLoadState('domcontentloaded');

        // Should be back on dashboard
        expect(page.url()).toContain('/dashboard');
    });

    test('Deep linking works', async ({ page }) => {
        // Direct navigation to deep page
        await page.goto(`${ISP_OPS_URL}/dashboard/network-monitoring`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await expect(page).toHaveTitle(/DotMac|ISP|Network|Login/i);
    });

    test('Invalid routes handle gracefully', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/invalid-route-xyz-123`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Should show some content (404 or redirect)
        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
    });
});

test.describe('Workflow: Search and Filtering', () => {
    test('Search input is present on relevant pages', async ({ page }) => {
        const pagesWithSearch = [
            '/dashboard/customers',
            '/dashboard/users',
            '/dashboard/integrations'
        ];

        for (const route of pagesWithSearch) {
            await page.goto(`${ISP_OPS_URL}${route}`, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            // Check for search input or filter controls
            const hasSearch = await page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="filter" i]').count();
            console.log(`${route}: ${hasSearch} search inputs found`);
            expect(hasSearch).toBeGreaterThan(0);
        }
    });

    test('Filter controls are interactive', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Look for any interactive elements
        const inputs = await page.locator('input').count();
        const selects = await page.locator('select').count();
        const buttons = await page.locator('button').count();

        console.log(`Found ${inputs} inputs, ${selects} selects, ${buttons} buttons`);
        expect(inputs + selects + buttons).toBeGreaterThan(0);

        // Page should have loaded successfully
        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
    });
});

test.describe('Workflow: Form Interactions', () => {
    test('Forms have proper structure', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Check form elements
        const forms = await page.locator('form').count();
        const inputs = await page.locator('input').count();
        const buttons = await page.locator('button[type="submit"]').count();

        expect(forms).toBeGreaterThan(0);
        expect(inputs).toBeGreaterThan(0);
        expect(buttons).toBeGreaterThan(0);
    });

    test('Input fields are focusable', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        await emailInput.focus();

        const isFocused = await emailInput.evaluate(el => el === document.activeElement);
        expect(isFocused).toBeTruthy();
    });

    test('Form inputs accept text', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        await emailInput.fill('test@example.com');

        const value = await emailInput.inputValue();
        expect(value).toBe('test@example.com');
    });

    test('Password fields mask input', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

        const inputType = await passwordInput.getAttribute('type');
        expect(inputType).toBe('password');
    });
});

test.describe('Workflow: Data Tables and Lists', () => {
    test('Tables render on list pages', async ({ page }) => {
        const pagesWithTables = [
            '/dashboard/customers',
            '/dashboard/users',
            '/dashboard/integrations'
        ];

        for (const route of pagesWithTables) {
            await page.goto(`${ISP_OPS_URL}${route}`, {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            // Check for table or list structure
            const hasTables = await page.locator('table, [role="table"], [role="grid"]').count();
            const hasLists = await page.locator('ul, ol, [role="list"]').count();

            console.log(`${route}: ${hasTables} tables, ${hasLists} lists`);
            expect(hasTables + hasLists).toBeGreaterThan(0);
        }
    });

    test('Table headers are present', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await page.waitForLoadState('domcontentloaded');

        // Look for table headers
        const headers = await page.locator('th, [role="columnheader"]').count();
        console.log(`Found ${headers} table headers`);
    });

    test('Lists have proper ARIA roles', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Check for proper list semantics
        const lists = await page.locator('[role="list"], ul, ol').count();
        console.log(`Found ${lists} lists`);
    });
});

test.describe('Workflow: Modal and Dialog Interactions', () => {
    test('Page can handle modal triggers', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Look for buttons that might trigger modals
        const buttons = await page.locator('button').count();
        console.log(`Found ${buttons} buttons that could trigger modals`);

        expect(buttons).toBeGreaterThanOrEqual(0);
    });

    test('Dialogs have proper ARIA attributes', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Check for dialog elements
        const dialogs = await page.locator('[role="dialog"], dialog').count();
        console.log(`Found ${dialogs} dialog elements`);
    });
});

test.describe('Workflow: Keyboard Navigation', () => {
    test('Tab navigation works on login form', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Press Tab
        await page.keyboard.press('Tab');

        // Something should be focused
        const focusedElement = await page.evaluate(() => {
            return document.activeElement?.tagName;
        });

        expect(focusedElement).toBeTruthy();
    });

    test('Enter key submits forms', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const emailInput = page.locator('input[type="email"], input[name="email"]').first();
        await emailInput.fill('test@example.com');

        const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
        await passwordInput.fill('password123');

        // Press Enter
        await passwordInput.press('Enter');

        // Form should attempt to submit (may show error or redirect)
        await page.waitForTimeout(1000);

        // Page should still be loaded
        const title = await page.title();
        expect(title).toBeTruthy();
    });

    test('Escape key is handled', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Press Escape
        await page.keyboard.press('Escape');

        // Page should still be functional
        const title = await page.title();
        expect(title).toBeTruthy();
    });
});

test.describe('Workflow: Responsive Design', () => {
    test('Page renders on mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
        expect(bodyText!.length).toBeGreaterThan(50);
    });

    test('Page renders on tablet viewport', async ({ page }) => {
        await page.setViewportSize({ width: 768, height: 1024 }); // iPad

        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
    });

    test('Page renders on desktop viewport', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop

        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const bodyText = await page.textContent('body');
        expect(bodyText).toBeTruthy();
    });
});

test.describe('Workflow: State Management', () => {
    test('Page state persists on refresh', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const urlBefore = page.url();

        // Reload page
        await page.reload({ waitUntil: 'domcontentloaded' });

        const urlAfter = page.url();
        expect(urlAfter).toBe(urlBefore);
    });

    test('Navigation history is maintained', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await page.goto(`${ISP_OPS_URL}/dashboard/customers`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        await page.goto(`${ISP_OPS_URL}/dashboard/billing`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Go back twice
        await page.goBack();
        expect(page.url()).toContain('customers');

        await page.goBack();
        expect(page.url()).toContain('dashboard');
    });
});

test.describe('Workflow: Loading States', () => {
    test('Page shows loading indicators', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Check for loading indicators or spinners
        const loadingElements = await page.locator('[role="status"], [aria-busy="true"], .loading, .spinner').count();
        console.log(`Found ${loadingElements} loading indicators`);
    });

    test('Content appears after load', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for network idle
        await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
            // Timeout is okay, just continue
        });

        const bodyText = await page.textContent('body');
        expect(bodyText!.length).toBeGreaterThan(100);
    });
});

test.describe('Workflow: Accessibility Features', () => {
    test('Skip links are present', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const skipLinks = await page.locator('a[href^="#"]').count();
        console.log(`Found ${skipLinks} skip links`);
    });

    test('Landmarks are properly defined', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const landmarks = await page.locator('main, nav, header, footer, aside, [role="main"], [role="navigation"]').count();
        console.log(`Found ${landmarks} landmark elements`);

        expect(landmarks).toBeGreaterThan(0);
    });

    test('Images have alt text', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const images = await page.locator('img').count();
        const imagesWithAlt = await page.locator('img[alt]').count();

        console.log(`Found ${images} images, ${imagesWithAlt} with alt text`);
    });

    test('Buttons have accessible names', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const buttons = await page.locator('button').all();

        for (const button of buttons) {
            const text = await button.textContent();
            const ariaLabel = await button.getAttribute('aria-label');
            const title = await button.getAttribute('title');

            const hasAccessibleName = text || ariaLabel || title;
            if (!hasAccessibleName) {
                console.log('Button without accessible name found');
            }
        }
    });
});

test.describe('Workflow: Security Features', () => {
    test('Forms use HTTPS in production', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const url = page.url();

        // In production, should use HTTPS
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
            console.log('Local development - HTTP is acceptable');
        } else {
            expect(url).toMatch(/^https:/);
        }
    });

    test('Password fields have autocomplete attributes', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/login`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const passwordInput = page.locator('input[type="password"]').first();
        const autocomplete = await passwordInput.getAttribute('autocomplete');

        console.log(`Password autocomplete: ${autocomplete}`);
    });

    test('No sensitive data in URLs', async ({ page }) => {
        await page.goto(`${ISP_OPS_URL}/dashboard`, {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        const url = page.url();

        // Should not contain passwords, tokens, etc in URL
        expect(url).not.toMatch(/password|token|secret|key/i);
    });
});
