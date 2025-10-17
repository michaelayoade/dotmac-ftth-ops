/**
 * Authentication helper for E2E tests
 */
import { Page } from '@playwright/test';

export interface LoginCredentials {
  username: string;
  password: string;
}

/**
 * Logs in a user for E2E tests
 * Sets a flag on window object to bypass client-side auth checks
 * and allows navigation to protected pages
 */
export async function login(page: Page, credentials: LoginCredentials) {
  // Set E2E test flag on window object before navigating
  await page.addInitScript(() => {
    (window as any).__e2e_test__ = true;
  });

  // Navigate to dashboard - middleware bypass allows access
  await page.goto('/dashboard');

  // Wait for dashboard to load
  await page.waitForLoadState('domcontentloaded');
}
