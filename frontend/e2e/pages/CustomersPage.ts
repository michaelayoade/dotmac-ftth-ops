import { Page, Locator } from "@playwright/test";

/**
 * Customers Page Object
 *
 * Encapsulates interactions with the customers list and management page
 */
export class CustomersPage {
  readonly page: Page;

  // Main elements
  readonly customersTable: Locator;
  readonly addCustomerButton: Locator;
  readonly searchInput: Locator;
  readonly filterDropdown: Locator;

  // Table elements
  readonly tableRows: Locator;
  readonly tableHeaders: Locator;
  readonly emptyState: Locator;
  readonly loadingSpinner: Locator;

  // Pagination
  readonly nextPageButton: Locator;
  readonly prevPageButton: Locator;
  readonly pageInfo: Locator;

  // Customer actions
  readonly editButtons: Locator;
  readonly deleteButtons: Locator;
  readonly viewButtons: Locator;

  constructor(page: Page) {
    this.page = page;

    // Main elements
    this.customersTable = page
      .locator('[data-testid="customers-table"], table, .customers-list')
      .first();
    this.addCustomerButton = page
      .locator(
        'button:has-text("Add Customer"), button:has-text("New Customer"), [data-testid="add-customer"]',
      )
      .first();
    this.searchInput = page
      .locator(
        'input[placeholder*="Search"], input[name="search"], [data-testid="search-customers"]',
      )
      .first();
    this.filterDropdown = page
      .locator('select[name="filter"], [data-testid="filter-customers"]')
      .first();

    // Table elements
    this.tableRows = this.customersTable.locator('tbody tr, [data-testid="customer-row"]');
    this.tableHeaders = this.customersTable.locator("thead th");
    this.emptyState = page.locator(
      '[data-testid="empty-state"], .empty-state, :text("No customers found")',
    );
    this.loadingSpinner = page.locator('[data-testid="loading"], .loading, .spinner');

    // Pagination
    this.nextPageButton = page.locator('button:has-text("Next"), [aria-label="Next page"]').first();
    this.prevPageButton = page
      .locator('button:has-text("Previous"), [aria-label="Previous page"]')
      .first();
    this.pageInfo = page.locator('[data-testid="page-info"], .pagination-info');

    // Customer actions
    this.editButtons = page.locator('button:has-text("Edit"), [data-testid*="edit"]');
    this.deleteButtons = page.locator('button:has-text("Delete"), [data-testid*="delete"]');
    this.viewButtons = page.locator('button:has-text("View"), [data-testid*="view"]');
  }

  async goto(): Promise<void> {
    await this.page.goto("/dashboard/customers");
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
    // Wait for either table or empty state to be visible
    await Promise.race([
      this.customersTable.waitFor({ state: "visible", timeout: 5000 }).catch(() => {}),
      this.emptyState.waitFor({ state: "visible", timeout: 5000 }).catch(() => {}),
    ]);
  }

  async searchCustomers(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
    // Wait for table to update
    await this.page.waitForTimeout(500); // Small wait for debounce
  }

  async clickAddCustomer(): Promise<void> {
    await this.addCustomerButton.click();
  }

  async getCustomerCount(): Promise<number> {
    return await this.tableRows.count();
  }

  async getCustomerByName(name: string): Promise<Locator> {
    return this.tableRows.filter({ hasText: name }).first();
  }

  async editCustomer(customerName: string): Promise<void> {
    const row = await this.getCustomerByName(customerName);
    await row.locator('button:has-text("Edit")').click();
  }

  async deleteCustomer(customerName: string): Promise<void> {
    const row = await this.getCustomerByName(customerName);
    await row.locator('button:has-text("Delete")').click();

    // Handle confirmation dialog if it appears
    const confirmButton = this.page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmButton.isVisible({ timeout: 1000 })) {
      await confirmButton.click();
    }
  }

  async viewCustomer(customerName: string): Promise<void> {
    const row = await this.getCustomerByName(customerName);
    await row.click();
  }

  async goToNextPage(): Promise<void> {
    await this.nextPageButton.click();
    await this.waitForPageLoad();
  }

  async goToPreviousPage(): Promise<void> {
    await this.prevPageButton.click();
    await this.waitForPageLoad();
  }

  async hasCustomers(): Promise<boolean> {
    return (await this.tableRows.count()) > 0;
  }

  async isEmptyStateVisible(): Promise<boolean> {
    return await this.emptyState.isVisible({ timeout: 2000 }).catch(() => false);
  }
}
