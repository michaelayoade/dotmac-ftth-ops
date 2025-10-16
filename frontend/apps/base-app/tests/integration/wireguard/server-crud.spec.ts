/**
 * WireGuard Server CRUD Integration Tests
 *
 * Tests for creating, reading, updating, and deleting WireGuard servers.
 */

import { test, expect } from '@playwright/test';
import { LoginPage, ServerListPage, ServerCreatePage, ServerDetailsPage } from '../../helpers/page-objects';
import { generateTestUser, generateTestServer, generateMultipleServers } from '../../fixtures/test-data';
import { createTestUser, loginUser, createServer, deleteServer, cleanupServers } from '../../helpers/api-helpers';

test.describe('WireGuard Server CRUD', () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Create and login user
    const testUser = generateTestUser();
    await createTestUser(testUser);
    authToken = await loginUser(page, testUser.email, testUser.password);
  });

  test.afterEach(async () => {
    // Cleanup servers after each test
    await cleanupServers(authToken);
  });

  test.describe('Server List', () => {
    test('should display empty state when no servers exist', async ({ page }) => {
      // Arrange
      const serverListPage = new ServerListPage(page);

      // Act
      await serverListPage.navigate();

      // Assert
      await expect(page.locator('text=No servers found')).toBeVisible();
      const count = await serverListPage.getServerCount();
      expect(count).toBe(0);
    });

    test('should display list of servers', async ({ page }) => {
      // Arrange - Create test servers
      const servers = generateMultipleServers(3);
      for (const server of servers) {
        await createServer(server, authToken);
      }

      const serverListPage = new ServerListPage(page);

      // Act
      await serverListPage.navigate();

      // Assert
      const count = await serverListPage.getServerCount();
      expect(count).toBe(3);
    });

    test('should search servers by name', async ({ page }) => {
      // Arrange
      const server1 = generateTestServer({ name: 'production-vpn' });
      const server2 = generateTestServer({ name: 'staging-vpn' });
      await createServer(server1, authToken);
      await createServer(server2, authToken);

      const serverListPage = new ServerListPage(page);
      await serverListPage.navigate();

      // Act
      await serverListPage.search('production');

      // Assert
      await expect(page.locator('text=production-vpn')).toBeVisible();
      await expect(page.locator('text=staging-vpn')).not.toBeVisible();
    });

    test('should filter servers by status', async ({ page }) => {
      // Arrange
      const activeServer = generateTestServer({ status: 'active' });
      const inactiveServer = generateTestServer({ status: 'inactive' });
      await createServer(activeServer, authToken);
      await createServer(inactiveServer, authToken);

      const serverListPage = new ServerListPage(page);
      await serverListPage.navigate();

      // Act
      await serverListPage.filterByStatus('active');

      // Assert
      await expect(page.locator(`text=${activeServer.name}`)).toBeVisible();
      await expect(page.locator(`text=${inactiveServer.name}`)).not.toBeVisible();
    });

    test('should navigate to create page', async ({ page }) => {
      // Arrange
      const serverListPage = new ServerListPage(page);
      await serverListPage.navigate();

      // Act
      await serverListPage.createButton.click();

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/servers\/new/);
    });

    test('should navigate to server details', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      await createServer(server, authToken);

      const serverListPage = new ServerListPage(page);
      await serverListPage.navigate();

      // Act
      await serverListPage.clickServer(server.name);

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/servers\/[a-z0-9-]+$/);
    });
  });

  test.describe('Server Creation', () => {
    test('should create server with valid data', async ({ page }) => {
      // Arrange
      const serverData = generateTestServer();
      const createPage = new ServerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        name: serverData.name,
        location: serverData.location,
        endpoint: serverData.endpoint,
        subnet: serverData.subnet,
      });
      await createPage.submit();

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/servers\/[a-z0-9-]+$/);
      await expect(page.locator('h1')).toContainText(serverData.name);
      await expect(page.locator('text=Server created successfully')).toBeVisible();
    });

    test('should auto-generate server keys', async ({ page }) => {
      // Arrange
      const serverData = generateTestServer();
      const createPage = new ServerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        name: serverData.name,
        location: serverData.location,
        endpoint: serverData.endpoint,
        subnet: serverData.subnet,
      });
      await createPage.submit();

      // Assert - Keys should be generated
      await expect(page.locator('[data-testid="public-key"]')).toBeVisible();
      await expect(page.locator('[data-testid="private-key"]')).toBeVisible();
    });

    test('should show validation error for missing required fields', async ({ page }) => {
      // Arrange
      const createPage = new ServerCreatePage(page);
      await createPage.navigate();

      // Act - Submit without filling any fields
      await createPage.submit();

      // Assert
      await expect(page.locator('text=Server name is required')).toBeVisible();
      await expect(page.locator('text=Location is required')).toBeVisible();
      await expect(page.locator('text=Subnet is required')).toBeVisible();
    });

    test('should show validation error for invalid subnet', async ({ page }) => {
      // Arrange
      const serverData = generateTestServer();
      const createPage = new ServerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        name: serverData.name,
        location: serverData.location,
        endpoint: serverData.endpoint,
        subnet: 'invalid-subnet',
      });
      await createPage.submit();

      // Assert
      await expect(page.locator('text=Invalid subnet format')).toBeVisible();
    });

    test('should show validation error for invalid endpoint', async ({ page }) => {
      // Arrange
      const serverData = generateTestServer();
      const createPage = new ServerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.fillForm({
        name: serverData.name,
        location: serverData.location,
        endpoint: 'invalid-endpoint',
        subnet: serverData.subnet,
      });
      await createPage.submit();

      // Assert
      await expect(page.locator('text=Invalid endpoint format')).toBeVisible();
    });

    test('should show validation error for duplicate server name', async ({ page }) => {
      // Arrange - Create existing server
      const existingServer = generateTestServer({ name: 'duplicate-vpn' });
      await createServer(existingServer, authToken);

      const createPage = new ServerCreatePage(page);
      await createPage.navigate();

      // Act - Try to create server with same name
      await createPage.fillForm({
        name: 'duplicate-vpn',
        location: 'US-East-1',
        endpoint: '192.168.1.1:51820',
        subnet: '10.8.0.0/24',
      });
      await createPage.submit();

      // Assert
      await expect(page.locator('text=Server name already exists')).toBeVisible();
    });

    test('should allow canceling server creation', async ({ page }) => {
      // Arrange
      const createPage = new ServerCreatePage(page);
      await createPage.navigate();

      // Act
      await createPage.cancel();

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/servers$/);
    });

    test('should set default values for optional fields', async ({ page }) => {
      // Arrange
      const serverData = generateTestServer();
      const createPage = new ServerCreatePage(page);
      await createPage.navigate();

      // Act - Don't fill optional fields
      await createPage.fillForm({
        name: serverData.name,
        location: serverData.location,
        endpoint: serverData.endpoint,
        subnet: serverData.subnet,
      });
      await createPage.submit();

      // Assert - Should use defaults
      await expect(page).toHaveURL(/\/wireguard\/servers\/[a-z0-9-]+$/);
      await expect(page.locator('text=51820')).toBeVisible(); // Default listen port
    });
  });

  test.describe('Server Details', () => {
    test('should display server details', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);

      // Act
      await detailsPage.navigate(created.id);

      // Assert
      await expect(detailsPage.serverName).toContainText(server.name);
      await expect(page.locator('text=' + server.location)).toBeVisible();
      await expect(page.locator('text=' + server.subnet)).toBeVisible();
    });

    test('should display server status badge', async ({ page }) => {
      // Arrange
      const server = generateTestServer({ status: 'active' });
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);

      // Act
      await detailsPage.navigate(created.id);

      // Assert
      const status = await detailsPage.getStatus();
      expect(status.toLowerCase()).toContain('active');
    });

    test('should display server statistics', async ({ page }) => {
      // Arrange
      const server = generateTestServer({ peer_count: 5, traffic_rx: 1000000, traffic_tx: 500000 });
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);

      // Act
      await detailsPage.navigate(created.id);

      // Assert
      await expect(page.locator('[data-testid="peer-count"]')).toContainText('5');
      await expect(page.locator('[data-testid="traffic-rx"]')).toBeVisible();
      await expect(page.locator('[data-testid="traffic-tx"]')).toBeVisible();
    });

    test('should display server public key', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);

      // Act
      await detailsPage.navigate(created.id);

      // Assert
      await expect(page.locator('[data-testid="public-key"]')).toBeVisible();
    });

    test('should copy public key to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);
      await detailsPage.navigate(created.id);

      // Act
      await page.click('[data-testid="copy-public-key"]');

      // Assert
      await expect(page.locator('text=Copied to clipboard')).toBeVisible();
    });

    test('should download server configuration', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);
      await detailsPage.navigate(created.id);

      // Act
      const downloadPromise = page.waitForEvent('download');
      await page.click('[data-testid="download-config"]');
      const download = await downloadPromise;

      // Assert
      expect(download.suggestedFilename()).toMatch(/\.conf$/);
    });

    test('should navigate to edit page', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);
      await detailsPage.navigate(created.id);

      // Act
      await detailsPage.edit();

      // Assert
      await expect(page).toHaveURL(new RegExp(`/wireguard/servers/${created.id}/edit`));
    });

    test('should display list of peers', async ({ page }) => {
      // Arrange
      const server = generateTestServer({ peer_count: 3 });
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);

      // Act
      await detailsPage.navigate(created.id);

      // Assert - Should have peers section
      await expect(page.locator('[data-testid="peers-section"]')).toBeVisible();
    });
  });

  test.describe('Server Update', () => {
    test('should update server details', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      await page.goto(`/dashboard/network/wireguard/servers/${created.id}/edit`);

      // Act
      await page.fill('[name="location"]', 'US-West-1');
      await page.fill('[name="max_peers"]', '200');
      await page.click('button[type="submit"]');

      // Assert
      await expect(page).toHaveURL(new RegExp(`/wireguard/servers/${created.id}`));
      await expect(page.locator('text=US-West-1')).toBeVisible();
      await expect(page.locator('text=Server updated successfully')).toBeVisible();
    });

    test('should not update server name (immutable)', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      // Act
      await page.goto(`/dashboard/network/wireguard/servers/${created.id}/edit`);

      // Assert - Name field should be disabled
      const nameInput = page.locator('[name="name"]');
      await expect(nameInput).toBeDisabled();
    });

    test('should regenerate server keys', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      await page.goto(`/dashboard/network/wireguard/servers/${created.id}/edit`);

      // Get original key
      const originalKey = await page.locator('[data-testid="public-key"]').textContent();

      // Act
      await page.click('[data-testid="regenerate-keys"]');
      await page.click('text=Confirm'); // Confirmation dialog

      // Assert
      await expect(page.locator('text=Keys regenerated successfully')).toBeVisible();
      const newKey = await page.locator('[data-testid="public-key"]').textContent();
      expect(newKey).not.toBe(originalKey);
    });

    test('should show confirmation before regenerating keys', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      await page.goto(`/dashboard/network/wireguard/servers/${created.id}/edit`);

      // Act
      await page.click('[data-testid="regenerate-keys"]');

      // Assert
      await expect(page.locator('text=This will disconnect all peers')).toBeVisible();
    });
  });

  test.describe('Server Deletion', () => {
    test('should delete server', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);
      await detailsPage.navigate(created.id);

      // Act
      await detailsPage.delete();
      await page.click('text=Confirm'); // Confirmation dialog

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/servers$/);
      await expect(page.locator('text=Server deleted successfully')).toBeVisible();
    });

    test('should show confirmation before deleting', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);
      await detailsPage.navigate(created.id);

      // Act
      await detailsPage.delete();

      // Assert
      await expect(page.locator('text=Are you sure')).toBeVisible();
      await expect(page.locator('text=This action cannot be undone')).toBeVisible();
    });

    test('should cancel server deletion', async ({ page }) => {
      // Arrange
      const server = generateTestServer();
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);
      await detailsPage.navigate(created.id);

      // Act
      await detailsPage.delete();
      await page.click('text=Cancel');

      // Assert - Should still be on details page
      await expect(page).toHaveURL(new RegExp(`/wireguard/servers/${created.id}`));
    });

    test('should warn if server has peers before deleting', async ({ page }) => {
      // Arrange
      const server = generateTestServer({ peer_count: 5 });
      const created = await createServer(server, authToken);

      const detailsPage = new ServerDetailsPage(page);
      await detailsPage.navigate(created.id);

      // Act
      await detailsPage.delete();

      // Assert
      await expect(page.locator('text=has 5 peers')).toBeVisible();
    });
  });
});
