/**
 * Unified API Client
 * Consolidates all API functionality from individual portals
 */

import type {
  ApiResponse,
  ApiError,
  RequestConfig,
  RetryConfig,
  ApiClientConfig,
  PortalEndpoints,
  PaginatedResponse,
  PaginationParams,
} from "./types";
import { PORTAL_ENDPOINTS } from "./types";
import { ApiCache } from "./cache";
import { RateLimiter } from "../utils/rate-limiter";

// Legacy types for compatibility
import type {
  ChatSession,
  Customer,
  DashboardMetrics,
  Invoice,
  NetworkAlert,
  NetworkDevice,
  QueryParams,
  ServicePlan,
  User,
} from "../types";
import type {
  PluginCatalogItem,
  PluginInstallationRequest,
  PluginInstallationResponse,
  InstalledPlugin,
  PluginUpdateInfo,
  PluginMarketplaceFilters,
  PluginPermissionRequest,
  PluginBackup,
} from "../types/plugins";
import { csrfProtection } from "../utils/csrfProtection";
import { inputSanitizer } from "../utils/sanitization";
import { type TokenPair, tokenManager } from "../utils/tokenManager";
import { validationPatterns, validate } from "@dotmac/primitives";
import { ISPError, classifyError } from "../utils/errorUtils";

const DEFAULT_CONFIG: Required<Omit<ApiClientConfig, "interceptors" | "portal" | "tenantId">> = {
  baseUrl: "/api",
  apiKey: "",
  defaultHeaders: {
    "Content-Type": "application/json",
  },
  timeout: 30000,
  retries: 3,
  rateLimiting: true,
  caching: true,
  defaultCacheTTL: 5 * 60 * 1000, // 5 minutes
  csrf: true,
  auth: {
    tokenHeader: "Authorization",
    refreshEndpoint: "/auth/refresh",
    autoRefresh: true,
  },
  metadata: {},
  onUnauthorized: () => {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },
  onError: (error) => {
    // Use existing ISPError system for standardized error handling
    const ispError = new ISPError({
      code: "API_CLIENT_ERROR",
      message: error.message || "Unknown API client error",
      category: "system",
      severity: "medium",
      technicalDetails: { originalError: error },
    });
    // The ISPError constructor automatically logs and reports errors
  },
};

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  attempts: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  jitter: true,
};

const AUTH_REQUIRED_ERROR = "Unauthorized - authentication required";

export class ApiClient {
  private config: Required<Omit<ApiClientConfig, "interceptors" | "portal" | "tenantId">> & {
    portal?: string;
    tenantId?: string;
    interceptors?: ApiClientConfig["interceptors"];
  };
  private cache?: ApiCache;
  private rateLimiter?: RateLimiter;
  private endpoints: PortalEndpoints;

  constructor(config: ApiClientConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    // Support alternate casing used in tests/configs
    if ((config as any).baseURL) {
      this.config.baseUrl = (config as any).baseURL;
    }

    // Setup cache if enabled
    if (this.config.caching) {
      this.cache = new ApiCache(this.config.defaultCacheTTL);
    }

    // Setup rate limiting if enabled
    if (this.config.rateLimiting) {
      this.rateLimiter = new RateLimiter({
        windowMs: 60_000,
        maxRequests: 60,
        keyPrefix: "api-client",
      });
    }

    // Get portal-specific endpoints
    this.endpoints = this.getPortalEndpoints();
  }

  // Exposed for tests to override token retrieval
  getAuthToken(): string | null {
    try {
      return tokenManager.getAccessToken() as any;
    } catch (_e) {
      return null;
    }
  }

  // Get endpoints for current portal
  private getPortalEndpoints(): PortalEndpoints {
    if (this.config.portal && this.config.portal in PORTAL_ENDPOINTS) {
      return PORTAL_ENDPOINTS[this.config.portal]!;
    }

    // Default endpoints if no portal specified
    return {
      login: "/api/auth/login",
      logout: "/api/auth/logout",
      refresh: "/api/auth/refresh",
      validate: "/api/auth/validate",
      csrf: "/api/auth/csrf",
      users: "/api/users",
      profile: "/api/profile",
      settings: "/api/settings",
    };
  }

