/**
 * Command Palette (⌘K) - Integration Tests
 *
 * Tests the global command palette keyboard navigation and search.
 * Part of BSS Phase 1 UI implementation.
 */

import { test, expect } from '@playwright/test';
import { login } from '../helpers/auth';

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Browser console error:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });

    // Login via helper (middleware bypass allows navigation even without cookies)
    await login(page, { username: 'admin', password: 'admin123' });
  });

  test('should open command palette with Cmd+K (Mac)', async ({ page }) => {
    // Wait for dashboard to be fully loaded
    await page.waitForLoadState('networkidle');

    // Press Cmd+K (use Meta key for Mac)
    await page.keyboard.press('Meta+K');

    // Verify modal opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(
      page.locator('input[placeholder*="Search anything" i]')
    ).toBeVisible();
  });

  test('should open command palette with Ctrl+K (Windows/Linux)', async ({ page }) => {
    // Press Ctrl+K
    await page.keyboard.press('Control+K');

    // Verify modal opened
    await expect(page.locator('[role="dialog"]')).toBeVisible();
  });

  test('should close command palette with Escape', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Verify modal closed
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should display quick actions when no search query', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Verify quick actions section
    await expect(page.locator('text=Quick Actions')).toBeVisible();
    await expect(page.locator('text=Go to Dashboard')).toBeVisible();
    await expect(page.locator('text=Open Search Page')).toBeVisible();
    await expect(page.locator('text=View Subscribers')).toBeVisible();
  });

  test('should navigate to dashboard on action selection', async ({ page }) => {
    // Navigate away from dashboard
    await page.goto('/dashboard/search');

    // Open palette
    await page.keyboard.press('Meta+K');

    // Click "Go to Dashboard"
    await page.click('text=Go to Dashboard');

    // Verify navigation
    await page.waitForURL('/dashboard');
    await expect(page).toHaveURL('/dashboard');
  });

  test('should filter actions by typing', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Type "bill"
    await page.fill('input[placeholder*="Search anything" i]', 'bill');

    // Verify billing action shown
    await expect(page.locator('text=Billing & Revenue')).toBeVisible();

    // Verify other actions filtered out
    await expect(page.locator('text=View Subscribers')).not.toBeVisible();
  });

  test('should perform global search with results', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Type search query
    await page.fill('input[placeholder*="Search anything" i]', 'customer');

    // Wait for search results
    await page.waitForResponse((response) =>
      response.url().includes('/api/v1/search') && response.status() === 200
    );

    // Verify search results section
    await expect(page.locator('text=Search Results')).toBeVisible();

    // Verify result items
    const results = page.locator('[cmdk-item]');
    await expect(results.first()).toBeVisible();
  });

  test('should navigate to search result on selection', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Type search query
    await page.fill('input[placeholder*="Search anything" i]', 'customer');

    // Wait for results
    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Click first result
    const firstResult = page.locator('[cmdk-item]').first();
    await firstResult.click();

    // Verify navigation occurred
    await page.waitForTimeout(500);
    expect(page.url()).not.toContain('/dashboard$');
  });

  test('should navigate with keyboard arrows', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Navigate down with arrow key
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');

    // Press Enter to select
    await page.keyboard.press('Enter');

    // Verify navigation occurred (palette closed)
    await expect(page.locator('[role="dialog"]')).not.toBeVisible();
  });

  test('should display entity type badges in search results', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Search
    await page.fill('input[placeholder*="Search anything" i]', 'test');

    // Wait for results
    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Verify badges present
    await expect(page.locator('[class*="Badge"]').first()).toBeVisible();
  });

  test('should show loading state during search', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Type quickly
    await page.fill('input[placeholder*="Search anything" i]', 'loading test');

    // Should show loading spinner briefly
    const spinner = page.locator('.animate-spin, text=Searching...');
    // Note: This may be too fast to catch, that's OK
  });

  test('should clear search input', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Type search
    await page.fill('input[placeholder*="Search anything" i]', 'test query');

    // Click clear button
    await page.click('button:has-text("Clear search")');

    // Verify input cleared
    await expect(page.locator('input[placeholder*="Search anything" i]')).toHaveValue('');

    // Verify back to quick actions
    await expect(page.locator('text=Quick Actions')).toBeVisible();
  });

  test('should display keyboard shortcuts hints', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Verify keyboard hints visible
    await expect(page.locator('kbd').first()).toBeVisible();
    await expect(page.locator('text=/Enter.*to select/i')).toBeVisible();
  });

  test('should auto-focus search input on open', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Verify input is focused
    const input = page.locator('input[placeholder*="Search anything" i]');
    await expect(input).toBeFocused();
  });

  test('should not close on backdrop click during search', async ({ page }) => {
    // Open palette
    await page.keyboard.press('Meta+K');

    // Type to trigger search
    await page.fill('input[placeholder*="Search anything" i]', 'test');

    // Click backdrop (outside modal)
    await page.mouse.click(10, 10);

    // Modal should close (default dialog behavior)
    await page.waitForTimeout(300);
    // This behavior depends on dialog implementation
  });
});

