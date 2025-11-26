/**
 * Standardized Error Types and Interfaces
 *
 * Provides consistent error handling across the application
 */

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

/**
 * Error categories for better classification
 */
export enum ErrorCategory {
  NETWORK = 'network',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',
  SERVER = 'server',
  CLIENT = 'client',
  UNKNOWN = 'unknown',
}

/**
 * Standard API error response structure
 */
export interface ApiErrorResponse {
  detail?: string;
  message?: string;
  errors?: Array<{
    field?: string;
    message: string;
    code?: string;
  }>;
  status?: number;
  code?: string;
}

/**
 * Enhanced error information
 */
export interface AppError {
  /** Unique error identifier */
  id: string;

  /** User-friendly error message */
  message: string;

  /** Technical error details (for logging) */
  details?: string;

  /** Error category */
  category: ErrorCategory;

  /** Error severity */
  severity: ErrorSeverity;

  /** HTTP status code (if applicable) */
  statusCode?: number;

  /** Error code for programmatic handling */
  code?: string;

  /** Field-specific validation errors */
  fieldErrors?: Record<string, string[]>;

  /** Original error object */
  originalError?: Error | unknown;

  /** Timestamp when error occurred */
  timestamp: Date;

  /** Whether error can be retried */
  retryable: boolean;

  /** Suggested user action */
  action?: string;

  /** Additional context */
  context?: Record<string, unknown>;
}

// ============================================================================
// Error Response Helpers
// ============================================================================

/**
 * Extract error message from various error formats
 */
export function extractErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    // API error response
    if ('detail' in err && typeof err['detail'] === 'string') {
      return err['detail'] as string;
    }

    if ('message' in err && typeof err['message'] === 'string') {
      return err['message'] as string;
    }

    // Axios error response
    if ('response' in err && err['response']) {
      const response = err['response'] as Record<string, unknown>;
      if (response['data'] && typeof response['data'] === 'object') {
        const data = response['data'] as ApiErrorResponse;
        return data.detail || data.message || 'An error occurred';
      }
    }

    // Native Error object
    if (error instanceof Error) {
      return error.message;
    }
  }

  return 'An unexpected error occurred';
}

/**
 * Extract status code from error
 */
export function extractStatusCode(error: unknown): number | undefined {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    if ('status' in err && typeof err['status'] === 'number') {
      return err['status'] as number;
    }

    if ('statusCode' in err && typeof err['statusCode'] === 'number') {
      return err['statusCode'] as number;
    }

    if ('response' in err && err['response']) {
      const response = err['response'] as Record<string, unknown>;
      if ('status' in response && typeof response['status'] === 'number') {
        return response['status'] as number;
      }
    }
  }

  return undefined;
}

/**
 * Categorize error based on status code and error content
 */
