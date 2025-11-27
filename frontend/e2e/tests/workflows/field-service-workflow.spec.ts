/**
 * E2E Tests for Field Service Management Workflows
 * Covers technician, dispatcher, and manager journeys end to end.
 */

import { test, expect } from "#e2e/fixtures";
import type { Page } from "@playwright/test";

import path from "path";

const BASE_APP_URL = process.env.ISP_OPS_URL || "http://localhost:3001";
const NAV_TIMEOUT = parseInt(process.env.E2E_NAV_TIMEOUT || "120000", 10);
const SELECTOR_TIMEOUT = parseInt(process.env.E2E_SELECTOR_TIMEOUT || "15000", 10);
const AUTH_DIR = path.resolve(__dirname, "../../.auth");
const TECH_AUTH_STATE = path.join(AUTH_DIR, "isp-technician.json");
const DISPATCHER_AUTH_STATE = path.join(AUTH_DIR, "isp-dispatcher.json");
const MANAGER_AUTH_STATE = path.join(AUTH_DIR, "isp-manager.json");
const BASE_ORIGIN = new URL(BASE_APP_URL).origin;

const dashboardUrl = (pathname: string) => `${BASE_APP_URL}${pathname}`;

async function goto(page: Page, pathname: string) {
  await page.goto(dashboardUrl(pathname), {
    waitUntil: "domcontentloaded",
    timeout: NAV_TIMEOUT,
  });
}

