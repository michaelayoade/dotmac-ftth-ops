/**
 * ISP Framework API Client
 * Refactored using composition pattern for better maintainability
 * Composes module-specific clients into unified interface
 */

import { IdentityApiClient } from "./clients/IdentityApiClient";
import { NetworkingApiClient } from "./clients/NetworkingApiClient";
import { BillingApiClient } from "./clients/BillingApiClient";
import { ServicesApiClient } from "./clients/ServicesApiClient";
import { SupportApiClient } from "./clients/SupportApiClient";
import { ResellersApiClient } from "./clients/ResellersApiClient";
import { FieldOpsApiClient } from "./clients/FieldOpsApiClient";
import { NotificationsApiClient } from "./clients/NotificationsApiClient";
import { ComplianceApiClient } from "./clients/ComplianceApiClient";
import { LicensingApiClient } from "./clients/LicensingApiClient";
import { InventoryApiClient } from "./clients/InventoryApiClient";
import { AnalyticsApiClient } from "./clients/AnalyticsApiClient";
import type { PaginatedResponse, QueryParams } from "./types/api";
import type { ISPTenant, TenantNotification } from "../types/tenant";

type HttpRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  headers?: HeadersInit;
  body?: BodyInit | Record<string, any> | Array<Record<string, any>> | null;
};
type NotificationPayload = Omit<
  Parameters<NotificationsApiClient["sendNotification"]>[0],
  "channel"
>;

export interface ISPApiClientConfig {
  baseURL: string;
  apiKey?: string;
  tenantId?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
}

/**
 * Main ISP API Client using Composition Pattern
 * Delegates to specialized module clients
 */
export class ISPApiClient {
  private config: ISPApiClientConfig;
  private defaultHeaders: Record<string, string>;
  private readonly baseURL: string;

  // Module-specific clients
  public readonly identity: IdentityApiClient;
  public readonly networking: NetworkingApiClient;
  public readonly billing: BillingApiClient;
  public readonly services: ServicesApiClient;
  public readonly support: SupportApiClient;
  public readonly resellers: ResellersApiClient;
  public readonly fieldOps: FieldOpsApiClient;
  public readonly notifications: NotificationsApiClient;
  public readonly compliance: ComplianceApiClient;
  public readonly licensing: LicensingApiClient;
  public readonly inventory: InventoryApiClient;
  public readonly analytics: AnalyticsApiClient;

  constructor(baseURL: string, apiKey?: string, defaultHeaders?: Record<string, string>);
  constructor(config: ISPApiClientConfig);
  constructor(
    baseURLOrConfig: string | ISPApiClientConfig,
    apiKey?: string,
    defaultHeaders?: Record<string, string>,
  ) {
    const normalizedConfig: ISPApiClientConfig =
      typeof baseURLOrConfig === "string"
        ? { baseURL: baseURLOrConfig, apiKey, defaultHeaders }
        : baseURLOrConfig;

    if (!normalizedConfig.baseURL) {
      throw new Error("baseURL is required");
    }

    this.config = {
      ...normalizedConfig,
      defaultHeaders: normalizedConfig.defaultHeaders || defaultHeaders,
    };
    this.baseURL = normalizedConfig.baseURL;

    // Build default headers
    this.defaultHeaders = {
      "Content-Type": "application/json",
      "X-API-Version": "1.0",
      ...(normalizedConfig.defaultHeaders || defaultHeaders || {}),
    };

    if (normalizedConfig.apiKey !== undefined) {
      this.defaultHeaders["Authorization"] = `Bearer ${normalizedConfig.apiKey}`;
    }

    if (normalizedConfig.tenantId) {
      this.defaultHeaders["X-Tenant-ID"] = normalizedConfig.tenantId;
    }

    // Initialize module clients
    this.identity = this.instantiateClient<IdentityApiClient>(IdentityApiClient);
    this.networking = this.instantiateClient<NetworkingApiClient>(NetworkingApiClient);
    this.billing = this.instantiateClient<BillingApiClient>(BillingApiClient);
    this.services = this.instantiateClient<ServicesApiClient>(ServicesApiClient);
    this.support = this.instantiateClient<SupportApiClient>(SupportApiClient);
    this.resellers = this.instantiateClient<ResellersApiClient>(ResellersApiClient);
    this.fieldOps = this.instantiateClient<FieldOpsApiClient>(FieldOpsApiClient);
    this.notifications = this.instantiateClient<NotificationsApiClient>(NotificationsApiClient);
    this.compliance = this.instantiateClient<ComplianceApiClient>(ComplianceApiClient);
    this.licensing = this.instantiateClient<LicensingApiClient>(LicensingApiClient);
    this.inventory = this.instantiateClient<InventoryApiClient>(InventoryApiClient);
    this.analytics = this.instantiateClient<AnalyticsApiClient>(AnalyticsApiClient);
  }