export function categorizeError(error: unknown): ErrorCategory {
  const statusCode = extractStatusCode(error);
  const message = extractErrorMessage(error).toLowerCase();

  if (statusCode) {
    if (statusCode === 401) return ErrorCategory.AUTHENTICATION;
    if (statusCode === 403) return ErrorCategory.AUTHORIZATION;
    if (statusCode === 404) return ErrorCategory.NOT_FOUND;
    if (statusCode === 422 || statusCode === 400) return ErrorCategory.VALIDATION;
    if (statusCode >= 500) return ErrorCategory.SERVER;
    if (statusCode >= 400) return ErrorCategory.CLIENT;
  }

  if (message.includes('network') || message.includes('fetch')) {
    return ErrorCategory.NETWORK;
  }

  if (message.includes('unauthorized') || message.includes('token')) {
    return ErrorCategory.AUTHENTICATION;
  }

  if (message.includes('forbidden') || message.includes('permission')) {
    return ErrorCategory.AUTHORIZATION;
  }

  if (message.includes('not found')) {
    return ErrorCategory.NOT_FOUND;
  }

  if (message.includes('validation') || message.includes('invalid')) {
    return ErrorCategory.VALIDATION;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Determine if error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const statusCode = extractStatusCode(error);
  const category = categorizeError(error);

  // Network errors are generally retryable
  if (category === ErrorCategory.NETWORK) {
    return true;
  }

  // Server errors might be temporary
  if (statusCode && statusCode >= 500) {
    return true;
  }

  // Rate limiting (429) is retryable
  if (statusCode === 429) {
    return true;
  }

  // Timeout errors are retryable
  const message = extractErrorMessage(error).toLowerCase();
  if (message.includes('timeout') || message.includes('timed out')) {
    return true;
  }

  return false;
}

/**
 * Get suggested user action based on error
 */
export function getSuggestedAction(error: unknown): string | undefined {
  const category = categorizeError(error);
  const statusCode = extractStatusCode(error);

  switch (category) {
    case ErrorCategory.AUTHENTICATION:
      return 'Please log in again';
    case ErrorCategory.AUTHORIZATION:
      return 'Contact your administrator for access';
    case ErrorCategory.NETWORK:
      return 'Check your internet connection and try again';
    case ErrorCategory.NOT_FOUND:
      return 'The requested resource could not be found';
    case ErrorCategory.VALIDATION:
      return 'Please check your input and try again';
    case ErrorCategory.SERVER:
      return 'Our team has been notified. Please try again later';
    default:
      if (statusCode === 429) {
        return 'Too many requests. Please wait a moment';
      }
      if (isRetryableError(error)) {
        return 'Please try again';
      }
      return undefined;
  }
}

/**
 * Create a standardized app error from any error type
 */
export function createAppError(error: unknown, context?: Record<string, unknown>): AppError {
  const category = categorizeError(error);
  const statusCode = extractStatusCode(error);
  const message = extractErrorMessage(error);

  let severity = ErrorSeverity.ERROR;
  if (category === ErrorCategory.AUTHENTICATION || category === ErrorCategory.AUTHORIZATION) {
    severity = ErrorSeverity.WARNING;
  } else if (statusCode && statusCode >= 500) {
    severity = ErrorSeverity.CRITICAL;
  }

  const action = getSuggestedAction(error);

  const appError: AppError = {
    id: crypto.randomUUID(),
    message,
    details: error instanceof Error ? (error.stack ?? '') : JSON.stringify(error),
    category,
    severity,
    originalError: error,
    timestamp: new Date(),
    retryable: isRetryableError(error),
    action: action ?? 'Please try again or contact support',
  };

  if (statusCode !== undefined) {
    appError.statusCode = statusCode;
  }

  if (context !== undefined) {
    appError.context = context;
  }

  return appError;
}

/**
 * Check if error requires authentication
 */
export function isAuthError(error: unknown): boolean {
  const statusCode = extractStatusCode(error);
  return statusCode === 401 || categorizeError(error) === ErrorCategory.AUTHENTICATION;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  const statusCode = extractStatusCode(error);
  return statusCode === 422 || statusCode === 400 || categorizeError(error) === ErrorCategory.VALIDATION;
}

/**
 * Extract field errors from API validation error
 */
export function extractFieldErrors(error: unknown): Record<string, string[]> | undefined {
  if (error && typeof error === 'object') {
    const err = error as Record<string, unknown>;

    if ('response' in err && err['response']) {
      const response = err['response'] as Record<string, unknown>;
      if (response['data'] && typeof response['data'] === 'object') {
        const data = response['data'] as ApiErrorResponse;

        if (data.errors && Array.isArray(data.errors)) {
          const fieldErrors: Record<string, string[]> = {};

          data.errors.forEach((error) => {
            if (error?.field) {
              if (!fieldErrors[error.field]) {
                fieldErrors[error.field] = [];
              }
              fieldErrors[error.field]?.push(error.message);
            }
          });

          return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
        }
      }
    }
  }

  return undefined;
}
