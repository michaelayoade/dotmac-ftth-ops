import { Page, Locator } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly welcomeMessage: Locator;
  readonly userMenu: Locator;
  readonly mfaEnabledBadge: Locator;
  readonly backupCodeUsedAlert: Locator;
  readonly welcomeWidget: Locator;
  readonly statsWidget: Locator;
  readonly recentActivityWidget: Locator;
  readonly quickActionsWidget: Locator;

  // Navigation elements
  readonly userManagementLink: Locator;
  readonly featureFlagsLink: Locator;
  readonly monitoringLink: Locator;
  readonly settingsLink: Locator;
  readonly auditTrailLink: Locator;
  readonly profileLink: Locator;
  readonly filesLink: Locator;
  readonly logoutButton: Locator;

  // Notification center
  readonly notificationBell: Locator;
  readonly notificationBadge: Locator;
  readonly notificationCenter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeMessage = page.locator('.welcome, h1:has-text("Welcome"), [data-testid="welcome"]');
    this.userMenu = page.locator('.user-menu, .profile-dropdown, [data-testid="user-menu"]');
    this.mfaEnabledBadge = page.locator(
      '.mfa-enabled, :text("MFA Enabled"), [data-testid="mfa-badge"]',
    );
    this.backupCodeUsedAlert = page.locator(
      '.backup-code-alert, :text("backup code"), [data-testid="backup-alert"]',
    );

    // Widgets
    this.welcomeWidget = page.locator('[data-testid="welcome-widget"], .welcome-widget');
    this.statsWidget = page.locator('[data-testid="stats-widget"], .stats-widget');
    this.recentActivityWidget = page.locator(
      '[data-testid="recent-activity-widget"], .activity-widget',
    );
    this.quickActionsWidget = page.locator('[data-testid="quick-actions-widget"], .actions-widget');

    // Navigation
    this.userManagementLink = page.locator(
      'a[href*="users"], a:has-text("Users"), nav a:has-text("User Management")',
    );
    this.featureFlagsLink = page.locator(
      'a[href*="feature"], a:has-text("Feature Flags"), nav a:has-text("Features")',
    );
    this.monitoringLink = page.locator(
      'a[href*="monitor"], a:has-text("Monitoring"), nav a:has-text("System")',
    );
    this.settingsLink = page.locator(
      'a[href*="settings"], a:has-text("Settings"), nav a:has-text("Admin Settings")',
    );
    this.auditTrailLink = page.locator(
      'a[href*="audit"], a:has-text("Audit"), nav a:has-text("Audit Trail")',
    );
    this.profileLink = page.locator(
      'a[href*="profile"], a:has-text("Profile"), .user-menu a:has-text("Profile")',
    );
    this.filesLink = page.locator('a[href*="files"], a:has-text("Files"), nav a:has-text("Files")');
    this.logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Sign out"), a:has-text("Logout")',
    );

    // Notifications
    this.notificationBell = page.locator(
      '.notification-bell, [data-testid="notifications"], .bell-icon',
    );
    this.notificationBadge = page.locator(
      '[data-testid="notification-badge"], .notification-count',
    );
    this.notificationCenter = page.locator(".notification-center, .notifications-panel");
  }

  async navigateToUserManagement(): Promise<void> {
    await this.userManagementLink.click();
  }

  async navigateToFeatureFlags(): Promise<void> {
    await this.featureFlagsLink.click();
  }

  async navigateToMonitoring(): Promise<void> {
    await this.monitoringLink.click();
  }

  async navigateToSettings(): Promise<void> {
    await this.settingsLink.click();
  }

  async navigateToAuditTrail(): Promise<void> {
    await this.auditTrailLink.click();
  }

  async navigateToProfile(): Promise<void> {
    await this.profileLink.click();
  }

  async navigateToFiles(): Promise<void> {
    await this.filesLink.click();
  }

  async navigateToDashboard(): Promise<void> {
    await this.page.goto("/dashboard");
  }

  async logout(): Promise<void> {
    // Open user menu if it's a dropdown
    if (await this.userMenu.isVisible()) {
      await this.userMenu.click();
    }
    await this.logoutButton.click();
  }

  async openNotificationCenter(): Promise<void> {
    await this.notificationBell.click();
  }

  async getNotificationCount(): Promise<number> {
    const text = await this.notificationBadge.textContent();
    return parseInt(text?.trim() || "0", 10);
  }

  async performGlobalSearch(query: string): Promise<void> {
    const searchInput = this.page.locator(
      'input[type="search"], input[placeholder*="Search"], [data-testid="global-search"]',
    );
    await searchInput.fill(query);
    await searchInput.press("Enter");
  }

  async quickUploadFile(): Promise<void> {
    const uploadButton = this.quickActionsWidget.locator(
      'button:has-text("Upload"), a:has-text("Upload")',
    );
    await uploadButton.click();
  }

  async viewDetailedAnalytics(): Promise<void> {
    const analyticsLink = this.statsWidget.locator(
      'a:has-text("View all"), a:has-text("Analytics"), button:has-text("Details")',
    );
    await analyticsLink.click();
  }

  async customizeDashboard(): Promise<void> {
    const customizeButton = this.page.locator(
      'button:has-text("Customize"), [data-testid="customize-dashboard"]',
    );
    await customizeButton.click();
  }

  async getWelcomeText(): Promise<string> {
    return (await this.welcomeMessage.textContent()) || "";
  }

  async getUserDisplayName(): Promise<string> {
    return (await this.userMenu.textContent()) || "";
  }

  async waitForDashboardLoad(): Promise<void> {
    await this.welcomeWidget.waitFor({ state: "visible" });
  }

  async isNotificationBadgeVisible(): Promise<boolean> {
    return await this.notificationBadge.isVisible();
  }
}
