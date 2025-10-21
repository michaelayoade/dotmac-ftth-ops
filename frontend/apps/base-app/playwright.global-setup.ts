import { chromium, FullConfig } from "@playwright/test";
import path from "path";

/**
 * Global setup for Playwright tests
 * Authenticates once and saves the session for all tests to reuse
 */
async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to login page
  await page.goto("http://localhost:3000/login");

  // Wait for page to be ready
  await page.waitForLoadState("networkidle");

  // Fill in login form
  const emailInput = page.locator('[data-testid="email-input"]');
  await emailInput.click();
  await emailInput.fill("admin");
  await emailInput.blur();

  const passwordInput = page.locator('[data-testid="password-input"]');
  await passwordInput.click();
  await passwordInput.fill("admin123");
  await passwordInput.blur();

  // Small delay for React Hook Form
  await page.waitForTimeout(100);

  // Submit form
  await page.click('[data-testid="submit-button"]');

  // Wait for redirect to dashboard (with longer timeout)
  try {
    await page.waitForURL("**/dashboard", { timeout: 10000 });
    console.log("✅ Authentication successful");
  } catch (error) {
    console.log("⚠️  Dashboard navigation timed out, but cookies may be set");
    // Even if navigation fails, cookies might be set, so continue
  }

  // Save the authenticated state
  const storageStatePath = path.join(__dirname, ".auth", "user.json");
  await context.storageState({ path: storageStatePath });

  await browser.close();

  console.log(`✅ Saved authentication state to ${storageStatePath}`);
}

export default globalSetup;
