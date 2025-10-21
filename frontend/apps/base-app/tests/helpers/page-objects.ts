/**
 * Page Object Models
 *
 * Encapsulate page interactions for cleaner, more maintainable tests.
 */

import { Page, Locator } from "@playwright/test";

// ==================== Base Page Object ====================

export class BasePage {
  constructor(protected page: Page) {}

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  async waitForLoad(): Promise<void> {
    await this.page.waitForLoadState("networkidle");
  }

  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  async screenshot(name: string): Promise<void> {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }
}

// ==================== Login Page ====================

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
  }

  async navigate(): Promise<void> {
    await this.goto("/login");
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async expectError(message: string): Promise<void> {
    await this.page.waitForSelector(`text=${message}`);
  }
}

// ==================== WireGuard Pages ====================

export class WireGuardDashboard extends BasePage {
  readonly totalServersCard: Locator;
  readonly activePeersCard: Locator;
  readonly createServerButton: Locator;
  readonly createPeerButton: Locator;

  constructor(page: Page) {
    super(page);
    this.totalServersCard = page.locator('[data-testid="total-servers"]');
    this.activePeersCard = page.locator('[data-testid="active-peers"]');
    this.createServerButton = page.locator('a[href="/dashboard/network/wireguard/servers/new"]');
    this.createPeerButton = page.locator('a[href="/dashboard/network/wireguard/peers/new"]');
  }

  async navigate(): Promise<void> {
    await this.goto("/dashboard/network/wireguard");
  }

  async getTotalServers(): Promise<string> {
    return (await this.totalServersCard.textContent()) || "0";
  }

  async getActivePeers(): Promise<string> {
    return (await this.activePeersCard.textContent()) || "0";
  }
}

export class ServerListPage extends BasePage {
  readonly searchInput: Locator;
  readonly statusFilter: Locator;
  readonly serverCards: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.statusFilter = page.locator('[data-testid="status-filter"]');
    this.serverCards = page.locator('[data-testid="server-card"]');
    this.createButton = page.locator('a[href="/dashboard/network/wireguard/servers/new"]');
  }

  async navigate(): Promise<void> {
    await this.goto("/dashboard/network/wireguard/servers");
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async filterByStatus(status: string): Promise<void> {
    await this.statusFilter.click();
    await this.page.click(`text=${status}`);
  }

  async getServerCount(): Promise<number> {
    return await this.serverCards.count();
  }

  async clickServer(name: string): Promise<void> {
    await this.page.click(`[data-testid="server-card"]:has-text("${name}")`);
  }
}

export class ServerCreatePage extends BasePage {
  readonly nameInput: Locator;
  readonly locationInput: Locator;
  readonly endpointInput: Locator;
  readonly listenPortInput: Locator;
  readonly subnetInput: Locator;
  readonly dnsServersInput: Locator;
  readonly maxPeersInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.locator('input[name="name"]');
    this.locationInput = page.locator('input[name="location"]');
    this.endpointInput = page.locator('input[name="endpoint"]');
    this.listenPortInput = page.locator('input[name="listen_port"]');
    this.subnetInput = page.locator('input[name="subnet"]');
    this.dnsServersInput = page.locator('input[name="dns_servers"]');
    this.maxPeersInput = page.locator('input[name="max_peers"]');
    this.submitButton = page.locator('button[type="submit"]');
    this.cancelButton = page.locator('button:has-text("Cancel")');
  }

  async navigate(): Promise<void> {
    await this.goto("/dashboard/network/wireguard/servers/new");
  }

  async fillForm(data: {
    name: string;
    location: string;
    endpoint: string;
    listenPort?: number;
    subnet: string;
    dnsServers?: string;
    maxPeers?: number;
  }): Promise<void> {
    await this.nameInput.fill(data.name);
    await this.locationInput.fill(data.location);
    await this.endpointInput.fill(data.endpoint);
    if (data.listenPort) await this.listenPortInput.fill(data.listenPort.toString());
    await this.subnetInput.fill(data.subnet);
    if (data.dnsServers) await this.dnsServersInput.fill(data.dnsServers);
    if (data.maxPeers) await this.maxPeersInput.fill(data.maxPeers.toString());
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }

  async cancel(): Promise<void> {
    await this.cancelButton.click();
  }

  async expectValidationError(field: string, message: string): Promise<void> {
    await this.page.waitForSelector(`text=${message}`);
  }
}

export class ServerDetailsPage extends BasePage {
  readonly serverName: Locator;
  readonly statusBadge: Locator;
  readonly editButton: Locator;
  readonly deleteButton: Locator;
  readonly peersList: Locator;

  constructor(page: Page) {
    super(page);
    this.serverName = page.locator("h1");
    this.statusBadge = page.locator('[data-testid="status-badge"]');
    this.editButton = page.locator('a:has-text("Edit")');
    this.deleteButton = page.locator('button[data-testid="delete-button"]');
    this.peersList = page.locator('[data-testid="peer-row"]');
  }

  async navigate(serverId: string): Promise<void> {
    await this.goto(`/dashboard/network/wireguard/servers/${serverId}`);
  }

  async getServerName(): Promise<string> {
    return (await this.serverName.textContent()) || "";
  }

  async getStatus(): Promise<string> {
    return (await this.statusBadge.textContent()) || "";
  }

  async edit(): Promise<void> {
    await this.editButton.click();
  }

  async delete(): Promise<void> {
    await this.deleteButton.click();
  }

  async getPeerCount(): Promise<number> {
    return await this.peersList.count();
  }
}

