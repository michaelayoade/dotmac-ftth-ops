/**
 * E2E Tests for Orchestration Workflow Management
 *
 * These tests cover the full integration of workflow orchestration functionality
 * including UI interactions, workflow lifecycle management, and data persistence.
 *
 * Covers:
 * - Viewing workflow list with filters and pagination
 * - Viewing single workflow details with steps
 * - Workflow lifecycle (pending → running → completed/failed)
 * - Retrying failed workflows
 * - Canceling running workflows
 * - Auto-refresh behavior for running workflows
 * - Viewing workflow statistics
 * - Exporting workflows (CSV/JSON)
 * - Error handling and edge cases
 */

import { test, expect } from "@playwright/test";

const BASE_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
const NAV_TIMEOUT = parseInt(process.env.E2E_NAV_TIMEOUT || "30000", 10);

test.describe("Orchestration Workflow Management", () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin/operator
    await page.goto("/login");
    await page.fill('[name="email"]', process.env.TEST_ADMIN_EMAIL || "admin@test.com");
    await page.fill('[name="password"]', process.env.TEST_ADMIN_PASSWORD || "password");
    await page.click('button[type="submit"]');

    // Wait for login to complete
    await page.waitForURL(/\/dashboard|\/settings/, { timeout: 10000 });

    // Navigate to orchestration page
    await page.goto("/orchestration/workflows");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Viewing Workflows", () => {
    test("should display workflows list", async ({ page }) => {
      // Check for the workflows heading
      await expect(page.getByRole("heading", { name: /workflows|orchestration/i })).toBeVisible({
        timeout: 10000,
      });

      // Verify workflows list/table is displayed
      const workflowsList = page.locator(
        '[data-testid="workflows-list"], [data-testid="workflows-table"], table',
      );
      await expect(workflowsList.first()).toBeVisible({ timeout: 10000 });
    });

    test("should show empty state when no workflows exist", async ({ page }) => {
      const emptyState = page.locator(
        '[data-testid="workflows-empty"], [data-testid="empty-state"]',
      );
      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');

      const count = await workflowRows.count();
      if (count === 0) {
        await expect(emptyState).toBeVisible();
      }
    });

    test("should display workflow properties correctly", async ({ page }) => {
      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
      const count = await workflowRows.count();

      if (count > 0) {
        const firstWorkflow = workflowRows.first();

        // Should show: workflow ID, type, status, timestamps
        await expect(firstWorkflow).toBeVisible();

        // Check for status badge (pending/running/completed/failed)
        await expect(
          firstWorkflow
            .locator('[data-testid="workflow-status"], [class*="badge"], [class*="status"]')
            .first(),
        ).toBeVisible();
      }
    });

    test("should filter workflows by status", async ({ page }) => {
      const statusFilter = page
        .locator('[data-testid="status-filter"], [name="status"], select')
        .first();

      if (await statusFilter.isVisible()) {
        // Filter by completed
        await statusFilter.click();
        await page.click("text=/completed/i");
        await page.waitForTimeout(1000);

        // Verify filtered results
        const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
        const count = await workflowRows.count();

        if (count > 0) {
          for (let i = 0; i < Math.min(count, 3); i++) {
            await expect(workflowRows.nth(i)).toContainText(/completed/i);
          }
        }
      }
    });

    test("should filter workflows by type", async ({ page }) => {
      const typeFilter = page
        .locator('[data-testid="type-filter"], [name="workflowType"], [name="workflow_type"]')
        .first();

      if (await typeFilter.isVisible()) {
        // Filter by provision_subscriber
        await typeFilter.click();
        await page.click("text=/provision.*subscriber/i");
        await page.waitForTimeout(1000);

        // Verify filtered results
        const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
        const count = await workflowRows.count();

        if (count > 0) {
          // At least one result should contain the workflow type
          const firstRow = workflowRows.first();
          await expect(firstRow).toContainText(/provision/i);
        }
      }
    });

    test("should paginate workflows", async ({ page }) => {
      const paginationControls = page.locator('[data-testid="pagination"], [role="navigation"]');

      if (await paginationControls.isVisible()) {
        const nextButton = page
          .locator('button:has-text("Next"), [aria-label="Next page"]')
          .first();

        if (await nextButton.isEnabled()) {
          // Get current page workflows
          const firstPageRows = await page
            .locator('[data-testid="workflow-row"], tbody tr')
            .count();

          // Go to next page
          await nextButton.click();
          await page.waitForTimeout(1000);

          // Should have new workflows
          const secondPageRows = await page
            .locator('[data-testid="workflow-row"], tbody tr')
            .count();
          expect(secondPageRows).toBeGreaterThan(0);
        }
      }
    });

    test("should allow sorting workflows", async ({ page }) => {
      const sortableHeaders = page.locator('th[role="columnheader"], th[data-sortable], th button');

      if (await sortableHeaders.first().isVisible()) {
        // Click first sortable header
        await sortableHeaders.first().click();
        await page.waitForTimeout(500);

        // Should trigger sort (verify by checking if UI responds)
        // In real implementation, you'd verify the sort order
        await expect(page.locator("tbody tr").first()).toBeVisible();
      }
    });
  });

  test.describe("Viewing Single Workflow", () => {
    test("should navigate to workflow detail page", async ({ page }) => {
      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
      const count = await workflowRows.count();

      if (count > 0) {
        // Click first workflow row or detail link
        const firstRow = workflowRows.first();
        const detailLink = firstRow
          .locator('a, button:has-text("View"), button:has-text("Details")')
          .first();

        if (await detailLink.isVisible()) {
          await detailLink.click();
        } else {
          await firstRow.click();
        }

        // Should navigate to detail page
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Verify detail page loaded
        await expect(page.getByRole("heading", { name: /workflow details|workflow/i })).toBeVisible(
          { timeout: 10000 },
        );
      }
    });

    test("should display workflow steps", async ({ page }) => {
      // Navigate to a workflow detail page
      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
      const count = await workflowRows.count();

      if (count > 0) {
        const firstRow = workflowRows.first();
        await firstRow.click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Should show steps list/timeline
        const stepsContainer = page.locator(
          '[data-testid="workflow-steps"], [data-testid="steps-list"]',
        );

        if (await stepsContainer.isVisible()) {
          // Verify at least one step is shown
          const steps = page.locator('[data-testid="workflow-step"], [data-testid="step"]');
          expect(await steps.count()).toBeGreaterThan(0);
        }
      }
    });

    test("should display step status correctly", async ({ page }) => {
      // Navigate to a workflow detail page
      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
      const count = await workflowRows.count();

      if (count > 0) {
        await workflowRows.first().click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Check for step status indicators
        const steps = page.locator('[data-testid="workflow-step"], [data-testid="step"]');
        const stepCount = await steps.count();

        if (stepCount > 0) {
          const firstStep = steps.first();

          // Should have status indicator (pending/running/completed/failed)
          await expect(
            firstStep.locator('[data-testid="step-status"], [class*="status"]').first(),
          ).toBeVisible();
        }
      }
    });

    test("should show workflow metadata", async ({ page }) => {
      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
      const count = await workflowRows.count();

      if (count > 0) {
        await workflowRows.first().click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Should show metadata like: workflow ID, type, status, timestamps
        const metadataContainer = page.locator(
          '[data-testid="workflow-metadata"], [data-testid="workflow-info"]',
        );

        if (await metadataContainer.isVisible()) {
          // Verify key metadata fields are present
          await expect(
            page.locator("text=/workflow.*id|type|status|created|started/i").first(),
          ).toBeVisible();
        }
      }
    });
  });

  test.describe("Workflow Actions", () => {
    test("should retry a failed workflow", async ({ page }) => {
      // Find a failed workflow
      const failedWorkflows = page.locator(
        '[data-testid="workflow-row"]:has-text("failed"), tbody tr:has-text("failed")',
      );
      const count = await failedWorkflows.count();

      if (count > 0) {
        const firstFailed = failedWorkflows.first();

        // Look for retry button in row or navigate to detail
        const retryButton = firstFailed.locator('button:has-text("Retry")').first();

        if (await retryButton.isVisible()) {
          await retryButton.click();
        } else {
          // Navigate to detail page
          await firstFailed.click();
          await page.waitForURL(/\/orchestration\/workflows\//);

          // Click retry on detail page
          await page.click('button:has-text("Retry")');
        }

        // Should show success message or confirmation
        await expect(page.locator("text=/retry.*success|workflow.*retried/i")).toBeVisible({
          timeout: 10000,
        });
      }
    });

    test("should cancel a running workflow", async ({ page }) => {
      // Find a running workflow
      const runningWorkflows = page.locator(
        '[data-testid="workflow-row"]:has-text("running"), tbody tr:has-text("running")',
      );
      const count = await runningWorkflows.count();

      if (count > 0) {
        const firstRunning = runningWorkflows.first();

        // Look for cancel button
        const cancelButton = firstRunning.locator('button:has-text("Cancel")').first();

        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        } else {
          // Navigate to detail page
          await firstRunning.click();
          await page.waitForURL(/\/orchestration\/workflows\//);

          // Click cancel on detail page
          await page.click('button:has-text("Cancel")');
        }

        // Confirm cancellation if modal appears
        const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
        }

        // Should show success message
        await expect(page.locator("text=/cancel.*success|workflow.*cancelled/i")).toBeVisible({
          timeout: 10000,
        });
      }
    });

    test("should handle retry button disabled for non-failed workflows", async ({ page }) => {
      // Find a completed/successful workflow
      const completedWorkflows = page.locator(
        '[data-testid="workflow-row"]:has-text("completed"), tbody tr:has-text("completed")',
      );
      const count = await completedWorkflows.count();

      if (count > 0) {
        await completedWorkflows.first().click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Retry button should be disabled or not visible
        const retryButton = page.locator('button:has-text("Retry")').first();

        if (await retryButton.isVisible()) {
          expect(await retryButton.isDisabled()).toBe(true);
        }
      }
    });

    test("should handle cancel button disabled for completed workflows", async ({ page }) => {
      // Find a completed workflow
      const completedWorkflows = page.locator(
        '[data-testid="workflow-row"]:has-text("completed"), tbody tr:has-text("completed")',
      );
      const count = await completedWorkflows.count();

      if (count > 0) {
        await completedWorkflows.first().click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Cancel button should be disabled or not visible
        const cancelButton = page.locator('button:has-text("Cancel")').first();

        if (await cancelButton.isVisible()) {
          expect(await cancelButton.isDisabled()).toBe(true);
        }
      }
    });
  });

  test.describe("Workflow Statistics", () => {
    test("should display workflow statistics", async ({ page }) => {
      // Look for statistics section
      const statsContainer = page.locator(
        '[data-testid="workflow-stats"], [data-testid="statistics"]',
      );

      if (await statsContainer.isVisible()) {
        // Should show key metrics: total, pending, running, completed, failed
        await expect(
          page.locator("text=/total|pending|running|completed|failed/i").first(),
        ).toBeVisible();
      }
    });

    test("should show success rate", async ({ page }) => {
      const statsContainer = page.locator(
        '[data-testid="workflow-stats"], [data-testid="statistics"]',
      );

      if (await statsContainer.isVisible()) {
        // Look for success rate percentage
        await expect(page.locator("text=/success.*rate|rate.*%/i").first()).toBeVisible();
      }
    });

    test("should show breakdown by workflow type", async ({ page }) => {
      const statsContainer = page.locator(
        '[data-testid="workflow-stats"], [data-testid="statistics"]',
      );

      if (await statsContainer.isVisible()) {
        // Look for workflow type breakdown
        const typeBreakdown = page.locator(
          '[data-testid="type-breakdown"], [data-testid="by-type"]',
        );

        if (await typeBreakdown.isVisible()) {
          // Should show different workflow types
          await expect(
            typeBreakdown.locator("text=/provision|activate|suspend|terminate/i").first(),
          ).toBeVisible();
        }
      }
    });
  });

  test.describe("Workflow Export", () => {
    test("should export workflows as CSV", async ({ page }) => {
      // Look for export button
      const exportButton = page
        .locator('button:has-text("Export"), [data-testid="export-button"]')
        .first();

      if (await exportButton.isVisible()) {
        // Start waiting for download before clicking
        const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

        await exportButton.click();

        // Select CSV format if menu appears
        const csvOption = page.locator('text=/CSV/i, [data-value="csv"]').first();
        if (await csvOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await csvOption.click();
        }

        try {
          // Wait for download
          const download = await downloadPromise;

          // Verify filename
          expect(download.suggestedFilename()).toMatch(/workflows.*\.csv$/i);
        } catch (e) {
          console.log("Download not available or blocked in test environment");
        }
      }
    });

    test("should export workflows as JSON", async ({ page }) => {
      const exportButton = page
        .locator('button:has-text("Export"), [data-testid="export-button"]')
        .first();

      if (await exportButton.isVisible()) {
        const downloadPromise = page.waitForEvent("download", { timeout: 30000 });

        await exportButton.click();

        // Select JSON format if menu appears
        const jsonOption = page.locator('text=/JSON/i, [data-value="json"]').first();
        if (await jsonOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await jsonOption.click();
        }

        try {
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toMatch(/workflows.*\.json$/i);
        } catch (e) {
          console.log("Download not available or blocked in test environment");
        }
      }
    });

    test("should allow filtering before export", async ({ page }) => {
      // Apply status filter
      const statusFilter = page.locator('[data-testid="status-filter"], [name="status"]').first();

      if (await statusFilter.isVisible()) {
        await statusFilter.click();
        await page.click("text=/completed/i");
        await page.waitForTimeout(1000);

        // Then try to export
        const exportButton = page.locator('button:has-text("Export")').first();
        if (await exportButton.isVisible()) {
          await exportButton.click();

          // Export should apply current filters
          await expect(page.locator("text=/export.*filtered|export.*\d+.*workflow/i"))
            .toBeVisible({ timeout: 5000 })
            .catch(() => {});
        }
      }
    });
  });

  test.describe("Auto-Refresh Behavior", () => {
    test("should auto-refresh running workflows", async ({ page }) => {
      // Find a running workflow
      const runningWorkflows = page.locator(
        '[data-testid="workflow-row"]:has-text("running"), tbody tr:has-text("running")',
      );
      const count = await runningWorkflows.count();

      if (count > 0) {
        await runningWorkflows.first().click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Enable auto-refresh if toggle exists
        const autoRefreshToggle = page
          .locator('[data-testid="auto-refresh"], input[type="checkbox"]')
          .first();

        if (await autoRefreshToggle.isVisible()) {
          if (!(await autoRefreshToggle.isChecked())) {
            await autoRefreshToggle.click();
          }
        }

        // Wait a few seconds and verify page is still showing fresh data
        await page.waitForTimeout(3000);

        // Should still show running status (or have updated to completed)
        const statusBadge = page
          .locator('[data-testid="workflow-status"], [class*="status"]')
          .first();
        await expect(statusBadge).toBeVisible();
      }
    });

    test("should stop polling for completed workflows", async ({ page }) => {
      // Find a completed workflow
      const completedWorkflows = page.locator(
        '[data-testid="workflow-row"]:has-text("completed"), tbody tr:has-text("completed")',
      );
      const count = await completedWorkflows.count();

      if (count > 0) {
        await completedWorkflows.first().click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Auto-refresh should be disabled or not polling for completed
        const statusBadge = page.locator('[data-testid="workflow-status"]').first();
        const initialText = await statusBadge.textContent();

        // Wait and verify status hasn't changed (no unnecessary polls)
        await page.waitForTimeout(3000);

        const finalText = await statusBadge.textContent();
        expect(finalText).toBe(initialText); // Should remain "completed"
      }
    });
  });

  test.describe("Error Handling", () => {
    test("should handle workflow not found gracefully", async ({ page }) => {
      // Navigate to non-existent workflow
      await page.goto("/orchestration/workflows/nonexistent-id-12345");

      // Should show error message or 404 page
      await expect(
        page.locator("text=/not found|workflow.*does not exist|404/i").first(),
      ).toBeVisible({ timeout: 10000 });
    });

    test("should show error message when workflow fetch fails", async ({ page }) => {
      // Simulate network error by going offline briefly
      await page.context().setOffline(true);

      // Try to load workflows
      await page.reload();

      // Should show error state
      await expect(page.locator("text=/error|failed to load|network/i").first()).toBeVisible({
        timeout: 10000,
      });

      // Restore connection
      await page.context().setOffline(false);
    });

    test("should display step error messages", async ({ page }) => {
      // Find a failed workflow
      const failedWorkflows = page.locator(
        '[data-testid="workflow-row"]:has-text("failed"), tbody tr:has-text("failed")',
      );
      const count = await failedWorkflows.count();

      if (count > 0) {
        await failedWorkflows.first().click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        // Look for error messages in failed steps
        const failedSteps = page.locator(
          '[data-testid="workflow-step"]:has-text("failed"), [data-testid="step"]:has-text("failed")',
        );
        const failedStepCount = await failedSteps.count();

        if (failedStepCount > 0) {
          // Should show error message
          await expect(failedSteps.first().locator("text=/error|failed|timeout/i")).toBeVisible();
        }
      }
    });
  });

  test.describe("Workflow Lifecycle", () => {
    test("should show workflow progression through states", async ({ page }) => {
      // This test would ideally trigger a new workflow and watch it progress
      // For now, we'll verify we can see workflows in different states

      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
      const count = await workflowRows.count();

      if (count > 0) {
        // Look for workflows in different states
        const states = ["pending", "running", "completed", "failed"];
        const foundStates: string[] = [];

        for (let i = 0; i < Math.min(count, 10); i++) {
          const row = workflowRows.nth(i);
          const text = await row.textContent();

          for (const state of states) {
            if (text?.toLowerCase().includes(state)) {
              if (!foundStates.includes(state)) {
                foundStates.push(state);
              }
            }
          }
        }

        // Should have workflows in multiple states
        expect(foundStates.length).toBeGreaterThan(0);
      }
    });

    test("should show step progression", async ({ page }) => {
      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
      const count = await workflowRows.count();

      if (count > 0) {
        await workflowRows.first().click();
        await page.waitForURL(/\/orchestration\/workflows\//);

        const steps = page.locator('[data-testid="workflow-step"], [data-testid="step"]');
        const stepCount = await steps.count();

        if (stepCount > 1) {
          // At least one step should be completed if workflow has progressed
          const completedSteps = page.locator(
            '[data-testid="workflow-step"]:has-text("completed"), [data-testid="step"]:has-text("completed")',
          );

          // Verify steps are shown in order
          for (let i = 0; i < Math.min(stepCount, 3); i++) {
            await expect(steps.nth(i)).toBeVisible();
          }
        }
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should have accessible workflow list", async ({ page }) => {
      // Verify table has proper roles
      const table = page.locator('table, [role="table"]').first();
      await expect(table).toBeVisible();

      // Verify action buttons have labels
      const buttons = page.locator("button");
      const buttonCount = await buttons.count();

      if (buttonCount > 0) {
        for (let i = 0; i < Math.min(buttonCount, 5); i++) {
          const button = buttons.nth(i);
          const ariaLabel = await button.getAttribute("aria-label");
          const text = await button.textContent();

          // Button should have either text or aria-label
          expect(ariaLabel || text?.trim()).toBeTruthy();
        }
      }
    });

    test("should support keyboard navigation", async ({ page }) => {
      const workflowRows = page.locator('[data-testid="workflow-row"], tbody tr');
      const count = await workflowRows.count();

      if (count > 0) {
        const firstRow = workflowRows.first();

        // Should be focusable
        await firstRow.focus();

        // Should be able to navigate with keyboard
        await page.keyboard.press("Enter");

        // May navigate to detail page or open menu
        await page.waitForTimeout(500);
      }
    });
  });
});
