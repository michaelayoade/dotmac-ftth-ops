/**
 * Unified API Types
 * Common types for all API interactions
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  statusCode?: number;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    hasNext?: boolean;
    hasPrev?: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: any;
  statusCode?: number;
  timestamp?: string;
  path?: string;
}

export interface RequestConfig extends Omit<RequestInit, "cache" | "headers" | "body"> {
  retries?: number;
  timeout?: number;
  validateResponse?: boolean;
  skipRetryOn?: number[];
  headers?: HeadersInit;
  params?: Record<string, unknown> | undefined;
  cache?: boolean;
  cacheTTL?: number;
  portal?: string;
  tenantId?: string;
  body?: BodyInit | Record<string, unknown> | null;
}

export interface RetryConfig {
  attempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  jitter: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface ApiClientConfig {
  baseUrl?: string;
  apiKey?: string;
  portal?: string;
  tenantId?: string;
  metadata?: Record<string, unknown>;
  defaultHeaders?: Record<string, string>;
  timeout?: number;
  retries?: number;
  rateLimiting?: boolean;
  caching?: boolean;
  defaultCacheTTL?: number;
  csrf?: boolean;
  auth?: {
    tokenHeader?: string;
    refreshEndpoint?: string;
    autoRefresh?: boolean;
  };
  // Lifecycle callbacks
  onUnauthorized?: () => void;
  onError?: (error: ApiError) => void;
  interceptors?: {
    request?: (config: RequestConfig) => RequestConfig;
    response?: <T>(response: ApiResponse<T>) => ApiResponse<T>;
    error?: (error: ApiError) => ApiError;
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  filters?: Record<string, any>;
}

// Portal-specific API endpoints
export interface PortalEndpoints {
  // Auth endpoints
  login: string;
  logout: string;
  refresh: string;
  validate: string;
  csrf: string;

  // Core endpoints
  users: string;
  profile: string;
  settings: string;

  // Feature-specific endpoints (optional)
  billing?: {
    invoices: string;
    payments: string;
    reports: string;
    metrics: string;
  };
  analytics?: {
    dashboard: string;
    reports: string;
    metrics: string;
  };
  monitoring?: {
    status: string;
    metrics: string;
    logs: string;
  };
}

// Built-in portal endpoint configurations
export const PORTAL_ENDPOINTS: Record<string, PortalEndpoints> = {
  admin: {
    login: "/api/admin/auth/login",
    logout: "/api/admin/auth/logout",
    refresh: "/api/admin/auth/refresh",
    validate: "/api/admin/auth/validate",
    csrf: "/api/admin/auth/csrf",
    users: "/api/admin/users",
    profile: "/api/admin/profile",
    settings: "/api/admin/settings",
    billing: {
      invoices: "/api/admin/billing/invoices",
      payments: "/api/admin/billing/payments",
      reports: "/api/admin/billing/reports",
      metrics: "/api/admin/billing/metrics",
    },
    analytics: {
      dashboard: "/api/admin/analytics/dashboard",
      reports: "/api/admin/analytics/reports",
      metrics: "/api/admin/analytics/metrics",
    },
    monitoring: {
      status: "/api/admin/monitoring/status",
      metrics: "/api/admin/monitoring/metrics",
      logs: "/api/admin/monitoring/logs",
    },
  },

  customer: {
    login: "/api/customer/auth/login",
    logout: "/api/customer/auth/logout",
    refresh: "/api/customer/auth/refresh",
    validate: "/api/customer/auth/validate",
    csrf: "/api/customer/auth/csrf",
    users: "/api/customer/users",
    profile: "/api/customer/profile",
    settings: "/api/customer/settings",
    billing: {
      invoices: "/api/customer/billing/invoices",
      payments: "/api/customer/billing/payments",
      reports: "/api/customer/billing/reports",
      metrics: "/api/customer/billing/metrics",
    },
  },

  reseller: {
    login: "/api/reseller/auth/login",
    logout: "/api/reseller/auth/logout",
    refresh: "/api/reseller/auth/refresh",
    validate: "/api/reseller/auth/validate",
    csrf: "/api/reseller/auth/csrf",
    users: "/api/reseller/users",
    profile: "/api/reseller/profile",
    settings: "/api/reseller/settings",
    billing: {
      invoices: "/api/reseller/billing/invoices",
      payments: "/api/reseller/billing/payments",
      reports: "/api/reseller/billing/reports",
      metrics: "/api/reseller/billing/metrics",
    },
    analytics: {
      dashboard: "/api/reseller/analytics/dashboard",
      reports: "/api/reseller/analytics/reports",
      metrics: "/api/reseller/analytics/metrics",
    },
  },

  technician: {
    login: "/api/technician/auth/login",
    logout: "/api/technician/auth/logout",
    refresh: "/api/technician/auth/refresh",
    validate: "/api/technician/auth/validate",
    csrf: "/api/technician/auth/csrf",
    users: "/api/technician/users",
    profile: "/api/technician/profile",
    settings: "/api/technician/settings",
  },

  management: {
    login: "/api/management/auth/login",
    logout: "/api/management/auth/logout",
    refresh: "/api/management/auth/refresh",
    validate: "/api/management/auth/validate",
    csrf: "/api/management/auth/csrf",
    users: "/api/management/users",
    profile: "/api/management/profile",
    settings: "/api/management/settings",
    billing: {
      invoices: "/api/management/billing/invoices",
      payments: "/api/management/billing/payments",
      reports: "/api/management/billing/reports",
      metrics: "/api/management/billing/metrics",
    },
    analytics: {
      dashboard: "/api/management/analytics/dashboard",
      reports: "/api/management/analytics/reports",
      metrics: "/api/management/analytics/metrics",
    },
    monitoring: {
      status: "/api/management/monitoring/status",
      metrics: "/api/management/monitoring/metrics",
      logs: "/api/management/monitoring/logs",
    },
  },
};
