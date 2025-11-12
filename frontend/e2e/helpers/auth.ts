/**
 * Authentication Helpers for E2E Tests
 */

import { Page, expect } from '@playwright/test';

export interface TestCredentials {
  email: string;
  password: string;
}

export const TEST_USERS = {
  admin: {
    email: process.env.TEST_USER_EMAIL || 'test@example.com',
    password: process.env.TEST_USER_PASSWORD || 'TestPass123!',
  },
  operator: {
    email: process.env.TEST_OPERATOR_EMAIL || 'operator@test.com',
    password: process.env.TEST_OPERATOR_PASSWORD || 'OperatorPass123!',
  },
  customer: {
    email: process.env.TEST_CUSTOMER_EMAIL || 'customer@test.com',
    password: process.env.TEST_CUSTOMER_PASSWORD || 'CustomerPass123!',
  },
};

/**
 * Login to the application
 */
export async function login(page: Page, credentials: TestCredentials, baseUrl: string) {
  try {
    await page.goto(`${baseUrl}/login`);

    // Wait for login form
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    // Fill credentials
    await page.fill('input[type="email"], input[name="email"]', credentials.email);
    await page.fill('input[type="password"], input[name="password"]', credentials.password);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for navigation
    await page.waitForURL(/dashboard|home/, { timeout: 15000 });

    return true;
  } catch (error) {
    console.warn(`Login failed: ${error.message}`);
    return false;
  }
}

/**
 * Check if already logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const url = page.url();
  return !url.includes('/login') && (url.includes('/dashboard') || url.includes('/portal'));
}

/**
 * Logout from the application
 */
export async function logout(page: Page) {
  try {
    // Look for logout button/link
    const logoutButton = page.locator('button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")').first();

    if (await logoutButton.count() > 0) {
      await logoutButton.click();
      await page.waitForURL(/login/, { timeout: 5000 });
    }
  } catch (error) {
    console.warn(`Logout failed: ${error.message}`);
  }
}

/**
 * Ensure user is logged in before testing
 */
export async function ensureAuthenticated(page: Page, baseUrl: string, credentials: TestCredentials = TEST_USERS.admin) {
  if (await isLoggedIn(page)) {
    return true;
  }

  return await login(page, credentials, baseUrl);
}

/**
 * Get auth token from cookies/localStorage
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  try {
    // Try to get token from localStorage
    const token = await page.evaluate(() => {
      return localStorage.getItem('access_token') ||
             localStorage.getItem('token') ||
             localStorage.getItem('auth_token');
    });

    return token;
  } catch (error) {
    return null;
  }
}

/**
 * Set auth token directly (useful for API testing)
 */
export async function setAuthToken(page: Page, token: string) {
  await page.evaluate((tokenValue) => {
    localStorage.setItem('access_token', tokenValue);
    localStorage.setItem('token', tokenValue);
  }, token);
}
