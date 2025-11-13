/**
 * API Response Helpers
 *
 * Utilities for handling API responses consistently.
 */

import { AxiosError, AxiosResponse } from "axios";

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T = any> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Extract data from API response
 */
export function extractData<T>(response: AxiosResponse<T>): T {
  return response.data;
}

/**
 * Extract data or throw error
 */
export function extractDataOrThrow<T>(response: AxiosResponse<T>, errorMessage?: string): T {
  if (response.status >= 400) {
    throw new Error(errorMessage || response.statusText || "Request failed");
  }
  return response.data;
}

/**
 * Handle API error
 */
export function handleApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const response = error.response;

    if (response) {
      return {
        message: response.data?.message || response.data?.detail || error.message,
        code: response.data?.error || response.data?.code,
        status: response.status,
        details: response.data?.details,
      };
    }

    return {
      message: error.message || "Network error occurred",
      code: "NETWORK_ERROR",
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      code: "UNKNOWN_ERROR",
    };
  }

  return {
    message: "An unknown error occurred",
    code: "UNKNOWN_ERROR",
  };
}

/**
 * Check if error is a specific HTTP status
 */
export function isHttpError(error: unknown, status: number): boolean {
  if (error instanceof AxiosError && error.response) {
    return error.response.status === status;
  }
  return false;
}

/**
 * Check if error is unauthorized (401)
 */
export function isUnauthorizedError(error: unknown): boolean {
  return isHttpError(error, 401);
}

/**
 * Check if error is forbidden (403)
 */
export function isForbiddenError(error: unknown): boolean {
  return isHttpError(error, 403);
}

/**
 * Check if error is not found (404)
 */
export function isNotFoundError(error: unknown): boolean {
  return isHttpError(error, 404);
}

/**
 * Check if error is validation error (422)
 */
export function isValidationError(error: unknown): boolean {
  return isHttpError(error, 422);
}

/**
 * Extract validation errors from response
 */
export function extractValidationErrors(error: unknown): Record<string, string[]> {
  if (error instanceof AxiosError && error.response?.data?.details?.fields) {
    return error.response.data.details.fields;
  }
  return {};
}

/**
 * Format paginated response
 */
export function formatPaginatedResponse<T>(
  response: AxiosResponse<PaginatedResponse<T>>,
): PaginatedResponse<T> {
  return response.data;
}

/**
 * Create success response
 */
export function createSuccessResponse<T>(data: T, message?: string): ApiResponse<T> {
  const response: ApiResponse<T> = {
    data,
    success: true,
  };

  if (message) {
    response.message = message;
  }

  return response;
}

/**
 * Create error response
 */
export function createErrorResponse(error: ApiError): ApiResponse<null> {
  return {
    data: null,
    message: error.message,
    success: false,
  };
}

const responseHelpers = {
  extractData,
  handleApiError,
  isHttpError,
  isUnauthorizedError,
  isForbiddenError,
  isNotFoundError,
  isValidationError,
  extractValidationErrors,
  formatPaginatedResponse,
  createSuccessResponse,
  createErrorResponse,
};

export default responseHelpers;