// ==================== Peer Pages ====================

export class PeerListPage extends BasePage {
  readonly searchInput: Locator;
  readonly serverFilter: Locator;
  readonly statusFilter: Locator;
  readonly peerCards: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.serverFilter = page.locator('[data-testid="server-filter"]');
    this.statusFilter = page.locator('[data-testid="status-filter"]');
    this.peerCards = page.locator('[data-testid="peer-card"]');
    this.createButton = page.locator('a[href="/dashboard/network/wireguard/peers/new"]');
  }

  async navigate(): Promise<void> {
    await this.goto("/dashboard/network/wireguard/peers");
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async getPeerCount(): Promise<number> {
    return await this.peerCards.count();
  }
}

export class PeerCreatePage extends BasePage {
  readonly serverSelect: Locator;
  readonly peerNameInput: Locator;
  readonly allowedIpsInput: Locator;
  readonly keepaliveInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    super(page);
    this.serverSelect = page.locator('[name="server_id"]');
    this.peerNameInput = page.locator('[name="peer_name"]');
    this.allowedIpsInput = page.locator('[name="allowed_ips"]');
    this.keepaliveInput = page.locator('[name="persistent_keepalive"]');
    this.submitButton = page.locator('button[type="submit"]');
  }

  async navigate(): Promise<void> {
    await this.goto("/dashboard/network/wireguard/peers/new");
  }

  async fillForm(data: {
    serverId: string;
    peerName: string;
    allowedIps?: string;
    keepalive?: number;
  }): Promise<void> {
    await this.serverSelect.click();
    await this.page.click(`[data-server-id="${data.serverId}"]`);
    await this.peerNameInput.fill(data.peerName);
    if (data.allowedIps) await this.allowedIpsInput.fill(data.allowedIps);
    if (data.keepalive) await this.keepaliveInput.fill(data.keepalive.toString());
  }

  async submit(): Promise<void> {
    await this.submitButton.click();
  }
}

// ==================== Communications Pages ====================

export class CommunicationsDashboard extends BasePage {
  readonly totalSentCard: Locator;
  readonly deliveredCard: Locator;
  readonly smtpStatus: Locator;
  readonly sendEmailButton: Locator;

  constructor(page: Page) {
    super(page);
    this.totalSentCard = page.locator('[data-testid="total-sent"]');
    this.deliveredCard = page.locator('[data-testid="total-delivered"]');
    this.smtpStatus = page.locator('[data-testid="smtp-status"]');
    this.sendEmailButton = page.locator('a[href="/dashboard/communications/send"]');
  }

  async navigate(): Promise<void> {
    await this.goto("/dashboard/communications");
  }

  async getTotalSent(): Promise<string> {
    return (await this.totalSentCard.textContent()) || "0";
  }

  async getSMTPStatus(): Promise<string> {
    return (await this.smtpStatus.textContent()) || "";
  }
}

export class EmailComposerPage extends BasePage {
  readonly toInput: Locator;
  readonly subjectInput: Locator;
  readonly bodyTextarea: Locator;
  readonly useTemplateCheckbox: Locator;
  readonly templateSelect: Locator;
  readonly submitButton: Locator;
  readonly previewButton: Locator;

  constructor(page: Page) {
    super(page);
    this.toInput = page.locator('input[name="to"]');
    this.subjectInput = page.locator('input[name="subject"]');
    this.bodyTextarea = page.locator('textarea[name="body_text"]');
    this.useTemplateCheckbox = page.locator('input[name="use_template"]');
    this.templateSelect = page.locator('select[name="template_id"]');
    this.submitButton = page.locator('button:has-text("Send Now")');
    this.previewButton = page.locator('button:has-text("Preview")');
  }

  async navigate(): Promise<void> {
    await this.goto("/dashboard/communications/send");
  }

  async composeEmail(data: { to: string; subject: string; body: string }): Promise<void> {
    await this.toInput.fill(data.to);
    await this.subjectInput.fill(data.subject);
    await this.bodyTextarea.fill(data.body);
  }

  async send(): Promise<void> {
    await this.submitButton.click();
  }

  async preview(): Promise<void> {
    await this.previewButton.click();
  }
}

export class TemplateListPage extends BasePage {
  readonly searchInput: Locator;
  readonly channelFilter: Locator;
  readonly templateCards: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    super(page);
    this.searchInput = page.locator('[data-testid="search-input"]');
    this.channelFilter = page.locator('[data-testid="channel-filter"]');
    this.templateCards = page.locator('[data-testid="template-card"]');
    this.createButton = page.locator('a[href="/dashboard/communications/templates/new"]');
  }

  async navigate(): Promise<void> {
    await this.goto("/dashboard/communications/templates");
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async getTemplateCount(): Promise<number> {
    return await this.templateCards.count();
  }
}

// ==================== Real-Time Components ====================

export class ConnectionStatusIndicator {
  readonly indicator: Locator;
  readonly expandedPanel: Locator;

  constructor(private page: Page) {
    this.indicator = page.locator('[data-testid="connection-indicator"]');
    this.expandedPanel = page.locator('[data-testid="connection-panel"]');
  }

  async click(): Promise<void> {
    await this.indicator.click();
  }

  async isConnected(): Promise<boolean> {
    const status = await this.indicator.getAttribute("data-status");
    return status === "connected";
  }

  async getConnectionStatus(stream: string): Promise<string> {
    await this.click();
    const statusElement = this.page.locator(`[data-stream="${stream}"] [data-status]`);
    return (await statusElement.getAttribute("data-status")) || "unknown";
  }
}
