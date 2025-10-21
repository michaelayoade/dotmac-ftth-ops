export interface HttpClientConfig {
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  tenantIdSource?: "header" | "subdomain" | "query" | "cookie";
  authTokenSource?: "cookie" | "localStorage" | "sessionStorage";
}

export interface RequestConfig extends Omit<import("axios").AxiosRequestConfig, "url"> {
  skipAuth?: boolean;
  skipTenantId?: boolean;
  skipRetry?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RetryConfig {
  retries: number;
  retryDelay: number;
  shouldRetry: (error: any) => boolean;
}

export interface TenantConfig {
  tenantId: string;
  source: "header" | "subdomain" | "query" | "cookie";
}
