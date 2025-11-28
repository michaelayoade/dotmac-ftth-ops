/**
 * Unified Management API Client
 * Production-ready API client for cross-portal management operations
 * Features: Retry logic, caching, error handling, audit logging, rate limiting
 */

import { BaseApiClient, RequestConfig } from "../api/clients/BaseApiClient";
import {
  BaseEntity,
  EntityFilters,
  EntityListResponse,
  CreateEntityRequest,
  UpdateEntityRequest,
  EntityOperationResult,
  BillingData,
  PaymentResult,
  Invoice,
  DashboardStats,
  UsageMetrics,
  Report,
  ReportType,
  ReportParams,
  ApiConfig,
  RequestContext,
  CacheConfig,
  CacheEntry,
  ManagementEvent,
  OperationError,
} from "./types";

export interface ManagementApiClientConfig {
  baseURL: string;
  apiConfig?: Partial<ApiConfig>;
  cacheConfig?: Partial<CacheConfig>;
  enableAuditLogging?: boolean;
  enablePerformanceMonitoring?: boolean;
}

export class ManagementApiClient extends BaseApiClient {
  private cache: Map<string, CacheEntry>;
  private rateLimitTokens: number;
  private rateLimitLastRefill: number;
  private requestQueue: Array<() => Promise<unknown>>;
  private isProcessingQueue: boolean;
  private apiConfig: ApiConfig;
  private cacheConfig: CacheConfig;
  private enableAuditLogging: boolean;
  private enablePerformanceMonitoring: boolean;

  constructor(config: ManagementApiClientConfig) {
    super(config.baseURL, {}, "ManagementAPI");

    this.apiConfig = {
      base_url: config.baseURL,
      timeout_ms: 30000,
      retry_attempts: 3,
      retry_delay_ms: 1000,
      rate_limit_requests: 100,
      rate_limit_window_ms: 60000,
      auth_header_name: "Authorization",
      tenant_header_name: "X-Tenant-ID",
      request_id_header_name: "X-Request-ID",
      ...config.apiConfig,
    };

    this.cacheConfig = {
      enabled: true,
      default_ttl_seconds: 300,
      max_entries: 1000,
      cache_key_prefix: "mgmt_api",
      invalidation_patterns: ["create_*", "update_*", "delete_*"],
      ...config.cacheConfig,
    };

    this.enableAuditLogging = config.enableAuditLogging ?? true;
    this.enablePerformanceMonitoring = config.enablePerformanceMonitoring ?? true;

    this.cache = new Map();
    this.rateLimitTokens = this.apiConfig.rate_limit_requests;
    this.rateLimitLastRefill = Date.now();
    this.requestQueue = [];
    this.isProcessingQueue = false;

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Performance monitoring
    if (this.enablePerformanceMonitoring) {
      this.setupPerformanceMonitoring();
    }

    // Audit logging
    if (this.enableAuditLogging) {
      this.setupAuditLogging();
    }
  }

  private setupPerformanceMonitoring(): void {
    // Request timing and metrics collection
    const originalRequest = this.request.bind(this);
    this.request = async function <T>(
      method: string,
      endpoint: string,
      data?: unknown,
      config?: RequestConfig,
    ): Promise<T> {
      const startTime = performance.now();
      try {
        const result = await originalRequest(method, endpoint, data, config);
        const duration = performance.now() - startTime;
        this.logPerformanceMetric(method, endpoint, duration, "success");
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        this.logPerformanceMetric(method, endpoint, duration, "error");
        throw error;
      }
    }.bind(this);
  }

  private logPerformanceMetric(
    method: string,
    endpoint: string,
    duration: number,
    status: string,
  ): void {
    const metric = {
      timestamp: new Date().toISOString(),
      method,
      endpoint,
      duration_ms: Math.round(duration),
      status,
    };

    // Send to performance monitoring service
    if (typeof window !== "undefined" && "performanceMonitor" in window) {
      (
        window as unknown as {
          performanceMonitor: { track: (event: string, data: unknown) => void };
        }
      ).performanceMonitor.track("api_request", metric);
    }
  }