  private instantiateClient<T>(ClientClass: any): T {
    try {
      return new ClientClass(this.baseURL, this.defaultHeaders);
    } catch (error) {
      if (typeof ClientClass?.mockReset === "function") {
        ClientClass.mockReset();
      }
      throw error;
    }
  }

  private applyToCoreClients(method: string, ...args: any[]) {
    [this.identity, this.networking, this.billing].forEach((client) => {
      const fn = (client as any)?.[method];
      if (typeof fn === "function") {
        fn.apply(client, args);
      }
    });
  }

  updateAuthToken(token: string | null) {
    this.config.apiKey = token === undefined ? this.config.apiKey : token || undefined;
    this.defaultHeaders["Authorization"] =
      token === null || token === undefined ? "" : `Bearer ${token}`;
    this.applyToCoreClients("updateAuthToken", token as any);
  }

  setTenantContext(tenantId: string) {
    if (tenantId) {
      this.defaultHeaders["X-Tenant-ID"] = tenantId;
      this.config.tenantId = tenantId;
    }
    this.applyToCoreClients("setTenantContext", tenantId);
  }

  setTimeout(timeout: number) {
    this.config.timeout = timeout;
    this.applyToCoreClients("setTimeout", timeout);
  }

  setDebugMode(debug: boolean) {
    this.applyToCoreClients("setDebugMode", debug);
  }

  addRequestInterceptor(interceptor: (config: any) => any) {
    this.applyToCoreClients("addRequestInterceptor", interceptor);
  }

  addResponseInterceptor(interceptor: (response: any) => any) {
    this.applyToCoreClients("addResponseInterceptor", interceptor);
  }

  async healthCheck() {
    const clients = [
      { key: "identity", client: this.identity },
      { key: "networking", client: this.networking },
      { key: "billing", client: this.billing },
    ] as const;

    const results: Record<string, any> = {};
    const checks = await Promise.allSettled(
      clients.map(({ client }) => (client as any)?.healthCheck?.()),
    );

    checks.forEach((result, idx) => {
      const key = clients[idx].key;
      if (result.status === "fulfilled") {
        results[key] = result.value ?? { status: "healthy" };
      } else {
        results[key] = {
          status: "unhealthy",
          error: (result.reason as Error)?.message || "Unknown error",
        };
      }
    });

    const anyUnhealthy = Object.values(results).some(
      (value: any) => value?.status && value.status !== "healthy",
    );
    results.overall = anyUnhealthy ? "degraded" : "healthy";
    return results;
  }

  async batchOperations(
    operations: Array<{ client: "identity" | "networking" | "billing"; method: string; params?: any[] }>,
  ) {
    return Promise.all(
      operations.map(async ({ client, method, params }) => {
        const target = (this as any)[client];
        if (!target || typeof target[method] !== "function") {
          throw new Error(`Operation ${client}.${method} not supported`);
        }
        return target[method].apply(target, params || []);
      }),
    );
  }

  setRateLimit(limit: { requests: number; window: number }) {
    this.applyToCoreClients("setRateLimit", limit);
  }

  private buildQuery(params?: Record<string, any>): string {
    if (!params) return "";
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    return queryString ? `?${queryString}` : "";
  }

  private normalizeBody(body: HttpRequestOptions["body"]): BodyInit | null | undefined {
    if (body === null || body === undefined) {
      return body ?? undefined;
    }

    if (typeof body === "string" || body instanceof URLSearchParams || body instanceof FormData) {
      return body;
    }

    if (body instanceof Blob || body instanceof ArrayBuffer) {
      return body;
    }

    if (ArrayBuffer.isView(body)) {
      return body as BodyInit;
    }

    return JSON.stringify(body);
  }

