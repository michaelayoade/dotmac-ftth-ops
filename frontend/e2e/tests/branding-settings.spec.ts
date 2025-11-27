/**
 * Playwright coverage for the Branding Settings workflow.
 *
 * Uses the in-app test harness to exercise the shared BrandingForm component
 * without relying on backend state. This guarantees we can fill, save, and
 * re-render tenant-defined branding assets.
 */

import { test, expect } from "#e2e/fixtures";

test.describe("Branding Settings Harness", () => {
  test("allows operators to update identity, contact, and color fields", async ({ page }) => {
    await page.goto("/test-harness/branding");

    const harness = page.getByTestId("branding-test-harness");
    await expect(harness).toBeVisible();

    const productNameInput = page.locator("#productName");
    const supportEmailInput = page.locator("#supportEmail");
    const primaryColorInput = page.locator("#primaryColor");

    await productNameInput.fill("E2E Fiber Suite");
    await supportEmailInput.fill("help+e2e@example.com");
    await primaryColorInput.fill("#123456");

    await page.locator('button:has-text("Save branding settings")').click();

    const confirmation = page.getByTestId("branding-save-confirmation");
    await expect(confirmation).toContainText("E2E Fiber Suite");

    await expect(primaryColorInput).toHaveValue("#123456");
    await expect(supportEmailInput).toHaveValue("help+e2e@example.com");
  });
});