  private setupAuditLogging(): void {
    // Override request method to add audit context
    const originalRequest = this.request.bind(this);
    this.request = async function <T>(
      method: string,
      endpoint: string,
      data?: unknown,
      config?: RequestConfig,
    ): Promise<T> {
      const requestContext = this.createRequestContext(method, endpoint);
      const auditConfig = {
        ...config,
        headers: {
          ...config?.headers,
          [this.apiConfig.request_id_header_name]: requestContext.request_id,
          "X-Audit-Context": JSON.stringify(requestContext),
        },
      };

      try {
        const result = await originalRequest(method, endpoint, data, auditConfig);
        this.logAuditEvent("api_request", "success", requestContext, {
          method,
          endpoint,
          data,
        });
        return result;
      } catch (error) {
        this.logAuditEvent("api_request", "error", requestContext, {
          method,
          endpoint,
          data,
          error: error.message,
        });
        throw error;
      }
    }.bind(this);
  }

  private createRequestContext(method: string, endpoint: string): RequestContext {
    return {
      request_id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: this.getCurrentUserId(),
      tenant_id: this.getCurrentTenantId(),
      portal_type: this.getPortalType(),
      timestamp: new Date().toISOString(),
      correlation_id: this.generateCorrelationId(),
    };
  }

  private getCurrentUserId(): string | undefined {
    // Implementation depends on your auth system
    return typeof window !== "undefined" ? localStorage.getItem("user_id") || undefined : undefined;
  }

  private getCurrentTenantId(): string | undefined {
    return typeof window !== "undefined"
      ? localStorage.getItem("tenant_id") || undefined
      : undefined;
  }

