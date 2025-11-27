/**
 * Base API Client
 * Provides common HTTP operations for all module clients with standardized error handling
 * Integrated with audit logging for comprehensive API tracking
 */

import { ISPError, ErrorFactory } from "../../utils/errorUtils";

export interface RequestConfig {
  params?: Record<string, any> | undefined;
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
          const encoded =
            typeof value === "object"
              ? JSON.stringify(value)
              : Array.isArray(value)
                ? JSON.stringify(value)
                : value;
          searchParams.append(key, String(encoded));
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
      signal: this.createTimeoutSignal(timeout),
    };

    if (data && method !== "GET" && method !== "HEAD") {
      requestOptions.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(finalUrl, requestOptions);

      if (!response.ok) {
        throw await this.createHttpError(response, endpoint, method);
      }

      const responseHeaders = this.normalizeHeaders((response as any)?.headers);
      const contentType = responseHeaders?.get?.("content-type");
      if (response && typeof (response as any).json === "function") {
        try {
          return await (response as any).json();
        } catch {
          // fall through to raw response
        }
      }
      if (contentType && contentType.includes("application/json") && (response as any)?.json) {
        return await (response as any).json();
      }

      return (response as unknown) as T;
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
    const responseHeaders = this.normalizeHeaders((response as any)?.headers);

    try {
      const contentType = responseHeaders?.get?.("content-type");
      if (contentType?.includes("application/json")) {
        errorDetails = await response.json();
      } else {
        errorDetails.message = await response.text();
      }
    } catch {
      // Ignore errors parsing response body
    }

    const baseMessage = `${method} ${endpoint} failed with status ${response.status}`;
    const userMessage =
      errorDetails.message ||
      response.statusText ||
      this.getStandardStatusText(response.status) ||
      "Request failed";

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

  private createTimeoutSignal(timeoutMs: number | undefined): AbortSignal | undefined {
    const duration = typeof timeoutMs === "number" ? timeoutMs : 0;
    if (typeof AbortSignal !== "undefined" && typeof (AbortSignal as any).timeout === "function") {
      return (AbortSignal as any).timeout(duration);
    }

    if (typeof AbortController !== "undefined") {
      const controller = new AbortController();
      if (duration > 0) {
        setTimeout(() => controller.abort(), duration);
      }
      return controller.signal;
    }

    return undefined;
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

  private getStandardStatusText(status: number): string | undefined {
    const lookup: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized",
      403: "Forbidden",
      404: "Not Found",
      408: "Request Timeout",
      409: "Conflict",
      422: "Unprocessable Entity",
      429: "Too Many Requests",
      500: "Internal Server Error",
      502: "Bad Gateway",
      503: "Service Unavailable",
      504: "Gateway Timeout",
    };
    return lookup[status];
  }

  private normalizeHeaders(
    headers: Headers | Record<string, string> | undefined,
  ): Headers | undefined {
    if (!headers) {
      return new Headers();
    }

    if (headers instanceof Headers) {
      return headers;
    }

    try {
      return new Headers(headers as Record<string, string>);
    } catch (_e) {
      return undefined;
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
