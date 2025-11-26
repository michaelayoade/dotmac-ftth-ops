/**
 * Enhanced Error Handler Hook
 * Provides comprehensive error handling with business context and user experience
 */

import { useCallback, useEffect, useState } from "react";
import {
  EnhancedISPError,
  EnhancedErrorFactory,
  ErrorCode,
  type ErrorContext,
} from "../utils/enhancedErrorHandling";
import { errorLogger } from "../services/ErrorLoggingService";

const mergeErrorContext = (base: ErrorContext, updates?: Partial<ErrorContext>): ErrorContext => {
  if (!updates) {
    return base;
  }

  const merged = { ...base } as ErrorContext & Record<string, unknown>;
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }

  return merged;
};

export interface ErrorHandlerConfig {
  enableAutoRecovery: boolean;
  enableUserNotifications: boolean;
  enableMetrics: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
  context?: Partial<ErrorContext>;
}

export interface ErrorState {
  error: EnhancedISPError | null;
  isRetrying: boolean;
  retryCount: number;
  canRetry: boolean;
  lastRetryAt?: Date;
}

export interface UseEnhancedErrorHandlerResult {
  // Current error state
  errorState: ErrorState;

  // Error handling methods
  handleError: (error: unknown, context?: Partial<ErrorContext>) => EnhancedISPError;
  handleApiError: (error: any, operation: string, resource?: string) => EnhancedISPError;
  handleBusinessError: (
    code: ErrorCode,
    message: string,
    businessProcess: string,
    customerImpact?: "none" | "low" | "medium" | "high" | "critical",
  ) => EnhancedISPError;

  // Recovery methods
  retry: () => Promise<void>;
  clearError: () => void;

  // Utility methods
  createErrorContext: (operation: string, resource?: string) => ErrorContext;
  isRecoverableError: (error: EnhancedISPError) => boolean;
}

const defaultConfig: ErrorHandlerConfig = {
  enableAutoRecovery: true,
  enableUserNotifications: true,
  enableMetrics: true,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
};

