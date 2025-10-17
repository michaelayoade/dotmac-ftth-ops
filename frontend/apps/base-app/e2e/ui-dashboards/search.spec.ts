/**
 * Global Search UI - Integration Tests
 *
 * Tests the global search interface integration with backend API.
 * Part of BSS Phase 1 UI implementation.
 */

import { test, expect } from '@playwright/test';

const SEARCH_PAGE = '/dashboard/search';

test.describe('Global Search UI', () => {
  test.beforeEach(async ({ page }) => {
    // Login and navigate to search page
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL('/dashboard');
    await page.goto(SEARCH_PAGE);
  });

  test('should display search page with empty state', async ({ page }) => {
    // Verify page loaded
    await expect(page.locator('h1')).toContainText('Global Search');

    // Verify empty state
    await expect(page.locator('text=Start Searching')).toBeVisible();
    await expect(page.locator('text=Enter a search term above')).toBeVisible();
  });

  test('should perform search and display results', async ({ page }) => {
    // Enter search query
    await page.fill('input[placeholder*="Search for anything"]', 'customer');
    await page.click('button:has-text("Search")');

    // Wait for results
    await page.waitForResponse((response) =>
      response.url().includes('/api/v1/search') && response.status() === 200
    );

    // Verify results displayed
    await expect(page.locator('[class*="Card"]').first()).toBeVisible();

    // Verify results count
    const resultsCount = await page.locator('text=/Found.*results/').textContent();
    expect(resultsCount).toBeTruthy();
  });

  test('should filter results by entity type', async ({ page }) => {
    // Search first
    await page.fill('input[placeholder*="Search for anything"]', 'test');
    await page.click('button:has-text("Search")');

    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Click customer filter
    await page.click('button:has-text("Customer")');

    // Verify URL updated with type filter
    await expect(page).toHaveURL(/type=customer/);

    // Verify filtered results
    await expect(page.locator('text=/Customer/')).toBeVisible();
  });

  test('should show loading state during search', async ({ page }) => {
    // Start search
    await page.fill('input[placeholder*="Search for anything"]', 'loading test');
    await page.click('button:has-text("Search")');

    // Verify loading spinner appears
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 1000 });
  });

  test('should handle empty search results', async ({ page }) => {
    // Search for something that doesn't exist
    await page.fill('input[placeholder*="Search for anything"]', 'xyznonexistent123');
    await page.click('button:has-text("Search")');

    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Verify empty state
    await expect(page.locator('text=No Results Found')).toBeVisible();
    await expect(page.locator('button:has-text("Clear Search")')).toBeVisible();
  });

  test('should clear search when clicking clear button', async ({ page }) => {
    // Perform search
    await page.fill('input[placeholder*="Search for anything"]', 'test query');
    await page.click('button:has-text("Search")');

    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Click X button to clear
    await page.click('button[aria-label*="clear" i]');

    // Verify input cleared and back to empty state
    await expect(page.locator('input[placeholder*="Search for anything"]')).toHaveValue('');
    await expect(page.locator('text=Start Searching')).toBeVisible();
  });

  test('should navigate to entity detail page when clicking result', async ({ page }) => {
    // Perform search
    await page.fill('input[placeholder*="Search for anything"]', 'customer');
    await page.click('button:has-text("Search")');

    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Click first result
    const firstResult = page.locator('[class*="Card"]').first();
    await expect(firstResult).toBeVisible();
    await firstResult.click();

    // Verify navigation to detail page
    await expect(page).toHaveURL(/\/dashboard\/.+\/.+/);
  });

  test('should display entity type badges on results', async ({ page }) => {
    // Perform search
    await page.fill('input[placeholder*="Search for anything"]', 'test');
    await page.click('button:has-text("Search")');

    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Verify badges visible
    await expect(page.locator('[class*="Badge"]').first()).toBeVisible();
  });

  test('should handle pagination correctly', async ({ page }) => {
    // Perform search that returns many results
    await page.fill('input[placeholder*="Search for anything"]', 'a');
    await page.click('button:has-text("Search")');

    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Check if pagination exists
    const nextButton = page.locator('button:has-text("Next")');
    const isVisible = await nextButton.isVisible();

    if (isVisible) {
      // Click next page
      await nextButton.click();

      // Verify page changed
      await expect(page).toHaveURL(/page=2/);
    }
  });

  test('should sync search parameters with URL', async ({ page }) => {
    // Perform search
    await page.fill('input[placeholder*="Search for anything"]', 'url test');
    await page.click('button:has-text("Search")');

    await page.waitForResponse((response) => response.url().includes('/api/v1/search'));

    // Verify URL has query parameter
    await expect(page).toHaveURL(/q=url\+test/);

    // Reload page
    await page.reload();

    // Verify search persisted from URL
    await expect(page.locator('input[placeholder*="Search for anything"]')).toHaveValue(
      'url test'
    );
  });
});

test.describe('Global Search - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin@example.com');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL('/dashboard');
    await page.goto(SEARCH_PAGE);
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Mock API to return error
    await page.route('**/api/v1/search*', (route) => {
      route.fulfill({
        status: 500,
        body: 'Internal Server Error',
      });
    });

    // Perform search
    await page.fill('input[placeholder*="Search for anything"]', 'error test');
    await page.click('button:has-text("Search")');

    // Verify error message displayed
    await expect(page.locator('text=/Error performing search/i')).toBeVisible();
  });

  test('should handle network timeout', async ({ page }) => {
    // Mock slow API response
    await page.route('**/api/v1/search*', async (route) => {
      await page.waitForTimeout(10000); // Simulate timeout
      route.abort();
    });

    // Perform search
    await page.fill('input[placeholder*="Search for anything"]', 'timeout test');
    await page.click('button:has-text("Search")');

    // Should show error or timeout message
    await expect(
      page.locator('text=/Error|Timeout|Failed/i').first()
    ).toBeVisible({ timeout: 15000 });
  });
});
