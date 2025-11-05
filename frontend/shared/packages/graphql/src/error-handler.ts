/**
 * GraphQL Error Handler
 *
 * Centralized error handling with logging and toast notifications.
 * Extracts error codes from GraphQLError.extensions and maps to appropriate
 * toast variants.
 */

import { GraphQLError as GQLError } from './client';

/**
 * Error code to toast variant mapping
 * Based on GraphQL error extensions
 */
export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface ErrorHandlerContext {
  operation?: string;
  componentName?: string;
  userId?: string;
  tenantId?: string;
  additionalData?: Record<string, any>;
}

export interface ErrorHandlerResult {
  message: string;
  severity: ErrorSeverity;
  code?: string;
  shouldToast: boolean;
  shouldLog: boolean;
}

/**
 * Maps GraphQL error extensions code to severity
 */
function getErrorSeverity(code?: string): ErrorSeverity {
  if (!code) return ErrorSeverity.ERROR;

  // Critical errors - system failures
  if (code.includes('INTERNAL_SERVER_ERROR') || code.includes('DATABASE_ERROR')) {
    return ErrorSeverity.CRITICAL;
  }

  // Warnings - client errors that might be recoverable
  if (
    code.includes('VALIDATION_ERROR') ||
    code.includes('BAD_USER_INPUT') ||
    code.includes('NOT_FOUND')
  ) {
    return ErrorSeverity.WARNING;
  }

  // Info - expected errors (auth, permissions)
  if (
    code.includes('UNAUTHENTICATED') ||
    code.includes('FORBIDDEN') ||
    code.includes('UNAUTHORIZED')
  ) {
    return ErrorSeverity.INFO;
  }

  // Default to error
  return ErrorSeverity.ERROR;
}

/**
 * Handles GraphQL errors with consistent logging and toast behavior
 *
 * @example
 * ```tsx
 * const { data, error } = useCustomerListQuery(...);
 *
 * useEffect(() => {
 *   if (error) {
 *     const result = handleGraphQLError(error, {
 *       operation: 'CustomerList',
 *       componentName: 'CustomerDashboard',
 *     });
 *
 *     if (result.shouldToast) {
 *       toast[result.severity](result.message);
 *     }
 *   }
 * }, [error]);
 * ```
 */
export function handleGraphQLError(
  error: unknown,
  context: ErrorHandlerContext = {},
): ErrorHandlerResult {
  // Extract error details
  let message = 'An unexpected error occurred';
  let code: string | undefined;
  let extensions: Record<string, any> | undefined;

  if (error instanceof GQLError) {
    message = error.message;
    if (error.errors && error.errors.length > 0) {
      const firstError = error.errors[0];
      code = firstError.extensions?.code as string | undefined;
      extensions = firstError.extensions;
    }
  } else if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === 'string') {
    message = error;
  }

  const severity = getErrorSeverity(code);

  // Determine if we should toast (skip for certain error codes)
  const skipToastCodes = ['UNAUTHENTICATED', 'SESSION_EXPIRED'];
  const shouldToast = !code || !skipToastCodes.includes(code);

  // Always log errors (can be filtered by severity in logger)
  const shouldLog = true;

  // Log to console (in production, this would go to a logging service)
  if (shouldLog) {
    const logContext = {
      severity,
      code,
      extensions,
      ...context,
    };

    console.error(`[GraphQL Error] ${message}`, logContext);
  }

  return {
    message,
    severity,
    code,
    shouldToast,
    shouldLog,
  };
}

/**
 * Hook-friendly error handler that returns toast-ready values
 *
 * @example
 * ```tsx
 * const { data, error } = useCustomerListQuery(...);
 * const errorState = useErrorHandler(error, { operation: 'CustomerList' });
 *
 * useEffect(() => {
 *   if (errorState) {
 *     toast[errorState.severity](errorState.message);
 *   }
 * }, [errorState]);
 * ```
 */
export function useErrorHandler(
  error: unknown,
  context: ErrorHandlerContext = {},
): ErrorHandlerResult | null {
  if (!error) return null;
  return handleGraphQLError(error, context);
}

/**
 * User-friendly error messages for common codes
 */
export const ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: 'Please log in to continue',
  FORBIDDEN: 'You do not have permission to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  VALIDATION_ERROR: 'Please check your input and try again',
  INTERNAL_SERVER_ERROR: 'A server error occurred. Please try again later',
  DATABASE_ERROR: 'Unable to access data. Please try again later',
  NETWORK_ERROR: 'Network error. Please check your connection',
  TIMEOUT: 'Request timed out. Please try again',
};

/**
 * Gets user-friendly message for error code
 */
export function getUserFriendlyMessage(code?: string): string {
  if (!code) return 'An unexpected error occurred';
  return ERROR_MESSAGES[code] || 'An error occurred. Please try again';
}

/**
 * Enhanced error handler with user-friendly messages
 */
export function handleGraphQLErrorWithFriendlyMessage(
  error: unknown,
  context: ErrorHandlerContext = {},
): ErrorHandlerResult {
  const result = handleGraphQLError(error, context);

  // Replace technical message with user-friendly one
  if (result.code) {
    const friendlyMessage = getUserFriendlyMessage(result.code);
    return {
      ...result,
      message: friendlyMessage,
    };
  }

  return result;
}
