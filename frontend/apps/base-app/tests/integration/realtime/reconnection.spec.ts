/**
 * Real-Time Reconnection and Resilience Integration Tests
 *
 * Tests for connection resilience, auto-reconnection, and error recovery.
 */

import { test, expect } from "@playwright/test";
import { generateTestUser } from "../../fixtures/test-data";
import { createTestUser, loginUser } from "../../helpers/api-helpers";

test.describe("Real-Time Reconnection and Resilience", () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Create and login user
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);
  });

  test.describe("Auto-Reconnection", () => {
    test("should auto-reconnect after connection loss", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Simulate connection loss
      await page.evaluate(() => {
        // Force close all connections
        (window as any).__closeAllConnections?.();
      });

      await page.waitForTimeout(2000);

      // Assert - Should show reconnecting, then connected
      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="reconnecting"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="connected"]'),
      ).toBeVisible({ timeout: 15000 });
    });

    test("should use exponential backoff for reconnection attempts", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Track reconnection timings
      const reconnectTimes: number[] = [];

      await page.exposeFunction("logReconnect", (timestamp: number) => {
        reconnectTimes.push(timestamp);
      });

      // Act - Force multiple disconnections
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          (window as any).__forceDisconnect?.();
        });
        await page.waitForTimeout(10000);
      }

      // Assert - Backoff intervals should increase
      if (reconnectTimes.length >= 3) {
        const interval1 = reconnectTimes[1] - reconnectTimes[0];
        const interval2 = reconnectTimes[2] - reconnectTimes[1];
        expect(interval2).toBeGreaterThanOrEqual(interval1);
      }
    });

    test("should not exceed maximum backoff time", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Force many reconnections to reach max backoff
      for (let i = 0; i < 10; i++) {
        await page.evaluate(() => {
          (window as any).__forceDisconnect?.();
        });
        await page.waitForTimeout(3000);
      }

      // Assert - Backoff should cap at max (e.g., 30 seconds)
      const backoffTime = await page.evaluate(() => {
        return (window as any).__currentBackoff || 0;
      });

      expect(backoffTime).toBeLessThanOrEqual(30000);
    });

    test("should reset backoff after successful connection", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Disconnect and reconnect successfully
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await page.waitForTimeout(5000);
      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="connected"]'),
      ).toBeVisible({ timeout: 15000 });

      // Wait for stable connection
      await page.waitForTimeout(5000);

      // Assert - Backoff should be reset
      const backoffTime = await page.evaluate(() => {
        return (window as any).__currentBackoff || 0;
      });

      expect(backoffTime).toBe(0);
    });
  });

  test.describe("Connection State Management", () => {
    test("should maintain state during reconnection", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Store initial state
      const initialData = await page.evaluate(() => {
        return (window as any).__appState;
      });

      // Act - Disconnect and reconnect
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="connected"]'),
      ).toBeVisible({ timeout: 15000 });

      // Assert - State should be preserved
      const reconnectedData = await page.evaluate(() => {
        return (window as any).__appState;
      });

      expect(reconnectedData).toEqual(initialData);
    });

    test("should restore subscriptions after reconnection", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      await page.click('[data-testid="connection-indicator"]');
      const initialStreams = await page.locator('[data-status="connected"]').count();

      // Act - Disconnect and reconnect
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="connected"]'),
      ).toBeVisible({ timeout: 15000 });

      await page.click('[data-testid="connection-indicator"]');
      const reconnectedStreams = await page.locator('[data-status="connected"]').count();

      // Assert - Same number of streams should be connected
      expect(reconnectedStreams).toBe(initialStreams);
    });

    test("should queue messages during disconnection", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/jobs");
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Disconnect
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      // Try to send command while disconnected
      await page.click('[data-job-id="test-job"] [data-testid="pause-button"]');

      // Reconnect
      await expect(page.locator('[data-testid="ws-status"][data-status="connected"]')).toBeVisible({
        timeout: 15000,
      });

      // Assert - Command should be sent after reconnection
      await expect(page.locator('[data-job-id="test-job"][data-status="paused"]')).toBeVisible({
        timeout: 10000,
      });
    });

    test("should notify user of queued actions", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/jobs");
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act - Disconnect
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await page.waitForTimeout(1000);

      // Try to send command
      await page.click('[data-job-id="test-job"] [data-testid="pause-button"]');

      // Assert
      await expect(page.locator("text=Action queued")).toBeVisible();
      await expect(page.locator("text=Will be sent when reconnected")).toBeVisible();
    });
  });

  test.describe("Network Interruption Handling", () => {
    test("should detect network offline", async ({ page, context }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Simulate offline
      await context.setOffline(true);
      await page.waitForTimeout(3000);

      // Assert
      await expect(page.locator('[data-testid="offline-indicator"]')).toBeVisible();
    });

    test("should reconnect when network comes back online", async ({ page, context }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Go offline then online
      await context.setOffline(true);
      await page.waitForTimeout(2000);
      await context.setOffline(false);

      // Assert
      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="connected"]'),
      ).toBeVisible({ timeout: 15000 });
    });

    test("should show offline banner", async ({ page, context }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act
      await context.setOffline(true);
      await page.waitForTimeout(2000);

      // Assert
      await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
      await expect(page.locator("text=You are currently offline")).toBeVisible();
    });

    test("should disable actions while offline", async ({ page, context }) => {
      // Arrange
      await page.goto("/dashboard/jobs");
      await page.waitForSelector('[data-testid="ws-status"][data-status="connected"]');

      // Act
      await context.setOffline(true);
      await page.waitForTimeout(2000);

      // Assert - Actions should be disabled
      await expect(page.locator('[data-testid="pause-button"]')).toBeDisabled();
      await expect(page.locator('[data-testid="resume-button"]')).toBeDisabled();
    });

    test("should cache read-only data while offline", async ({ page, context }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Record initial data
      const initialContent = await page.locator('[data-testid="dashboard-content"]').textContent();

      // Act - Go offline
      await context.setOffline(true);
      await page.reload();

      // Assert - Cached data should be available
      const offlineContent = await page.locator('[data-testid="dashboard-content"]').textContent();
      expect(offlineContent).toBeTruthy();
    });
  });

  test.describe("Server Errors and Recovery", () => {
    test("should handle 5xx server errors", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Mock server error
      await page.route("**/api/v1/realtime/**", (route) => {
        route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Service temporarily unavailable" }),
        });
      });

      // Act - Force reconnection
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await page.waitForTimeout(2000);

      // Assert
      await expect(page.locator("text=Server temporarily unavailable")).toBeVisible();
      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="error"]'),
      ).toBeVisible();
    });

    test("should retry after server error", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      let attempt = 0;

      // Mock server error then success
      await page.route("**/api/v1/realtime/**", (route) => {
        if (attempt < 2) {
          attempt++;
          route.fulfill({
            status: 503,
            body: JSON.stringify({ detail: "Service unavailable" }),
          });
        } else {
          route.continue();
        }
      });

      // Act
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      // Assert - Should eventually reconnect
      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="connected"]'),
      ).toBeVisible({ timeout: 30000 });
    });

    test("should show different message for 401 Unauthorized", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Mock auth error
      await page.route("**/api/v1/realtime/**", (route) => {
        route.fulfill({
          status: 401,
          body: JSON.stringify({ detail: "Unauthorized" }),
        });
      });

      // Act
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await page.waitForTimeout(3000);

      // Assert
      await expect(page.locator("text=Session expired")).toBeVisible();
      await expect(page.locator('button:has-text("Login Again")')).toBeVisible();
    });

    test("should stop retrying after too many failures", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Mock continuous failures
      await page.route("**/api/v1/realtime/**", (route) => route.abort("failed"));

      // Act - Force disconnect
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      // Wait for multiple retry attempts
      await page.waitForTimeout(60000);

      // Assert - Should give up and show manual option
      await expect(page.locator("text=Unable to connect")).toBeVisible();
      await expect(page.locator('button:has-text("Try Again")')).toBeVisible();
    });
  });

  test.describe("User Notifications", () => {
    test("should show toast notification on disconnect", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      // Assert
      await expect(page.locator('.toast:has-text("Connection lost")')).toBeVisible();
    });

    test("should show toast notification on reconnect", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Disconnect and reconnect
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="connected"]'),
      ).toBeVisible({ timeout: 15000 });

      // Assert
      await expect(page.locator('.toast:has-text("Reconnected successfully")')).toBeVisible();
    });

    test("should not spam notifications during unstable connection", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act - Multiple rapid disconnects/reconnects
      for (let i = 0; i < 5; i++) {
        await page.evaluate(() => {
          (window as any).__forceDisconnect?.();
        });
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(3000);

      // Assert - Should consolidate notifications
      const toastCount = await page.locator(".toast").count();
      expect(toastCount).toBeLessThan(5); // Should not show all 5 disconnections
    });

    test("should allow dismissing connection notifications", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Act
      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await expect(page.locator('.toast:has-text("Connection lost")')).toBeVisible();

      await page.click('.toast [data-testid="dismiss"]');

      // Assert
      await expect(page.locator('.toast:has-text("Connection lost")')).not.toBeVisible();
    });
  });

  test.describe("Manual Reconnection", () => {
    test("should allow manual reconnection attempt", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Mock connection failure
      await page.route("**/api/v1/realtime/**", (route) => route.abort("failed"));

      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await page.waitForTimeout(3000);

      // Act - Manual reconnect
      await page.click('[data-testid="connection-indicator"]');
      await page.click('[data-testid="manual-reconnect"]');

      // Assert
      await expect(page.locator("text=Attempting to reconnect")).toBeVisible();
    });

    test("should disable manual reconnect button during attempt", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await page.waitForTimeout(2000);

      // Act
      await page.click('[data-testid="connection-indicator"]');
      const reconnectButton = page.locator('[data-testid="manual-reconnect"]');
      await reconnectButton.click();

      // Assert
      await expect(reconnectButton).toBeDisabled();
    });

    test("should show success message on successful manual reconnect", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      let disconnected = true;

      // Mock initial failure, then success
      await page.route("**/api/v1/realtime/**", (route) => {
        if (disconnected) {
          route.abort("failed");
        } else {
          route.continue();
        }
      });

      await page.evaluate(() => {
        (window as any).__forceDisconnect?.();
      });

      await page.waitForTimeout(2000);

      // Act - Manual reconnect (this will succeed)
      disconnected = false;
      await page.click('[data-testid="connection-indicator"]');
      await page.click('[data-testid="manual-reconnect"]');

      // Assert
      await expect(page.locator("text=Successfully reconnected")).toBeVisible();
      await expect(
        page.locator('[data-testid="connection-indicator"][data-status="connected"]'),
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Connection Quality Indicators", () => {
    test("should show connection quality status", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      await page.click('[data-testid="connection-indicator"]');

      // Assert
      await expect(page.locator('[data-testid="connection-quality"]')).toBeVisible();
    });

    test("should show good quality for stable connection", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      await page.waitForTimeout(3000);

      await page.click('[data-testid="connection-indicator"]');

      // Assert
      await expect(
        page.locator('[data-testid="connection-quality"][data-quality="good"]'),
      ).toBeVisible();
    });

    test("should show poor quality for unstable connection", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      // Simulate unstable connection
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          (window as any).__forceDisconnect?.();
        });
        await page.waitForTimeout(2000);
      }

      await page.click('[data-testid="connection-indicator"]');

      // Assert
      await expect(
        page.locator('[data-testid="connection-quality"][data-quality="poor"]'),
      ).toBeVisible();
    });

    test("should show latency information", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard");
      await page.waitForSelector('[data-testid="connection-indicator"][data-status="connected"]');

      await page.click('[data-testid="connection-indicator"]');

      // Assert
      await expect(page.locator('[data-testid="connection-latency"]')).toBeVisible();
      await expect(page.locator('[data-testid="connection-latency"]')).toContainText("ms");
    });
  });
});
