/**
 * Communications Dashboard Integration Tests
 *
 * Tests for dashboard statistics, health monitoring, and overview functionality.
 */

import { test, expect } from '@playwright/test';
import { CommunicationsDashboard } from '../../helpers/page-objects';
import { generateTestUser, generateTestEmail, generateTestTemplate } from '../../fixtures/test-data';
import {
  createTestUser,
  loginUser,
  sendEmail,
  createTemplate,
  getCommunicationStats,
  getCommunicationHealth,
  cleanupTemplates,
} from '../../helpers/api-helpers';

test.describe('Communications Dashboard', () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Create and login user
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);
  });

  test.afterEach(async () => {
    await cleanupTemplates(authToken);
  });

  test.describe('Statistics Cards', () => {
    test('should display total sent count', async ({ page }) => {
      // Arrange
      const dashboard = new CommunicationsDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      const totalSent = await dashboard.getTotalSent();
      expect(totalSent).toBeTruthy();
    });

    test('should display delivered count', async ({ page }) => {
      // Arrange
      const dashboard = new CommunicationsDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      await expect(dashboard.deliveredCard).toBeVisible();
    });

    test('should display failed count', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="total-failed"]')).toBeVisible();
    });

    test('should display delivery rate percentage', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="delivery-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="delivery-rate"]')).toContainText('%');
    });

    test('should display open rate percentage', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="open-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="open-rate"]')).toContainText('%');
    });

    test('should display click rate percentage', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="click-rate"]')).toBeVisible();
      await expect(page.locator('[data-testid="click-rate"]')).toContainText('%');
    });

    test('should update statistics in real-time', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');
      const initialCount = await page.locator('[data-testid="total-sent"]').textContent();

      // Act - Send an email
      const email = generateTestEmail();
      await sendEmail(email, authToken);

      // Wait for auto-refresh or manual refresh
      await page.click('[data-testid="refresh-button"]');

      // Assert
      const updatedCount = await page.locator('[data-testid="total-sent"]').textContent();
      expect(updatedCount).not.toBe(initialCount);
    });
  });

  test.describe('Charts and Graphs', () => {
    test('should display delivery trends chart', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="delivery-trends-chart"]')).toBeVisible();
    });

    test('should display channel distribution chart', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="channel-distribution-chart"]')).toBeVisible();
    });

    test('should display engagement metrics chart', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="engagement-chart"]')).toBeVisible();
    });

    test('should allow changing chart time range', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('[data-testid="time-range-selector"]');
      await page.click('text=Last 7 days');

      // Assert
      await expect(page.locator('[data-time-range="7d"]')).toBeVisible();
    });
  });

  test.describe('System Health', () => {
    test('should display SMTP connection status', async ({ page }) => {
      // Arrange
      const dashboard = new CommunicationsDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      const smtpStatus = await dashboard.getSMTPStatus();
      expect(smtpStatus).toBeTruthy();
    });

    test('should show healthy status when SMTP is connected', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="smtp-status"][data-health="healthy"]')).toBeVisible();
    });

    test('should show warning when SMTP has issues', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Mock unhealthy SMTP
      await page.route('**/api/v1/communications/health', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            smtp: { status: 'degraded', message: 'High latency detected' },
          }),
        });
      });

      await page.reload();

      // Assert
      await expect(page.locator('[data-testid="smtp-status"][data-health="degraded"]')).toBeVisible();
    });

    test('should display queue status', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="queue-status"]')).toBeVisible();
      await expect(page.locator('[data-testid="queue-count"]')).toBeVisible();
    });

    test('should display worker status', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="worker-status"]')).toBeVisible();
      await expect(page.locator('text=workers active')).toBeVisible();
    });
  });

  test.describe('Recent Activity', () => {
    test('should display recent emails sent', async ({ page }) => {
      // Arrange
      const email = generateTestEmail({ subject: 'Recent Test Email' });
      await sendEmail(email, authToken);

      // Act
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
      await expect(page.locator('text=Recent Test Email')).toBeVisible();
    });

    test('should show email delivery status', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="activity-item"][data-status="delivered"]')).toBeVisible();
    });

    test('should show timestamp for recent activity', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('text=/\\d+\\s*(minute|hour|day)s?\\s*ago/i')).toBeVisible();
    });

    test('should limit recent activity to last 10 items', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      const activityItems = page.locator('[data-testid="activity-item"]');
      const count = await activityItems.count();
      expect(count).toBeLessThanOrEqual(10);
    });

    test('should allow viewing full activity log', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('text=View All Activity');

      // Assert
      await expect(page).toHaveURL(/\/communications\/history/);
    });
  });

  test.describe('Top Templates', () => {
    test('should display most used templates', async ({ page }) => {
      // Arrange
      const template1 = generateTestTemplate({ usage_count: 100 });
      const template2 = generateTestTemplate({ usage_count: 50 });
      await createTemplate(template1, authToken);
      await createTemplate(template2, authToken);

      // Act
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="top-templates"]')).toBeVisible();
      await expect(page.locator(`text=${template1.name}`)).toBeVisible();
    });

    test('should show usage count for each template', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({ usage_count: 156 });
      await createTemplate(template, authToken);

      // Act
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('text=156 uses')).toBeVisible();
    });

    test('should limit to top 5 templates', async ({ page }) => {
      // Arrange
      const templates = Array.from({ length: 10 }, (_, i) =>
        generateTestTemplate({ usage_count: 100 - i * 10 })
      );
      for (const template of templates) {
        await createTemplate(template, authToken);
      }

      // Act
      await page.goto('/dashboard/communications');

      // Assert
      const templateItems = page.locator('[data-testid="top-template-item"]');
      const count = await templateItems.count();
      expect(count).toBeLessThanOrEqual(5);
    });

    test('should navigate to template details', async ({ page }) => {
      // Arrange
      const template = generateTestTemplate({ usage_count: 50 });
      const created = await createTemplate(template, authToken);

      await page.goto('/dashboard/communications');

      // Act
      await page.click(`[data-template-id="${created.id}"]`);

      // Assert
      await expect(page).toHaveURL(new RegExp(`/communications/templates/${created.id}`));
    });
  });

  test.describe('Quick Actions', () => {
    test('should navigate to compose email', async ({ page }) => {
      // Arrange
      const dashboard = new CommunicationsDashboard(page);
      await dashboard.navigate();

      // Act
      await dashboard.sendEmailButton.click();

      // Assert
      await expect(page).toHaveURL(/\/communications\/send/);
    });

    test('should navigate to templates', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('a:has-text("Manage Templates")');

      // Assert
      await expect(page).toHaveURL(/\/communications\/templates/);
    });

    test('should navigate to activity log', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('a:has-text("View History")');

      // Assert
      await expect(page).toHaveURL(/\/communications\/history/);
    });
  });

  test.describe('Filters', () => {
    test('should filter by date range', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('[data-testid="date-filter"]');
      await page.click('text=Last 30 days');

      // Assert
      await expect(page.locator('[data-date-range="30d"]')).toBeVisible();
    });

    test('should filter by channel', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('[data-testid="channel-filter"]');
      await page.click('text=Email');

      // Assert
      await expect(page.locator('[data-channel="email"]')).toBeVisible();
    });

    test('should filter by status', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('[data-testid="status-filter"]');
      await page.click('text=Delivered');

      // Assert
      await expect(page.locator('[data-status="delivered"]')).toBeVisible();
    });
  });

  test.describe('Alerts and Warnings', () => {
    test('should show alert when delivery rate is low', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Mock low delivery rate
      await page.route('**/api/v1/communications/stats', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            delivery_rate: 0.65, // 65% (below 90% threshold)
          }),
        });
      });

      await page.reload();

      // Assert
      await expect(page.locator('[data-testid="low-delivery-alert"]')).toBeVisible();
    });

    test('should show alert when queue is backed up', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Mock large queue
      await page.route('**/api/v1/communications/health', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            queue: { pending: 5000 }, // Large queue
          }),
        });
      });

      await page.reload();

      // Assert
      await expect(page.locator('[data-testid="queue-alert"]')).toBeVisible();
      await expect(page.locator('text=high email queue')).toBeVisible();
    });

    test('should show alert when SMTP is down', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Mock SMTP down
      await page.route('**/api/v1/communications/health', route => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            smtp: { status: 'down', message: 'Connection refused' },
          }),
        });
      });

      await page.reload();

      // Assert
      await expect(page.locator('[data-testid="smtp-down-alert"]')).toBeVisible();
    });

    test('should dismiss alerts', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assuming there's an alert
      await expect(page.locator('[data-testid="alert"]').first()).toBeVisible();

      // Act
      await page.click('[data-testid="dismiss-alert"]');

      // Assert
      await expect(page.locator('[data-testid="alert"]')).not.toBeVisible();
    });
  });

  test.describe('Auto-Refresh', () => {
    test('should auto-refresh dashboard statistics', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      const initialUpdate = await page.locator('[data-testid="last-updated"]').textContent();

      // Act - Wait for auto-refresh (typically 30 seconds)
      await page.waitForTimeout(31000);

      // Assert
      const updatedTime = await page.locator('[data-testid="last-updated"]').textContent();
      expect(updatedTime).not.toBe(initialUpdate);
    });

    test('should show last updated timestamp', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="last-updated"]')).toBeVisible();
      await expect(page.locator('text=/Updated.*ago/i')).toBeVisible();
    });

    test('should allow manual refresh', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('[data-testid="refresh-button"]');

      // Assert
      await expect(page.locator('[data-testid="refreshing-indicator"]')).toBeVisible();
      await expect(page.locator('text=Dashboard refreshed')).toBeVisible();
    });

    test('should allow disabling auto-refresh', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      await page.click('[data-testid="auto-refresh-toggle"]');

      // Assert
      await expect(page.locator('[data-testid="auto-refresh-toggle"]')).not.toBeChecked();
    });
  });

  test.describe('Empty States', () => {
    test('should show empty state when no emails sent', async ({ page }) => {
      // Act
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('text=No emails sent yet')).toBeVisible();
      await expect(page.locator('text=Send your first email')).toBeVisible();
    });

    test('should show empty state for templates', async ({ page }) => {
      // Act
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('text=No templates created')).toBeVisible();
    });

    test('should show CTA in empty state', async ({ page }) => {
      // Act
      await page.goto('/dashboard/communications');

      // Assert
      const ctaButton = page.locator('[data-testid="send-first-email"]');
      await expect(ctaButton).toBeVisible();
      await ctaButton.click();
      await expect(page).toHaveURL(/\/communications\/send/);
    });
  });

  test.describe('Loading States', () => {
    test('should show loading skeleton on initial load', async ({ page }) => {
      // Act
      await page.goto('/dashboard/communications');

      // Assert
      await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();
      await page.waitForSelector('[data-testid="loading-skeleton"]', { state: 'hidden', timeout: 5000 });
    });

    test('should show loading indicator on refresh', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');
      await page.waitForLoadState('networkidle');

      // Act
      await page.click('[data-testid="refresh-button"]');

      // Assert
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    });
  });

  test.describe('Export Functionality', () => {
    test('should export statistics as CSV', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-csv"]');
      const download = await downloadPromise;

      // Assert
      expect(download.suggestedFilename()).toMatch(/\.csv$/);
    });

    test('should export statistics as PDF', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications');

      // Act
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="export-pdf"]');
      const download = await downloadPromise;

      // Assert
      expect(download.suggestedFilename()).toMatch(/\.pdf$/);
    });
  });
});
