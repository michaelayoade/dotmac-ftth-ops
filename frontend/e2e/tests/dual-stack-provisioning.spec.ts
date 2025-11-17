/**
 * End-to-End Tests for Dual-Stack Subscriber Provisioning
 *
 * Tests complete user workflows for provisioning subscribers with IPv4/IPv6
 */

import { test, expect } from "#e2e/fixtures";
import type { Page } from "@playwright/test";


test.describe("Dual-Stack Subscriber Provisioning", () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');

    // Wait for dashboard
    await page.waitForURL("/dashboard");
  });

  test("should provision subscriber with dual-stack IPs", async ({ page }) => {
    // Navigate to provisioning
    await page.click("text=Provisioning");
    await page.click("text=New Subscriber");

    // Fill basic information
    await page.fill('input[name="subscriber_id"]', "SUB-E2E-001");
    await page.fill('input[name="username"]', "e2e-user@example.com");
    await page.fill('input[name="password"]', "SecurePassword123!");

    // Go to IP allocation tab
    await page.click("text=IP Allocation");

    // Enable dual-stack
    await page.check('input[name="auto_allocate_ipv4"]');
    await page.check('input[name="auto_allocate_ipv6"]');

    // Or manually specify IPs
    await page.uncheck('input[name="auto_allocate_ipv4"]');
    await page.fill('input[name="framed_ipv4_address"]', "100.64.1.100/24");
    await page.fill('input[name="framed_ipv6_prefix"]', "2001:db8:100::/64");
    await page.fill('input[name="framed_ipv6_address"]', "2001:db8:100::100/128");

    // Verify IP validation
    await expect(page.locator("text=IPv4")).toBeVisible();
    await expect(page.locator("text=IPv6")).toBeVisible();

    // Go to service configuration
    await page.click("text=Service");
    await page.selectOption('select[name="bandwidth_profile_id"]', "profile-100mbps");

    // Go to VPN configuration
    await page.click("text=VPN");
    await page.check('input[name="provision_wireguard"]');
    await page.selectOption('select[name="wireguard_server_id"]', "vpn-server-1");

    // Submit
    await page.click('button:has-text("Provision Subscriber")');

    // Verify success
    await expect(page.locator("text=Successfully provisioned")).toBeVisible();

    // Verify subscriber appears in list
    await page.goto("/subscribers");
    await expect(page.locator("text=SUB-E2E-001")).toBeVisible();
    await expect(page.locator("text=Dual-Stack")).toBeVisible();
  });

  test("should provision subscriber with IPv4 only", async ({ page }) => {
    await page.click("text=Provisioning");
    await page.click("text=New Subscriber");

    await page.fill('input[name="subscriber_id"]', "SUB-E2E-002");
    await page.fill('input[name="username"]', "ipv4-only@example.com");
    await page.fill('input[name="password"]', "SecurePassword123!");

    await page.click("text=IP Allocation");

    // Only IPv4
    await page.check('input[name="auto_allocate_ipv4"]');
    await page.uncheck('input[name="auto_allocate_ipv6"]');

    await page.click('button:has-text("Provision Subscriber")');

    await expect(page.locator("text=Successfully provisioned")).toBeVisible();

    await page.goto("/subscribers");
    await expect(page.locator("text=SUB-E2E-002")).toBeVisible();
    await expect(page.locator("text=IPv4 Only")).toBeVisible();
  });

  test("should provision subscriber with IPv6 only", async ({ page }) => {
    await page.click("text=Provisioning");
    await page.click("text=New Subscriber");

    await page.fill('input[name="subscriber_id"]', "SUB-E2E-003");
    await page.fill('input[name="username"]', "ipv6-only@example.com");
    await page.fill('input[name="password"]', "SecurePassword123!");

    await page.click("text=IP Allocation");

    // Only IPv6
    await page.uncheck('input[name="auto_allocate_ipv4"]');
    await page.check('input[name="auto_allocate_ipv6"]');

    await page.click('button:has-text("Provision Subscriber")');

    await expect(page.locator("text=Successfully provisioned")).toBeVisible();

    await page.goto("/subscribers");
    await expect(page.locator("text=SUB-E2E-003")).toBeVisible();
    await expect(page.locator("text=IPv6 Only")).toBeVisible();
  });

  test("should show validation errors for invalid IPs", async ({ page }) => {
    await page.click("text=Provisioning");
    await page.click("text=New Subscriber");

    await page.fill('input[name="subscriber_id"]', "SUB-E2E-004");
    await page.click("text=IP Allocation");

    await page.uncheck('input[name="auto_allocate_ipv4"]');
    await page.fill('input[name="framed_ipv4_address"]', "256.256.256.256");

    await page.click('button:has-text("Provision Subscriber")');

    // Should show validation error
    await expect(page.locator("text=Invalid IPv4 address")).toBeVisible();
  });

  test("should require at least one IP address", async ({ page }) => {
    await page.click("text=Provisioning");
    await page.click("text=New Subscriber");

    await page.fill('input[name="subscriber_id"]', "SUB-E2E-005");
    await page.click("text=IP Allocation");

    // Disable both auto-allocations
    await page.uncheck('input[name="auto_allocate_ipv4"]');
    await page.uncheck('input[name="auto_allocate_ipv6"]');

    await page.click('button:has-text("Provision Subscriber")');

    // Should show error
    await expect(page.locator("text=at least one IP address")).toBeVisible();
  });
});