  private getPortalType(): string {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname.includes("admin")) return "admin";
      if (hostname.includes("reseller")) return "reseller";
      if (hostname.includes("management")) return "management";
      return "unknown";
    }
    return "server";
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logAuditEvent(type: string, status: string, context: RequestContext, data: any): void {
    if (this.enableAuditLogging) {
      // Integration with audit system would go here
      console.debug("[Audit]", { type, status, context, data });
    }
  }

  // ===== RATE LIMITING =====

  private async checkRateLimit(): Promise<void> {
    const now = Date.now();
    const timePassed = now - this.rateLimitLastRefill;

    // Refill tokens based on time passed
    if (timePassed >= this.apiConfig.rate_limit_window_ms) {
      this.rateLimitTokens = this.apiConfig.rate_limit_requests;
      this.rateLimitLastRefill = now;
    }

    if (this.rateLimitTokens <= 0) {
      // Add to queue if rate limited
      return new Promise((resolve) => {
        this.requestQueue.push(resolve);
        this.processQueue();
      });
    }

    this.rateLimitTokens--;
  }

  private processQueue(): void {
    if (this.isProcessingQueue || this.requestQueue.length === 0) return;

    this.isProcessingQueue = true;

    const processNext = () => {
      if (this.requestQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      if (this.rateLimitTokens > 0) {
        const nextRequest = this.requestQueue.shift();
        if (nextRequest) {
          this.rateLimitTokens--;
          nextRequest();
        }
      }

      setTimeout(processNext, 100); // Check every 100ms
    };

    setTimeout(processNext, 0);
  }

  // ===== CACHING =====

  private getCacheKey(method: string, endpoint: string, params?: any): string {
    const key = `${this.cacheConfig.cache_key_prefix}:${method}:${endpoint}`;
    if (params) {
      const paramString = JSON.stringify(params);
      return `${key}:${btoa(paramString)}`;
    }
    return key;
  }

  private getFromCache<T>(key: string): T | null {
    if (!this.cacheConfig.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const expirationTime = entry.timestamp + entry.ttl_seconds * 1000;

    if (now > expirationTime) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    if (!this.cacheConfig.enabled) return;

    // Remove oldest entries if cache is full
    if (this.cache.size >= this.cacheConfig.max_entries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: CacheEntry<T> = {
      key,
      data,
      timestamp: Date.now(),
      ttl_seconds: ttl || this.cacheConfig.default_ttl_seconds,
    };

    this.cache.set(key, entry);
  }

  private invalidateCache(pattern?: string): void {
    if (!pattern) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  // ===== ENTITY MANAGEMENT OPERATIONS =====

  async listEntities<T extends BaseEntity>(
    entityType: string,
    filters: EntityFilters = {},
  ): Promise<EntityListResponse<T>> {
    await this.checkRateLimit();

    const cacheKey = this.getCacheKey("GET", `/entities/${entityType}`, filters);
    const cached = this.getFromCache<EntityListResponse<T>>(cacheKey);
    if (cached) return cached;

    const config: RequestConfig = { params: filters };
    const result = await this.get<EntityListResponse<T>>(`/api/platform/v1/admin/entities/${entityType}`, config);

    this.setCache(cacheKey, result);
    return result;
  }

  async getEntity<T extends BaseEntity>(entityType: string, entityId: string): Promise<T> {
    await this.checkRateLimit();

    const cacheKey = this.getCacheKey("GET", `/entities/${entityType}/${entityId}`);
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) return cached;

    const result = await this.get<T>(`/api/platform/v1/admin/entities/${entityType}/${entityId}`);

    this.setCache(cacheKey, result);
    return result;
  }

  async createEntity<T extends BaseEntity>(
    request: CreateEntityRequest,
  ): Promise<EntityOperationResult<T>> {
    await this.checkRateLimit();

    try {
      const result = await this.post<EntityOperationResult<T>>("/api/platform/v1/admin/entities", request);

      // Invalidate related caches
      this.invalidateCache(`entities/${request.entity_type}`);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        error_code: error.code,
      };
    }
  }

  async updateEntity<T extends BaseEntity>(
    entityType: string,
    entityId: string,
    request: UpdateEntityRequest,
  ): Promise<EntityOperationResult<T>> {
    await this.checkRateLimit();

    try {
      const result = await this.put<EntityOperationResult<T>>(
        `/api/platform/v1/admin/entities/${entityType}/${entityId}`,
        request,
      );

      // Invalidate related caches
      this.invalidateCache(`entities/${entityType}`);
      this.cache.delete(this.getCacheKey("GET", `/entities/${entityType}/${entityId}`));

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        error_code: error.code,
      };
    }
  }

  async deleteEntity(entityType: string, entityId: string): Promise<EntityOperationResult<void>> {
    await this.checkRateLimit();

    try {
      await this.delete(`/api/platform/v1/admin/entities/${entityType}/${entityId}`);

      // Invalidate related caches
      this.invalidateCache(`entities/${entityType}`);
      this.cache.delete(this.getCacheKey("GET", `/entities/${entityType}/${entityId}`));

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        error_code: error.code,
      };
    }
  }

  // ===== BILLING OPERATIONS =====

  async getBillingData(
    entityId: string,
    period: { start_date: string; end_date: string },
  ): Promise<BillingData> {
    await this.checkRateLimit();

    const cacheKey = this.getCacheKey("GET", `/billing/${entityId}`, period);
    const cached = this.getFromCache<BillingData>(cacheKey);
    if (cached) return cached;

    const config: RequestConfig = { params: period };
    const result = await this.get<BillingData>(`/api/isp/v1/admin/billing/${entityId}`, config);

    this.setCache(cacheKey, result, 600); // Cache for 10 minutes
    return result;
  }

  async processPayment(entityId: string, amount: number, paymentData: any): Promise<PaymentResult> {
    await this.checkRateLimit();

    const result = await this.post<PaymentResult>(`/api/isp/v1/admin/billing/${entityId}/payments`, {
      amount,
      ...paymentData,
    });

    // Invalidate billing caches
    this.invalidateCache(`billing/${entityId}`);

    return result;
  }

  async generateInvoice(entityId: string, services: any[], options: any = {}): Promise<Invoice> {
    await this.checkRateLimit();

    const result = await this.post<Invoice>(`/api/isp/v1/admin/billing/${entityId}/invoices`, {
      services,
      ...options,
    });

    // Invalidate billing caches
    this.invalidateCache(`billing/${entityId}`);

    return result;
  }

  async getInvoices(entityId: string, filters: any = {}): Promise<Invoice[]> {
    await this.checkRateLimit();

    const cacheKey = this.getCacheKey("GET", `/billing/${entityId}/invoices`, filters);
    const cached = this.getFromCache<Invoice[]>(cacheKey);
    if (cached) return cached;

    const config: RequestConfig = { params: filters };
    const result = await this.get<Invoice[]>(`/api/isp/v1/admin/billing/${entityId}/invoices`, config);

    this.setCache(cacheKey, result, 300); // Cache for 5 minutes
    return result;
  }

  // ===== ANALYTICS OPERATIONS =====

  async getDashboardStats(timeframe: string, entityType?: string): Promise<DashboardStats> {
    await this.checkRateLimit();

    const cacheKey = this.getCacheKey("GET", "/analytics/dashboard", {
      timeframe,
      entityType,
    });
    const cached = this.getFromCache<DashboardStats>(cacheKey);
    if (cached) return cached;

    const config: RequestConfig = {
      params: { timeframe, entity_type: entityType },
    };
    const result = await this.get<DashboardStats>("/api/isp/v1/admin/analytics/dashboard", config);

    this.setCache(cacheKey, result, 600); // Cache for 10 minutes
    return result;
  }

  async getUsageMetrics(entityId: string, period: any): Promise<UsageMetrics> {
    await this.checkRateLimit();

    const cacheKey = this.getCacheKey("GET", `/analytics/usage/${entityId}`, period);
    const cached = this.getFromCache<UsageMetrics>(cacheKey);
    if (cached) return cached;

    const config: RequestConfig = { params: period };
    const result = await this.get<UsageMetrics>(`/api/isp/v1/admin/analytics/usage/${entityId}`, config);

    this.setCache(cacheKey, result, 300); // Cache for 5 minutes
    return result;
  }

  async generateReport(type: ReportType, params: ReportParams): Promise<Report> {
    await this.checkRateLimit();

    const result = await this.post<Report>("/api/isp/v1/admin/reports/generate", {
      type,
      parameters: params,
    });

    // Don't cache report generation requests
    return result;
  }

  async getReport(reportId: string): Promise<Report> {
    await this.checkRateLimit();

    const cacheKey = this.getCacheKey("GET", `/reports/${reportId}`);
    const cached = this.getFromCache<Report>(cacheKey);
    if (cached) return cached;

    const result = await this.get<Report>(`/api/isp/v1/admin/reports/${reportId}`);

    this.setCache(cacheKey, result, 3600); // Cache for 1 hour
    return result;
  }

  async downloadReport(reportId: string): Promise<Blob> {
    await this.checkRateLimit();

    const result = await this.get<Blob>(`/api/isp/v1/admin/reports/${reportId}/download`, {
      headers: { Accept: "application/octet-stream" },
    });

    return result;
  }

  // ===== BATCH OPERATIONS =====

  async batchOperation<T>(
    operations: Array<{
      method: string;
      endpoint: string;
      data?: any;
    }>,
  ): Promise<EntityOperationResult<T>[]> {
    await this.checkRateLimit();

    const result = await this.post<EntityOperationResult<T>[]>("/api/v1/batch", {
      operations,
    });

    // Invalidate all caches on batch operations
    this.cache.clear();

    return result;
  }

  // ===== HEALTH AND MONITORING =====

  async getApiHealth(): Promise<{ status: string; checks: any[] }> {
    // Health checks don't count against rate limits
    return this.get("/api/v1/health");
  }

  async getApiMetrics(): Promise<any> {
    return this.get("/api/v1/metrics");
  }

  // ===== CACHE MANAGEMENT =====

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; max_size: number; hit_ratio: number } {
    return {
      size: this.cache.size,
      max_size: this.cacheConfig.max_entries,
      hit_ratio: 0, // Would need to implement hit counting
    };
  }
}
