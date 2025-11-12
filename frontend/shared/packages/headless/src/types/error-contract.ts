/**
 * Standardized Error Response Contract v1.0
 *
 * This module defines the standard error response format used across the entire platform.
 * Both frontend and backend must adhere to this contract for consistent error handling.
 *
 * Version: 1.0
 * Must match: src/dotmac/platform/core/error_contract.py
 */

export enum ErrorSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum ErrorCategory {
  NETWORK = "network",
  VALIDATION = "validation",
  AUTHENTICATION = "authentication",
  AUTHORIZATION = "authorization",
  BUSINESS = "business",
  SYSTEM = "system",
  DATABASE = "database",
  EXTERNAL_SERVICE = "external_service",
  UNKNOWN = "unknown",
}

/**
 * Standard error response format for all API errors.
 *
 * This format is used by both frontend and backend to ensure
 * consistent error handling across the platform.
 */
export interface StandardErrorResponse {
  /** Machine-readable error code (e.g., "VALIDATION_ERROR") */
  error_code: string;

  /** Technical error message for developers */
  message: string;

  /** User-friendly error message for display */
  user_message: string;

  /** Unique identifier for this error instance */
  correlation_id: string;

  /** ISO 8601 timestamp when error occurred */
  timestamp: string;

  /** HTTP status code */
  status: number;

  /** Error severity level */
  severity: ErrorSeverity;

  /** Error category for classification */
  category: ErrorCategory;

  /** Whether the operation can be retried */
  retryable: boolean;

  /** Additional error context (field errors, etc.) */
  details?: Record<string, any>;

  /** Optional suggestion for error recovery */
  recovery_hint?: string;

  /** Optional distributed tracing ID */
  trace_id?: string;

  /** Optional request identifier */
  request_id?: string;
}

/**
 * Options for creating an error response
 */
export interface CreateErrorOptions {
  error_code: string;
  message: string;
  status?: number;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  retryable?: boolean;
  user_message?: string;
  details?: Record<string, any>;
  recovery_hint?: string;
  trace_id?: string;
  request_id?: string;
}

/**
 * HTTP Status Code to Error Category mapping
 */
export const STATUS_TO_CATEGORY: Record<number, ErrorCategory> = {
  400: ErrorCategory.VALIDATION,
  401: ErrorCategory.AUTHENTICATION,
  403: ErrorCategory.AUTHORIZATION,
  404: ErrorCategory.BUSINESS,
  409: ErrorCategory.BUSINESS,
  422: ErrorCategory.VALIDATION,
  429: ErrorCategory.SYSTEM,
  500: ErrorCategory.SYSTEM,
  502: ErrorCategory.EXTERNAL_SERVICE,
  503: ErrorCategory.SYSTEM,
  504: ErrorCategory.NETWORK,
};

/**
 * HTTP Status Code to Error Severity mapping
 */
export const STATUS_TO_SEVERITY: Record<number, ErrorSeverity> = {
  400: ErrorSeverity.LOW,
  401: ErrorSeverity.HIGH,
  403: ErrorSeverity.HIGH,
  404: ErrorSeverity.LOW,
  409: ErrorSeverity.MEDIUM,
  422: ErrorSeverity.LOW,
  429: ErrorSeverity.MEDIUM,
  500: ErrorSeverity.CRITICAL,
  502: ErrorSeverity.HIGH,
  503: ErrorSeverity.CRITICAL,
  504: ErrorSeverity.HIGH,
};

/**
 * HTTP Status Code to Retryable mapping
 */
export const STATUS_TO_RETRYABLE: Record<number, boolean> = {
  400: false,
  401: false,
  403: false,
  404: false,
  409: false,
  422: false,
  429: true, // Rate limit - retry with backoff
  500: true, // Server error - may be transient
  502: true, // Bad gateway - retry
  503: true, // Service unavailable - retry
  504: true, // Gateway timeout - retry
};

/**
 * Map HTTP status code to error category
 */
export function statusToCategory(status: number): ErrorCategory {
  return STATUS_TO_CATEGORY[status] || ErrorCategory.SYSTEM;
}

/**
 * Map HTTP status code to error severity
 */
export function statusToSeverity(status: number): ErrorSeverity {
  return STATUS_TO_SEVERITY[status] || ErrorSeverity.MEDIUM;
}

/**
 * Determine if HTTP status code indicates retryable error
 */
export function isRetryableStatus(status: number): boolean {
  return STATUS_TO_RETRYABLE[status] || false;
}

/**
 * Generate user-friendly message based on error category
 */
export function generateUserMessage(category: ErrorCategory, technicalMessage?: string): string {
  const messages: Record<ErrorCategory, string> = {
    [ErrorCategory.NETWORK]: "Connection problem. Please check your internet and try again.",
    [ErrorCategory.AUTHENTICATION]: "Please log in again to continue.",
    [ErrorCategory.AUTHORIZATION]: "You don't have permission to perform this action.",
    [ErrorCategory.VALIDATION]: "Please check your input and try again.",
    [ErrorCategory.BUSINESS]: "Unable to complete this action. Please try again later.",
    [ErrorCategory.SYSTEM]: "System temporarily unavailable. Please try again in a few minutes.",
    [ErrorCategory.DATABASE]: "Database operation failed. Please try again.",
    [ErrorCategory.EXTERNAL_SERVICE]: "External service unavailable. Please try again later.",
    [ErrorCategory.UNKNOWN]: "Something went wrong. Please try again.",
  };

  return messages[category] || technicalMessage || "An error occurred.";
}

/**
 * Generate a unique correlation ID
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `err_${timestamp}_${random}`;
}

/**
 * Create a standard error response
 */
export function createStandardError(options: CreateErrorOptions): StandardErrorResponse {
  const status = options.status || 500;
  const category = options.category || statusToCategory(status);
  const severity = options.severity || statusToSeverity(status);
  const retryable = options.retryable !== undefined ? options.retryable : isRetryableStatus(status);

  return {
    error_code: options.error_code,
    message: options.message,
    user_message: options.user_message || generateUserMessage(category, options.message),
    correlation_id: generateCorrelationId(),
    timestamp: new Date().toISOString(),
    status,
    severity,
    category,
    retryable,
    details: options.details,
    recovery_hint: options.recovery_hint,
    trace_id: options.trace_id,
    request_id: options.request_id,
  };
}

/**
 * Parse backend error response to standard format
 */
export function parseBackendError(error: any): StandardErrorResponse {
  // If already in standard format
  if (error.error_code && error.correlation_id) {
    return error as StandardErrorResponse;
  }

  // Parse from various backend error formats
  const status = error.status || error.status_code || 500;
  const errorCode = error.error || error.error_code || error.code || "UNKNOWN_ERROR";
  const message = error.message || "An error occurred";
  const details = error.details || {};

  return createStandardError({
    error_code: errorCode,
    message,
    status,
    user_message: error.user_message,
    details,
    recovery_hint: error.recovery_hint,
    trace_id: error.trace_id,
    request_id: error.request_id || error.correlation_id,
  });
}

/**
 * Type guard to check if object is StandardErrorResponse
 */
export function isStandardError(obj: any): obj is StandardErrorResponse {
  return (
    typeof obj === "object" &&
    obj !== null &&
    typeof obj.error_code === "string" &&
    typeof obj.message === "string" &&
    typeof obj.user_message === "string" &&
    typeof obj.correlation_id === "string"
  );
}