test.describe("IPAM Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("should allocate dual-stack IPs from IPAM", async ({ page }) => {
    await page.goto("/ipam");

    // Click allocate on a prefix
    await page.click('button:has-text("Allocate IP"):first');

    // Select dual-stack mode
    await page.click("text=Dual-Stack");

    // Fill form
    await page.fill('input[name="description"]', "E2E Test Dual-Stack");
    await page.fill('input[name="dns_name"]', "e2e-dual.example.com");

    await page.click('button:has-text("Allocate")');

    // Verify success
    await expect(page.locator("text=Successfully allocated")).toBeVisible();

    // Verify IPs appear in list
    await expect(page.locator("text=e2e-dual.example.com")).toBeVisible();
    await expect(page.locator("text=Dual-Stack")).toBeVisible();
  });

  test("should bulk allocate IPs", async ({ page }) => {
    await page.goto("/ipam");

    await page.click('button:has-text("Allocate IP"):first');

    // Select bulk mode
    await page.click("text=Bulk");

    // Fill bulk form
    await page.fill('input[name="count"]', "10");
    await page.fill('input[name="description_prefix"]', "Bulk Test");

    await page.click('button:has-text("Allocate")');

    // Verify 10 IPs allocated
    await expect(page.locator("text=10 IPs allocated successfully")).toBeVisible();
  });

  test("should filter IPs by family", async ({ page }) => {
    await page.goto("/ipam/addresses");

    // Initially shows all
    const initialCount = await page.locator('[data-testid="ip-address-row"]').count();
    expect(initialCount).toBeGreaterThan(0);

    // Filter to IPv4
    await page.click('button:has-text("IPv4 Only")');

    // Should only show IPv4
    const ipv4Rows = await page.locator('[data-testid="ip-address-row"]').all();
    for (const row of ipv4Rows) {
      await expect(row.locator("text=IPv4")).toBeVisible();
    }

    // Filter to IPv6
    await page.click('button:has-text("IPv6 Only")');

    // Should only show IPv6
    const ipv6Rows = await page.locator('[data-testid="ip-address-row"]').all();
    for (const row of ipv6Rows) {
      await expect(row.locator("text=IPv6")).toBeVisible();
    }
  });

  test("should search IPs by DNS name", async ({ page }) => {
    await page.goto("/ipam/addresses");

    // Search for specific DNS
    await page.fill('input[placeholder*="Search"]', "server1");

    // Wait for filter
    await page.waitForTimeout(500);

    // Should only show matching results
    const results = await page.locator('[data-testid="ip-address-row"]').all();
    for (const result of results) {
      await expect(result).toContainText("server1");
    }
  });

  test("should copy IP to clipboard", async ({ page }) => {
    await page.goto("/ipam/addresses");

    // Grant clipboard permissions
    await page.context().grantPermissions(["clipboard-write", "clipboard-read"]);

    // Click copy button
    await page.click('button[aria-label="Copy IP"]:first');

    // Verify clipboard content
    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText).toMatch(/\d+\.\d+\.\d+\.\d+|[0-9a-f:]+/i);

    // Verify success message
    await expect(page.locator("text=Copied")).toBeVisible();
  });
});

