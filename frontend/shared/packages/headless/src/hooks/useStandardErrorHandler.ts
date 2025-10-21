/**
 * Standardized Error Handler Hook
 * Provides consistent error handling across all components and hooks
 */

import { useCallback, useState, useRef, useEffect } from "react";
import {
  ISPError,
  classifyError,
  shouldRetry,
  calculateRetryDelay,
  logError,
  deduplicateError,
  DEFAULT_ERROR_CONFIG,
  type ErrorHandlingConfig,
  type ErrorSeverity,
} from "../utils/errorUtils";
import { useNotifications } from "./useNotifications";
import { useISPTenant } from "./useISPTenant";

export interface UseStandardErrorHandlerOptions {
  context: string;
  enableRetry?: boolean;
  enableNotifications?: boolean;
  enableLogging?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  fallbackData?: any;
  onError?: (error: ISPError) => void;
  onRetry?: (attempt: number, error: ISPError) => void;
  onMaxRetriesReached?: (error: ISPError) => void;
  onFallback?: (fallbackData: any) => void;
}

export interface UseStandardErrorHandlerReturn {
  error: ISPError | null;
  isRetrying: boolean;
  retryCount: number;
  hasReachedMaxRetries: boolean;
  clearError: () => void;
  handleError: (error: unknown) => ISPError;
  retry: () => Promise<void>;
  withErrorHandling: <T>(operation: () => Promise<T>) => Promise<T | null>;
}

export function useStandardErrorHandler(
  options: UseStandardErrorHandlerOptions,
): UseStandardErrorHandlerReturn {
  const {
    context,
    enableRetry = DEFAULT_ERROR_CONFIG.maxRetries > 0,
    enableNotifications = DEFAULT_ERROR_CONFIG.enableUserNotifications,
    enableLogging = DEFAULT_ERROR_CONFIG.enableLogging,
    maxRetries = DEFAULT_ERROR_CONFIG.maxRetries,
    retryDelay = DEFAULT_ERROR_CONFIG.retryDelayMs,
    fallbackData,
    onError,
    onRetry,
    onMaxRetriesReached,
    onFallback,
  } = options;

  const { showError, showWarning } = useNotifications();
  const { currentTenant } = useISPTenant();

  const [error, setError] = useState<ISPError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasReachedMaxRetries, setHasReachedMaxRetries] = useState(false);

  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const lastOperationRef = useRef<(() => Promise<any>) | null>(null);

  // Clear retry timeout on unmount
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsRetrying(false);
    setHasReachedMaxRetries(false);

    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
  }, []);

  const handleError = useCallback(
    (rawError: unknown): ISPError => {
      const ispError = classifyError(rawError, context);

      // Log error with tenant context
      if (enableLogging && deduplicateError(ispError)) {
        logError(ispError, {
          tenantId: currentTenant?.id,
          sessionId:
            typeof window !== "undefined"
              ? window.sessionStorage.getItem("sessionId") || undefined
              : undefined,
        });
      }

      // Show user notification based on severity
      if (enableNotifications) {
        if (ispError.severity === "critical" || ispError.severity === "high") {
          showError(ispError.userMessage, {
            persistent: true,
            actions: ispError.retryable ? [{ label: "Retry", action: () => retry() }] : undefined,
          });
        } else if (ispError.severity === "medium") {
          showWarning(ispError.userMessage);
        }
        // Don't show notifications for 'low' severity errors
      }

      setError(ispError);
      onError?.(ispError);

      return ispError;
    },
    [context, enableLogging, enableNotifications, currentTenant, showError, showWarning, onError],
  );

  const retry = useCallback(async () => {
    if (!error || !lastOperationRef.current || !shouldRetry(error, retryCount, maxRetries)) {
      return;
    }

    setIsRetrying(true);
    const currentRetryCount = retryCount + 1;
    setRetryCount(currentRetryCount);

    onRetry?.(currentRetryCount, error);

    try {
      // Calculate retry delay with exponential backoff
      const delay = calculateRetryDelay(currentRetryCount - 1, retryDelay);

      await new Promise((resolve) => {
        retryTimeoutRef.current = setTimeout(resolve, delay);
      });

      if (lastOperationRef.current) {
        const result = await lastOperationRef.current();
        clearError(); // Success - clear error
        return result;
      }
    } catch (retryError) {
      const newError = handleError(retryError);

      if (currentRetryCount >= maxRetries) {
        setHasReachedMaxRetries(true);
        onMaxRetriesReached?.(newError);

        // Use fallback if available
        if (fallbackData !== undefined) {
          onFallback?.(fallbackData);
        }
      }
    } finally {
      setIsRetrying(false);
    }
  }, [
    error,
    retryCount,
    maxRetries,
    retryDelay,
    onRetry,
    onMaxRetriesReached,
    fallbackData,
    onFallback,
    handleError,
    clearError,
  ]);

  const withErrorHandling = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T | null> => {
      // Store operation reference for retry
      lastOperationRef.current = operation;

      try {
        clearError();
        const result = await operation();
        return result;
      } catch (operationError) {
        const ispError = handleError(operationError);

        // Auto-retry if enabled and error is retryable
        if (enableRetry && shouldRetry(ispError, 0, maxRetries)) {
          try {
            return await retry();
          } catch (retryError) {
            // Retry failed, handle as final error
            handleError(retryError);
          }
        }

        // Use fallback if available and max retries reached
        if (fallbackData !== undefined && (hasReachedMaxRetries || !ispError.retryable)) {
          onFallback?.(fallbackData);
          return fallbackData;
        }

        return null;
      }
    },
    [
      enableRetry,
      maxRetries,
      handleError,
      retry,
      fallbackData,
      onFallback,
      hasReachedMaxRetries,
      clearError,
    ],
  );

  return {
    error,
    isRetrying,
    retryCount,
    hasReachedMaxRetries,
    clearError,
    handleError,
    retry,
    withErrorHandling,
  };
}

