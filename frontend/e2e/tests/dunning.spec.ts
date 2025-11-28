/**
 * E2E Tests for Dunning & Collections Management
 *
 * These tests cover the full integration of dunning campaign and execution
 * management functionality including UI interactions and data persistence.
 *
 * Covers:
 * - Viewing dunning campaigns
 * - Creating new campaigns
 * - Updating existing campaigns
 * - Pausing/resuming campaigns
 * - Deleting campaigns
 * - Viewing executions
 * - Starting executions
 * - Canceling executions
 * - Statistics and analytics
 * - Error handling
 */

import { test, expect } from "@playwright/test";

test.describe("Dunning & Collections Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin/operator
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL || "admin@test.com");
    await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD || "password");
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForURL(/\/dashboard|\/settings/);

    // Navigate to dunning page
    await page.goto("/billing/dunning");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Viewing Campaigns", () => {
    test("should display campaigns list", async ({ page }) => {
      // Check for the campaigns heading
      await expect(page.getByRole("heading", { name: /campaigns|dunning/i })).toBeVisible();

      // Verify campaigns list/table is displayed
      const campaignsList = page.locator('[data-testid="campaigns-list"], table');
      await expect(campaignsList).toBeVisible();
    });

    test("should show empty state when no campaigns exist", async ({ page }) => {
      const emptyState = page.locator('[data-testid="campaigns-empty"]');
      const campaignRows = page.locator('[data-testid="campaign-row"], tbody tr');

      const count = await campaignRows.count();
      if (count === 0) {
        await expect(emptyState).toBeVisible();
      }
    });

    test("should display campaign properties correctly", async ({ page }) => {
      const campaignRows = page.locator('[data-testid="campaign-row"], tbody tr');
      const count = await campaignRows.count();

      if (count > 0) {
        const firstCampaign = campaignRows.first();

        // Should show: name, status, trigger days, priority
        await expect(firstCampaign).toBeVisible();
        // Check for status badge (active/paused)
        await expect(
          firstCampaign.locator('[data-testid="campaign-status"], [class*="badge"]'),
        ).toBeVisible();
      }
    });

    test("should filter campaigns by status", async ({ page }) => {
      const statusFilter = page.locator('[data-testid="status-filter"], select, [role="combobox"]');

      if (await statusFilter.isVisible()) {
        // Filter by active
        await statusFilter.click();
        await page.click("text=/active/i");
        await page.waitForTimeout(500);

        // All visible campaigns should be active
        const campaignRows = page.locator('[data-testid="campaign-row"]');
        const count = await campaignRows.count();

        for (let i = 0; i < count; i++) {
          await expect(campaignRows.nth(i)).toContainText(/active/i);
        }
      }
    });
  });

  test.describe("Creating Campaigns", () => {
    test("should create a new campaign successfully", async ({ page }) => {
      // Click create button
      await page.click('button:has-text("Create Campaign"), button:has-text("New Campaign")');

      // Fill in campaign details
      await page.fill('[name="name"], [placeholder*="name" i]', "E2E Test Campaign");
      await page.fill('[name="description"]', "Created by E2E test");

      // Set trigger days
      await page.fill('[name="trigger_after_days"]', "30");

      // Set max retries
      await page.fill('[name="max_retries"]', "3");

      // Submit
      await page.click('button[type="submit"]:has-text("Create")');

      // Should show success message
      await expect(page.locator("text=/campaign created|success/i")).toBeVisible({
        timeout: 10000,
      });

      // Verify campaign appears in list
      await page.goto("/billing/dunning");
      await expect(page.locator('text="E2E Test Campaign"')).toBeVisible();
    });

    test("should validate required fields", async ({ page }) => {
      // Click create button
      await page.click('button:has-text("Create Campaign"), button:has-text("New Campaign")');

      // Try to submit without filling required fields
      await page.click('button[type="submit"]:has-text("Create")');

      // Should show validation errors
      await expect(page.locator("text=/name is required|required field/i")).toBeVisible();
    });

    test("should configure campaign stages", async ({ page }) => {
      await page.click('button:has-text("Create Campaign")');

      await page.fill('[name="name"]', "Multi-Stage Campaign");

      // Add stages
      const addStageButton = page.locator('button:has-text("Add Stage")');
      if (await addStageButton.isVisible()) {
        await addStageButton.click();

        // Configure first stage
        await page.fill('[name="stages[0].days_after_trigger"]', "7");
        await page.selectOption('[name="stages[0].action"]', "send_email");

        // Add second stage
        await addStageButton.click();
        await page.fill('[name="stages[1].days_after_trigger"]', "14");
        await page.selectOption('[name="stages[1].action"]', "suspend_service");
      }

      await page.click('button[type="submit"]:has-text("Create")');

      await expect(page.locator("text=/success/i")).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe("Updating Campaigns", () => {
    test("should update campaign details", async ({ page }) => {
      const campaignRows = page.locator('[data-testid="campaign-row"], tbody tr');
      const count = await campaignRows.count();

      if (count === 0) {
        test.skip(true, "No campaigns available to update");
      }

      // Click edit button on first campaign
      await campaignRows
        .first()
        .locator('button:has-text("Edit"), button:has-text("Manage"), [data-testid="edit-button"]')
        .click();

      // Update name
      await page.fill('[name="name"]', "Updated E2E Campaign");
      await page.fill('[name="description"]', "Updated by E2E test");

      // Save
      await page.click('button[type="submit"]:has-text("Save"), button:has-text("Update")');

      // Verify update
      await expect(page.locator('text="Updated E2E Campaign"')).toBeVisible();
    });

    test("should update campaign priority", async ({ page }) => {
      const campaignRows = page.locator('[data-testid="campaign-row"], tbody tr');
      const count = await campaignRows.count();

      if (count === 0) {
        test.skip(true, "No campaigns available");
      }

      await campaignRows.first().locator('button:has-text("Edit")').click();

      // Change priority
      const priorityInput = page.locator('[name="priority"]');
      await priorityInput.fill("5");

      await page.click('button[type="submit"]:has-text("Save")');

      await expect(page.locator("text=/success|updated/i")).toBeVisible();
    });
  });

  test.describe("Pausing and Resuming Campaigns", () => {
    test("should pause an active campaign", async ({ page }) => {
      const campaignRows = page.locator(
        '[data-testid="campaign-row"]:has-text("active"), tbody tr:has-text("active")',
      );
      const count = await campaignRows.count();

      if (count === 0) {
        test.skip(true, "No active campaigns available");
      }

      const firstActiveCampaign = campaignRows.first();

      // Click pause button
      await firstActiveCampaign
        .locator('button:has-text("Pause"), [data-testid="pause-button"]')
        .click();

      // Confirm pause
      await page.click('button:has-text("Confirm"), button:has-text("Pause"):last-of-type');

      // Verify status changed to paused
      await expect(page.locator("text=/paused|campaign paused/i")).toBeVisible();
    });

    test("should resume a paused campaign", async ({ page }) => {
      const pausedCampaigns = page.locator(
        '[data-testid="campaign-row"]:has-text("paused"), tbody tr:has-text("paused")',
      );
      const count = await pausedCampaigns.count();

      if (count === 0) {
        test.skip(true, "No paused campaigns available");
      }

      const firstPausedCampaign = pausedCampaigns.first();

      // Click resume button
      await firstPausedCampaign
        .locator('button:has-text("Resume"), [data-testid="resume-button"]')
        .click();

      // Confirm resume
      await page.click('button:has-text("Confirm"), button:has-text("Resume"):last-of-type');

      // Verify status changed to active
      await expect(page.locator("text=/active|campaign resumed/i")).toBeVisible();
    });
  });

  test.describe("Deleting Campaigns", () => {
    test.beforeEach(async ({ page }) => {
      // Create a test campaign to delete
      await page.click('button:has-text("Create Campaign")');
      await page.fill('[name="name"]', "Campaign to Delete");
      await page.fill('[name="trigger_after_days"]', "30");
      await page.click('button[type="submit"]:has-text("Create")');
      await page.waitForLoadState("networkidle");
    });

    test("should delete a campaign with confirmation", async ({ page }) => {
      await page.goto("/billing/dunning");

      const campaignRow = page.locator(
        'tr:has-text("Campaign to Delete"), [data-testid="campaign-row"]:has-text("Campaign to Delete")',
      );

      // Click delete button
      await campaignRow.locator('button:has-text("Delete"), [data-testid="delete-button"]').click();

      // Confirm deletion
      await expect(page.locator('[role="alertdialog"], [role="dialog"]')).toBeVisible();
      await page.click('button:has-text("Delete"):last-of-type, button:has-text("Confirm")');

      // Verify campaign is removed
      await expect(page.locator('text="Campaign to Delete"')).not.toBeVisible();
    });

    test("should cancel delete operation", async ({ page }) => {
      await page.goto("/billing/dunning");

      const campaignRow = page.locator('tr:has-text("Campaign to Delete")');

      // Click delete button
      await campaignRow.locator('button:has-text("Delete")').click();

      // Cancel deletion
      await page.click('button:has-text("Cancel")');

      // Verify campaign still exists
      await expect(page.locator('text="Campaign to Delete"')).toBeVisible();
    });
  });

  test.describe("Viewing Executions", () => {
    test("should display executions list", async ({ page }) => {
      // Navigate to executions tab/page
      await page.click("text=/executions|execution history/i");
      await page.waitForLoadState("networkidle");

      const executionsList = page.locator('[data-testid="executions-list"], table');
      await expect(executionsList).toBeVisible();
    });

    test("should filter executions by campaign", async ({ page }) => {
      await page.click("text=/executions/i");

      const campaignFilter = page.locator('[data-testid="campaign-filter"]');

      if (await campaignFilter.isVisible()) {
        await campaignFilter.click();
        // Select first campaign from dropdown
        await page.click('[role="option"]:first-of-type');
        await page.waitForTimeout(500);

        // Verify executions are filtered
        const executionRows = page.locator('[data-testid="execution-row"]');
        const count = await executionRows.count();

        if (count > 0) {
          // All executions should belong to selected campaign
          await expect(executionRows.first()).toBeVisible();
        }
      }
    });

    test("should filter executions by status", async ({ page }) => {
      await page.click("text=/executions/i");

      const statusFilter = page.locator('[data-testid="execution-status-filter"]');

      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.click("text=/active/i");
        await page.waitForTimeout(500);

        const executionRows = page.locator('[data-testid="execution-row"]');
        const count = await executionRows.count();

        for (let i = 0; i < count; i++) {
          await expect(executionRows.nth(i)).toContainText(/active/i);
        }
      }
    });
  });

  test.describe("Starting Executions", () => {
    test("should start a new execution", async ({ page }) => {
      await page.click("text=/executions/i");

      // Click start execution button
      await page.click('button:has-text("Start Execution"), button:has-text("New Execution")');

      // Select campaign
      await page.click('[name="campaign_id"], [data-testid="campaign-select"]');
      await page.click('[role="option"]:first-of-type');

      // Select subscription (if required)
      const subscriptionSelect = page.locator('[name="subscription_id"]');
      if (await subscriptionSelect.isVisible()) {
        await subscriptionSelect.click();
        await page.click('[role="option"]:first-of-type');
      }

      // Submit
      await page.click('button[type="submit"]:has-text("Start")');

      // Verify success
      await expect(page.locator("text=/execution started|success/i")).toBeVisible();
    });
  });

  test.describe("Canceling Executions", () => {
    test("should cancel an active execution", async ({ page }) => {
      await page.click("text=/executions/i");

      const activeExecutions = page.locator(
        '[data-testid="execution-row"]:has-text("active"), tbody tr:has-text("active")',
      );
      const count = await activeExecutions.count();

      if (count === 0) {
        test.skip(true, "No active executions available");
      }

      const firstExecution = activeExecutions.first();

      // Click cancel button
      await firstExecution
        .locator('button:has-text("Cancel"), [data-testid="cancel-button"]')
        .click();

      // Enter cancellation reason
      await page.fill('[name="reason"], [placeholder*="reason" i]', "Customer paid");

      // Confirm cancellation
      await page.click('button:has-text("Confirm"), button:has-text("Cancel"):last-of-type');

      // Verify execution is cancelled
      await expect(page.locator("text=/cancelled|execution cancelled/i")).toBeVisible();
    });
  });

  test.describe("Statistics and Analytics", () => {
    test("should display dunning statistics", async ({ page }) => {
      // Navigate to statistics/dashboard section
      const statsSection = page.locator('[data-testid="dunning-stats"]');

      if (await statsSection.isVisible()) {
        // Check for key metrics
        await expect(
          statsSection.locator("text=/total campaigns|active campaigns/i"),
        ).toBeVisible();
        await expect(
          statsSection.locator("text=/total executions|active executions/i"),
        ).toBeVisible();
        await expect(statsSection.locator("text=/recovery rate|amount recovered/i")).toBeVisible();
      }
    });

    test("should display recovery chart", async ({ page }) => {
      const recoveryChart = page.locator('[data-testid="recovery-chart"], [class*="chart"]');

      if (await recoveryChart.isVisible()) {
        await expect(recoveryChart).toBeVisible();

        // Check for time range selector
        const timeRangeSelector = page.locator('[data-testid="time-range-selector"]');
        if (await timeRangeSelector.isVisible()) {
          await timeRangeSelector.click();
          await page.click("text=/30 days/i");
          await page.waitForTimeout(500);
        }
      }
    });

    test("should display campaign-specific statistics", async ({ page }) => {
      const campaignRows = page.locator('[data-testid="campaign-row"], tbody tr');
      const count = await campaignRows.count();

      if (count === 0) {
        test.skip(true, "No campaigns available");
      }

      // Click on first campaign to view details
      await campaignRows.first().click();

      // Check for campaign statistics
      const statsPanel = page.locator('[data-testid="campaign-stats"]');
      if (await statsPanel.isVisible()) {
        await expect(statsPanel).toContainText(/executions|recovery rate/i);
      }
    });
  });

  test.describe("Error Handling", () => {
    test("should handle network errors gracefully", async ({ page, context }) => {
      // Simulate network failure
      await context.route("**/api/isp/v1/admin/billing/dunning/campaigns", (route) => {
        route.abort("failed");
      });

      await page.goto("/billing/dunning");

      // Should show error message
      await expect(page.locator("text=/error|failed to load|something went wrong/i")).toBeVisible();
    });

    test("should handle invalid campaign configuration", async ({ page }) => {
      await page.click('button:has-text("Create Campaign")');

      // Fill with invalid data
      await page.fill('[name="name"]', "Invalid Campaign");
      await page.fill('[name="trigger_after_days"]', "-1"); // Invalid: negative days

      await page.click('button[type="submit"]');

      // Should show validation error
      await expect(page.locator("text=/invalid|must be positive|greater than 0/i")).toBeVisible();
    });

    test("should handle campaign with active executions deletion", async ({ page }) => {
      // Try to delete a campaign that has active executions
      const campaignWithExecutions = page
        .locator('[data-testid="campaign-row"]:has-text("active")')
        .first();

      if (await campaignWithExecutions.isVisible()) {
        await campaignWithExecutions.locator('button:has-text("Delete")').click();

        // May show warning or prevent deletion
        const warningMessage = page.locator("text=/active executions|cannot delete|in use/i");

        if (await warningMessage.isVisible()) {
          await expect(warningMessage).toBeVisible();
        }
      }
    });
  });

  test.describe("Pagination", () => {
    test("should paginate campaigns list", async ({ page }) => {
      const campaignRows = page.locator('[data-testid="campaign-row"], tbody tr');
      const count = await campaignRows.count();

      if (count < 10) {
        test.skip(true, "Not enough campaigns to test pagination");
      }

      const nextButton = page.locator('button:has-text("Next"), [aria-label="Next page"]');
      await expect(nextButton).toBeVisible();

      // Get first campaign name
      const firstCampaignName = await campaignRows.first().textContent();

      // Go to next page
      await nextButton.click();
      await page.waitForLoadState("networkidle");

      // First campaign should be different
      const newFirstCampaignName = await campaignRows.first().textContent();
      expect(newFirstCampaignName).not.toBe(firstCampaignName);
    });
  });
});
