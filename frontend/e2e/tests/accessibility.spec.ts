/**
 * Accessibility Tests (A11y)
 *
 * Tests WCAG 2.1 compliance for dual-stack IP components
 */

import { test, expect } from "#e2e/fixtures";

import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility - IP Input Components", () => {
  test.beforeEach(async ({ page }) => {
    // In bypass mode, /login auto-redirects to /dashboard - just go directly
    await page.goto("/dashboard");
    await page.waitForURL("**/dashboard**");
  });

  test("IPAddressInput should be accessible", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="ip-address-input"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("IPCIDRInput should be accessible", async ({ page }) => {
    await page.goto("/components/cidr-input-demo");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="cidr-input"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("DualStackIPInput should be accessible", async ({ page }) => {
    await page.goto("/components/dual-stack-demo");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="dual-stack-input"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("IPCalculator should be accessible", async ({ page }) => {
    await page.goto("/tools/ip-calculator");

    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("IP inputs should have proper labels", async ({ page }) => {
    await page.goto("/components/dual-stack-demo");

    // Check for aria-labels or visible labels
    const ipv4Input = page.locator('input[name="ipv4"]');
    const ipv6Input = page.locator('input[name="ipv6"]');

    // Should have accessible names
    await expect(ipv4Input).toHaveAccessibleName();
    await expect(ipv6Input).toHaveAccessibleName();
  });

  test("Error messages should be associated with inputs", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    // Enter invalid IP
    await page.fill('input[name="ip"]', "invalid");

    // Error message should be aria-described
    const input = page.locator('input[name="ip"]');
    const describedBy = await input.getAttribute("aria-describedby");

    expect(describedBy).toBeTruthy();

    // The error message element should exist
    const errorElement = page.locator(`#${describedBy}`);
    await expect(errorElement).toBeVisible();
  });

  test("Required fields should be indicated", async ({ page }) => {
    await page.goto("/provisioning/new");

    // Required inputs should have aria-required
    const subscriberIdInput = page.locator('input[name="subscriber_id"]');
    await expect(subscriberIdInput).toHaveAttribute("aria-required", "true");
  });
});

test.describe("Accessibility - IPAM Management", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("PrefixList should be accessible", async ({ page }) => {
    await page.goto("/ipam");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="prefix-list"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("IPAddressList should be accessible", async ({ page }) => {
    await page.goto("/ipam/addresses");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="ip-address-list"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("AllocateIPDialog should be accessible", async ({ page }) => {
    await page.goto("/ipam");
    await page.click('button:has-text("Allocate IP"):first');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include("role=dialog")
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Dialog should trap focus", async ({ page }) => {
    await page.goto("/ipam");
    await page.click('button:has-text("Allocate IP"):first');

    // Tab through elements
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Focus should remain within dialog
    const focusedElement = page.locator(":focus");
    const dialog = page.locator("role=dialog");

    const isFocusInDialog = await focusedElement.evaluate(
      (el, dialogEl) => {
        return dialogEl?.contains(el);
      },
      await dialog.elementHandle(),
    );

    expect(isFocusInDialog).toBe(true);
  });

  test("Buttons should have accessible names", async ({ page }) => {
    await page.goto("/ipam");

    // All action buttons should have accessible names
    const allocateButtons = await page.locator('button:has-text("Allocate IP")').all();

    for (const button of allocateButtons) {
      await expect(button).toHaveAccessibleName();
    }
  });

  test("Tables should have proper headers", async ({ page }) => {
    await page.goto("/ipam");

    // Prefix list table should have th elements
    const table = page.locator("table").first();
    const headers = table.locator("th");

    const headerCount = await headers.count();
    expect(headerCount).toBeGreaterThan(0);
  });
});

test.describe("Accessibility - Keyboard Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("Can navigate form with keyboard only", async ({ page }) => {
    await page.goto("/provisioning/new");

    // Tab to first input
    await page.keyboard.press("Tab");
    let focused = await page.locator(":focus").getAttribute("name");
    expect(focused).toBe("subscriber_id");

    // Tab to next input
    await page.keyboard.press("Tab");
    focused = await page.locator(":focus").getAttribute("name");
    expect(focused).toBe("username");

    // Tab to password
    await page.keyboard.press("Tab");
    focused = await page.locator(":focus").getAttribute("name");
    expect(focused).toBe("password");
  });

  test("Can operate dual-stack toggle with keyboard", async ({ page }) => {
    await page.goto("/provisioning/new");
    await page.click("text=IP Allocation");

    // Tab to auto-allocate checkbox
    const checkbox = page.locator('input[name="auto_allocate_ipv4"]');
    await checkbox.focus();

    // Press Space to toggle
    await page.keyboard.press("Space");

    const isChecked = await checkbox.isChecked();
    expect(isChecked).toBe(false); // Toggled off
  });

  test("Can submit form with Enter key", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    const input = page.locator('input[name="ip"]');
    await input.fill("192.168.1.1");

    // Press Enter
    await page.keyboard.press("Enter");

    // Form should submit
    await expect(page.locator("text=Submitted")).toBeVisible();
  });

  test("Can close dialog with Escape key", async ({ page }) => {
    await page.goto("/ipam");
    await page.click('button:has-text("Allocate IP"):first');

    // Dialog should be visible
    await expect(page.locator("role=dialog")).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Dialog should close
    await expect(page.locator("role=dialog")).not.toBeVisible();
  });

  test("Can navigate tabs with arrow keys", async ({ page }) => {
    await page.goto("/provisioning/new");

    // Focus on first tab
    const basicTab = page.locator('button[role="tab"]:has-text("Basic Info")');
    await basicTab.focus();

    // Arrow right to next tab
    await page.keyboard.press("ArrowRight");

    const ipTab = page.locator('button[role="tab"]:has-text("IP Allocation")');
    await expect(ipTab).toBeFocused();
  });
});

test.describe("Accessibility - Screen Reader Support", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("Status badges have aria-labels", async ({ page }) => {
    await page.goto("/ipam/addresses");

    const badges = page.locator('[role="status"]');
    const firstBadge = badges.first();

    await expect(firstBadge).toHaveAttribute("aria-label");
  });

  test("Loading states are announced", async ({ page }) => {
    await page.goto("/ipam");

    // Click allocate
    await page.click('button:has-text("Allocate IP"):first');

    // Fill form
    await page.fill('input[name="description"]', "Test");

    // Submit
    await page.click('button:has-text("Allocate")');

    // Loading indicator should have aria-label
    const loader = page.locator('[role="status"]');
    await expect(loader).toHaveAttribute("aria-label");
  });

  test("Success messages are announced", async ({ page }) => {
    await page.goto("/ipam");
    await page.click('button:has-text("Allocate IP"):first');

    await page.fill('input[name="description"]', "Test");
    await page.click('button:has-text("Allocate")');

    // Success alert should have role="alert"
    const alert = page.locator("role=alert");
    await expect(alert).toBeVisible();
  });

  test("Progress bars have accessible names and values", async ({ page }) => {
    await page.goto("/ipam");

    const progressBars = page.locator('[role="progressbar"]');
    const firstProgress = progressBars.first();

    // Should have aria-valuenow and aria-valuemax
    await expect(firstProgress).toHaveAttribute("aria-valuenow");
    await expect(firstProgress).toHaveAttribute("aria-valuemax");
  });

  test("Dual-stack badges describe IP configuration", async ({ page }) => {
    await page.goto("/ipam/addresses");

    const dualStackBadge = page.locator("text=Dual-Stack").first();

    // Should have descriptive aria-label
    const ariaLabel = await dualStackBadge.getAttribute("aria-label");
    expect(ariaLabel).toMatch(/IPv4.*IPv6/i);
  });
});

test.describe("Accessibility - Color Contrast", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("Should not have color contrast violations", async ({ page }) => {
    await page.goto("/ipam");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2aa", "wcag21aa"])
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === "color-contrast",
    );

    expect(contrastViolations).toEqual([]);
  });

  test("Error messages have sufficient contrast", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    await page.fill('input[name="ip"]', "invalid");

    const errorMessage = page.locator("text=Invalid");

    const accessibilityScanResults = await new AxeBuilder({ page }).include(errorMessage).analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === "color-contrast",
    );

    expect(contrastViolations).toEqual([]);
  });

  test("Buttons have sufficient contrast in all states", async ({ page }) => {
    await page.goto("/ipam");

    // Test normal state
    let scanResults = await new AxeBuilder({ page })
      .include('button:has-text("Allocate IP")')
      .analyze();

    expect(scanResults.violations.filter((v) => v.id === "color-contrast")).toEqual([]);

    // Test hover state
    await page.hover('button:has-text("Allocate IP"):first');

    scanResults = await new AxeBuilder({ page })
      .include('button:has-text("Allocate IP")')
      .analyze();

    expect(scanResults.violations.filter((v) => v.id === "color-contrast")).toEqual([]);
  });
});

