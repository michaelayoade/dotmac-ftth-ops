/**
 * WireGuard Provisioning Integration Tests
 *
 * Tests for one-click VPN provisioning wizard.
 */

import { test, expect } from "@playwright/test";
import { generateTestUser } from "../../fixtures/test-data";
import {
  createTestUser,
  loginUser,
  cleanupServers,
  cleanupPeers,
  provisionVPN,
} from "../../helpers/api-helpers";

test.describe("WireGuard Provisioning", () => {
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

  test.describe("Provisioning Wizard", () => {
    test("should complete provisioning with valid inputs", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Act - Step 1: Server Configuration
      await page.fill('[name="server_name"]', "my-vpn-service");
      await page.fill('[name="server_location"]', "US-East-1");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      // Step 2: Peer Configuration
      await page.fill('[name="initial_peer_count"]', "3");
      await page.fill('[name="peer_name_prefix"]', "user");
      await page.click("text=Next");

      // Step 3: Review and Confirm
      await expect(page.locator("text=my-vpn-service")).toBeVisible();
      await expect(page.locator("text=3 peers")).toBeVisible();
      await page.click("text=Provision");

      // Assert
      await expect(page.locator("text=VPN service provisioned successfully")).toBeVisible();
      await expect(page).toHaveURL(/\/wireguard\/servers\/[a-z0-9-]+$/);
    });

    test("should create server and peers in one operation", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Act
      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-West-1");
      await page.fill('[name="subnet"]', "10.9.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "5");
      await page.fill('[name="peer_name_prefix"]', "client");
      await page.click("text=Next");

      await page.click("text=Provision");

      // Assert
      await expect(page).toHaveURL(/\/wireguard\/servers\/[a-z0-9-]+$/);

      // Check peers were created
      await page.click('[data-testid="view-peers"]');
      const peerCount = await page.locator('[data-testid="peer-card"]').count();
      expect(peerCount).toBe(5);
    });

    test("should generate sequential peer names with prefix", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Act
      await page.fill('[name="server_name"]', "vpn-service");
      await page.fill('[name="server_location"]', "EU-West-1");
      await page.fill('[name="subnet"]', "10.10.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "3");
      await page.fill('[name="peer_name_prefix"]', "employee");
      await page.click("text=Next");

      // Step 3: Preview should show generated names
      await expect(page.locator("text=employee-1")).toBeVisible();
      await expect(page.locator("text=employee-2")).toBeVisible();
      await expect(page.locator("text=employee-3")).toBeVisible();

      await page.click("text=Provision");

      // Assert
      await page.click('[data-testid="view-peers"]');
      await expect(page.locator("text=employee-1")).toBeVisible();
      await expect(page.locator("text=employee-2")).toBeVisible();
      await expect(page.locator("text=employee-3")).toBeVisible();
    });

    test("should use default DNS servers", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Act
      await page.fill('[name="server_name"]', "quick-vpn");
      await page.fill('[name="server_location"]', "US-Central");
      await page.fill('[name="subnet"]', "10.11.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "1");
      await page.click("text=Next");

      await page.click("text=Provision");

      // Assert
      await expect(page.locator("text=1.1.1.1")).toBeVisible(); // Default DNS
    });

    test("should allow custom DNS servers", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Act
      await page.fill('[name="server_name"]', "custom-dns-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.12.0.0/24");
      await page.fill('[name="dns_servers"]', "8.8.8.8, 8.8.4.4");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "1");
      await page.click("text=Next");

      await page.click("text=Provision");

      // Assert
      await expect(page.locator("text=8.8.8.8")).toBeVisible();
      await expect(page.locator("text=8.8.4.4")).toBeVisible();
    });
  });

  test.describe("Validation", () => {
    test("should validate server name is required", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Act
      await page.click("text=Next");

      // Assert
      await expect(page.locator("text=Server name is required")).toBeVisible();
    });

    test("should validate location is required", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Act
      await page.fill('[name="server_name"]', "test-vpn");
      await page.click("text=Next");

      // Assert
      await expect(page.locator("text=Location is required")).toBeVisible();
    });

    test("should validate subnet format", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Act
      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "invalid-subnet");
      await page.click("text=Next");

      // Assert
      await expect(page.locator("text=Invalid subnet format")).toBeVisible();
    });

    test("should validate peer count is positive", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      // Act
      await page.fill('[name="initial_peer_count"]', "0");
      await page.click("text=Next");

      // Assert
      await expect(page.locator("text=At least 1 peer required")).toBeVisible();
    });

    test("should validate peer count maximum", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      // Act
      await page.fill('[name="initial_peer_count"]', "1000");
      await page.click("text=Next");

      // Assert
      await expect(page.locator("text=Maximum 254 peers per subnet")).toBeVisible();
    });

    test("should validate peer name prefix", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      // Act
      await page.fill('[name="initial_peer_count"]', "5");
      await page.fill('[name="peer_name_prefix"]', "invalid prefix!@#");
      await page.click("text=Next");

      // Assert
      await expect(page.locator("text=Invalid prefix format")).toBeVisible();
    });
  });

  test.describe("Navigation", () => {
    test("should allow going back to previous step", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      // Act
      await page.click("text=Back");

      // Assert
      await expect(page.locator('[name="server_name"]')).toHaveValue("test-vpn");
    });

    test("should preserve data when navigating between steps", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "5");
      await page.fill('[name="peer_name_prefix"]', "user");
      await page.click("text=Next");

      // Act
      await page.click("text=Back");
      await page.click("text=Back");

      // Assert
      await expect(page.locator('[name="server_name"]')).toHaveValue("test-vpn");
      await expect(page.locator('[name="server_location"]')).toHaveValue("US-East");
    });

    test("should allow canceling provisioning", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");

      // Act
      await page.click("text=Cancel");

      // Assert
      await expect(page).toHaveURL(/\/wireguard$/);
    });

    test("should show confirmation before canceling", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");

      // Act
      await page.click("text=Cancel");

      // Assert
      await expect(page.locator("text=Discard changes?")).toBeVisible();
    });
  });

  test.describe("Progress Indicator", () => {
    test("should show current step", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      // Assert - Step 1
      await expect(page.locator('[data-step="1"][data-active="true"]')).toBeVisible();

      // Act - Go to step 2
      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      // Assert - Step 2
      await expect(page.locator('[data-step="2"][data-active="true"]')).toBeVisible();
    });

    test("should mark completed steps", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      // Assert
      await expect(page.locator('[data-step="1"][data-completed="true"]')).toBeVisible();
    });
  });

  test.describe("Configuration Download", () => {
    test("should download all peer configurations after provisioning", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "3");
      await page.fill('[name="peer_name_prefix"]', "user");
      await page.click("text=Next");

      await page.click("text=Provision");

      // Wait for success
      await expect(page.locator("text=VPN service provisioned successfully")).toBeVisible();

      // Act
      const downloadPromise = page.waitForEvent("download");
      await page.click('[data-testid="download-all-configs"]');
      const download = await downloadPromise;

      // Assert
      expect(download.suggestedFilename()).toMatch(/\.zip$/);
    });

    test("should display QR codes for all peers", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "2");
      await page.click("text=Next");

      await page.click("text=Provision");

      // Act
      await page.click('[data-testid="show-qr-codes"]');

      // Assert
      const qrCodes = page.locator('[data-testid="qr-code"]');
      const count = await qrCodes.count();
      expect(count).toBe(2);
    });
  });

  test.describe("Error Handling", () => {
    test("should handle network error during provisioning", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "1");
      await page.click("text=Next");

      // Mock network error
      await page.route("**/api/v1/wireguard/provision", (route) => route.abort("failed"));

      // Act
      await page.click("text=Provision");

      // Assert
      await expect(page.locator("text=Network error")).toBeVisible();
      await expect(page.locator("text=Retry")).toBeVisible();
    });

    test("should allow retrying after error", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "1");
      await page.click("text=Next");

      // Mock error first, then success
      let attempt = 0;
      await page.route("**/api/v1/wireguard/provision", (route) => {
        if (attempt === 0) {
          attempt++;
          route.abort("failed");
        } else {
          route.continue();
        }
      });

      await page.click("text=Provision");
      await expect(page.locator("text=Network error")).toBeVisible();

      // Act - Retry
      await page.click("text=Retry");

      // Assert
      await expect(page.locator("text=VPN service provisioned successfully")).toBeVisible();
    });

    test("should handle validation errors from backend", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "1");
      await page.click("text=Next");

      // Mock validation error
      await page.route("**/api/v1/wireguard/provision", (route) => {
        route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({ detail: "Server name already exists" }),
        });
      });

      // Act
      await page.click("text=Provision");

      // Assert
      await expect(page.locator("text=Server name already exists")).toBeVisible();
    });
  });

  test.describe("Loading States", () => {
    test("should show loading indicator during provisioning", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "1");
      await page.click("text=Next");

      // Act
      await page.click("text=Provision");

      // Assert
      await expect(page.locator('[data-testid="provisioning-indicator"]')).toBeVisible();
      await expect(page.locator("text=Provisioning VPN service")).toBeVisible();
    });

    test("should disable buttons during provisioning", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "1");
      await page.click("text=Next");

      // Act
      const provisionButton = page.locator('button:has-text("Provision")');
      await provisionButton.click();

      // Assert
      await expect(provisionButton).toBeDisabled();
      await expect(page.locator('button:has-text("Back")')).toBeDisabled();
    });

    test("should show progress during provisioning", async ({ page }) => {
      // Arrange
      await page.goto("/dashboard/network/wireguard/provision");

      await page.fill('[name="server_name"]', "test-vpn");
      await page.fill('[name="server_location"]', "US-East");
      await page.fill('[name="subnet"]', "10.8.0.0/24");
      await page.click("text=Next");

      await page.fill('[name="initial_peer_count"]', "1");
      await page.click("text=Next");

      // Act
      await page.click("text=Provision");

      // Assert
      await expect(page.locator("text=Creating server")).toBeVisible();
      // Eventually shows peer creation
      await expect(page.locator("text=Creating peers")).toBeVisible({
        timeout: 10000,
      });
    });
  });
});