test.describe("Field Service Management - Complete Workflows", () => {
  // -----------------------------------------------------------------------------
  // Technician Journeys
  // -----------------------------------------------------------------------------
  test.describe("Technician Journeys", () => {
    test.use({ storageState: TECH_AUTH_STATE });

    test.beforeEach(async ({ page }) => {
      await goto(page, "/dashboard/technician");
    });

    test("technician complete day workflow: clock in → work tasks → clock out", async ({
      page,
    }) => {
      await expect(page.locator("h1")).toContainText("My Dashboard");

      const clockInButton = page.locator('button:has-text("Clock In")');
      if (await clockInButton.isVisible({ timeout: SELECTOR_TIMEOUT }).catch(() => false)) {
        await clockInButton.click();
      }

      await expect(page.locator('button:has-text("Clock Out")')).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });

      const elapsedTime = page.locator("text=/\\d{2}:\\d{2}:\\d{2}/");
      await expect(elapsedTime).toBeVisible();
      await expect(page.locator('text="Today\'s Schedule"')).toBeVisible();

      const taskCards = page.locator('[data-testid="task-card"]');
      if ((await taskCards.count()) > 0) {
        const firstTask = taskCards.first();
        const startButton = firstTask.locator('button:has-text("Start")');

        if (await startButton.isVisible().catch(() => false)) {
          await startButton.click();
          await expect(firstTask.locator('text="In Progress"')).toBeVisible({
            timeout: SELECTOR_TIMEOUT,
          });

          const navigateButton = firstTask.locator('[aria-label="Navigate"]');
          await expect(navigateButton).toBeVisible();

          await page.waitForTimeout(2000);

          const completeButton = firstTask.locator('button:has-text("Complete")');
          await expect(completeButton).toBeVisible();
          await completeButton.click();

          await expect(firstTask.locator('text="Completed"')).toBeVisible({
            timeout: SELECTOR_TIMEOUT,
          });
        }
      }

      const clockOutButton = page.locator('button:has-text("Clock Out")');
      await expect(clockOutButton).toBeVisible();
      await clockOutButton.click();
      await expect(page.locator('button:has-text("Clock In")')).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });
    });

    test("time tracking workflow: clock in → add entries → submit for approval", async ({
      page,
    }) => {
      await goto(page, "/dashboard/time-tracking");
      await expect(page.locator("h1")).toContainText("Time Tracking");

      await page.selectOption('select[name="entryType"]', "regular");
      await page.fill('textarea[name="description"]', "Fiber installation work");
      await page.locator('button:has-text("Clock In")').click();

      await expect(page.locator("text=/Clocked in at \\d+:\\d+ [AP]M/")).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });
      await expect(page.locator("text=/Location: \\d+\\.\\d+, \\d+\\.\\d+/")).toBeVisible();

      const elapsedLocator = page.locator('[data-testid="elapsed-time"]');
      const elapsed1 = await elapsedLocator.textContent();
      await page.waitForTimeout(3000);
      const elapsed2 = await elapsedLocator.textContent();
      expect(elapsed1).not.toBe(elapsed2);

      await page.fill('input[name="breakMinutes"]', "30");
      await page.locator('button:has-text("Clock Out")').click();

      const timeEntryList = page.locator('[data-testid="time-entry-list"]');
      await expect(timeEntryList.locator("text=Draft")).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });
      await timeEntryList.locator('button:has-text("Submit")').first().click();
      await expect(timeEntryList.locator("text=Submitted")).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });
    });
  });

  // -----------------------------------------------------------------------------
  // Dispatcher Journeys
  // -----------------------------------------------------------------------------
  test.describe("Dispatcher Journeys", () => {
    test.use({ storageState: DISPATCHER_AUTH_STATE });

    test.beforeEach(async ({ page }) => {
      await goto(page, "/dashboard/scheduling");
    });

    test("dispatcher workflow: create schedule → assign tasks → monitor progress", async ({
      page,
    }) => {
      await expect(page.locator("h1")).toContainText("Scheduling");
      await expect(page.locator('[data-testid="week-calendar"]')).toBeVisible();

      await page.click('button:has-text("Today")');
      await page.click('button:has-text("Quick Assign")');

      await page.fill('input[name="taskId"]', "task-12345");
      await page.fill('input[name="scheduledStart"]', "2025-11-08T09:00");
      await page.fill('input[name="scheduledEnd"]', "2025-11-08T12:00");
      await page.check('input[name="useAutoAssign"]');
      await expect(page.locator('text="AI Auto-Assignment"')).toBeVisible();

      await page.fill('input[name="taskLocationLat"]', "6.5244");
      await page.fill('input[name="taskLocationLng"]', "3.3792");
      await page.check('input[name="skill_fiber_splicing"]');

      await page.click('button:has-text("Auto Assign")');
      await expect(
        page.locator('[data-testid="assignment-list"]').locator("text=Scheduled"),
      ).toBeVisible({
        timeout: NAV_TIMEOUT,
      });
      await expect(page.locator("text=/Score: \\d+%/")).toBeVisible();

      const viewCandidatesButton = page.locator('button:has-text("View Candidates")');
      if (await viewCandidatesButton.isVisible().catch(() => false)) {
        await viewCandidatesButton.click();
        await expect(page.locator('[data-testid="candidate-list"]')).toBeVisible();
        await expect(page.locator('text="Skill Match"')).toBeVisible();
        await expect(page.locator('text="Location Score"')).toBeVisible();
      }

      const assignmentCard = page.locator('[data-testid="assignment-card"]').first();
      await expect(assignmentCard.locator('text="Scheduled"')).toBeVisible();

      await assignmentCard.locator('button:has-text("Reschedule")').click();
      await page.fill('input[name="newScheduledStart"]', "2025-11-08T10:00");
      await page.fill('input[name="newScheduledEnd"]', "2025-11-08T13:00");
      await page.fill('textarea[name="rescheduleReason"]', "Customer requested later time");
      await page.click('button:has-text("Confirm Reschedule")');

      await expect(page.locator("text=/10:00 AM - 1:00 PM/")).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });
    });
  });

  // -----------------------------------------------------------------------------
  // Resource Management (Manager)
  // -----------------------------------------------------------------------------
  test.describe("Resource Management Journeys", () => {
    test.use({ storageState: MANAGER_AUTH_STATE });

    test("resource management workflow: assign equipment → assign vehicle → track usage", async ({
      page,
    }) => {
      await goto(page, "/dashboard/resources");
      await expect(page.locator("h1")).toContainText("Resources");

      await page.click('button[role="tab"]:has-text("Equipment")');
      const equipmentList = page.locator('[data-testid="equipment-list"]');
      await expect(equipmentList).toBeVisible();

      const availableEquipment = equipmentList
        .locator('[data-testid="equipment-card"]')
        .filter({ hasText: "Available" })
        .first();

      if (await availableEquipment.isVisible().catch(() => false)) {
        await availableEquipment.locator('button:has-text("Assign")').click();
        await page.selectOption('select[name="technicianId"]', { index: 1 });
        await page.fill('input[name="expectedReturn"]', "2025-11-08T18:00");
        await page.fill('textarea[name="notes"]', "For fiber installation project");
        await page.click('button:has-text("Confirm Assignment")');
        await expect(availableEquipment.locator('text="In Use"')).toBeVisible({
          timeout: SELECTOR_TIMEOUT,
        });
      }

      const maintenanceAlert = page.locator('[data-testid="maintenance-alert"]');
      if (await maintenanceAlert.isVisible().catch(() => false)) {
        await expect(maintenanceAlert).toContainText("Maintenance Due");
      }

      await page.click('button[role="tab"]:has-text("Vehicles")');
      const vehicleList = page.locator('[data-testid="vehicle-list"]');
      await expect(vehicleList).toBeVisible();

      const availableVehicle = vehicleList
        .locator('[data-testid="vehicle-card"]')
        .filter({ hasText: "Available" })
        .first();

      if (await availableVehicle.isVisible().catch(() => false)) {
        await availableVehicle.locator('button:has-text("Assign")').click();
        await page.selectOption('select[name="technicianId"]', { index: 1 });
        await page.fill('input[name="expectedReturn"]', "2025-11-08T18:00");
        await page.click('button:has-text("Confirm Assignment")');
        await expect(availableVehicle.locator('text="In Use"')).toBeVisible({
          timeout: SELECTOR_TIMEOUT,
        });
      }

      await expect(page.locator("text=/Total: \\d+/")).toBeVisible();
      await expect(page.locator("text=/Available: \\d+/")).toBeVisible();
      await expect(page.locator("text=/In Use: \\d+/")).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------------
  // End-to-End Orchestration (multi-role)
  // -----------------------------------------------------------------------------
  test("complete service call workflow: dispatch → travel → work → complete → clock out", async ({
    browser,
  }) => {
    // Dispatcher creates assignment
    const dispatcherContext = await browser.newContext({ storageState: DISPATCHER_AUTH_STATE });
    const dispatcherPage = await dispatcherContext.newPage();
    await dispatcherPage.goto(dashboardUrl("/dashboard/scheduling"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await dispatcherPage.click('button:has-text("Quick Assign")');
    await dispatcherPage.fill('input[name="taskId"]', "task-67890");
    await dispatcherPage.selectOption('select[name="technicianId"]', { index: 1 });
    await dispatcherPage.fill('input[name="scheduledStart"]', "2025-11-08T09:00");
    await dispatcherPage.fill('input[name="scheduledEnd"]', "2025-11-08T12:00");
    await dispatcherPage.click('button:has-text("Create Assignment")');
    await expect(dispatcherPage.locator('text="Assignment created"')).toBeVisible({
      timeout: NAV_TIMEOUT,
    });
    await dispatcherContext.close();

    // Technician executes assignment
    const technicianContext = await browser.newContext({ storageState: TECH_AUTH_STATE });
    const technicianPage = await technicianContext.newPage();
    await technicianPage.goto(dashboardUrl("/dashboard/technician"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    await technicianPage.click('button:has-text("Clock In")');
    await expect(technicianPage.locator('button:has-text("Clock Out")')).toBeVisible({
      timeout: SELECTOR_TIMEOUT,
    });

    const taskCard = technicianPage.locator('[data-testid="task-card"]').first();
    await expect(taskCard).toBeVisible();
    await taskCard.locator('button:has-text("Start")').click();
    await expect(taskCard.locator('text="In Progress"')).toBeVisible();

    const navButton = taskCard.locator('[aria-label="Navigate"]');
    await expect(navButton).toBeEnabled();

    await technicianPage.waitForTimeout(3000);
    await taskCard.locator('button:has-text("Complete")').click();
    await expect(taskCard.locator('text="Completed"')).toBeVisible({
      timeout: SELECTOR_TIMEOUT,
    });

    await technicianPage.goto(dashboardUrl("/dashboard/time-tracking"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    const timeEntryList = technicianPage.locator('[data-testid="time-entry-list"]');
    await expect(timeEntryList.locator("text=Draft")).toBeVisible();
    await timeEntryList.locator('button:has-text("Submit")').first().click();
    await expect(timeEntryList.locator("text=Submitted")).toBeVisible({
      timeout: SELECTOR_TIMEOUT,
    });
    await technicianContext.close();

    // Manager approves
    const managerContext = await browser.newContext({ storageState: MANAGER_AUTH_STATE });
    const managerPage = await managerContext.newPage();
    await managerPage.goto(dashboardUrl("/dashboard/time-tracking"), {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    const submittedEntry = managerPage
      .locator('[data-testid="time-entry-list"]')
      .locator("text=Submitted")
      .first();
    await submittedEntry.locator('button:has-text("Approve")').click();
    await expect(
      managerPage.locator('[data-testid="time-entry-list"]').locator("text=Approved"),
    ).toBeVisible({ timeout: SELECTOR_TIMEOUT });
    await managerContext.close();
  });

  // -----------------------------------------------------------------------------
  // Resilience & Edge Cases
  // -----------------------------------------------------------------------------
  test.describe("Resilience & Edge Cases", () => {
    test.use({ storageState: TECH_AUTH_STATE });

    test("handles offline scenario gracefully", async ({ page }) => {
      await goto(page, "/dashboard/technician");
      await page.click('button:has-text("Clock In")');
      await expect(page.locator('button:has-text("Clock Out")')).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });

      const ctx = page.context();
      await ctx.setOffline(true);
      await page.click('button:has-text("Clock Out")');
      await expect(page.locator("text=/Error|Failed|Retry|Offline/")).toBeVisible({
        timeout: SELECTOR_TIMEOUT,
      });

      await ctx.setOffline(false);
      const retryButton = page.locator('button:has-text("Retry")');
      if (await retryButton.isVisible().catch(() => false)) {
        await retryButton.click();
      }

      await expect(page.locator('button:has-text("Clock In")')).toBeVisible({
        timeout: NAV_TIMEOUT,
      });
    });

    test("handles GPS permission denial", async ({ page }) => {
      await goto(page, "/dashboard/time-tracking");
      await page.context().grantPermissions([], { origin: BASE_ORIGIN });

      await page.click('button:has-text("Clock In")');
      const result = await Promise.race([
        page.locator('button:has-text("Clock Out")').isVisible({ timeout: SELECTOR_TIMEOUT }),
        page.locator("text=/GPS|Location|Permission/").isVisible({ timeout: SELECTOR_TIMEOUT }),
      ]);

      expect(result).toBeTruthy();
    });
  });
});
