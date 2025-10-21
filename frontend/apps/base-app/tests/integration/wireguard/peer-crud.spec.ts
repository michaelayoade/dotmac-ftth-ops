/**
 * WireGuard Peer CRUD Integration Tests
 *
 * Tests for creating, reading, updating, and deleting WireGuard peers.
 */

import { test, expect } from "@playwright/test";
import { PeerListPage, PeerCreatePage } from "../../helpers/page-objects";
import {
  generateTestUser,
  generateTestServer,
  generateTestPeer,
  generateMultiplePeers,
} from "../../fixtures/test-data";
import {
  createTestUser,
  loginUser,
  createServer,
  createPeer,
  deletePeer,
  cleanupPeers,
  cleanupServers,
} from "../../helpers/api-helpers";

test.describe("WireGuard Peer CRUD", () => {
  let authToken: string;
  let testServerId: string;

  test.beforeEach(async ({ page }) => {
    // Create and login user
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);

    // Create test server
    const testServer = generateTestServer();
    const createdServer = await createServer(testServer, authToken);
    testServerId = createdServer.id;
  });

  test.afterEach(async () => {
    // Cleanup peers and servers
    await cleanupPeers(authToken);
    await cleanupServers(authToken);
  });

  test.describe("Peer List", () => {
    test("should display empty state when no peers exist", async ({ page }) => {
      // Arrange
      const peerListPage = new PeerListPage(page);

      // Act
      await peerListPage.navigate();

      // Assert
      await expect(page.locator("text=No peers found")).toBeVisible();
      const count = await peerListPage.getPeerCount();
      expect(count).toBe(0);
    });

    test("should display list of peers", async ({ page }) => {
      // Arrange - Create test peers
      const peers = generateMultiplePeers(testServerId, 3);
      for (const peer of peers) {
        await createPeer(peer, authToken);
      }

      const peerListPage = new PeerListPage(page);

      // Act
      await peerListPage.navigate();

      // Assert
      const count = await peerListPage.getPeerCount();
      expect(count).toBe(3);
    });

    test("should search peers by name", async ({ page }) => {
      // Arrange
      const peer1 = generateTestPeer(testServerId, { peer_name: "user-alice" });
      const peer2 = generateTestPeer(testServerId, { peer_name: "user-bob" });
      await createPeer(peer1, authToken);
      await createPeer(peer2, authToken);

      const peerListPage = new PeerListPage(page);
      await peerListPage.navigate();

      // Act
      await peerListPage.search("alice");

      // Assert
      await expect(page.locator("text=user-alice")).toBeVisible();
      await expect(page.locator("text=user-bob")).not.toBeVisible();
    });

    test("should filter peers by server", async ({ page }) => {
      // Arrange - Create second server
      const server2 = generateTestServer();
      const created2 = await createServer(server2, authToken);

      const peer1 = generateTestPeer(testServerId, {
        peer_name: "server1-peer",
      });
      const peer2 = generateTestPeer(created2.id, {
        peer_name: "server2-peer",
      });
      await createPeer(peer1, authToken);
      await createPeer(peer2, authToken);

      const peerListPage = new PeerListPage(page);
      await peerListPage.navigate();

      // Act
      await peerListPage.serverFilter.click();
      await page.click(`[data-server-id="${testServerId}"]`);

      // Assert
      await expect(page.locator("text=server1-peer")).toBeVisible();
      await expect(page.locator("text=server2-peer")).not.toBeVisible();
    });

    test("should filter peers by status", async ({ page }) => {
      // Arrange
      const activePeer = generateTestPeer(testServerId, { status: "active" });
      const inactivePeer = generateTestPeer(testServerId, {
        status: "inactive",
      });
      await createPeer(activePeer, authToken);
      await createPeer(inactivePeer, authToken);

      const peerListPage = new PeerListPage(page);
      await peerListPage.navigate();

      // Act
      await peerListPage.statusFilter.click();
      await page.click("text=Active");

      // Assert
      await expect(page.locator(`text=${activePeer.peer_name}`)).toBeVisible();
      await expect(page.locator(`text=${inactivePeer.peer_name}`)).not.toBeVisible();
    });

    test("should navigate to create page", async ({ page }) => {
      // Arrange
      const peerListPage = new PeerListPage(page);
      await peerListPage.navigate();

      // Act
      await peerListPage.createButton.click();

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/peers\/new/);
    });
  });

  test.describe("Peer Creation", () => {
    test("should create peer with valid data", async ({ page }) => {
      // Arrange
      const peerData = generateTestPeer(testServerId);
      const createPage = new PeerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        serverId: testServerId,
        peerName: peerData.peer_name,
        allowedIps: peerData.allowed_ips,
      });
      await createPage.submit();

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/peers\/[a-z0-9-]+$/);
      await expect(page.locator("h1")).toContainText(peerData.peer_name);
      await expect(page.locator("text=Peer created successfully")).toBeVisible();
    });

    test("should auto-generate peer keys", async ({ page }) => {
      // Arrange
      const peerData = generateTestPeer(testServerId);
      const createPage = new PeerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        serverId: testServerId,
        peerName: peerData.peer_name,
        allowedIps: peerData.allowed_ips,
      });
      await createPage.submit();

      // Assert - Keys should be generated
      await expect(page.locator('[data-testid="public-key"]')).toBeVisible();
      await expect(page.locator('[data-testid="private-key"]')).toBeVisible();
    });

    test("should auto-assign peer IP from server subnet", async ({ page }) => {
      // Arrange
      const peerData = generateTestPeer(testServerId);
      const createPage = new PeerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        serverId: testServerId,
        peerName: peerData.peer_name,
        allowedIps: peerData.allowed_ips,
      });
      await createPage.submit();

      // Assert - IP should be assigned
      await expect(page.locator('[data-testid="peer-ip"]')).toBeVisible();
      const peerIp = await page.locator('[data-testid="peer-ip"]').textContent();
      expect(peerIp).toMatch(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
    });

    test("should show validation error for missing required fields", async ({ page }) => {
      // Arrange
      const createPage = new PeerCreatePage(page);
      await createPage.navigate();

      // Act - Submit without filling fields
      await createPage.submit();

      // Assert
      await expect(page.locator("text=Server is required")).toBeVisible();
      await expect(page.locator("text=Peer name is required")).toBeVisible();
    });

    test("should show validation error for invalid allowed IPs", async ({ page }) => {
      // Arrange
      const peerData = generateTestPeer(testServerId);
      const createPage = new PeerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        serverId: testServerId,
        peerName: peerData.peer_name,
        allowedIps: "invalid-ips",
      });
      await createPage.submit();

      // Assert
      await expect(page.locator("text=Invalid IP format")).toBeVisible();
    });

    test("should show validation error for duplicate peer name on same server", async ({
      page,
    }) => {
      // Arrange - Create existing peer
      const existingPeer = generateTestPeer(testServerId, {
        peer_name: "duplicate-peer",
      });
      await createPeer(existingPeer, authToken);

      const createPage = new PeerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        serverId: testServerId,
        peerName: "duplicate-peer",
        allowedIps: "0.0.0.0/0",
      });
      await createPage.submit();

      // Assert
      await expect(page.locator("text=Peer name already exists")).toBeVisible();
    });

    test("should set default persistent keepalive", async ({ page }) => {
      // Arrange
      const peerData = generateTestPeer(testServerId);
      const createPage = new PeerCreatePage(page);
      await createPage.navigate();

      // Act - Don't set keepalive
      await createPage.fillForm({
        serverId: testServerId,
        peerName: peerData.peer_name,
        allowedIps: peerData.allowed_ips,
      });
      await createPage.submit();

      // Assert - Should use default (25 seconds)
      await expect(page.locator("text=25")).toBeVisible();
    });

    test("should allow custom persistent keepalive", async ({ page }) => {
      // Arrange
      const peerData = generateTestPeer(testServerId);
      const createPage = new PeerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        serverId: testServerId,
        peerName: peerData.peer_name,
        allowedIps: peerData.allowed_ips,
        keepalive: 30,
      });
      await createPage.submit();

      // Assert
      await expect(page.locator("text=30")).toBeVisible();
    });
  });

  test.describe("Peer Details", () => {
    test("should display peer details", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      // Act
      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Assert
      await expect(page.locator("h1")).toContainText(peer.peer_name);
      await expect(page.locator("text=" + peer.allowed_ips)).toBeVisible();
    });

    test("should display peer status badge", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId, { status: "active" });
      const created = await createPeer(peer, authToken);

      // Act
      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Assert
      await expect(page.locator('[data-testid="status-badge"]')).toContainText("Active");
    });

    test("should display peer public key", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      // Act
      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Assert
      await expect(page.locator('[data-testid="public-key"]')).toBeVisible();
    });

    test("should copy peer public key to clipboard", async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);

      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      await page.click('[data-testid="copy-public-key"]');

      // Assert
      await expect(page.locator("text=Copied to clipboard")).toBeVisible();
    });

    test("should download peer configuration", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      const downloadPromise = page.waitForEvent("download");
      await page.click('[data-testid="download-config"]');
      const download = await downloadPromise;

      // Assert
      expect(download.suggestedFilename()).toMatch(/\.conf$/);
    });

    test("should display QR code for mobile", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      await page.click('[data-testid="show-qr-code"]');

      // Assert
      await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();
    });

    test("should display peer server information", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      // Act
      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Assert
      await expect(page.locator('[data-testid="server-info"]')).toBeVisible();
    });

    test("should navigate to server details", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      await page.click('[data-testid="view-server"]');

      // Assert
      await expect(page).toHaveURL(new RegExp(`/wireguard/servers/${testServerId}`));
    });
  });

  test.describe("Peer Update", () => {
    test("should update peer details", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}/edit`);

      // Act
      await page.fill('[name="allowed_ips"]', "10.0.0.0/8");
      await page.fill('[name="persistent_keepalive"]', "30");
      await page.click('button[type="submit"]');

      // Assert
      await expect(page).toHaveURL(new RegExp(`/wireguard/peers/${created.id}`));
      await expect(page.locator("text=10.0.0.0/8")).toBeVisible();
      await expect(page.locator("text=Peer updated successfully")).toBeVisible();
    });

    test("should not update peer name (immutable)", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      // Act
      await page.goto(`/dashboard/network/wireguard/peers/${created.id}/edit`);

      // Assert - Name field should be disabled
      const nameInput = page.locator('[name="peer_name"]');
      await expect(nameInput).toBeDisabled();
    });

    test("should regenerate peer keys", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}/edit`);

      // Get original key
      const originalKey = await page.locator('[data-testid="public-key"]').textContent();

      // Act
      await page.click('[data-testid="regenerate-keys"]');
      await page.click("text=Confirm"); // Confirmation dialog

      // Assert
      await expect(page.locator("text=Keys regenerated successfully")).toBeVisible();
      const newKey = await page.locator('[data-testid="public-key"]').textContent();
      expect(newKey).not.toBe(originalKey);
    });

    test("should update peer expiration date", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}/edit`);

      // Act
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      await page.fill('[name="expiration_date"]', futureDate.toISOString().split("T")[0]);
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator("text=Peer updated successfully")).toBeVisible();
    });

    test("should add notes to peer", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}/edit`);

      // Act
      await page.fill('[name="notes"]', "VPN for remote employee");
      await page.click('button[type="submit"]');

      // Assert
      await expect(page.locator("text=VPN for remote employee")).toBeVisible();
    });
  });

  test.describe("Peer Deletion", () => {
    test("should delete peer", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      await page.click('[data-testid="delete-button"]');
      await page.click("text=Confirm"); // Confirmation dialog

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/peers$/);
      await expect(page.locator("text=Peer deleted successfully")).toBeVisible();
    });

    test("should show confirmation before deleting", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      await page.click('[data-testid="delete-button"]');

      // Assert
      await expect(page.locator("text=Are you sure")).toBeVisible();
      await expect(page.locator("text=This action cannot be undone")).toBeVisible();
    });

    test("should cancel peer deletion", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId);
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      await page.click('[data-testid="delete-button"]');
      await page.click("text=Cancel");

      // Assert - Should still be on details page
      await expect(page).toHaveURL(new RegExp(`/wireguard/peers/${created.id}`));
    });
  });

  test.describe("Peer Status Management", () => {
    test("should disable peer", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId, { status: "active" });
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      await page.click('[data-testid="disable-peer"]');

      // Assert
      await expect(page.locator('[data-testid="status-badge"]')).toContainText("Disabled");
      await expect(page.locator("text=Peer disabled successfully")).toBeVisible();
    });

    test("should enable peer", async ({ page }) => {
      // Arrange
      const peer = generateTestPeer(testServerId, { status: "disabled" });
      const created = await createPeer(peer, authToken);

      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Act
      await page.click('[data-testid="enable-peer"]');

      // Assert
      await expect(page.locator('[data-testid="status-badge"]')).toContainText("Active");
      await expect(page.locator("text=Peer enabled successfully")).toBeVisible();
    });

    test("should show expired status when expiration date passed", async ({ page }) => {
      // Arrange
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const peer = generateTestPeer(testServerId, {
        expiration_date: pastDate.toISOString(),
      });
      const created = await createPeer(peer, authToken);

      // Act
      await page.goto(`/dashboard/network/wireguard/peers/${created.id}`);

      // Assert
      await expect(page.locator('[data-testid="status-badge"]')).toContainText("Expired");
    });
  });
});