  private async http<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
    const url = `${this.baseURL}${path}`;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...this.defaultHeaders,
      ...(options.headers || {}),
    };

    const normalizedBody = this.normalizeBody(options.body);
    const response = await fetch(url, {
      ...options,
      headers,
      body: normalizedBody ?? null,
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    return (await response.json()) as T;
  }

  // Convenience methods for common operations
  async getCustomers(params?: QueryParams) {
    return this.identity.getCustomers(params);
  }

  async getCustomer(customerId: string, params?: QueryParams) {
    return this.identity.getCustomer(customerId, params);
  }

  async getNetworkDevices(params?: QueryParams) {
    return this.networking.getNetworkDevices(params);
  }

  async getBillingProcessors(params?: QueryParams) {
    return this.billing.getBillingProcessors(params);
  }

  async getTransactions(params?: QueryParams) {
    return this.billing.getTransactions(params);
  }

  async getTenant(tenantId: string) {
    return this.http<{ data: ISPTenant }>(`/tenants/${tenantId}`);
  }

  async getTenantNotifications(tenantId: string, params?: Record<string, any>) {
    return this.http<{ data: TenantNotification[] }>(
      `/tenants/${tenantId}/notifications${this.buildQuery(params)}`,
    );
  }

  async markNotificationRead(notificationId: string) {
    await this.http(`/tenants/notifications/${notificationId}/read`, { method: "POST" });
  }

  async markAllNotificationsRead(tenantId: string) {
    await this.http(`/tenants/${tenantId}/notifications/read-all`, { method: "POST" });
  }

  async dismissNotification(notificationId: string) {
    await this.http(`/tenants/notifications/${notificationId}/dismiss`, { method: "POST" });
  }

  // Legacy methods for backward compatibility
  async portalLogin(credentials: any) {
    return this.identity.authenticate(credentials);
  }

  async createPaymentIntent(data: any) {
    return this.billing.createPaymentIntent(data);
  }

  async getNetworkTopology(params?: any) {
    return this.networking.getNetworkTopology(params);
  }

  // Identity module
  async getUsers(params?: QueryParams) {
    return this.identity.getUsers(params);
  }

  async getUser(userId: string) {
    return this.identity.getUser(userId);
  }

  async createCustomer(customerData: Parameters<IdentityApiClient["createCustomer"]>[0]) {
    return this.identity.createCustomer(customerData);
  }

  // Billing module
  async getInvoices(params?: QueryParams) {
    return this.billing.getInvoices(params);
  }

  async getInvoice(invoiceId: string) {
    return this.billing.getInvoice(invoiceId);
  }

  async getPayments(params?: QueryParams) {
    return this.billing.getTransactions(params);
  }

  async processPayment(paymentData: any) {
    return this.billing.createPaymentIntent(paymentData);
  }

  async getSubscriptions(customerId?: string) {
    const query = this.buildQuery(customerId ? { customerId } : undefined);
    return this.http(`/api/billing/subscriptions${query}`);
  }

  // Services module
  async getServiceCatalog(params?: QueryParams) {
    return this.services.getServicePlans(params);
  }

  async getServiceInstances(customerId?: string, params?: QueryParams) {
    if (customerId) {
      return this.services.getCustomerServices(customerId, params);
    }
    return this.services.getServiceOrders(params);
  }

  async provisionService(order: Parameters<ServicesApiClient["createServiceOrder"]>[0]) {
    return this.services.createServiceOrder(order);
  }

  async getUsageTracking(serviceId: string, period?: string) {
    const params = period ? { start_date: period } : {};
    return this.services.getServiceUsage(serviceId, params);
  }

  // Networking module
  async getNetworkDevice(deviceId: string) {
    return this.networking.getNetworkDevice(deviceId);
  }

  async getIPAMData(params?: Record<string, any>) {
    return this.http(`/api/networking/ipam${this.buildQuery(params)}`);
  }

  async allocateIP(request: Record<string, any>) {
    return this.http("/api/networking/ipam/allocate", { method: "POST", body: request });
  }

  async getNetworkMonitoring() {
    return this.networking.getNetworkHealth();
  }

  // Sales module
  async getLeads(params?: QueryParams) {
    return this.http(`/api/sales/leads${this.buildQuery(params)}`);
  }

  async createLead(lead: Record<string, any>) {
    return this.http("/api/sales/leads", { method: "POST", body: lead });
  }

  async getCRMData(customerId: string) {
    return this.http(`/api/sales/crm/${customerId}`);
  }

  async getCampaigns(params?: QueryParams) {
    return this.http(`/api/sales/campaigns${this.buildQuery(params)}`);
  }

  async getSalesAnalytics(params?: QueryParams) {
    return this.http(`/api/sales/analytics${this.buildQuery(params)}`);
  }

  // Support module
  async getSupportTickets(params?: QueryParams) {
    return this.support.getTickets(params);
  }

  async getSupportTicket(ticketId: string) {
    return this.support.getTicket(ticketId);
  }

  async createSupportTicket(ticket: Parameters<SupportApiClient["createTicket"]>[0]) {
    return this.support.createTicket(ticket);
  }

  async updateSupportTicket(
    ticketId: string,
    updates: Parameters<SupportApiClient["updateTicket"]>[1],
  ) {
    return this.support.updateTicket(ticketId, updates);
  }

  async getKnowledgeBase(params?: QueryParams) {
    return this.support.getKnowledgeArticles(params);
  }

  async getSLAMetrics(params?: Record<string, any>) {
    return this.http(`/api/support/sla-metrics${this.buildQuery(params)}`);
  }

  // Resellers module
  async getResellers(params?: QueryParams) {
    return this.resellers.getPartners(params);
  }

  async getReseller(partnerId: string) {
    return this.resellers.getPartner(partnerId);
  }

  async getResellerCommissions(params?: QueryParams) {
    return this.resellers.getCommissionPayments(params);
  }

  async getResellerPerformance(params?: Record<string, any>) {
    return this.resellers.getChannelPerformance(params);
  }

  // Analytics module
  async getBusinessIntelligence(params?: QueryParams) {
    return this.analytics.getDashboards(params);
  }

  async getDataVisualization(
    dashboardId: string,
    params?: { widgetId?: string } & Record<string, any>,
  ) {
    const widgetId = params?.widgetId;
    if (!widgetId) {
      throw new Error("widgetId is required to load visualization data");
    }
    const { widgetId: _, ...rest } = params ?? {};
    return this.analytics.getWidgetData(dashboardId, widgetId, rest);
  }

  async getCustomReports(params?: QueryParams) {
    return this.analytics.getReports(params);
  }

  async generateReport(config: {
    reportId: string;
    parameters?: Record<string, any>;
    format?: string;
  }) {
    return this.analytics.executeReport(config.reportId, config.parameters ?? {}, config.format);
  }

  // Inventory module
  async getInventoryItems(params?: QueryParams) {
    return this.inventory.getInventoryItems(params);
  }

  async getWarehouseManagement(params?: QueryParams) {
    return this.http(`/api/inventory/warehouses${this.buildQuery(params)}`);
  }

  async getProcurementOrders(params?: QueryParams) {
    return this.http(`/api/inventory/procurement${this.buildQuery(params)}`);
  }

  // Field operations module
  async getWorkOrders(params?: QueryParams) {
    return this.fieldOps.getWorkOrders(params);
  }

  async getWorkOrder(workOrderId: string) {
    return this.fieldOps.getWorkOrder(workOrderId);
  }

  async createWorkOrder(data: Parameters<FieldOpsApiClient["createWorkOrder"]>[0]) {
    return this.fieldOps.createWorkOrder(data);
  }

  async getTechnicians(params?: QueryParams) {
    return this.fieldOps.getTechnicians(params);
  }

  async getTechnicianLocation(technicianId: string) {
    const technician = await this.fieldOps.getTechnician(technicianId);
    return {
      data: technician.data.current_location,
    };
  }

  async updateTechnicianLocation(
    technicianId: string,
    location: Parameters<FieldOpsApiClient["updateTechnicianLocation"]>[1],
  ) {
    return this.fieldOps.updateTechnicianLocation(technicianId, location);
  }

  // Compliance module
  async getComplianceReports(params?: QueryParams) {
    return this.http(`/api/compliance/reports${this.buildQuery(params)}`);
  }

  async getAuditTrail(params?: QueryParams) {
    return this.http(`/api/compliance/audit-trail${this.buildQuery(params)}`);
  }

  async getDataProtectionStatus(params?: QueryParams) {
    return this.http(`/api/compliance/data-protection${this.buildQuery(params)}`);
  }

  // Notifications module
  async getNotificationTemplates(params?: QueryParams) {
    return this.notifications.getTemplates(params);
  }

  async sendEmail(payload: NotificationPayload) {
    return this.notifications.sendNotification({
      ...payload,
      channel: "EMAIL",
    });
  }

  async sendSMS(payload: NotificationPayload) {
    return this.notifications.sendNotification({
      ...payload,
      channel: "SMS",
    });
  }

  async getAutomationRules(params?: QueryParams) {
    return this.http(`/api/automation/rules${this.buildQuery(params)}`);
  }

  // Licensing module
  async getLicenseInfo(params?: QueryParams) {
    return this.http(`/api/licensing/licenses${this.buildQuery(params)}`);
  }

  async getFeatureEntitlements(params?: QueryParams) {
    return this.http(`/api/licensing/entitlements${this.buildQuery(params)}`);
  }

  async validateLicense(payload: Record<string, any>) {
    return this.http("/api/licensing/validate", { method: "POST", body: payload });
  }

  // Dashboards
  async getAdminDashboard(params?: QueryParams) {
    return this.http(`/api/dashboards/admin${this.buildQuery(params)}`);
  }

  async getCustomerDashboard(params?: QueryParams) {
    return this.http(`/api/dashboards/customer${this.buildQuery(params)}`);
  }

  async getResellerDashboard(params?: QueryParams) {
    return this.http(`/api/dashboards/reseller${this.buildQuery(params)}`);
  }

  async getTechnicianDashboard(params?: QueryParams) {
    return this.http(`/api/dashboards/technician${this.buildQuery(params)}`);
  }

  static create(config: {
    baseURL: string;
    authToken?: string;
    tenantId?: string;
    timeout?: number;
    headers?: Record<string, string>;
  }) {
    if (!config?.baseURL) {
      throw new Error("baseURL is required");
    }

    try {
      // Validate URL format
      // eslint-disable-next-line no-new
      new URL(config.baseURL);
    } catch {
      throw new Error("Invalid baseURL format");
    }

    return new ISPApiClient({
      baseURL: config.baseURL,
      apiKey: config.authToken,
      tenantId: config.tenantId,
      timeout: config.timeout,
      defaultHeaders: config.headers,
    });
  }

  // Configuration methods
  updateConfig(updates: Partial<ISPApiClientConfig>) {
    this.config = { ...this.config, ...updates };

    if (updates.defaultHeaders) {
      this.defaultHeaders = {
        ...this.defaultHeaders,
        ...updates.defaultHeaders,
      };
    }

    if (Object.prototype.hasOwnProperty.call(updates, "apiKey")) {
      this.updateAuthToken(updates.apiKey ?? null);
    }

    if (updates.tenantId) {
      this.setTenantContext(updates.tenantId);
    }

    if (typeof updates.timeout === "number") {
      this.setTimeout(updates.timeout);
    }
  }

  getConfig(): Readonly<ISPApiClientConfig> {
    return Object.freeze({ ...this.config });
  }
}

// Global instance management
let globalClient: ISPApiClient | null = null;

export function createISPApiClient(config: ISPApiClientConfig): ISPApiClient {
  return new ISPApiClient(config);
}

export function setGlobalISPApiClient(client: ISPApiClient): void {
  globalClient = client;
}

export function getISPApiClient(): ISPApiClient {
  if (!globalClient) {
    throw new Error("ISP API client not initialized. Call setGlobalISPApiClient first.");
  }
  return globalClient;
}

// Export for backward compatibility
export const ispApiClient = {
  get: () => getISPApiClient(),
  create: createISPApiClient,
  setGlobal: setGlobalISPApiClient,
};

// Re-export types for convenience
export type { PaginatedResponse, QueryParams };
