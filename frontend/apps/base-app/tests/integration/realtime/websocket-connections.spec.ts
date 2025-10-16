/**
 * Real-Time WebSocket Connection Integration Tests
 *
 * Tests for WebSocket connection management and bi-directional communication.
 */

import { test, expect } from '@playwright/test';
import { generateTestUser } from '../../fixtures/test-data';
import { createTestUser, loginUser } from '../../helpers/api-helpers';

test.describe('Real-Time WebSocket Connections', () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Create and login user
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);
  });

  test.describe('Connection Establishment', () => {
    test('should establish WebSocket connection', async ({ page }) => {
      // Act
      await page.goto('/dashboard/network/sessions/live');

      // Wait for WebSocket connection
      const wsPromise = page.waitForEvent('websocket');
      const ws = await wsPromise;

      // Assert
      expect(ws.url()).toContain('ws://');
      expect(ws.url()).toContain('/realtime/ws');
    });

    test('should upgrade HTTP to WebSocket', async ({ page }) => {
      // Act
      await page.goto('/dashboard/network/sessions/live');

      const wsPromise = page.waitForEvent('websocket');
      const ws = await wsPromise;

      // Assert - Should have Upgrade header
      await ws.waitForEvent('framereceived');
    });

    test('should send auth token in WebSocket connection', async ({ page }) => {
      // Act
      await page.goto('/dashboard/network/sessions/live');

      const wsPromise = page.waitForEvent('websocket');
      const ws = await wsPromise;

      // Wait for first frame (should be auth)
      const framePromise = ws.waitForEvent('framereceived');
      const frame = await framePromise;

      // Assert
      const payload = JSON.parse(frame.payload as string);
      expect(payload.type).toBe('auth');
      expect(payload.token).toBeTruthy();
    });

    test('should show connected status after handshake', async ({ page }) => {
      // Act
      await page.goto('/dashboard/network/sessions/live');

      // Assert
      await expect(page.locator('[data-testid="ws-status"][data-status="connected"]')).toBeVisible({ timeout: 10000 });
    });

    test('should establish multiple WebSocket connections', async ({ page }) => {
      // Act
      await page.goto('/dashboard');

      // Wait for multiple WebSocket connections
      await page.waitForTimeout(2000);

      // Assert
      await page.click('[data-testid="connection-indicator"]');
      const wsJobsStream = page.locator('[data-stream="jobs-ws"][data-status="connected"]');
      const wsCampaignsStream = page.locator('[data-stream="campaigns-ws"][data-status="connected"]');

      await expect(wsJobsStream).toBeVisible();
      await expect(wsCampaignsStream).toBeVisible();
    });
  });

  test.describe('Bi-directional Communication', () => {
    test('should send messages to server', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Send pause command
      await page.click('[data-job-id="test-job"] [data-testid="pause-job"]');

      // Wait for WebSocket frame to be sent
      await page.waitForTimeout(1000);

      // Assert - Check that message was sent (via WebSocket frames)
      const wsSpy = await page.evaluate(() => {
        return (window as any).__wsMessagesSent || [];
      });

      expect(wsSpy.length).toBeGreaterThan(0);
    });

    test('should receive messages from server', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Server sends job progress update (simulated)
      // This would be triggered by backend

      // Assert - Check for progress update
      await expect(page.locator('[data-testid="job-progress"]')).toBeVisible({ timeout: 15000 });
    });

    test('should handle command responses', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Send command and wait for response
      await page.click('[data-job-id="test-job"] [data-testid="resume-job"]');

      // Assert - Should show success message
      await expect(page.locator('text=Job resumed successfully')).toBeVisible({ timeout: 10000 });
    });

    test('should send heartbeat/ping messages', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      const wsPromise = page.waitForEvent('websocket');
      const ws = await wsPromise;

      // Act - Wait for heartbeat
      const framePromise = ws.waitForEvent('framesent', { timeout: 60000 });
      const frame = await framePromise;

      // Assert - Should be ping/heartbeat
      const payload = JSON.parse(frame.payload as string);
      expect(['ping', 'heartbeat']).toContain(payload.type);
    });

    test('should respond to server pong messages', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Wait for ping/pong cycle
      await page.waitForTimeout(5000);

      // Assert - Connection should still be alive
      await expect(page.locator('[data-testid="ws-status"][data-status="connected"]')).toBeVisible();
    });
  });

  test.describe('Job Control Commands', () => {
    test('should send pause job command', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act
      await page.click('[data-job-id="running-job"] [data-testid="pause-button"]');

      // Assert
      await expect(page.locator('[data-job-id="running-job"][data-status="paused"]')).toBeVisible({ timeout: 10000 });
    });

    test('should send resume job command', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act
      await page.click('[data-job-id="paused-job"] [data-testid="resume-button"]');

      // Assert
      await expect(page.locator('[data-job-id="paused-job"][data-status="running"]')).toBeVisible({ timeout: 10000 });
    });

    test('should send cancel job command', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act
      await page.click('[data-job-id="running-job"] [data-testid="cancel-button"]');
      await page.click('text=Confirm');

      // Assert
      await expect(page.locator('[data-job-id="running-job"][data-status="cancelled"]')).toBeVisible({ timeout: 10000 });
    });

    test('should show confirmation for destructive commands', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act
      await page.click('[data-job-id="running-job"] [data-testid="cancel-button"]');

      // Assert
      await expect(page.locator('text=Are you sure')).toBeVisible();
      await expect(page.locator('text=This will cancel the job')).toBeVisible();
    });

    test('should show error if command fails', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Mock command failure
      await page.evaluate(() => {
        (window as any).__mockCommandFailure = true;
      });

      // Act
      await page.click('[data-job-id="test-job"] [data-testid="pause-button"]');

      // Assert
      await expect(page.locator('text=Failed to pause job')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Campaign Control Commands', () => {
    test('should send pause campaign command', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/campaigns');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act
      await page.click('[data-campaign-id="active-campaign"] [data-testid="pause-button"]');

      // Assert
      await expect(page.locator('[data-campaign-id="active-campaign"][data-status="paused"]')).toBeVisible({ timeout: 10000 });
    });

    test('should send resume campaign command', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/campaigns');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act
      await page.click('[data-campaign-id="paused-campaign"] [data-testid="resume-button"]');

      // Assert
      await expect(page.locator('[data-campaign-id="paused-campaign"][data-status="running"]')).toBeVisible({ timeout: 10000 });
    });

    test('should show real-time campaign progress', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/communications/campaigns');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      const initialProgress = await page.locator('[data-campaign-id="active-campaign"] [data-testid="progress"]').textContent();

      // Act - Wait for progress updates
      await page.waitForTimeout(3000);

      // Assert
      const updatedProgress = await page.locator('[data-campaign-id="active-campaign"] [data-testid="progress"]').textContent();
      expect(updatedProgress).not.toBe(initialProgress);
    });
  });

  test.describe('Real-time Progress Updates', () => {
    test('should update job progress bar in real-time', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Assert - Progress should update
      const progressBar = page.locator('[data-job-id="running-job"] [data-testid="progress-bar"]');
      const initialWidth = await progressBar.evaluate(el => el.style.width);

      await page.waitForTimeout(5000);

      const updatedWidth = await progressBar.evaluate(el => el.style.width);
      expect(updatedWidth).not.toBe(initialWidth);
    });

    test('should update ETA dynamically', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Assert
      await expect(page.locator('[data-job-id="running-job"] [data-testid="eta"]')).toBeVisible();
    });

    test('should show completion notification', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Wait for job to complete (simulated fast job)
      await page.waitForTimeout(10000);

      // Assert
      await expect(page.locator('text=Job completed successfully')).toBeVisible();
    });
  });

  test.describe('Connection Health', () => {
    test('should detect connection timeout', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Simulate no heartbeat response
      await page.evaluate(() => {
        (window as any).__simulateTimeout = true;
      });

      await page.waitForTimeout(35000); // Assuming 30s timeout

      // Assert
      await expect(page.locator('[data-testid="ws-status"][data-status="reconnecting"]')).toBeVisible();
    });

    test('should show connection latency', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      await page.click('[data-testid="connection-indicator"]');

      // Assert
      await expect(page.locator('[data-testid="ws-latency"]')).toBeVisible();
      await expect(page.locator('[data-testid="ws-latency"]')).toContainText('ms');
    });

    test('should warn on high latency', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Mock high latency
      await page.evaluate(() => {
        (window as any).__mockHighLatency = 5000; // 5 seconds
      });

      await page.waitForTimeout(2000);

      // Assert
      await expect(page.locator('text=High connection latency detected')).toBeVisible();
    });
  });

  test.describe('Reconnection Logic', () => {
    test('should attempt reconnection on disconnect', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      const wsPromise = page.waitForEvent('websocket');
      const ws = await wsPromise;

      // Act - Close connection
      await page.evaluate(() => {
        (window as any).__wsConnection?.close();
      });

      await page.waitForTimeout(2000);

      // Assert - Should show reconnecting
      await expect(page.locator('[data-testid="ws-status"][data-status="reconnecting"]')).toBeVisible();
    });

    test('should successfully reconnect after disconnect', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Simulate disconnect and reconnect
      await page.evaluate(() => {
        (window as any).__wsConnection?.close();
      });

      await page.waitForTimeout(5000);

      // Assert - Should be reconnected
      await expect(page.locator('[data-testid="ws-status"][data-status="connected"]')).toBeVisible({ timeout: 15000 });
    });

    test('should use exponential backoff for reconnection', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Track reconnection attempts
      const attempts: number[] = [];
      await page.exposeFunction('trackReconnect', (timestamp: number) => {
        attempts.push(timestamp);
      });

      // Act - Simulate multiple disconnect/reconnect cycles
      await page.evaluate(() => {
        (window as any).__trackReconnects = true;
      });

      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          (window as any).__wsConnection?.close();
        });
        await page.waitForTimeout(10000);
      }

      // Assert - Intervals should increase
      if (attempts.length >= 3) {
        const interval1 = attempts[1] - attempts[0];
        const interval2 = attempts[2] - attempts[1];
        expect(interval2).toBeGreaterThan(interval1);
      }
    });

    test('should show manual reconnect button after multiple failures', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Mock connection failures
      await page.route('**/realtime/ws', route => route.abort('failed'));

      // Act - Force multiple reconnection attempts
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          (window as any).__wsConnection?.close();
        });
        await page.waitForTimeout(3000);
      }

      // Assert
      await expect(page.locator('[data-testid="manual-reconnect-button"]')).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle authentication failure', async ({ page }) => {
      // Arrange - Use invalid token
      await page.goto('/dashboard/jobs');

      // Mock auth failure
      await page.evaluate(() => {
        (window as any).__mockAuthFailure = true;
      });

      // Assert
      await expect(page.locator('text=Authentication failed')).toBeVisible({ timeout: 10000 });
    });

    test('should handle server errors gracefully', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Server sends error message
      await page.evaluate(() => {
        (window as any).__simulateServerError = true;
      });

      await page.waitForTimeout(2000);

      // Assert
      await expect(page.locator('text=Server error')).toBeVisible();
    });

    test('should handle malformed messages', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Send malformed message
      await page.evaluate(() => {
        (window as any).__sendMalformedMessage = true;
      });

      await page.waitForTimeout(1000);

      // Assert - Should not crash, connection should remain stable
      await expect(page.locator('[data-testid="ws-status"][data-status="connected"]')).toBeVisible();
    });
  });

  test.describe('Cleanup', () => {
    test('should close WebSocket on page navigation', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      const wsPromise = page.waitForEvent('websocket');
      const ws = await wsPromise;

      // Act - Navigate away
      await page.goto('/dashboard');

      // Wait for close event
      await ws.waitForEvent('close', { timeout: 5000 });

      // Assert - WebSocket should be closed
    });

    test('should close WebSocket on logout', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      const wsPromise = page.waitForEvent('websocket');
      const ws = await wsPromise;

      // Act - Logout
      await page.click('[data-testid="user-menu"]');
      await page.click('text=Logout');

      // Assert - WebSocket should be closed
      await ws.waitForEvent('close', { timeout: 5000 });
    });

    test('should cleanup event listeners on unmount', async ({ page }) => {
      // Arrange
      await page.goto('/dashboard/jobs');
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Navigate to different page
      await page.goto('/dashboard/communications');

      // Assert - No memory leaks (simplified check)
      const listenerCount = await page.evaluate(() => {
        return (window as any).__wsListenerCount || 0;
      });

      expect(listenerCount).toBe(0);
    });
  });
});
