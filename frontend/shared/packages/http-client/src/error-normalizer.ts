import type { AxiosError } from "axios";
import type { ApiError } from "./types";

export class ErrorNormalizer {
  static normalize(error: any): ApiError {
    if (error.isAxiosError) {
      return this.normalizeAxiosError(error as AxiosError);
    }

    if (error instanceof Error) {
      return this.normalizeGenericError(error);
    }

    if (typeof error === "string") {
      return {
        message: error,
        code: "UNKNOWN_ERROR",
      };
    }

    return {
      message: "An unknown error occurred",
      code: "UNKNOWN_ERROR",
      details: error,
    };
  }

  private static normalizeAxiosError(error: AxiosError): ApiError {
    const { response, request, message } = error;

    if (response) {
      // Server responded with error status
      const { status, data } = response;

      // Try to extract error message from response data
      const errorMessage = this.extractErrorMessage(data);

      return {
        message: errorMessage || this.getStatusMessage(status),
        code: this.getErrorCode(status),
        status,
        details: data,
      };
    }

    if (request) {
      // Request was made but no response received
      return {
        message: "Network error - no response received",
        code: "NETWORK_ERROR",
      };
    }

    // Request setup error
    return {
      message: message || "Request configuration error",
      code: "REQUEST_ERROR",
    };
  }

  private static normalizeGenericError(error: Error): ApiError {
    return {
      message: error.message || "An error occurred",
      code: "GENERIC_ERROR",
    };
  }

  private static extractErrorMessage(data: any): string | null {
    if (!data) return null;

    // Common error message patterns
    if (typeof data === "string") return data;
    if (data.message) return data.message;
    if (data.error) return data.error;
    if (data.detail) return data.detail;
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      return data.errors[0];
    }

    return null;
  }

  private static getStatusMessage(status: number): string {
    const statusMessages: Record<number, string> = {
      400: "Bad Request",
      401: "Unauthorized - Please log in",
      403: "Forbidden - Access denied",
      404: "Resource not found",
      409: "Conflict - Resource already exists",
      422: "Validation error",
      429: "Too many requests - Please try again later",
      500: "Internal server error",
      502: "Bad Gateway",
      503: "Service unavailable",
      504: "Gateway timeout",
    };

    return statusMessages[status] || `HTTP Error ${status}`;
  }

  private static getErrorCode(status: number): string {
    const statusCodes: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "VALIDATION_ERROR",
      429: "TOO_MANY_REQUESTS",
      500: "INTERNAL_SERVER_ERROR",
      502: "BAD_GATEWAY",
      503: "SERVICE_UNAVAILABLE",
      504: "GATEWAY_TIMEOUT",
    };

    return statusCodes[status] || "HTTP_ERROR";
  }

  static isNetworkError(error: ApiError): boolean {
    return error.code === "NETWORK_ERROR";
  }

  static isAuthError(error: ApiError): boolean {
    return error.status === 401 || error.code === "UNAUTHORIZED";
  }

  static isValidationError(error: ApiError): boolean {
    return error.status === 422 || error.code === "VALIDATION_ERROR";
  }

  static isRetryableError(error: ApiError): boolean {
    if (this.isNetworkError(error)) return true;
    if (error.status && [429, 502, 503, 504].includes(error.status)) return true;
    return false;
  }
}
