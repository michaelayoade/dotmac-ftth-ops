import { Page, Locator, expect } from "@playwright/test";

/**
 * Base Page Object
 *
 * Provides common functionality for all page objects including:
 * - Navigation
 * - Common element interactions
 * - Wait strategies
 * - URL validation
 */
export abstract class BasePage {
  readonly page: Page;
  protected abstract path: string;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to the page
   */
  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitForPageLoad();
  }

  /**
   * Wait for the page to be fully loaded
   * Override this in subclasses for page-specific waits
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * Get the current URL
   */
  async getCurrentURL(): Promise<string> {
    return this.page.url();
  }

  /**
   * Verify we're on the expected page
   */
  async expectToBeOnPage(): Promise<void> {
    await expect(this.page).toHaveURL(new RegExp(this.path));
  }

  /**
   * Wait for a specific element to be visible
   */
  async waitForElement(locator: Locator): Promise<void> {
    await expect(locator).toBeVisible({ timeout: 5000 });
  }

  /**
   * Fill a form field with proper wait
   */
  async fillField(locator: Locator, value: string): Promise<void> {
    await this.waitForElement(locator);
    await locator.fill(value);
  }

  /**
   * Click an element with proper wait
   */
  async clickElement(locator: Locator): Promise<void> {
    await this.waitForElement(locator);
    await locator.click();
  }

  /**
   * Get text content of an element
   */
  async getTextContent(locator: Locator): Promise<string> {
    await this.waitForElement(locator);
    const text = await locator.textContent();
    return text || "";
  }

  /**
   * Check if element exists without waiting
   */
  async elementExists(locator: Locator): Promise<boolean> {
    return (await locator.count()) > 0;
  }

  /**
   * Wait for navigation to complete
   */
  async waitForNavigation(): Promise<void> {
    await this.page.waitForLoadState("networkidle", { timeout: 10000 });
  }
}
