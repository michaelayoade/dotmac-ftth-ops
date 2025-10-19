import { test, expect, Page } from '@playwright/test';

// Helper to generate mock TOTP code
function generateMockTOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

test.describe('2FA Setup Flow', () => {
  async function loginUser(page: Page) {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="submit-button"]');
    await page.waitForURL(/.*dashboard/);
  }

  test.beforeEach(async ({ page }) => {
    await loginUser(page);
  });

  test('should navigate to 2FA setup from settings', async ({ page }) => {
    // Navigate to security settings
    await page.goto('/dashboard/settings/security');

    // Find 2FA section
    await expect(page.locator('text=/Two-Factor Authentication|2FA/i')).toBeVisible();

    // Click setup/enable 2FA button
    const setupButton = page.locator('button:has-text("Enable 2FA")').first();
    if (await setupButton.count() > 0) {
      await setupButton.click();

      // Should show 2FA setup modal or page
      await expect(
        page.locator('text=/Set up|Configure|Enable.*2FA/i')
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('should display QR code for 2FA setup', async ({ page }) => {
    // Mock 2FA setup endpoint
    await page.route('**/api/v1/auth/2fa/enable', (route) => {
      route.fulfill({
        status: 200,
        json: {
          secret: 'JBSWY3DPEHPK3PXP',
          qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
          backup_codes: ['111111', '222222', '333333'],
        },
      });
    });

    await page.goto('/dashboard/settings/security');
    await page.click('button:has-text("Enable 2FA")');

    // Should show QR code
    await expect(page.locator('img[alt*="QR"]')).toBeVisible({ timeout: 5000 });

    // Should show manual entry code
    await expect(page.locator('text=/Secret.*Key|Manual Entry/i')).toBeVisible();

    // Should show backup codes
    await expect(page.locator('text=/Backup Codes|Recovery Codes/i')).toBeVisible();
  });

  test('should verify TOTP code during setup', async ({ page }) => {
    // Mock setup and verification
    await page.route('**/api/v1/auth/2fa/enable', (route) => {
      route.fulfill({
        status: 200,
        json: {
          secret: 'JBSWY3DPEHPK3PXP',
          qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
          backup_codes: ['111111', '222222', '333333'],
        },
      });
    });

    await page.route('**/api/v1/auth/2fa/verify', (route) => {
      route.fulfill({
        status: 200,
        json: { success: true, message: '2FA enabled successfully' },
      });
    });

    await page.goto('/dashboard/settings/security');
    await page.click('button:has-text("Enable 2FA")');

    // Wait for QR code
    await page.waitForSelector('img[alt*="QR"]');

    // Enter verification code
    const codeInput = page.locator('input[name="code"]').first();
    await codeInput.fill('123456');

    // Click verify button
    await page.click('button:has-text("Verify")');

    // Should show success message
    await expect(
      page.locator('text=/enabled|activated|success/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should save backup codes during setup', async ({ page }) => {
    const backupCodes = ['111111', '222222', '333333', '444444', '555555'];

    await page.route('**/api/v1/auth/2fa/enable', (route) => {
      route.fulfill({
        status: 200,
        json: {
          secret: 'JBSWY3DPEHPK3PXP',
          qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA',
          backup_codes: backupCodes,
        },
      });
    });

    await page.goto('/dashboard/settings/security');
    await page.click('button:has-text("Enable 2FA")');

    // Wait for backup codes to display
    await page.waitForSelector('text=/Backup Codes/i');

    // Verify backup codes are shown
    for (const code of backupCodes) {
      await expect(page.locator(`text=${code}`)).toBeVisible();
    }

    // Check download/copy functionality
    const downloadButton = page.locator('button:has-text("Download")').first();
    const copyButton = page.locator('button:has-text("Copy")').first();

    expect(
      (await downloadButton.count()) + (await copyButton.count())
    ).toBeGreaterThan(0);
  });
});

test.describe('2FA Login Flow', () => {
  test('should show 2FA prompt after password entry', async ({ page }) => {
    // Mock login to return 2FA challenge
    await page.route('**/api/v1/auth/login', (route) => {
      const body = route.request().postDataJSON();
      if (body.username && body.password) {
        route.fulfill({
          status: 403,
          headers: {
            'X-2FA-Required': 'true',
            'X-User-ID': 'user-123',
          },
          json: {
            detail: '2FA verification required',
            requires_2fa: true,
          },
        });
      }
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'user-with-2fa');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="submit-button"]');

    // Should show 2FA input form
    await expect(
      page.locator('text=/Enter.*code|Verification Code|2FA Code/i')
    ).toBeVisible({ timeout: 5000 });

    // Should have input for 6-digit code
    const codeInput = page.locator('input[name*="code"]').first();
    await expect(codeInput).toBeVisible();
  });

  test('should verify TOTP code and complete login', async ({ page }) => {
    // Mock password login
    await page.route('**/api/v1/auth/login', (route) => {
      route.fulfill({
        status: 403,
        headers: {
          'X-2FA-Required': 'true',
          'X-User-ID': 'user-123',
        },
        json: {
          detail: '2FA verification required',
          requires_2fa: true,
        },
      });
    });

    // Mock 2FA verification
    await page.route('**/api/v1/auth/login/verify-2fa', (route) => {
      route.fulfill({
        status: 200,
        json: {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          token_type: 'bearer',
        },
      });
    });

    // Mock dashboard data
    await page.route('**/api/v1/**', (route) => {
      if (!route.request().url().includes('/auth/')) {
        route.fulfill({ status: 200, json: {} });
      }
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'user-with-2fa');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="submit-button"]');

    // Wait for 2FA prompt
    await page.waitForSelector('text=/Enter.*code|Verification Code/i');

    // Enter TOTP code
    const totpCode = '123456';
    await page.fill('input[name*="code"]', totpCode);
    await page.click('button:has-text("Verify")');

    // Should redirect to dashboard
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/.*dashboard/);
  });

  test('should show error for invalid TOTP code', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) => {
      route.fulfill({
        status: 403,
        headers: { 'X-2FA-Required': 'true' },
        json: { detail: '2FA verification required' },
      });
    });

    await page.route('**/api/v1/auth/login/verify-2fa', (route) => {
      route.fulfill({
        status: 401,
        json: { detail: 'Invalid verification code' },
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'user-with-2fa');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="submit-button"]');

    await page.waitForSelector('input[name*="code"]');
    await page.fill('input[name*="code"]', '000000');
    await page.click('button:has-text("Verify")');

    // Should show error
    await expect(
      page.locator('text=/invalid|incorrect|wrong/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should allow using backup code', async ({ page }) => {
    await page.route('**/api/v1/auth/login', (route) => {
      route.fulfill({
        status: 403,
        headers: { 'X-2FA-Required': 'true' },
        json: { detail: '2FA verification required' },
      });
    });

    await page.route('**/api/v1/auth/login/verify-2fa', (route) => {
      const body = route.request().postDataJSON();
      if (body.is_backup_code) {
        route.fulfill({
          status: 200,
          json: {
            access_token: 'mock-token',
            refresh_token: 'mock-refresh',
            token_type: 'bearer',
          },
        });
      }
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'user-with-2fa');
    await page.fill('[data-testid="password-input"]', 'password123');
    await page.click('[data-testid="submit-button"]');

    // Click "Use backup code" link
    await page.click('text=/backup code|recovery code/i');

    // Should show backup code input
    await expect(page.locator('text=/Enter backup code/i')).toBeVisible();

    // Enter backup code
    await page.fill('input[name*="backup"]', '111111');
    await page.click('button:has-text("Verify")');

    // Should login successfully
    await page.waitForTimeout(1000);
    await expect(page).toHaveURL(/.*dashboard/);
  });
});

test.describe('2FA Management', () => {
  async function loginUser(page: Page) {
    await page.route('**/api/v1/auth/login', (route) => {
      route.fulfill({
        status: 200,
        json: {
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          token_type: 'bearer',
        },
      });
    });

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'admin');
    await page.fill('[data-testid="password-input"]', 'admin123');
    await page.click('[data-testid="submit-button"]');
    await page.waitForTimeout(1000);
  }

  test('should disable 2FA with password confirmation', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/auth/2fa/disable', (route) => {
      route.fulfill({
        status: 200,
        json: { message: '2FA disabled successfully' },
      });
    });

    await page.goto('/dashboard/settings/security');

    // Click disable 2FA button
    await page.click('button:has-text("Disable 2FA")');

    // Should prompt for password confirmation
    await expect(page.locator('text=/confirm.*password/i')).toBeVisible();

    // Enter password
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Confirm")');

    // Should show success message
    await expect(page.locator('text=/disabled|deactivated/i')).toBeVisible();
  });

  test('should regenerate backup codes', async ({ page }) => {
    await loginUser(page);

    const newBackupCodes = ['999999', '888888', '777777'];

    await page.route('**/api/v1/auth/2fa/backup-codes/regenerate', (route) => {
      route.fulfill({
        status: 200,
        json: { backup_codes: newBackupCodes },
      });
    });

    await page.goto('/dashboard/settings/security');

    // Click regenerate backup codes
    await page.click('button:has-text("Regenerate Backup Codes")');

    // Should show confirmation dialog
    await expect(page.locator('text=/old codes.*invalid/i')).toBeVisible();

    // Confirm regeneration
    await page.click('button:has-text("Regenerate")');

    // Should show new codes
    for (const code of newBackupCodes) {
      await expect(page.locator(`text=${code}`)).toBeVisible();
    }
  });

  test('should view remaining backup codes count', async ({ page }) => {
    await loginUser(page);

    await page.route('**/api/v1/auth/2fa/backup-codes', (route) => {
      route.fulfill({
        status: 200,
        json: {
          total: 5,
          remaining: 3,
          used: 2,
        },
      });
    });

    await page.goto('/dashboard/settings/security');

    // Should show backup codes status
    await expect(page.locator('text=/3.*remaining|3 of 5/i')).toBeVisible();
  });
});
