/**
 * Real-Time SSE Connection Integration Tests
 *
 * Tests for Server-Sent Events (SSE) connection management and event streaming.
 */

import { test, expect } from '@playwright/test';
import { generateTestUser, generateAlertEvent, generateSessionEvent } from '../../fixtures/test-data';
import { createTestUser, loginUser, publishEvent } from '../../helpers/api-helpers';

test.describe('Real-Time SSE Connections', () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Create and login user
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);
  });

  test.describe('Connection Establishment', () => {
    test('should establish SSE connection on dashboard load', async ({ page }) => {
      // Act
      await page.goto('/dashboard');

      // Assert - Connection indicator should show connected
      await expect(page.locator('[data-testid="connection-indicator"][data-status="connected"]')).toBeVisible();
    });

    test('should connect to alert stream', async ({ page }) => {
      // Act
      await page.goto('/dashboard');

      // Assert - Check network tab for SSE connection
      const sseRequest = page.waitForRequest(request =>
        request.url().includes('/api/v1/realtime/alerts/stream') &&
        request.headers()['accept'] === 'text/event-stream'
      );

      await sseRequest;
    });

    test('should connect to session stream', async ({ page }) => {
      // Act
      await page.goto('/dashboard/network/sessions/live');

      // Assert
      const sseRequest = page.waitForRequest(request =>
        request.url().includes('/api/v1/realtime/sessions/stream')
      );

      await sseRequest;
    });

    test('should include auth token in SSE connection', async ({ page }) => {
      // Act
      await page.goto('/dashboard');

      // Assert
      const sseRequest = page.waitForRequest(request =>
        request.url().includes('/api/v1/realtime/') &&
        request.headers()['authorization']?.startsWith('Bearer ')
      );

      await sseRequest;
    });

    test('should establish multiple concurrent SSE streams', async ({ page }) => {
      // Act
      await page.goto('/dashboard');

      // Wait for multiple streams to connect
      await page.waitForTimeout(2000);

      // Assert
      await page.click('[data-testid="connection-indicator"]');
      const alertStream = page.locator('[data-stream="alerts"][data-status="connected"]');
      const sessionStream = page.locator('[data-stream="sessions"][data-status="connected"]');

      await expect(alertStream).toBeVisible();
      await expect(sessionStream).toBeVisible();
    });

    test('should show connecting status during connection', async ({ page }) => {
      // Slow down network to see connecting state
      await page.route('**/api/v1/realtime/**', async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        route.continue();
      });

      // Act
      await page.goto('/dashboard');

      // Assert
      await expect(page.locator('[data-testid="connection-indicator"][data-status="connecting"]')).toBeVisible();
    });
  });

  test.describe('Event Reception', () => {
    test('should receive alert events', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Publish test event (simulated server-side)
      const alertEvent = generateAlertEvent({
        event_type: 'alert.raised',
        severity: 'critical',
        message: 'Test critical alert',
      });

      // Use test endpoint to publish event
      await publishEvent('alerts', alertEvent, authToken);

      // Assert - Alert should appear
      await expect(page.locator('text=Test critical alert')).toBeVisible({ timeout: 10000 });
    });

    test('should receive session events', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/network/sessions/live');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act
      const sessionEvent = generateSessionEvent({
        event_type: 'session.started',
        username: 'testuser@isp',
      });

      await publishEvent('sessions', sessionEvent, authToken);

      // Assert
      await expect(page.locator('text=testuser@isp')).toBeVisible({ timeout: 10000 });
    });

    test('should update UI in real-time on event', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      const initialAlertCount = await page.locator('[data-testid="alert-count"]').textContent();

      // Act
      const alertEvent = generateAlertEvent();
      await publishEvent('alerts', alertEvent, authToken);

      // Wait for update
      await page.waitForTimeout(2000);

      // Assert
      const updatedAlertCount = await page.locator('[data-testid="alert-count"]').textContent();
      expect(updatedAlertCount).not.toBe(initialAlertCount);
    });

    test('should handle multiple events in sequence', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Publish multiple events
      for (let i = 0; i < 5; i++) {
        const alertEvent = generateAlertEvent({
          message: `Alert ${i + 1}`,
        });
        await publishEvent('alerts', alertEvent, authToken);
        await page.waitForTimeout(500);
      }

      // Assert
      await expect(page.locator('text=Alert 1')).toBeVisible();
      await expect(page.locator('text=Alert 5')).toBeVisible();
    });

    test('should maintain event order', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act
      const events = ['First', 'Second', 'Third'];
      for (const msg of events) {
        await publishEvent('alerts', generateAlertEvent({ message: msg }), authToken);
        await page.waitForTimeout(300);
      }

      // Assert - Events should appear in order
      const eventElements = page.locator('[data-testid="alert-item"]');
      const firstEvent = eventElements.nth(0);
      const lastEvent = eventElements.nth(2);

      await expect(firstEvent).toContainText('First');
      await expect(lastEvent).toContainText('Third');
    });
  });

  test.describe('Event Filtering', () => {
    test('should filter events by severity', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Publish different severity events
      await publishEvent('alerts', generateAlertEvent({ severity: 'critical', message: 'Critical Alert' }), authToken);
      await publishEvent('alerts', generateAlertEvent({ severity: 'warning', message: 'Warning Alert' }), authToken);

      // Act - Filter by critical
      await page.click('[data-testid="severity-filter"]');
      await page.click('text=Critical Only');

      // Assert
      await expect(page.locator('text=Critical Alert')).toBeVisible();
      await expect(page.locator('text=Warning Alert')).not.toBeVisible();
    });

    test('should filter events by type', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Filter by event type
      await page.click('[data-testid="event-type-filter"]');
      await page.click('text=Network Alerts');

      // Assert - Should only show network alerts
      await expect(page.locator('[data-event-type="network"]')).toBeVisible();
    });

    test('should clear all filters', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.click('[data-testid="severity-filter"]');
      await page.click('text=Critical Only');

      // Act
      await page.click('[data-testid="clear-filters"]');

      // Assert
      await expect(page.locator('[data-testid="severity-filter"]')).toContainText('All Severities');
    });
  });

  test.describe('Event History', () => {
    test('should store event history', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Publish events
      await publishEvent('alerts', generateAlertEvent({ message: 'Historical Event' }), authToken);
      await page.waitForTimeout(1000);

      // Act - Refresh page
      await page.reload();
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Click to view history
      await page.click('[data-testid="connection-indicator"]');
      await page.click('text=View History');

      // Assert
      await expect(page.locator('text=Historical Event')).toBeVisible();
    });

    test('should limit history to last 100 events', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Check history count
      await page.click('[data-testid="connection-indicator"]');
      await page.click('text=View History');

      const historyItems = page.locator('[data-testid="history-item"]');
      const count = await historyItems.count();

      // Assert
      expect(count).toBeLessThanOrEqual(100);
    });

    test('should allow clearing event history', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act
      await page.click('[data-testid="connection-indicator"]');
      await page.click('text=View History');
      await page.click('[data-testid="clear-history"]');
      await page.click('text=Confirm');

      // Assert
      await expect(page.locator('text=No events in history')).toBeVisible();
    });
  });

  test.describe('Connection Status Indicator', () => {
    test('should display connection status indicator', async ({ page }) => {
      // Act
      await page.goto('/dashboard');

      // Assert
      await expect(page.locator('[data-testid="connection-indicator"]')).toBeVisible();
    });

    test('should show connected status with green indicator', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');

      // Assert
      await expect(page.locator('[data-testid="connection-indicator"][data-status="connected"]')).toHaveCSS('background-color', /rgb\(.*,\s*2\d{2},\s*.*/); // Green-ish
    });

    test('should expand on click to show stream details', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act
      await page.click('[data-testid="connection-indicator"]');

      // Assert
      await expect(page.locator('[data-testid="connection-panel"]')).toBeVisible();
      await expect(page.locator('[data-stream="alerts"]')).toBeVisible();
      await expect(page.locator('[data-stream="sessions"]')).toBeVisible();
    });

    test('should show individual stream status', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act
      await page.click('[data-testid="connection-indicator"]');

      // Assert
      const alertStream = page.locator('[data-stream="alerts"]');
      await expect(alertStream.locator('[data-status]')).toHaveAttribute('data-status', 'connected');
    });

    test('should show event count per stream', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Publish events
      await publishEvent('alerts', generateAlertEvent(), authToken);
      await page.waitForTimeout(1000);

      // Act
      await page.click('[data-testid="connection-indicator"]');

      // Assert
      const alertStream = page.locator('[data-stream="alerts"]');
      await expect(alertStream.locator('[data-testid="event-count"]')).toContainText('1');
    });

    test('should allow manually disconnecting stream', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      await page.click('[data-testid="connection-indicator"]');

      // Act
      await page.click('[data-stream="alerts"] [data-testid="disconnect-button"]');

      // Assert
      await expect(page.locator('[data-stream="alerts"][data-status="disconnected"]')).toBeVisible();
    });

    test('should allow manually reconnecting stream', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      await page.click('[data-testid="connection-indicator"]');
      await page.click('[data-stream="alerts"] [data-testid="disconnect-button"]');
      await expect(page.locator('[data-stream="alerts"][data-status="disconnected"]')).toBeVisible();

      // Act
      await page.click('[data-stream="alerts"] [data-testid="reconnect-button"]');

      // Assert
      await expect(page.locator('[data-stream="alerts"][data-status="connected"]')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should show error state on connection failure', async ({ page }) => {
      // Mock connection failure
      await page.route('**/api/v1/realtime/alerts/stream', route => route.abort('failed'));

      // Act
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);

      // Assert
      await expect(page.locator('[data-testid="connection-indicator"][data-status="error"]')).toBeVisible();
    });

    test('should show retry button on connection error', async ({ page }) => {
      // Mock connection failure
      await page.route('**/api/v1/realtime/alerts/stream', route => route.abort('failed'));

      // Act
      await page.goto('/dashboard');
      await page.waitForTimeout(2000);

      await page.click('[data-testid="connection-indicator"]');

      // Assert
      await expect(page.locator('[data-testid="retry-connection"]')).toBeVisible();
    });

    test('should attempt to reconnect on retry', async ({ page }) => {
      // Mock initial failure, then success
      let attempt = 0;
      await page.route('**/api/v1/realtime/alerts/stream', route => {
        if (attempt === 0) {
          attempt++;
          route.abort('failed');
        } else {
          route.continue();
        }
      });

      await page.goto('/dashboard');
      await page.waitForTimeout(2000);

      // Act
      await page.click('[data-testid="connection-indicator"]');
      await page.click('[data-testid="retry-connection"]');

      // Assert
      await expect(page.locator('[data-testid="connection-indicator"][data-status="connected"]')).toBeVisible({ timeout: 10000 });
    });

    test('should handle network interruption gracefully', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Simulate network interruption
      await page.route('**/api/v1/realtime/**', route => route.abort('failed'));
      await page.waitForTimeout(5000);

      // Assert - Should show disconnected/reconnecting
      await expect(page.locator('[data-testid="connection-indicator"][data-status="reconnecting"]')).toBeVisible();
    });

    test('should show notification on connection lost', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Break connection
      await page.route('**/api/v1/realtime/**', route => route.abort('failed'));
      await page.waitForTimeout(3000);

      // Assert
      await expect(page.locator('text=Connection lost')).toBeVisible();
    });
  });

  test.describe('Performance', () => {
    test('should handle high-frequency events efficiently', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      const startTime = Date.now();

      // Act - Publish many events quickly
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(publishEvent('alerts', generateAlertEvent({ message: `Rapid Event ${i}` }), authToken));
      }
      await Promise.all(promises);

      // Wait for events to process
      await page.waitForTimeout(5000);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert - Should process within reasonable time (< 10 seconds)
      expect(duration).toBeLessThan(10000);
    });

    test('should not cause memory leaks with long-running connection', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard');
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Publish events over time
      for (let i = 0; i < 20; i++) {
        await publishEvent('alerts', generateAlertEvent(), authToken);
        await page.waitForTimeout(500);
      }

      // Act - Check memory usage (simplified check)
      const performanceMetrics = await page.evaluate(() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
          };
        }
        return null;
      });

      // Assert - Memory usage should be reasonable
      if (performanceMetrics) {
        const usagePercent = performanceMetrics.usedJSHeapSize / performanceMetrics.totalJSHeapSize;
        expect(usagePercent).toBeLessThan(0.9); // Less than 90% memory usage
      }
    });
  });

  test.describe('Multi-Tab Support', () => {
    test('should share connection state across tabs', async ({ browser }) => {
      // Arrange
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const testUser = generateTestUser();
      await createTestUser(testUser);
      await loginUser(page1, testUser.email, testUser.password);

      // Act - Open second tab
      await page2.goto('/dashboard');
      await page2.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Assert - Both tabs should be connected
      await expect(page1.locator('[data-testid="connection-indicator"][data-status="connected"]')).toBeVisible();
      await expect(page2.locator('[data-testid="connection-indicator"][data-status="connected"]')).toBeVisible();

      await context.close();
    });

    test('should receive events in all tabs', async ({ browser }) => {
      // Arrange
      const context = await browser.newContext();
      const page1 = await context.newPage();
      const page2 = await context.newPage();

      const testUser = generateTestUser();
      await createTestUser(testUser);
      const token = await loginUser(page1, testUser.email, testUser.password);

      await page2.goto('/dashboard');
      await page2.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Publish event
      await publishEvent('alerts', generateAlertEvent({ message: 'Multi-tab test' }), token);

      // Assert - Event should appear in both tabs
      await expect(page1.locator('text=Multi-tab test')).toBeVisible({ timeout: 10000 });
      await expect(page2.locator('text=Multi-tab test')).toBeVisible({ timeout: 10000 });

      await context.close();
    });
  });
});