export function useEnhancedErrorHandler(
  config: Partial<ErrorHandlerConfig> = {},
  onRetry?: (error: EnhancedISPError) => Promise<void>,
): UseEnhancedErrorHandlerResult {
  const finalConfig = { ...defaultConfig, ...config };

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    isRetrying: false,
    retryCount: 0,
    canRetry: false,
  });

  // Generate correlation ID for request tracking
  const generateCorrelationId = useCallback(() => {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Create standardized error context
  const createErrorContext = useCallback(
    (operation: string, resource?: string): ErrorContext => {
      const baseContext: ErrorContext = {
        operation,
        correlationId: generateCorrelationId(),
        service: "isp-frontend",
        component: "error-handler",
        version: process.env["REACT_APP_VERSION"] || "1.0.0",
        environment: process.env["NODE_ENV"] || "development",
      };

      if (resource) {
        baseContext.resource = resource;
      }

      return mergeErrorContext(baseContext, finalConfig.context);
    },
    [finalConfig.context, generateCorrelationId],
  );

  // Enhanced error handler with business context
  const handleError = useCallback(
    (error: unknown, context?: Partial<ErrorContext>): EnhancedISPError => {
      // If already an enhanced error, just update context
      if (error instanceof EnhancedISPError) {
        const mergedContext = mergeErrorContext(error.enhancedContext, context);
        const enhancedParams: ConstructorParameters<typeof EnhancedISPError>[0] = {
          code: error.errorCode,
          message: error.message,
          context: mergedContext,
          category: error.category,
          severity: error.severity,
        };

        if (typeof error.status === "number") {
          enhancedParams.status = error.status;
        }

        if (error.userMessage) {
          enhancedParams.userMessage = error.userMessage;
        }

        if (typeof error.retryable === "boolean") {
          enhancedParams.retryable = error.retryable;
        }

        if (error.technicalDetails) {
          enhancedParams.technicalDetails = error.technicalDetails;
        }

        const enhancedError = new EnhancedISPError(enhancedParams);

        setErrorState((prev) => ({
          error: enhancedError,
          isRetrying: false,
          retryCount: 0,
          canRetry: enhancedError.retryable && finalConfig.enableAutoRecovery,
        }));

        // Log the error
        if (finalConfig.enableMetrics) {
          errorLogger.logError(enhancedError, context as any);
        }

        return enhancedError;
      }

      // Handle different error types
      let enhancedError: EnhancedISPError;

      if (error instanceof Error) {
        // Network/fetch errors
        if (error.message.includes("fetch")) {
          enhancedError = EnhancedErrorFactory.network(error.message, context?.operation);
        }
        // Generic JavaScript errors
        else {
          enhancedError = new EnhancedISPError({
            code: ErrorCode.UNKNOWN_ERROR,
            message: error.message,
            context: mergeErrorContext(
              createErrorContext(context?.operation || "unknown"),
              context,
            ),
            technicalDetails: {
              stack: error.stack,
              name: error.name,
            },
          });
        }
      }
      // HTTP response errors
      else if (error && typeof error === "object" && "status" in error) {
        const status = (error as any).status;
        const message = (error as any).message || `HTTP ${status} error`;

        if (status === 401) {
          enhancedError = EnhancedErrorFactory.authentication(context?.operation);
        } else if (status === 403) {
          enhancedError = EnhancedErrorFactory.authorization(
            context?.resource || "resource",
            context?.operation,
          );
        } else if (status === 422) {
          enhancedError = EnhancedErrorFactory.validation(
            message,
            context?.operation,
            (error as any).details,
          );
        } else if (status >= 500) {
          enhancedError = EnhancedErrorFactory.system(message, context?.operation);
        } else {
          enhancedError = new EnhancedISPError({
            code: ErrorCode.UNKNOWN_ERROR,
            message,
            context: mergeErrorContext(
              createErrorContext(context?.operation || "api_call"),
              context,
            ),
            status,
          });
        }
      }
      // Unknown error types
      else {
        enhancedError = new EnhancedISPError({
          code: ErrorCode.UNKNOWN_ERROR,
          message: String(error),
          context: mergeErrorContext(createErrorContext(context?.operation || "unknown"), context),
        });
      }

      // Update error state
      setErrorState({
        error: enhancedError,
        isRetrying: false,
        retryCount: 0,
        canRetry: enhancedError.retryable && finalConfig.enableAutoRecovery,
      });

      // Log the error
      if (finalConfig.enableMetrics) {
        errorLogger.logError(enhancedError);
      }

      return enhancedError;
    },
    [createErrorContext, finalConfig.enableAutoRecovery, finalConfig.enableMetrics],
  );

  // Specialized API error handler
  const handleApiError = useCallback(
    (error: any, operation: string, resource?: string): EnhancedISPError => {
      const context: Partial<ErrorContext> = {
        operation: `api_${operation}`,
        metadata: {
          endpoint: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
        },
      };

      if (resource) {
        context.resource = resource;
      }

      const enhancedError = handleError(error, context);

      // Log API-specific context
      if (finalConfig.enableMetrics) {
        errorLogger.logApiError(
          error.config?.url || "unknown",
          error.config?.method || "GET",
          error.response?.status || 0,
          enhancedError,
          error.duration || 0,
          error.config?.data,
          error.response?.data,
        );
      }

      return enhancedError;
    },
    [handleError, finalConfig.enableMetrics],
  );

  // Business logic error handler
  const handleBusinessError = useCallback(
    (
      code: ErrorCode,
      message: string,
      businessProcess: string,
      customerImpact: "none" | "low" | "medium" | "high" | "critical" = "medium",
    ): EnhancedISPError => {
      const context: ErrorContext = {
        ...createErrorContext(`business_${businessProcess}`),
        businessProcess,
        customerImpact,
      };

      const enhancedError = new EnhancedISPError({
        code,
        message,
        context,
        category: "business",
      });

      setErrorState({
        error: enhancedError,
        isRetrying: false,
        retryCount: 0,
        canRetry: false, // Business errors typically not retryable
      });

      // Log business error with context
      if (finalConfig.enableMetrics) {
        errorLogger.logBusinessError(
          enhancedError,
          businessProcess,
          context.workflowStep || "unknown",
          customerImpact,
        );
      }

      return enhancedError;
    },
    [createErrorContext, finalConfig.enableMetrics],
  );

  // Retry mechanism
  const retry = useCallback(async (): Promise<void> => {
    if (!errorState.error || !errorState.canRetry || errorState.isRetrying) {
      return;
    }

    if (errorState.retryCount >= finalConfig.maxRetryAttempts) {
      return;
    }

    setErrorState((prev) => ({
      ...prev,
      isRetrying: true,
      lastRetryAt: new Date(),
    }));

    try {
      // Calculate exponential backoff delay
      const delay = finalConfig.retryDelayMs * Math.pow(2, errorState.retryCount);
      await new Promise((resolve) => setTimeout(resolve, delay));

      if (onRetry) {
        await onRetry(errorState.error);

        // Success - clear error
        setErrorState({
          error: null,
          isRetrying: false,
          retryCount: 0,
          canRetry: false,
        });
      } else {
        // No retry handler provided, just increment count
        setErrorState((prev) => ({
          ...prev,
          isRetrying: false,
          retryCount: prev.retryCount + 1,
          canRetry: prev.retryCount + 1 < finalConfig.maxRetryAttempts,
        }));
      }
    } catch (retryError) {
      // Retry failed
      const newRetryCount = errorState.retryCount + 1;
      setErrorState((prev) => ({
        ...prev,
        isRetrying: false,
        retryCount: newRetryCount,
        canRetry: newRetryCount < finalConfig.maxRetryAttempts,
      }));

      // Log retry failure
      if (finalConfig.enableMetrics) {
        const retryErrorEnhanced = handleError(retryError, {
          operation: "retry_failed",
          metadata: {
            originalError: errorState.error?.errorCode,
            retryAttempt: newRetryCount,
          },
        });
        errorLogger.logError(retryErrorEnhanced);
      }
    }
  }, [
    errorState,
    finalConfig.maxRetryAttempts,
    finalConfig.retryDelayMs,
    finalConfig.enableMetrics,
    onRetry,
    handleError,
  ]);

  // Clear error state
  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      isRetrying: false,
      retryCount: 0,
      canRetry: false,
    });
  }, []);

  // Determine if error is recoverable
  const isRecoverableError = useCallback((error: EnhancedISPError): boolean => {
    // Check if error is marked as retryable
    if (!error.retryable) return false;

    // Network errors are generally recoverable
    if (error.category === "network") return true;

    // System errors might be recoverable
    if (error.category === "system" && error.severity !== "critical") return true;

    // Specific recoverable error codes
    const recoverableCodes = [
      ErrorCode.NETWORK_CONNECTION_FAILED,
      ErrorCode.NETWORK_TIMEOUT,
      ErrorCode.SYSTEM_RESOURCE_EXHAUSTED,
      ErrorCode.NETWORK_DEVICE_UNREACHABLE,
    ];

    return recoverableCodes.includes(error.errorCode);
  }, []);

  // Auto-retry for recoverable errors
  useEffect(() => {
    if (
      errorState.error &&
      errorState.canRetry &&
      !errorState.isRetrying &&
      isRecoverableError(errorState.error) &&
      finalConfig.enableAutoRecovery
    ) {
      // Auto-retry after a short delay for first attempt
      if (errorState.retryCount === 0) {
        const timer = setTimeout(() => {
          retry();
        }, 2000); // 2 second delay for first auto-retry

        return () => clearTimeout(timer);
      }
    }

    return undefined;
  }, [errorState, retry, isRecoverableError, finalConfig.enableAutoRecovery]);

  return {
    errorState,
    handleError,
    handleApiError,
    handleBusinessError,
    retry,
    clearError,
    createErrorContext,
    isRecoverableError,
  };
}

export default useEnhancedErrorHandler;
