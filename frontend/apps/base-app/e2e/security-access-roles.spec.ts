import { test, expect, Page } from "@playwright/test";

async function authenticate(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="username"]', "admin");
  await page.fill('input[name="password"]', "Admin123!@#");
  await page.click('button[type="submit"]');
  await page.waitForURL(/.*dashboard/);
}

async function openRolesPage(page: Page) {
  await authenticate(page);
  await page.click('a[href="/dashboard/security-access/roles"]');
  await page.waitForURL(/.*security-access\/roles/);
  await expect(page.locator("h1")).toContainText("Role Management");
}

test.describe("Security Access · Role assignments", () => {
  test("assign and revoke users for a role", async ({ page }) => {
    await openRolesPage(page);

    const firstRoleRow = page.locator('[data-testid="role-row"]').first();
    await expect(firstRoleRow).toBeVisible();

    await firstRoleRow.locator('[data-testid="role-actions"]').click();
    await page.click('[data-testid="role-action-assign-users"]');

    const dialog = page.locator('[data-testid="assign-role-dialog"]');
    await expect(dialog).toBeVisible();

    const availableList = dialog.locator('[data-testid="available-users-list"]');
    if ((await availableList.locator('[data-testid="available-user-row"]').count()) === 0) {
      await dialog.locator('[data-testid="assign-refresh"] button').click();
      await page.waitForTimeout(500);
    }

    const availableUsers = availableList.locator('[data-testid="available-user-row"]');
    if ((await availableUsers.count()) === 0) {
      test.skip(true, "No available users to assign in this environment");
    }

    const firstAvailable = availableUsers.first();
    const userLabel = await firstAvailable.locator("[data-testid=\"user-label\"]").textContent();
    await firstAvailable.click();

    await dialog.locator('[data-testid="assign-selected"] button").click();
    await expect(dialog.locator('.success-toast')).toContainText("Assigned");

    const assignedList = dialog.locator('[data-testid="assigned-users-list"]');
    await expect(
      assignedList.locator(`[data-testid="assigned-user-row"]:has-text("${userLabel?.trim()}")`),
    ).toBeVisible();

    await assignedList
      .locator(`[data-testid="assigned-user-row"]:has-text("${userLabel?.trim()}") [data-testid="revoke-role"]`)
      .click();

    await page.click('[data-testid="confirm-revoke-role"]');

    await expect(dialog.locator('.success-toast')).toContainText("Role revoked");
    await expect(
      assignedList.locator(`[data-testid="assigned-user-row"]:has-text("${userLabel?.trim()}")`),
    ).toHaveCount(0);

    await dialog.locator('[data-testid="assign-cancel"]').click();
  });
});