test.describe("Accessibility - ARIA Attributes", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[name="email"]', "admin@test.com");
    await page.fill('input[name="password"]', "testpassword");
    await page.click('button[type="submit"]');
    await page.waitForURL("/dashboard");
  });

  test("Form controls have proper ARIA roles", async ({ page }) => {
    await page.goto("/provisioning/new");

    // Comboboxes should have role="combobox"
    const selects = await page.locator("select").all();
    for (const select of selects) {
      const role = await select.getAttribute("role");
      expect(["combobox", null]).toContain(role); // null is ok for native selects
    }
  });

  test("Tooltips have proper ARIA attributes", async ({ page }) => {
    await page.goto("/components/ip-input-demo");

    // Trigger tooltip
    await page.hover('[data-tooltip="IPv4 address format"]');

    const tooltip = page.locator('[role="tooltip"]');
    await expect(tooltip).toBeVisible();

    // Should have id that matches aria-describedby
    const tooltipId = await tooltip.getAttribute("id");
    expect(tooltipId).toBeTruthy();
  });

  test("Expandable sections have aria-expanded", async ({ page }) => {
    await page.goto("/provisioning/new");

    const expandButton = page.locator("button[aria-expanded]").first();

    // Should have aria-expanded attribute
    const isExpanded = await expandButton.getAttribute("aria-expanded");
    expect(["true", "false"]).toContain(isExpanded);
  });
});
