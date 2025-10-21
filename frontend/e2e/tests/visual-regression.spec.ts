/**
 * Visual Regression Tests
 *
 * Captures screenshots of key components and compares against baselines
 */

import { test, expect } from "@playwright/test";

test.describe("Visual Regression - IP Input Components", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("IPAddressInput - empty state", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    const component = page.locator('[data-testid="ip-address-input"]');
    await expect(component).toHaveScreenshot("ip-address-input-empty.png");
  });

  test("IPAddressInput - with valid IPv4", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    await page.fill('input[name="ip"]', "192.168.1.100");

    const component = page.locator('[data-testid="ip-address-input"]');
    await expect(component).toHaveScreenshot("ip-address-input-ipv4-valid.png");
  });

  test("IPAddressInput - with valid IPv6", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    await page.fill('input[name="ip"]', "2001:db8::1");

    const component = page.locator('[data-testid="ip-address-input"]');
    await expect(component).toHaveScreenshot("ip-address-input-ipv6-valid.png");
  });

  test("IPAddressInput - with error", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    await page.fill('input[name="ip"]', "invalid-ip");

    const component = page.locator('[data-testid="ip-address-input"]');
    await expect(component).toHaveScreenshot("ip-address-input-error.png");
  });

  test("DualStackIPInput - both IPs filled", async ({ page }) => {
    await page.goto("/components/dual-stack-demo");

    await page.fill('input[name="ipv4"]', "10.0.0.1");
    await page.fill('input[name="ipv6"]', "fd00::1");

    const component = page.locator('[data-testid="dual-stack-input"]');
    await expect(component).toHaveScreenshot("dual-stack-input-filled.png");
  });

  test("IPCalculator - with calculations", async ({ page }) => {
    await page.goto("/tools/ip-calculator");

    await page.fill('input[name="cidr"]', "192.168.1.0/24");
    await page.waitForTimeout(500); // Wait for calculations

    const component = page.locator('[data-testid="ip-calculator"]');
    await expect(component).toHaveScreenshot("ip-calculator-calculated.png");
  });
});

test.describe("Visual Regression - IPAM Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("PrefixList - with data", async ({ page }) => {
    await page.goto("/ipam");

    const list = page.locator('[data-testid="prefix-list"]');
    await expect(list).toHaveScreenshot("prefix-list.png");
  });

  test("IPAddressList - dual-stack grouped", async ({ page }) => {
    await page.goto("/ipam/addresses");

    const list = page.locator('[data-testid="ip-address-list"]');
    await expect(list).toHaveScreenshot("ip-address-list-grouped.png");
  });

  test("AllocateIPDialog - single mode", async ({ page }) => {
    await page.goto("/ipam");
    await page.click('button:has-text("Allocate IP"):first');

    const dialog = page.locator("role=dialog");
    await expect(dialog).toHaveScreenshot("allocate-ip-dialog-single.png");
  });

  test("AllocateIPDialog - dual-stack mode", async ({ page }) => {
    await page.goto("/ipam");
    await page.click('button:has-text("Allocate IP"):first');
    await page.click("text=Dual-Stack");

    const dialog = page.locator("role=dialog");
    await expect(dialog).toHaveScreenshot("allocate-ip-dialog-dual-stack.png");
  });

  test("IPAMDashboard - with statistics", async ({ page }) => {
    await page.goto("/ipam/dashboard");

    const dashboard = page.locator('[data-testid="ipam-dashboard"]');
    await expect(dashboard).toHaveScreenshot("ipam-dashboard.png");
  });
});

test.describe("Visual Regression - Provisioning Forms", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("SubscriberProvisionForm - basic tab", async ({ page }) => {
    await page.goto("/provisioning/new");

    const form = page.locator('[data-testid="subscriber-provision-form"]');
    await expect(form).toHaveScreenshot("subscriber-form-basic.png");
  });

  test("SubscriberProvisionForm - IP allocation tab", async ({ page }) => {
    await page.goto("/provisioning/new");
    await page.click("text=IP Allocation");

    const form = page.locator('[data-testid="subscriber-provision-form"]');
    await expect(form).toHaveScreenshot("subscriber-form-ip-allocation.png");
  });

  test("WireGuardServerForm - filled", async ({ page }) => {
    await page.goto("/network/wireguard");
    await page.click('button:has-text("Create Server")');

    await page.fill('input[name="name"]', "VPN Server 1");
    await page.fill('input[name="server_ipv4"]', "10.8.0.1/24");
    await page.fill('input[name="server_ipv6"]', "fd00:8::1/64");

    const form = page.locator("role=dialog");
    await expect(form).toHaveScreenshot("wireguard-server-form.png");
  });

  test("WireGuardPeerForm - with auto-allocation", async ({ page }) => {
    await page.goto("/network/wireguard");
    await page.click('button:has-text("Add Peer"):first');

    const form = page.locator("role=dialog");
    await expect(form).toHaveScreenshot("wireguard-peer-form-auto.png");
  });
});

test.describe("Visual Regression - Device Monitoring", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("DeviceList - with dual-stack devices", async ({ page }) => {
    await page.goto("/network/devices");

    const list = page.locator('[data-testid="device-list"]');
    await expect(list).toHaveScreenshot("device-list.png");
  });

  test("DeviceMetrics - IPv4 connectivity tab", async ({ page }) => {
    await page.goto("/network/devices");
    await page.click('[data-testid="device-row"]:first');

    const metrics = page.locator('[data-testid="device-metrics"]');
    await expect(metrics).toHaveScreenshot("device-metrics-ipv4.png");
  });

  test("DeviceMetrics - IPv6 connectivity tab", async ({ page }) => {
    await page.goto("/network/devices");
    await page.click('[data-testid="device-row"]:first');
    await page.click("text=IPv6 Connectivity");

    const metrics = page.locator('[data-testid="device-metrics"]');
    await expect(metrics).toHaveScreenshot("device-metrics-ipv6.png");
  });
});

test.describe("Visual Regression - Responsive Design", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("DualStackIPInput - mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto("/components/dual-stack-demo");

    const component = page.locator('[data-testid="dual-stack-input"]');
    await expect(component).toHaveScreenshot("dual-stack-input-mobile.png");
  });

  test("PrefixList - tablet viewport", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await page.goto("/ipam");

    const list = page.locator('[data-testid="prefix-list"]');
    await expect(list).toHaveScreenshot("prefix-list-tablet.png");
  });

  test("SubscriberProvisionForm - mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/provisioning/new");

    const form = page.locator('[data-testid="subscriber-provision-form"]');
    await expect(form).toHaveScreenshot("subscriber-form-mobile.png");
  });
});

test.describe("Visual Regression - Dark Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");

    // Enable dark mode
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForTimeout(300); // Wait for theme transition
  });

  test("IPAddressInput - dark mode", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    const component = page.locator('[data-testid="ip-address-input"]');
    await expect(component).toHaveScreenshot("ip-address-input-dark.png");
  });

  test("PrefixList - dark mode", async ({ page }) => {
    await page.goto("/ipam");

    const list = page.locator('[data-testid="prefix-list"]');
    await expect(list).toHaveScreenshot("prefix-list-dark.png");
  });

  test("DeviceMetrics - dark mode", async ({ page }) => {
    await page.goto("/network/devices");
    await page.click('[data-testid="device-row"]:first');

    const metrics = page.locator('[data-testid="device-metrics"]');
    await expect(metrics).toHaveScreenshot("device-metrics-dark.png");
  });
});
