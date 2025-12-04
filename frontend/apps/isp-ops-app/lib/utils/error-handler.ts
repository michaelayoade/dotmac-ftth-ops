/**
 * Error Handler Utility
 *
 * Centralized error handling for the application.
 */

import { AxiosError } from "axios";
import { alertService } from "../services/alert-service";
import { logger } from "../logger";

export interface ErrorDetails {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, any>;
}

/**
 * Parse error into standardized format
 */
export function parseError(error: unknown): ErrorDetails {
  // Axios error
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

  // Standard Error
  if (error instanceof Error) {
    return {
      message: error.message,
      code: "ERROR",
    };
  }

  // Unknown error
  return {
    message: String(error) || "An unknown error occurred",
    code: "UNKNOWN_ERROR",
  };
}

/**
 * Handle error with logging and user notification
 */
export function handleError(
  error: unknown,
  context?: string,
  showAlert: boolean = true,
): ErrorDetails {
  const errorDetails = parseError(error);

  // Log error
  logger.error(context ? `${context}: ${errorDetails.message}` : errorDetails.message, error, {
    code: errorDetails.code,
    status: errorDetails.status,
    details: errorDetails.details,
  });

  // Show alert to user if requested
  if (showAlert) {
    alertService.error(errorDetails.message, context ? `${context} Failed` : "Error");
  }

  return errorDetails;
}

/**
 * Handle validation errors
 */
export function handleValidationError(
  error: unknown,
  showAlert: boolean = true,
): Record<string, string[]> {
  const errorDetails = parseError(error);

  // Extract field-level validation errors if available
  const fieldErrors = errorDetails.details?.["fields"] || {};

  if (showAlert && Object.keys(fieldErrors).length === 0) {
    alertService.error(errorDetails.message, "Validation Error");
  }

  return fieldErrors;
}

/**
 * Handle API error with automatic retry logic
 */
export async function handleApiErrorWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      const errorDetails = parseError(error);

      // Don't retry on client errors (4xx)
      if (errorDetails.status && errorDetails.status >= 400 && errorDetails.status < 500) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));

      logger.warn(`Retrying operation (attempt ${attempt + 1}/${maxRetries})`, {
        error: errorDetails.message,
      });
    }
  }

  throw lastError;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  const errorDetails = parseError(error);

  // Map common error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    NETWORK_ERROR: "Unable to connect to the server. Please check your internet connection.",
    UNAUTHORIZED: "You are not authorized to perform this action. Please log in again.",
    FORBIDDEN: "You do not have permission to access this resource.",
    NOT_FOUND: "The requested resource was not found.",
    VALIDATION_ERROR: "Please check your input and try again.",
    TIMEOUT_ERROR: "The request timed out. Please try again.",
    SERVER_ERROR: "A server error occurred. Please try again later.",
  };

  return errorMessages[errorDetails.code || ""] || errorDetails.message;
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  const errorDetails = parseError(error);

  // Network errors and 5xx errors are potentially recoverable
  if (errorDetails.code === "NETWORK_ERROR") {
    return true;
  }

  if (errorDetails.status && errorDetails.status >= 500) {
    return true;
  }

  return false;
}

export const errorHandler = {
  parseError,
  handleError,
  handleValidationError,
  handleApiErrorWithRetry,
  getUserFriendlyErrorMessage,
  isRecoverableError,
};

export default errorHandler;
