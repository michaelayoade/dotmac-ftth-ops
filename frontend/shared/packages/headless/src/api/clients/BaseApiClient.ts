/**
 * Base API Client
 * Provides common HTTP operations for all module clients with standardized error handling
 * Integrated with audit logging for comprehensive API tracking
 */

import { ISPError, ErrorFactory } from "../../utils/errorUtils";

export interface RequestConfig {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  timeout?: number;
  retryable?: boolean;
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

export class BaseApiClient {
  protected baseURL: string;
  protected defaultHeaders: Record<string, string>;
  protected context: string;

  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}, context = "API") {
    this.baseURL = baseURL;
    this.defaultHeaders = defaultHeaders;
    this.context = context;
  }

  protected async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    config: RequestConfig = {},
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const { params, headers = {}, timeout = 30000, retryable = true } = config;

    // Build query string
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }

    const finalUrl = searchParams.toString() ? `${url}?${searchParams.toString()}` : url;

    const requestOptions: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...this.defaultHeaders,
        ...headers,
      },
      signal: AbortSignal.timeout(timeout),
    };

    if (data && method !== "GET" && method !== "HEAD") {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(finalUrl, requestOptions);

      if (!response.ok) {
        throw this.createHttpError(response, endpoint, method);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }

      return response as T;
    } catch (error) {
      if (error instanceof ISPError) {
        throw error;
      }

      // Handle different error types
      if (error instanceof TypeError && error.message.includes("fetch")) {
        throw ErrorFactory.network(
          `Network error for ${method} ${endpoint}: ${error.message}`,
          `${this.context} - ${endpoint}`,
        );
      }

      if ((error as any)?.name === "AbortError") {
        throw new ISPError({
          message: `Request timeout for ${method} ${endpoint}`,
          category: "network",
          severity: "medium",
          context: `${this.context} - ${endpoint}`,
          retryable: retryable,
          userMessage: "Request timed out. Please try again.",
          technicalDetails: { method, endpoint, timeout },
        });
      }

      // Generic error fallback
      throw ErrorFactory.system(
        `Request failed for ${method} ${endpoint}: ${(error as any)?.message || "Unknown error"}`,
        `${this.context} - ${endpoint}`,
      );
    }
  }

  private async createHttpError(
    response: Response,
    endpoint: string,
    method: string,
  ): Promise<ISPError> {
    let errorDetails: any = {};

    try {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        errorDetails = await response.json();
      } else {
        errorDetails.message = await response.text();
      }
    } catch {
      // Ignore errors parsing response body
    }

    const baseMessage = `${method} ${endpoint} failed with status ${response.status}`;
    const userMessage = errorDetails.message || response.statusText || "Request failed";

    return new ISPError({
      message: `${baseMessage}: ${userMessage}`,
      status: response.status,
      code: errorDetails.code || `HTTP_${response.status}`,
      category: this.categorizeHttpError(response.status),
      severity: this.getSeverityForStatus(response.status),
      context: `${this.context} - ${endpoint}`,
      retryable: this.isRetryableStatus(response.status),
      userMessage: this.getUserMessageForStatus(response.status, userMessage),
      technicalDetails: {
        method,
        endpoint,
        status: response.status,
        statusText: response.statusText,
        responseBody: errorDetails,
      },
    });
  }

  private categorizeHttpError(
    status: number,
  ):
    | "network"
    | "validation"
    | "authentication"
    | "authorization"
    | "business"
    | "system"
    | "unknown" {
    if (status === 401) return "authentication";
    if (status === 403) return "authorization";
    if (status === 422 || (status >= 400 && status < 500)) return "validation";
    if (status >= 500) return "system";
    return "network";
  }

  private getSeverityForStatus(status: number): "low" | "medium" | "high" | "critical" {
    if (status === 401 || status === 403) return "high";
    if (status >= 500) return "critical";
    if (status === 429) return "medium";
    if (status >= 400 && status < 500) return "low";
    return "medium";
  }

  private isRetryableStatus(status: number): boolean {
    // Retry on server errors, rate limits, and some network issues
    return status >= 500 || status === 429 || status === 408 || status === 0;
  }

  private getUserMessageForStatus(status: number, serverMessage: string): string {
    switch (status) {
      case 401:
        return "Please log in again to continue.";
      case 403:
        return "You don't have permission to perform this action.";
      case 404:
        return "The requested resource was not found.";
      case 409:
        return "This action conflicts with the current state. Please refresh and try again.";
      case 422:
        return "Please check your input and try again.";
      case 429:
        return "Too many requests. Please wait a moment before trying again.";
      case 500:
        return "Server error. Please try again in a few minutes.";
      case 502:
      case 503:
      case 504:
        return "Service temporarily unavailable. Please try again later.";
      default:
        return serverMessage || "Something went wrong. Please try again.";
    }
  }

  protected async get<T = any>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>("GET", endpoint, undefined, config);
  }

  protected async post<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>("POST", endpoint, data, config);
  }

  protected async put<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>("PUT", endpoint, data, config);
  }

  protected async patch<T = any>(endpoint: string, data?: any, config?: RequestConfig): Promise<T> {
    return this.request<T>("PATCH", endpoint, data, config);
  }

  protected async delete<T = any>(endpoint: string, config?: RequestConfig): Promise<T> {
    return this.request<T>("DELETE", endpoint, undefined, config);
  }
}