test.describe("WireGuard VPN Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("should create dual-stack WireGuard server", async ({ page }) => {
    await page.goto("/network/wireguard");

    await page.click('button:has-text("Create Server")');

    // Fill server details
    await page.fill('input[name="name"]', "E2E VPN Server");
    await page.fill('input[name="public_endpoint"]', "vpn-e2e.example.com:51820");
    await page.fill('input[name="server_ipv4"]', "10.8.0.1/24");
    await page.fill('input[name="server_ipv6"]', "fd00:8::1/64");

    await page.click('button:has-text("Create Server")');

    // Verify success
    await expect(page.locator("text=Server created successfully")).toBeVisible();

    // Verify dual-stack badge
    await expect(page.locator("text=Dual-Stack")).toBeVisible();
  });

  test("should create peer with auto-allocated IPs", async ({ page }) => {
    await page.goto("/network/wireguard");

    // Click add peer on first server
    await page.click('button:has-text("Add Peer"):first');

    // Fill peer details
    await page.fill('input[name="name"]', "E2E Test Peer");
    await page.fill('input[name="description"]', "Automatic dual-stack allocation");

    // Auto-allocation should be checked by default
    await expect(page.locator('input[name="auto_allocate"]')).toBeChecked();

    await page.click('button:has-text("Create Peer")');

    // Verify success
    await expect(page.locator("text=Peer created successfully")).toBeVisible();

    // Verify peer has both IPs
    await expect(page.locator("text=10.8.0.")).toBeVisible(); // IPv4
    await expect(page.locator("text=fd00:8::")).toBeVisible(); // IPv6
  });

  test("should generate peer configuration", async ({ page }) => {
    await page.goto("/network/wireguard");

    // Click on a peer
    await page.click('[data-testid="peer-row"]:first');

    // Click generate config
    await page.click('button:has-text("Generate Config")');

    // Verify config modal
    await expect(page.locator("text=[Interface]")).toBeVisible();
    await expect(page.locator("text=[Peer]")).toBeVisible();

    // Verify dual-stack IPs in config
    const configText = await page.locator("code").innerText();
    expect(configText).toMatch(/Address\s*=.*10\.8\.0\./); // IPv4
    expect(configText).toMatch(/Address\s*=.*fd00:8::/); // IPv6

    // Copy config
    await page.click('button:has-text("Copy Config")');
    await expect(page.locator("text=Configuration copied")).toBeVisible();
  });

  test("should show IP conflict error for duplicate peer IPs", async ({ page }) => {
    await page.goto("/network/wireguard");

    await page.click('button:has-text("Add Peer"):first');

    // Manually specify IPs
    await page.uncheck('input[name="auto_allocate"]');
    await page.fill('input[name="peer_ipv4"]', "10.8.0.2");
    await page.fill('input[name="peer_ipv6"]', "fd00:8::2");

    await page.click('button:has-text("Create Peer")');

    // Try to create another peer with same IPs
    await page.click('button:has-text("Add Peer"):first');
    await page.uncheck('input[name="auto_allocate"]');
    await page.fill('input[name="peer_ipv4"]', "10.8.0.2"); // Duplicate
    await page.fill('input[name="peer_ipv6"]', "fd00:8::2"); // Duplicate

    await page.click('button:has-text("Create Peer")');

    // Should show error
    await expect(page.locator("text=IP address already in use")).toBeVisible();
  });
});

test.describe("Device Monitoring", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("should add device with dual-stack IPs", async ({ page }) => {
    await page.goto("/network/devices");

    await page.click('button:has-text("Add Device")');

    await page.fill('input[name="name"]', "E2E Test Router");
    await page.fill('input[name="ipv4_address"]', "192.168.1.254");
    await page.fill('input[name="ipv6_address"]', "2001:db8:1::254");
    await page.fill('input[name="management_ip"]', "192.168.1.254");

    await page.selectOption('select[name="snmp_version"]', "v2c");
    await page.fill('input[name="snmp_community"]', "public");

    await page.click('button:has-text("Add Device")');

    await expect(page.locator("text=Device added successfully")).toBeVisible();

    // Verify dual-stack badge
    await expect(page.locator("text=Dual-Stack")).toBeVisible();
  });

  test("should show separate IPv4/IPv6 connectivity metrics", async ({ page }) => {
    await page.goto("/network/devices");

    // Click on a device
    await page.click('[data-testid="device-row"]:first');

    // Should see separate tabs for IPv4 and IPv6
    await expect(page.locator("text=IPv4 Connectivity")).toBeVisible();
    await expect(page.locator("text=IPv6 Connectivity")).toBeVisible();

    // Click IPv6 tab
    await page.click("text=IPv6 Connectivity");

    // Should show IPv6-specific metrics
    await expect(page.locator("text=Latency (ms)")).toBeVisible();
    await expect(page.locator("text=Packet Loss (%)")).toBeVisible();
  });

  test("should filter devices by online status", async ({ page }) => {
    await page.goto("/network/devices");

    // Filter to online only
    await page.click('button:has-text("Online")');

    // All visible devices should be online
    const statusBadges = await page.locator('[data-testid="device-status"]').all();
    for (const badge of statusBadges) {
      await expect(badge).toContainText("Online");
    }
  });
});

test.describe("IP Address Calculator", () => {
  test("should calculate subnet information", async ({ page }) => {
    await page.goto("/tools/ip-calculator");

    await page.fill('input[name="cidr"]', "192.168.1.0/24");

    // Wait for calculations
    await page.waitForTimeout(300);

    // Verify calculations
    await expect(page.locator("text=Network Address")).toBeVisible();
    await expect(page.locator("text=192.168.1.0")).toBeVisible();

    await expect(page.locator("text=Broadcast Address")).toBeVisible();
    await expect(page.locator("text=192.168.1.255")).toBeVisible();

    await expect(page.locator("text=Subnet Mask")).toBeVisible();
    await expect(page.locator("text=255.255.255.0")).toBeVisible();

    await expect(page.locator("text=Usable Hosts")).toBeVisible();
    await expect(page.locator("text=254")).toBeVisible();
  });

  test("should show binary representation", async ({ page }) => {
    await page.goto("/tools/ip-calculator");

    await page.fill('input[name="cidr"]', "10.0.0.0/8");

    await page.waitForTimeout(300);

    // Verify binary display
    await expect(page.locator("text=Binary IP")).toBeVisible();
    await expect(page.locator("text=Binary Mask")).toBeVisible();
  });
});
