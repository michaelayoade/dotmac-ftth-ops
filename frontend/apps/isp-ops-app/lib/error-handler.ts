/**
 * Centralized Error Handler
 *
 * Provides consistent error handling across the application.
 * Handles API errors, validation errors, and unexpected errors.
 *
 * @example
 * ```ts
 * import { handleApiError, handleError } from '@/lib/error-handler';
 *
 * try {
 *   const response = await apiClient.get('/api/users');
 * } catch (error) {
 *   handleApiError(error, { showToast: true });
 * }
 * ```
 */

import { logger } from "./logger";
import { ROUTES } from "./routes";

export interface ErrorOptions {
  /**
   * Show toast notification to user
   * @default true
   */
  showToast?: boolean;

  /**
   * Custom error message to display to user
   * If not provided, will use error message from API
   */
  userMessage?: string;

  /**
   * Redirect to login on 401 errors
   * @default true
   */
  redirectOnUnauthorized?: boolean;

  /**
   * Additional context for logging
   */
  context?: Record<string, unknown>;

  /**
   * Callback function to execute after handling error
   */
  onError?: (error: Error) => void;
}

export interface ApiError extends Error {
  status?: number;
  statusText?: string;
  data?: unknown;
  config?: {
    url?: string;
    method?: string;
  };
}

/**
 * Check if error is an API error (from axios or fetch)
 */
export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof Error && ("status" in error || "response" in error);
};

/**
 * Get user-friendly error message from error object
 */
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error["message"];
  }

  if (typeof error === "string") {
    return error;
  }

  if (isApiError(error) && error["data"]) {
    const data = error["data"] as Record<string, unknown>;
    if (data["message"] && typeof data["message"] === "string") {
      return data["message"];
    }
    if (data["detail"] && typeof data["detail"] === "string") {
      return data["detail"];
    }
  }

  return "An unexpected error occurred. Please try again.";
};

/**
 * Get error status code if available
 */
export const getErrorStatus = (error: unknown): number | undefined => {
  if (isApiError(error)) {
    return error["status"];
  }

  // Check for axios error response
  if (
    error &&
    typeof error === "object" &&
    "response" in error &&
    error["response"] &&
    typeof error.response === "object" &&
    "status" in error["response"]
  ) {
    return (error["response"] as { status: number }).status;
  }

  return undefined;
};

/**
 * Show toast notification (needs to be implemented in component)
 * This is a placeholder - should be replaced with actual toast implementation
 */
const showToastNotification = (options: {
  title: string;
  description?: string;
  variant: "default" | "destructive";
}) => {
  // In a real implementation, this would use the toast context
  // For now, we'll dispatch a custom event that can be listened to
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("toast", {
        detail: options,
      }),
    );
  }
};

/**
 * Handle API errors with consistent behavior
 */
export const handleApiError = (error: unknown, options: ErrorOptions = {}): void => {
  const {
    showToast = true,
    userMessage,
    redirectOnUnauthorized = true,
    context,
    onError,
  } = options;

  const status = getErrorStatus(error);
  const message = userMessage || getErrorMessage(error);

  // Log error with context
  logger.error("API Error", error, {
    status,
    message,
    ...context,
  });

  // Handle 401 Unauthorized - redirect to login
  if (status === 401 && redirectOnUnauthorized) {
    if (typeof window !== "undefined") {
      // Save current path for redirect after login
      const currentPath = window.location.pathname;
      if (currentPath !== ROUTES.LOGIN) {
        sessionStorage.setItem("redirectAfterLogin", currentPath);
      }

      // Redirect to login
      window.location.href = ROUTES.LOGIN;
    }
    return;
  }

  // Handle 403 Forbidden
  if (status === 403) {
    if (showToast) {
      showToastNotification({
        title: "Access Denied",
        description: "You do not have permission to perform this action.",
        variant: "destructive",
      });
    }
  }

  // Handle 404 Not Found
  else if (status === 404) {
    if (showToast) {
      showToastNotification({
        title: "Not Found",
        description: message,
        variant: "destructive",
      });
    }
  }

  // Handle 422 Validation Error
  else if (status === 422) {
    if (showToast) {
      showToastNotification({
        title: "Validation Error",
        description: message,
        variant: "destructive",
      });
    }
  }

  // Handle 500 Internal Server Error
  else if (status && status >= 500) {
    if (showToast) {
      showToastNotification({
        title: "Server Error",
        description: "An unexpected server error occurred. Please try again later.",
        variant: "destructive",
      });
    }
  }

  // Handle all other errors
  else {
    if (showToast) {
      showToastNotification({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  }

  // Call custom error handler if provided
  if (onError && error instanceof Error) {
    onError(error);
  }
};

/**
 * Handle general errors (non-API)
 */
export const handleError = (error: unknown, options: ErrorOptions = {}): void => {
  const { showToast = true, userMessage, context, onError } = options;

  const message = userMessage || getErrorMessage(error);

  // Log error
  logger.error("Error", error, context);

  // Show toast notification
  if (showToast) {
    showToastNotification({
      title: "Error",
      description: message,
      variant: "destructive",
    });
  }

  // Call custom error handler if provided
  if (onError && error instanceof Error) {
    onError(error);
  }
};

/**
 * Handle validation errors
 */
export const handleValidationError = (
  errors: Record<string, string[]>,
  options: ErrorOptions = {},
): void => {
  const { showToast = true } = options;

  // Log validation errors
  logger.warn("Validation errors", { errors });

  if (showToast) {
    // Get first error message
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      const firstError = errors[firstField]?.[0];

      if (firstError) {
        showToastNotification({
          title: "Validation Error",
          description: firstError,
          variant: "destructive",
        });
      }
    }
  }
};

/**
 * Create error boundary handler
 */
export const createErrorBoundaryHandler = (componentName: string) => {
  return (error: Error, errorInfo: React.ErrorInfo): void => {
    logger.error(`Error in ${componentName}`, error, {
      componentStack: errorInfo.componentStack,
    });

    // In production, you might want to send this to an error tracking service
    if (process["env"].NODE_ENV === "production") {
      // Send to error tracking service (e.g., Sentry)
      // sendToErrorTracking(error, { componentName, ...errorInfo });
    }
  };
};

/**
 * Wrap async function with error handling
 */
export const withErrorHandling = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  options: ErrorOptions = {},
): T => {
  return (async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (error) {
      handleApiError(error, options);
      throw error; // Re-throw to allow caller to handle if needed
    }
  }) as T;
};