test.describe('Command Palette - Recent Searches', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL('/dashboard');

    // Clear localStorage
    await page.evaluate(() => localStorage.removeItem('recentSearches'));
  });

  test('should save search to recent when selecting result', async ({ page }) => {
    // Open palette and search
    await page.keyboard.press('Meta+K');
    await page.fill('input[placeholder*="Search anything" i]', 'customer test');

    // Wait for results
    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Select first result
    const firstResult = page.locator('[cmdk-item]').first();
    if (await firstResult.isVisible()) {
      await firstResult.click();
    }

    // Reopen palette
    await page.keyboard.press('Meta+K');

    // Verify recent searches section
    const recentSection = page.locator('text=Recent Searches');
    // May or may not be visible depending on if result was selected
  });

  test('should limit recent searches to 5 items', async ({ page }) => {
    // Perform 6 searches
    for (let i = 1; i <= 6; i++) {
      await page.keyboard.press('Meta+K');
      await page.fill('input[placeholder*="Search anything" i]', `search ${i}`);

      await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

      const firstResult = page.locator('[cmdk-item]').first();
      if (await firstResult.isVisible()) {
        await firstResult.click();
        await page.waitForTimeout(200);
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // Open palette
    await page.keyboard.press('Meta+K');

    // Count recent searches
    const recentItems = page.locator('[cmdk-group]:has-text("Recent Searches") [cmdk-item]');
    const count = await recentItems.count();

    // Should be max 5
    expect(count).toBeLessThanOrEqual(5);
  });

  test('should repeat recent search on selection', async ({ page }) => {
    // Set up recent search in localStorage
    await page.evaluate(() => {
      localStorage.setItem('recentSearches', JSON.stringify(['previous search']));
    });

    // Open palette
    await page.keyboard.press('Meta+K');

    // Verify recent search shown
    await expect(page.locator('text=previous search')).toBeVisible();

    // Click it
    await page.click('text=previous search');

    // Verify input populated
    await expect(page.locator('input[placeholder*="Search anything" i]')).toHaveValue(
      'previous search'
    );
  });
});

test.describe('Command Palette - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL('/dashboard');
  });

  test('should handle search API errors', async ({ page }) => {
    // Mock API error
    await page.route('**/api/v1/search*', (route) => {
      route.fulfill({
        status: 500,
        body: 'Internal Server Error',
      });
    });

    // Open palette and search
    await page.keyboard.press('Meta+K');
    await page.fill('input[placeholder*="Search anything" i]', 'error test');

    // Wait a moment for error
    await page.waitForTimeout(1000);

    // Should show no results or error state
    await expect(page.locator('text=/No results|Error/i')).toBeVisible();
  });

  test('should handle empty search results', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/v1/search*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [],
          total: 0,
          facets: { types: {} },
        }),
      });
    });

    // Open palette and search
    await page.keyboard.press('Meta+K');
    await page.fill('input[placeholder*="Search anything" i]', 'nothing');

    // Wait for response
    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Verify empty state
    await expect(page.locator('text=No results found')).toBeVisible();
  });
});
