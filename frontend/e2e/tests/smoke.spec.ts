/**
 * Basic Smoke Tests
 * Quick tests to verify the application is running
 */

import { test, expect } from "#e2e/fixtures";

const ISP_OPS_URL = process.env.ISP_OPS_URL || "http://localhost:3001";

test.describe("Smoke Tests", () => {
  test("Application is accessible", async ({ page }) => {
    const response = await page.goto(ISP_OPS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    expect(response?.status()).toBeLessThan(500);
  });

  test("Page has a title", async ({ page }) => {
    await page.goto(ISP_OPS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    const title = await page.title();
    // Verify it's a meaningful title, not just "Untitled"
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(3);
    expect(title).not.toBe("Untitled");
  });

  test("No critical JavaScript errors on load", async ({ page }) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      errors.push(error.message);
    });

    await page.goto(ISP_OPS_URL, {
      waitUntil: "networkidle",
      timeout: 10000,
    });

    // Filter out known non-critical errors
    const criticalErrors = errors.filter((err) => !err.includes("favicon") && !err.includes("404"));

    expect(criticalErrors).toHaveLength(0);
  });

  test("Page renders meaningful content", async ({ page }) => {
    await page.goto(ISP_OPS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    const bodyText = await page.textContent("body");
    expect(bodyText).toBeTruthy();
    // Ensure it's not just whitespace or minimal content
    expect(bodyText!.trim().length).toBeGreaterThan(50);
  });

  test("Page has interactive elements", async ({ page }) => {
    await page.goto(ISP_OPS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    // Check for any interactive elements (buttons, links, inputs)
    const interactiveElements = await page.locator("button, a, input").count();
    expect(interactiveElements).toBeGreaterThan(0);
  });
});