/**
 * Specialized hooks for common error handling scenarios
 */

// For API operations
export function useApiErrorHandler(
  context: string,
  options: Partial<UseStandardErrorHandlerOptions> = {},
) {
  return useStandardErrorHandler({
    ...options,
    context: `API: ${context}`,
    enableRetry: options.enableRetry ?? true,
    maxRetries: options.maxRetries ?? 3,
  });
}

// For form operations
export function useFormErrorHandler(
  formName: string,
  options: Partial<UseStandardErrorHandlerOptions> = {},
) {
  return useStandardErrorHandler({
    ...options,
    context: `Form: ${formName}`,
    enableRetry: options.enableRetry ?? false,
    enableNotifications: options.enableNotifications ?? true,
  });
}

// For data loading operations
export function useDataLoadingErrorHandler(
  dataType: string,
  options: Partial<UseStandardErrorHandlerOptions> = {},
) {
  return useStandardErrorHandler({
    ...options,
    context: `Data Loading: ${dataType}`,
    enableRetry: options.enableRetry ?? true,
    maxRetries: options.maxRetries ?? 2,
  });
}

// For real-time operations (WebSocket, etc.)
export function useRealtimeErrorHandler(
  connectionType: string,
  options: Partial<UseStandardErrorHandlerOptions> = {},
) {
  return useStandardErrorHandler({
    ...options,
    context: `Realtime: ${connectionType}`,
    enableRetry: options.enableRetry ?? true,
    maxRetries: options.maxRetries ?? 5,
    retryDelay: options.retryDelay ?? 2000,
  });
}

// For file upload operations
export function useUploadErrorHandler(
  uploadType: string,
  options: Partial<UseStandardErrorHandlerOptions> = {},
) {
  return useStandardErrorHandler({
    ...options,
    context: `Upload: ${uploadType}`,
    enableRetry: options.enableRetry ?? true,
    maxRetries: options.maxRetries ?? 2,
    retryDelay: options.retryDelay ?? 3000,
  });
}

/**
 * Global error handler configuration
 */
let globalErrorConfig: Partial<ErrorHandlingConfig> = {};

export function configureGlobalErrorHandling(config: Partial<ErrorHandlingConfig>): void {
  globalErrorConfig = { ...DEFAULT_ERROR_CONFIG, ...config };
}

export function getGlobalErrorConfig(): ErrorHandlingConfig {
  return { ...DEFAULT_ERROR_CONFIG, ...globalErrorConfig };
}