  setAuthToken() {
    // Method implementation pending
  }

  clearAuthToken() {
    try {
      tokenManager.clearTokens();
    } catch (_e) {
      // Ignore in test environments where token access is restricted
    }
  }

  private sanitizeBody(body: unknown): BodyInit | null {
    if (!body) {
      return null;
    }

    if (typeof body === "string") {
      try {
        const parsed = JSON.parse(body);
        const sanitized = inputSanitizer.sanitizeFormData(parsed);
        return JSON.stringify(sanitized);
      } catch {
        return inputSanitizer.sanitizeText(body);
      }
    }

    // For non-string bodies (FormData, Blob, etc.)
    if (body instanceof FormData || body instanceof Blob || body instanceof ArrayBuffer) {
      return body as BodyInit;
    }

    // For objects, stringify them
    return JSON.stringify(body);
  }

  private buildHeaders(
    method: string,
    options: Pick<RequestConfig, "headers"> = {
      // Implementation pending
    },
  ): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...((options.headers as Record<string, string>) || {}),
    };

    const authToken = this.getAuthToken();
    if (authToken) {
      headers["Authorization"] = authToken.startsWith("Bearer")
        ? authToken
        : `Bearer ${authToken}`;
    }

    if (this.config.apiKey) {
      headers["X-API-Key"] = this.config.apiKey;
    }

    if (this.config.tenantId) {
      headers["X-Tenant-ID"] = this.config.tenantId;
    }
    if (this.config.portal) {
      headers["X-Portal"] = this.config.portal;
    }

    if (csrfProtection.requiresProtection(method)) {
      Object.assign(headers, csrfProtection.getHeaders());
    }

    return headers;
  }

  private async handleUnauthorized<T>(
    attempt: number,
    url: string,
    requestOptions: RequestInit,
  ): Promise<T> {
    if (attempt !== 0) {
      throw new Error(AUTH_REQUIRED_ERROR);
    }

    let refreshToken: string | null = null;
    try {
      refreshToken = tokenManager.getRefreshToken() as any;
    } catch (_e) {
      refreshToken = null;
    }
    if (!refreshToken) {
      throw new Error(AUTH_REQUIRED_ERROR);
    }

    try {
      const newTokens = await this.refreshToken(refreshToken);
      if (!newTokens) {
        throw new Error("Token refresh failed");
      }

      let newAuthToken: string | null = null;
      try {
        newAuthToken = tokenManager.getAccessToken() as any;
      } catch (_e) {
        newAuthToken = null;
      }
      if (!newAuthToken) {
        throw new Error("No access token after refresh");
      }

      const headers = { ...requestOptions.headers } as Record<string, string>;
      headers["Authorization"] = `Bearer ${newAuthToken}`;
      const retryResponse = await fetch(url, { ...requestOptions, headers });

      if (retryResponse.ok) {
        return (await retryResponse.json()) as T;
      }
      throw new Error("Retry after refresh failed");
    } catch (_error) {
      tokenManager.clearTokens();
      this.config.onUnauthorized();
      throw new Error(AUTH_REQUIRED_ERROR);
    }
  }

  private async handleErrorResponse(response: Response): Promise<never> {
    const errorData = await response.json().catch(() => ({}));
    const apiError: ApiError = {
      code: errorData.code || `HTTP_${response.status}`,
      message: errorData.message || response.statusText,
      details: errorData.details,
      statusCode: response.status,
      timestamp: new Date().toISOString(),
      path: response.url,
    };

    // Use existing ISPError system for standardized error classification
    const ispError = classifyError(apiError);

    // Call configured error handler
    // Convert ISPError to ApiError for compatibility
    const callbackStatus = ispError.status ?? response.status ?? 500;
    const apiErrorForCallback: ApiError = {
      code: ispError.code || "UNKNOWN_ERROR",
      message: ispError.message,
      details: ispError.technicalDetails,
      statusCode: callbackStatus,
    };
    this.config.onError?.(apiErrorForCallback);

    const enrichedError: any = new Error(apiError.message);
    enrichedError.status = response.status;
    enrichedError.data = errorData;
    enrichedError.headers = response.headers;
    enrichedError.code = apiError.code;
    throw enrichedError;
  }

  private shouldRetry(error: Error): boolean {
    const status = (error as any)?.status ?? (error as any)?.statusCode;
    if (typeof status === "number" && status >= 400 && status < 500) {
      return false;
    }
    return !(error.message === "Unauthorized" || error.name === "AbortError");
  }

  private async wait(attempt: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
  }

  public async request<T>(endpoint: string, options: RequestConfig = {}): Promise<T> {
    const { params, cache: useCache, cacheTTL, ...rest } = options;

    let url = `${this.config.baseUrl}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const query = searchParams.toString();
      if (query) {
        url += url.includes("?") ? `&${query}` : `?${query}`;
      }
    }

    const method = options.method || "GET";
    const sanitizedBody = this.sanitizeBody(options.body);
    const headers = this.buildHeaders(method, options);
    const timeoutSignal =
      typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function"
        ? (AbortSignal as any).timeout(this.config.timeout)
        : undefined;

    const controller = new AbortController();
    const requestOptions: RequestInit = {
      ...rest,
      method,
      headers,
      body: sanitizedBody,
      signal: timeoutSignal || controller.signal,
      credentials: "same-origin",
    };

    let lastError: Error = new Error("Request failed");

    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        this.config.interceptors?.request?.({
          url: endpoint,
          method,
          headers,
        });

        const timeoutMs = this.config.timeout;
        const response = await Promise.race([
          fetch(url, requestOptions),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timeout")), timeoutMs),
          ),
        ]);

        if (!response) {
          throw new Error("Request aborted");
        }

        if (!response.ok) {
          if (response.status === 401) {
            return await this.handleUnauthorized<T>(attempt, url, requestOptions);
          }
          await this.handleErrorResponse(response);
        }

        const parsed = (await response.json().catch(() => ({}))) as T;

        this.config.interceptors?.response?.({
          status: (response as any).status,
          data: parsed,
        } as any);

        return parsed;
      } catch (error) {
        lastError = error as Error;

        if (error instanceof Error && error.message === "Request timeout") {
          throw error;
        }
        if (error instanceof Error && error.message?.includes("Network request failed")) {
          throw error;
        }

        if (!this.shouldRetry(lastError)) {
          throw lastError;
        }

        if (attempt < this.config.retries) {
          await this.wait(attempt);
        }
      }
    }

    throw lastError;
  }

  public async get<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    return this.request<T>(endpoint, { ...config, method: "GET" });
  }

  public async post<T>(
    endpoint: string,
    data?: RequestConfig["body"],
    config: RequestConfig = {},
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "POST",
      body: data ?? config.body ?? null,
    });
  }

  public async put<T>(
    endpoint: string,
    data?: RequestConfig["body"],
    config: RequestConfig = {},
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "PUT",
      body: data ?? config.body ?? null,
    });
  }

  public async delete<T>(
    endpoint: string,
    data?: RequestConfig["body"],
    config: RequestConfig = {},
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...config,
      method: "DELETE",
      body: data ?? config.body ?? null,
    });
  }

  public invalidateEndpointCache(endpoint: string): void {
    this.cache?.invalidateEndpoint(endpoint);
  }

  public invalidateCacheByPattern(pattern: string | RegExp): void {
    this.cache?.invalidatePattern(pattern);
  }

  // Authentication
  async login(credentials: {
    email?: string;
    portalId?: string;
    accountNumber?: string;
    partnerCode?: string;
    password: string;
    portal: string;
  }): Promise<
    ApiResponse<{
      user: User;
      token: string;
      refreshToken: string;
      tenant: unknown;
    }>
  > {
    return this.request("/api/isp/v1/admin/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async refreshToken(refreshToken: string): Promise<TokenPair> {
    const response = await this.request<
      ApiResponse<{
        accessToken: string;
        refreshToken: string;
        expiresAt: number;
      }>
    >("/api/isp/v1/admin/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.data) {
      throw new ISPError({
        message: "Invalid refresh token response",
        category: "authentication",
        severity: "high",
      });
    }

    return {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
      expiresAt: response.data.expiresAt,
    };
  }

  async logout(): Promise<ApiResponse<Record<string, never>>> {
    return this.request("/api/isp/v1/admin/auth/logout", {
      method: "POST",
    });
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request("/api/isp/v1/admin/auth/me");
  }

  // Customers
  async getCustomers(params?: QueryParams): Promise<PaginatedResponse<Customer>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/customers${query ? `?${query}` : ""}`);
  }

  async getCustomer(id: string): Promise<ApiResponse<Customer>> {
    return this.request(`/api/isp/v1/admin/customers/${id}`);
  }

  async createCustomer(
    customer: Omit<Customer, "id" | "createdAt" | "updatedAt">,
  ): Promise<ApiResponse<Customer>> {
    return this.request("/api/isp/v1/admin/customers", {
      method: "POST",
      body: JSON.stringify(customer),
    });
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<ApiResponse<Customer>> {
    return this.request(`/api/isp/v1/admin/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async deleteCustomer(id: string): Promise<ApiResponse<Record<string, never>>> {
    return this.request(`/api/isp/v1/admin/customers/${id}`, {
      method: "DELETE",
    });
  }

  // Billing
  async getInvoices(
    customerId?: string,
    params?: QueryParams,
  ): Promise<PaginatedResponse<Invoice>> {
    const searchParams = new URLSearchParams();
    if (customerId) {
      searchParams.append("customerId", customerId);
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/billing/invoices${query ? `?${query}` : ""}`);
  }

  async getInvoice(id: string): Promise<ApiResponse<Invoice>> {
    return this.request(`/api/isp/v1/admin/billing/invoices/${id}`);
  }

  async createInvoice(
    invoice: Omit<Invoice, "id" | "createdAt" | "updatedAt">,
  ): Promise<ApiResponse<Invoice>> {
    return this.request("/api/isp/v1/admin/billing/invoices", {
      method: "POST",
      body: JSON.stringify(invoice),
    });
  }

  async payInvoice(
    id: string,
    paymentData: { method: string; amount: number },
  ): Promise<ApiResponse<Invoice>> {
    return this.request(`/api/isp/v1/admin/billing/invoices/${id}/pay`, {
      method: "POST",
      body: JSON.stringify(paymentData),
    });
  }

  // Network Management
  async getNetworkDevices(params?: QueryParams): Promise<PaginatedResponse<NetworkDevice>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/network/devices${query ? `?${query}` : ""}`);
  }

  async getNetworkDevice(id: string): Promise<ApiResponse<NetworkDevice>> {
    return this.request(`/api/isp/v1/admin/network/devices/${id}`);
  }

  async updateNetworkDevice(
    id: string,
    updates: Partial<NetworkDevice>,
  ): Promise<ApiResponse<NetworkDevice>> {
    return this.request(`/api/isp/v1/admin/network/devices/${id}`, {
      method: "PUT",
      body: JSON.stringify(updates),
    });
  }

  async getNetworkAlerts(params?: QueryParams): Promise<PaginatedResponse<NetworkAlert>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/network/alerts${query ? `?${query}` : ""}`);
  }

  async acknowledgeAlert(id: string): Promise<ApiResponse<NetworkAlert>> {
    return this.request(`/api/isp/v1/admin/network/alerts/${id}/acknowledge`, {
      method: "POST",
    });
  }

  async resolveAlert(id: string, resolution?: string): Promise<ApiResponse<NetworkAlert>> {
    return this.request(`/api/isp/v1/admin/network/alerts/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify({ resolution }),
    });
  }

  // Live Chat
  async getChatSessions(params?: QueryParams): Promise<PaginatedResponse<ChatSession>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/chat/sessions${query ? `?${query}` : ""}`);
  }

  async getChatSession(id: string): Promise<ApiResponse<ChatSession>> {
    return this.request(`/api/isp/v1/admin/chat/sessions/${id}`);
  }

  async createChatSession(customerId: string, subject?: string): Promise<ApiResponse<ChatSession>> {
    return this.request("/api/isp/v1/admin/chat/sessions", {
      method: "POST",
      body: JSON.stringify({ customerId, subject }),
    });
  }

  async closeChatSession(
    id: string,
    rating?: number,
    feedback?: string,
  ): Promise<ApiResponse<ChatSession>> {
    return this.request(`/api/isp/v1/admin/chat/sessions/${id}/close`, {
      method: "POST",
      body: JSON.stringify({ rating, feedback }),
    });
  }

  // Service Plans
  async getServicePlans(params?: QueryParams): Promise<PaginatedResponse<ServicePlan>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/services/plans${query ? `?${query}` : ""}`);
  }

  async getServicePlan(id: string): Promise<ApiResponse<ServicePlan>> {
    return this.request(`/api/isp/v1/admin/services/plans/${id}`);
  }

  // Dashboard
  async getDashboardMetrics(): Promise<ApiResponse<DashboardMetrics>> {
    return this.request("/api/isp/v1/admin/dashboard/metrics");
  }

  // File uploads
  async uploadFile(file: File, purpose: string): Promise<ApiResponse<{ url: string; id: string }>> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("purpose", purpose);

    return this.request("/api/isp/v1/admin/files/upload", {
      method: "POST",
      body: formData,
      headers: {
        // Implementation pending
      }, // Let browser set Content-Type for FormData
    });
  }

  // Customer Portal APIs
  async getCustomerDashboard(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/customer/dashboard");
  }

  async getCustomerServices(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/customer/services");
  }

  async getCustomerBilling(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/customer/billing");
  }

  async getCustomerUsage(period?: string): Promise<ApiResponse<unknown>> {
    const query = period ? `?period=${period}` : "";
    return this.request(`/api/isp/v1/admin/customer/usage${query}`);
  }

  async getCustomerDocuments(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/customer/documents");
  }

  async getCustomerSupportTickets(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/customer/support/tickets");
  }

  async createSupportTicket(data: unknown): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/customer/support/tickets", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async replySupportTicket(ticketId: string, message: string): Promise<ApiResponse<unknown>> {
    return this.request(`/api/isp/v1/admin/customer/support/tickets/${ticketId}/reply`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  }

  async runSpeedTest(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/customer/services/speed-test", {
      method: "POST",
    });
  }

  async requestServiceUpgrade(upgradeId: string): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/customer/services/upgrade", {
      method: "POST",
      body: JSON.stringify({ upgradeId }),
    });
  }

  // Admin Portal APIs
  async getAdminDashboard(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/admin/dashboard");
  }

  async getSystemAlerts(): Promise<ApiResponse<any[]>> {
    return this.request("/api/isp/v1/admin/admin/system/alerts");
  }

  async getNetworkStatus(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/admin/network/status");
  }

  // Reseller Portal APIs
  async getResellerDashboard(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/reseller/dashboard");
  }

  async getResellerCommissions(): Promise<ApiResponse<unknown>> {
    return this.request("/api/isp/v1/admin/reseller/commissions");
  }

  async getResellerCustomers(): Promise<ApiResponse<any[]>> {
    return this.request("/api/isp/v1/admin/reseller/customers");
  }

  // Plugin Management APIs
  async getPluginCatalog(
    filters?: PluginMarketplaceFilters,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<PluginCatalogItem>> {
    const searchParams = new URLSearchParams();

    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, String(v)));
          } else {
            searchParams.append(key, String(value));
          }
        }
      });
    }

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/plugins/catalog${query ? `?${query}` : ""}`);
  }

  async getPluginDetails(pluginId: string): Promise<ApiResponse<PluginCatalogItem>> {
    return this.request(`/api/isp/v1/admin/plugins/catalog/${pluginId}`);
  }

  async installPlugin(
    request: PluginInstallationRequest,
  ): Promise<ApiResponse<PluginInstallationResponse>> {
    // Validate plugin_id using existing validation system
    if (!validate.required(request.plugin_id)) {
      throw new ISPError({
        code: "VALIDATION_ERROR",
        message: "Plugin ID is required",
        category: "validation",
        severity: "medium",
        technicalDetails: { pluginId: request.plugin_id },
      });
    }

    // Validate license_tier
    const validTiers = ["trial", "basic", "professional", "enterprise"];
    if (!validate.oneOf(request.license_tier, validTiers)) {
      throw new ISPError({
        code: "VALIDATION_ERROR",
        message: "Invalid license tier",
        category: "validation",
        severity: "medium",
        technicalDetails: { licenseTier: request.license_tier, validTiers },
      });
    }

    // Basic configuration validation using existing patterns
    if (request.configuration && typeof request.configuration === "object") {
      // Use existing validation patterns for security
      const configKeys = Object.keys(request.configuration);
      if (configKeys.length > 50) {
        throw new ISPError({
          code: "VALIDATION_ERROR",
          message: "Too many configuration parameters",
          category: "validation",
          severity: "medium",
          technicalDetails: { configCount: configKeys.length, maxAllowed: 50 },
        });
      }
    }

    return this.request("/api/isp/v1/admin/plugins/install", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getPluginInstallationStatus(
    installationId: string,
  ): Promise<ApiResponse<PluginInstallationResponse>> {
    return this.request(`/api/isp/v1/admin/plugins/installations/${installationId}/status`);
  }

  async getInstalledPlugins(
    params?: PaginationParams,
  ): Promise<PaginatedResponse<InstalledPlugin>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/plugins/installed${query ? `?${query}` : ""}`);
  }

  async getInstalledPlugin(installationId: string): Promise<ApiResponse<InstalledPlugin>> {
    return this.request(`/api/isp/v1/admin/plugins/installed/${installationId}`);
  }

  async enablePlugin(installationId: string): Promise<ApiResponse<InstalledPlugin>> {
    return this.request(`/api/isp/v1/admin/plugins/installed/${installationId}/enable`, {
      method: "POST",
    });
  }

  async disablePlugin(installationId: string): Promise<ApiResponse<InstalledPlugin>> {
    return this.request(`/api/isp/v1/admin/plugins/installed/${installationId}/disable`, {
      method: "POST",
    });
  }

  async configurePlugin(
    installationId: string,
    configuration: Record<string, any>,
  ): Promise<ApiResponse<InstalledPlugin>> {
    return this.request(`/api/isp/v1/admin/plugins/installed/${installationId}/configure`, {
      method: "PUT",
      body: JSON.stringify({ configuration }),
    });
  }

  async uninstallPlugin(
    installationId: string,
    options?: { backup?: boolean; force?: boolean },
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.request(`/api/isp/v1/admin/plugins/installed/${installationId}/uninstall`, {
      method: "DELETE",
      body: JSON.stringify(options || {}),
    });
  }

  async getPluginUpdates(
    installationId?: string,
  ): Promise<ApiResponse<Record<string, PluginUpdateInfo>>> {
    const endpoint = installationId
      ? `/api/isp/v1/admin/plugins/installed/${installationId}/updates`
      : "/api/isp/v1/admin/plugins/updates";
    return this.request(endpoint);
  }

  async updatePlugin(
    installationId: string,
    options?: { backup?: boolean; auto_restart?: boolean; configuration?: any },
  ): Promise<ApiResponse<PluginInstallationResponse>> {
    // Basic rate limiting - can be enhanced with actual rate limiter if needed
    if (this.rateLimiter) {
      const limitResult = await this.rateLimiter.checkLimit(`plugin-update:${installationId}`);
      if (!limitResult.allowed) {
        throw new ISPError({
          message: "Rate limit exceeded. Please wait before making another plugin update request.",
          category: "system",
          severity: "medium",
          retryable: true,
        });
      }
    }

    // Sanitize installationId
    const sanitizedId = inputSanitizer.sanitizeText(installationId);
    if (!sanitizedId || sanitizedId.length > 50) {
      throw new Error("Invalid installation ID");
    }

    const sanitizedOptions = options || {};

    // Validate plugin configuration if provided
    if (sanitizedOptions.configuration) {
      let parsedConfig;
      try {
        parsedConfig =
          typeof sanitizedOptions.configuration === "string"
            ? JSON.parse(sanitizedOptions.configuration)
            : sanitizedOptions.configuration;
      } catch (error) {
        throw new Error(
          `Invalid plugin configuration: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }

      // Basic plugin config validation - ensure it's an object
      if (!parsedConfig || typeof parsedConfig !== "object") {
        throw new ISPError({
          message: "Plugin configuration must be a valid object",
          category: "validation",
          severity: "low",
        });
      }

      // Use parsed configuration
      sanitizedOptions.configuration = parsedConfig;
    }

    return this.request(`/api/isp/v1/admin/plugins/installed/${sanitizedId}/update`, {
      method: "POST",
      body: JSON.stringify(sanitizedOptions),
    });
  }

  async getPluginUsage(
    installationId: string,
    period?: string,
  ): Promise<
    ApiResponse<{
      cpu_usage: Array<{ timestamp: string; value: number }>;
      memory_usage: Array<{ timestamp: string; value: number }>;
      storage_usage: number;
      api_calls: number;
      errors: number;
    }>
  > {
    const query = period ? `?period=${period}` : "";
    return this.request(`/api/isp/v1/admin/plugins/installed/${installationId}/usage${query}`);
  }

  async getPluginHealth(
    installationId?: string,
  ): Promise<ApiResponse<InstalledPlugin["health"] | Record<string, InstalledPlugin["health"]>>> {
    const endpoint = installationId
      ? `/api/isp/v1/admin/plugins/installed/${installationId}/health`
      : "/api/isp/v1/admin/plugins/health";
    return this.request(endpoint);
  }

  async requestPluginPermissions(
    request: PluginPermissionRequest,
  ): Promise<ApiResponse<{ request_id: string; status: string }>> {
    return this.request("/api/isp/v1/admin/plugins/permissions/request", {
      method: "POST",
      body: JSON.stringify(request),
    });
  }

  async getPluginBackups(
    installationId?: string,
    params?: PaginationParams,
  ): Promise<PaginatedResponse<PluginBackup>> {
    const searchParams = new URLSearchParams();
    if (installationId) {
      searchParams.append("installation_id", installationId);
    }
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, String(value));
        }
      });
    }

    const query = searchParams.toString();
    return this.request(`/api/isp/v1/admin/plugins/backups${query ? `?${query}` : ""}`);
  }

  async createPluginBackup(
    installationId: string,
    type: "manual" | "pre_update" = "manual",
  ): Promise<ApiResponse<PluginBackup>> {
    return this.request("/api/isp/v1/admin/plugins/backups", {
      method: "POST",
      body: JSON.stringify({ installation_id: installationId, type }),
    });
  }

  async restorePluginBackup(backupId: string): Promise<ApiResponse<PluginInstallationResponse>> {
    return this.request(`/api/isp/v1/admin/plugins/backups/${backupId}/restore`, {
      method: "POST",
    });
  }
}

// Create a default client instance
let defaultClient: ApiClient | null = null;

export function createApiClient(config: ApiClientConfig): ApiClient {
  const client = new ApiClient(config);
  if (!defaultClient) {
    defaultClient = client;
  }
  return client;
}

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    throw new Error("API client not initialized. Call createApiClient() first.");
  }
  return defaultClient;
}

// Backwards-compatible aliases for test imports
export { ApiClient as APIClient };
export const createAPIClient = createApiClient;
