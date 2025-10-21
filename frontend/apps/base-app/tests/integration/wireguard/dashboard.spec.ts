/**
 * WireGuard Dashboard Integration Tests
 *
 * Tests for dashboard statistics, metrics, and overview functionality.
 */

import { test, expect } from "@playwright/test";
import { WireGuardDashboard } from "../../helpers/page-objects";
import {
  generateTestUser,
  generateTestServer,
  generateTestPeer,
  generateMultipleServers,
} from "../../fixtures/test-data";
import {
  createTestUser,
  loginUser,
  createServer,
  createPeer,
  cleanupServers,
  cleanupPeers,
  seedServers,
  seedPeers,
} from "../../helpers/api-helpers";

test.describe("WireGuard Dashboard", () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Create and login user
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);
  });

  test.afterEach(async () => {
    // Cleanup
    await cleanupPeers(authToken);
    await cleanupServers(authToken);
  });

  test.describe("Statistics Cards", () => {
    test("should display total servers count", async ({ page }) => {
      // Arrange
      const servers = generateMultipleServers(5);
      await seedServers(servers, authToken);

      const dashboard = new WireGuardDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      const totalServers = await dashboard.getTotalServers();
      expect(totalServers).toContain("5");
    });

    test("should display zero servers when none exist", async ({ page }) => {
      // Arrange
      const dashboard = new WireGuardDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      const totalServers = await dashboard.getTotalServers();
      expect(totalServers).toContain("0");
    });

    test("should display active peers count", async ({ page }) => {
      // Arrange - Create server and peers
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      for (let i = 0; i < 10; i++) {
        const peer = generateTestPeer(created.id, { status: "active" });
        await createPeer(peer, authToken);
      }

      const dashboard = new WireGuardDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      const activePeers = await dashboard.getActivePeers();
      expect(activePeers).toContain("10");
    });

    test("should display inactive servers count", async ({ page }) => {
      // Arrange
      const activeServers = generateMultipleServers(3);
      const inactiveServers = generateMultipleServers(2);

      // Mark some as inactive
      inactiveServers.forEach((s) => (s.status = "inactive"));

      await seedServers([...activeServers, ...inactiveServers], authToken);

      const dashboard = new WireGuardDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      await expect(page.locator('[data-testid="inactive-servers"]')).toContainText("2");
    });

    test("should display total traffic statistics", async ({ page }) => {
      // Arrange
      const servers = generateMultipleServers(3);
      servers[0].traffic_rx = 1000000000; // 1 GB
      servers[0].traffic_tx = 500000000; // 500 MB
      servers[1].traffic_rx = 2000000000; // 2 GB
      servers[1].traffic_tx = 1000000000; // 1 GB

      await seedServers(servers, authToken);

      const dashboard = new WireGuardDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      await expect(page.locator('[data-testid="total-traffic-rx"]')).toBeVisible();
      await expect(page.locator('[data-testid="total-traffic-tx"]')).toBeVisible();
    });

    test("should format traffic in human-readable units", async ({ page }) => {
      // Arrange
      const server = generateTestServer({
        traffic_rx: 1073741824, // 1 GiB
        traffic_tx: 536870912, // 512 MiB
      });

      await createServer(server, authToken);

      const dashboard = new WireGuardDashboard(page);

      // Act
      await dashboard.navigate();

      // Assert
      await expect(page.locator("text=/1(\\.0)?\\s*GB/i")).toBeVisible();
      await expect(page.locator("text=/512(\\.0)?\\s*MB/i")).toBeVisible();
    });
  });

  test.describe("Server List Overview", () => {
    test("should display list of servers with status", async ({ page }) => {
      // Arrange
      const servers = generateMultipleServers(3);
      await seedServers(servers, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      for (const server of servers) {
        await expect(page.locator(`text=${server.name}`)).toBeVisible();
      }
    });

    test("should show server health indicators", async ({ page }) => {
      // Arrange
      const activeServer = generateTestServer({ status: "active" });
      const degradedServer = generateTestServer({ status: "degraded" });

      await createServer(activeServer, authToken);
      await createServer(degradedServer, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-status="active"]')).toBeVisible();
      await expect(page.locator('[data-status="degraded"]')).toBeVisible();
    });

    test("should display peer count for each server", async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      // Create 5 peers
      for (let i = 0; i < 5; i++) {
        const peer = generateTestPeer(created.id);
        await createPeer(peer, authToken);
      }

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(
        page.locator(`[data-server-id="${created.id}"] [data-testid="peer-count"]`),
      ).toContainText("5");
    });

    test("should navigate to server details from list", async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click(`[data-server-id="${created.id}"]`);

      // Assert
      await expect(page).toHaveURL(new RegExp(`/wireguard/servers/${created.id}`));
    });
  });

  test.describe("Quick Actions", () => {
    test("should navigate to create server page", async ({ page }) => {
      // Arrange
      const dashboard = new WireGuardDashboard(page);
      await dashboard.navigate();

      // Act
      await dashboard.createServerButton.click();

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/servers\/new/);
    });

    test("should navigate to create peer page", async ({ page }) => {
      // Arrange
      const dashboard = new WireGuardDashboard(page);
      await dashboard.navigate();

      // Act
      await dashboard.createPeerButton.click();

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/peers\/new/);
    });

    test("should navigate to provisioning wizard", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click('[data-testid="provision-vpn"]');

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/provision/);
    });

    test("should navigate to servers list", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click("text=View All Servers");

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/servers$/);
    });

    test("should navigate to peers list", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click("text=View All Peers");

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/peers$/);
    });
  });

  test.describe("Charts and Graphs", () => {
    test("should display traffic chart", async ({ page }) => {
      // Arrange
      const servers = generateMultipleServers(3);
      servers.forEach((s) => {
        s.traffic_rx = Math.floor(Math.random() * 1000000000);
        s.traffic_tx = Math.floor(Math.random() * 1000000000);
      });

      await seedServers(servers, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="traffic-chart"]')).toBeVisible();
    });

    test("should display server status distribution chart", async ({ page }) => {
      // Arrange
      const servers = generateMultipleServers(5);
      servers[0].status = "active";
      servers[1].status = "active";
      servers[2].status = "inactive";
      servers[3].status = "degraded";
      servers[4].status = "maintenance";

      await seedServers(servers, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="status-distribution-chart"]')).toBeVisible();
    });

    test("should display peer activity chart", async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      // Create active and inactive peers
      for (let i = 0; i < 5; i++) {
        const peer = generateTestPeer(created.id, {
          status: i < 3 ? "active" : "inactive",
        });
        await createPeer(peer, authToken);
      }

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="peer-activity-chart"]')).toBeVisible();
    });
  });

  test.describe("Recent Activity", () => {
    test("should display recent server creations", async ({ page }) => {
      // Arrange
      const server = generateTestServer({ name: "new-vpn-server" });
      await createServer(server, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
      await expect(page.locator("text=new-vpn-server")).toBeVisible();
      await expect(page.locator("text=created")).toBeVisible();
    });

    test("should display recent peer connections", async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const peer = generateTestPeer(created.id, { peer_name: "new-peer" });
      await createPeer(peer, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="recent-activity"]')).toBeVisible();
      await expect(page.locator("text=new-peer")).toBeVisible();
    });

    test("should limit recent activity to last 10 items", async ({ page }) => {
      // Arrange - Create more than 10 items
      const servers = generateMultipleServers(15);
      await seedServers(servers, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      const activityItems = page.locator('[data-testid="activity-item"]');
      const count = await activityItems.count();
      expect(count).toBeLessThanOrEqual(10);
    });
  });

  test.describe("Filters and Sorting", () => {
    test("should filter dashboard by date range", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click('[data-testid="date-filter"]');
      await page.click("text=Last 7 days");

      // Assert
      await expect(page.locator('[data-date-range="7"]')).toBeVisible();
    });

    test("should sort servers by name", async ({ page }) => {
      // Arrange
      const servers = [
        generateTestServer({ name: "zebra-vpn" }),
        generateTestServer({ name: "alpha-vpn" }),
        generateTestServer({ name: "beta-vpn" }),
      ];
      await seedServers(servers, authToken);

      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click('[data-testid="sort-by-name"]');

      // Assert
      const firstServer = page.locator('[data-testid="server-card"]').first();
      await expect(firstServer).toContainText("alpha-vpn");
    });

    test("should sort servers by peer count", async ({ page }) => {
      // Arrange
      const server1 = generateTestServer({ name: "server-1", peer_count: 5 });
      const server2 = generateTestServer({ name: "server-2", peer_count: 15 });
      const server3 = generateTestServer({ name: "server-3", peer_count: 10 });

      await createServer(server1, authToken);
      await createServer(server2, authToken);
      await createServer(server3, authToken);

      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click('[data-testid="sort-by-peers"]');

      // Assert
      const firstServer = page.locator('[data-testid="server-card"]').first();
      await expect(firstServer).toContainText("server-2"); // Highest peer count
    });
  });

  test.describe("Auto-Refresh", () => {
    test("should auto-refresh dashboard statistics", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");

      const initialServers = await page.locator('[data-testid="total-servers"]').textContent();

      // Act - Create new server
      const server = generateTestServer();
      await createServer(server, authToken);

      // Wait for auto-refresh (30 seconds)
      await page.waitForTimeout(31000);

      // Assert
      const updatedServers = await page.locator('[data-testid="total-servers"]').textContent();
      expect(updatedServers).not.toBe(initialServers);
    });

    test("should show last updated timestamp", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="last-updated"]')).toBeVisible();
      await expect(page.locator("text=/Updated.*ago/i")).toBeVisible();
    });

    test("should allow manual refresh", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click('[data-testid="refresh-button"]');

      // Assert
      await expect(page.locator('[data-testid="refreshing-indicator"]')).toBeVisible();
      await expect(page.locator("text=Dashboard refreshed")).toBeVisible();
    });

    test("should disable auto-refresh when user opts out", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click('[data-testid="auto-refresh-toggle"]');

      // Assert
      await expect(page.locator('[data-testid="auto-refresh-toggle"]')).not.toBeChecked();
    });
  });

  test.describe("Empty States", () => {
    test("should show empty state for servers", async ({ page }) => {
      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator("text=No servers configured")).toBeVisible();
      await expect(page.locator("text=Create your first VPN server")).toBeVisible();
    });

    test("should show empty state for peers", async ({ page }) => {
      // Arrange - Create server but no peers
      const server = generateTestServer();
      await createServer(server, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator("text=No peers connected")).toBeVisible();
    });

    test("should show CTA button in empty state", async ({ page }) => {
      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      const ctaButton = page.locator('[data-testid="create-first-server"]');
      await expect(ctaButton).toBeVisible();
      await ctaButton.click();
      await expect(page).toHaveURL(/\/wireguard\/servers\/new/);
    });
  });

  test.describe("Alerts and Notifications", () => {
    test("should show alert for degraded servers", async ({ page }) => {
      // Arrange
      const server = generateTestServer({
        status: "degraded",
        name: "degraded-server",
      });
      await createServer(server, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="alert-banner"]')).toBeVisible();
      await expect(page.locator("text=/degraded-server.*degraded/i")).toBeVisible();
    });

    test("should show alert for servers in maintenance", async ({ page }) => {
      // Arrange
      const server = generateTestServer({ status: "maintenance" });
      await createServer(server, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="alert-banner"]')).toContainText("maintenance");
    });

    test("should show alert for expired peers", async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const expiredPeer = generateTestPeer(created.id, {
        expiration_date: pastDate.toISOString(),
      });
      await createPeer(expiredPeer, authToken);

      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator("text=expired peer")).toBeVisible();
    });

    test("should dismiss alerts", async ({ page }) => {
      // Arrange
      const server = generateTestServer({ status: "degraded" });
      await createServer(server, authToken);

      await page.goto("/dashboard/network/wireguard");

      // Act
      await page.click('[data-testid="dismiss-alert"]');

      // Assert
      await expect(page.locator('[data-testid="alert-banner"]')).not.toBeVisible();
    });
  });

  test.describe("Loading States", () => {
    test("should show loading skeleton on initial load", async ({ page }) => {
      // Act
      await page.goto("/dashboard/network/wireguard");

      // Assert
      await expect(page.locator('[data-testid="loading-skeleton"]')).toBeVisible();
      await page.waitForSelector('[data-testid="loading-skeleton"]', {
        state: "hidden",
        timeout: 5000,
      });
    });

    test("should show loading indicator on refresh", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard");
      await page.waitForLoadState("networkidle");

      // Act
      await page.click('[data-testid="refresh-button"]');

      // Assert
      await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();
    });
  });
});
