/**
 * Error Handling Hooks
 *
 * Standardized hooks for consistent error handling across the application
 */

import { useCallback, useState } from 'react';
import { useToast } from './useToast';
import {
  AppError,
  createAppError,
  isAuthError,
  ErrorSeverity,
  type ErrorCategory,
} from '@dotmac/types';
import { reportErrorToObservability } from '@dotmac/utils/observability';

// ============================================================================
// useErrorHandler Hook
// ============================================================================

export interface UseErrorHandlerOptions {
  /** Show toast notification on error */
  showToast?: boolean;

  /** Log error to console */
  logError?: boolean;

  /** Report error to error tracking service */
  reportError?: boolean;

  /** Custom error handler */
  onError?: (error: AppError) => void;

  /** Redirect on auth error */
  redirectOnAuthError?: boolean;

  /** Custom redirect path for auth errors */
  authRedirectPath?: string;
}

export interface UseErrorHandlerReturn {
  /** Current error state */
  error: AppError | null;

  /** Handle an error */
  handleError: (error: unknown, context?: Record<string, unknown>) => void;

  /** Clear current error */
  clearError: () => void;

  /** Check if there's an error */
  hasError: boolean;

  /** Retry callback (if error is retryable) */
  retry: (() => void) | null;

  /** Set retry callback */
  setRetry: (callback: (() => void) | null) => void;
}

/**
 * Hook for standardized error handling
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { handleError, error, clearError, retry } = useErrorHandler({
 *     showToast: true,
 *     redirectOnAuthError: true,
 *   });
 *
 *   const fetchData = async () => {
 *     try {
 *       const data = await api.getData();
 *       return data;
 *     } catch (err) {
 *       handleError(err, { component: 'MyComponent', action: 'fetchData' });
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       {error && (
 *         <ErrorAlert error={error} onClose={clearError} onRetry={retry} />
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useErrorHandler(
  options: UseErrorHandlerOptions = {}
): UseErrorHandlerReturn {
  const {
    showToast = true,
    logError = true,
    reportError = true,
    onError,
    redirectOnAuthError = true,
    authRedirectPath = '/login',
  } = options;

  const { toast } = useToast?.() ?? { toast: undefined };
  const [error, setError] = useState<AppError | null>(null);
  const [retryCallback, setRetryCallback] = useState<(() => void) | null>(null);

  const handleError = useCallback(
    (rawError: unknown, context?: Record<string, unknown>) => {
      const appError = createAppError(rawError, context);

      // Set error state
      setError(appError);

      // Log to console
      if (logError) {
        console.error('[Error Handler]', {
          message: appError.message,
          category: appError.category,
          severity: appError.severity,
          context: appError.context,
          originalError: appError.originalError,
        });
      }

      // Report to observability stack (OpenTelemetry/Prometheus/Grafana)
      if (reportError && typeof window !== 'undefined') {
        // TODO: Integrate with your observability stack
        // This should send to your OpenTelemetry endpoint
        reportErrorToObservability(appError);
      }

      // Show toast notification
      if (showToast && toast) {
        const toastVariant =
          appError.severity === ErrorSeverity.CRITICAL ||
          appError.severity === ErrorSeverity.ERROR
            ? 'destructive'
            : 'default';

        toast({
          variant: toastVariant,
          title: appError.message,
          description: appError.action,
        });
      }

      // Handle auth errors
      if (redirectOnAuthError && isAuthError(rawError)) {
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          const redirectUrl = `${authRedirectPath}?redirect=${encodeURIComponent(currentPath)}`;
          window.location.href = redirectUrl;
        }
      }

      // Call custom error handler
      if (onError) {
        onError(appError);
      }
    },
    [
      logError,
      reportError,
      showToast,
      toast,
      redirectOnAuthError,
      authRedirectPath,
      onError,
    ]
  );

  const clearError = useCallback(() => {
    setError(null);
    setRetryCallback(null);
  }, []);

  const setRetry = useCallback((callback: (() => void) | null) => {
    setRetryCallback(() => callback);
  }, []);

  return {
    error,
    handleError,
    clearError,
    hasError: error !== null,
    retry: retryCallback,
    setRetry,
  };
}

// ============================================================================
// useApiError Hook
// ============================================================================

export interface UseApiErrorOptions extends UseErrorHandlerOptions {
  /** Automatically retry on retryable errors */
  autoRetry?: boolean;

  /** Maximum retry attempts */
  maxRetries?: number;

  /** Retry delay in milliseconds */
  retryDelay?: number;
}

export interface UseApiErrorReturn extends UseErrorHandlerReturn {
  /** Number of retry attempts made */
  retryCount: number;

  /** Whether currently retrying */
  isRetrying: boolean;

  /** Reset retry count */
  resetRetry: () => void;
}

/**
 * Hook for handling API errors with retry logic
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { handleError, retry, isRetrying } = useApiError({
 *     autoRetry: true,
 *     maxRetries: 3,
 *   });
 *
 *   const fetchData = async () => {
 *     try {
 *       const data = await api.getData();
 *       return data;
 *     } catch (err) {
 *       handleError(err);
 *     }
 *   };
 *
 *   return <div>{isRetrying ? 'Retrying...' : 'Ready'}</div>;
 * }
 * ```
 */
export function useApiError(
  options: UseApiErrorOptions = {}
): UseApiErrorReturn {
  const {
    autoRetry = false,
    maxRetries = 3,
    retryDelay = 1000,
    ...errorHandlerOptions
  } = options;

  const errorHandler = useErrorHandler(errorHandlerOptions);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleError = useCallback(
    (rawError: unknown, context?: Record<string, unknown>) => {
      errorHandler.handleError(rawError, context);

      // Handle auto-retry logic
      if (autoRetry && errorHandler.error?.retryable && retryCount < maxRetries) {
        setIsRetrying(true);

        setTimeout(() => {
          setRetryCount((prev) => prev + 1);
          setIsRetrying(false);

          // Execute retry callback if available
          if (errorHandler.retry) {
            errorHandler.retry();
          }
        }, retryDelay * Math.pow(2, retryCount)); // Exponential backoff
      }
    },
    [
      errorHandler,
      autoRetry,
      retryCount,
      maxRetries,
      retryDelay,
    ]
  );

  const resetRetry = useCallback(() => {
    setRetryCount(0);
    setIsRetrying(false);
  }, []);

  return {
    ...errorHandler,
    handleError,
    retryCount,
    isRetrying,
    resetRetry,
  };
}

// ============================================================================
// useAsyncError Hook
// ============================================================================

/**
 * Hook for throwing errors from async callbacks to Error Boundary
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const throwError = useAsyncError();
 *
 *   const handleClick = async () => {
 *     try {
 *       await doSomething();
 *     } catch (err) {
 *       throwError(err); // Will be caught by Error Boundary
 *     }
 *   };
 *
 *   return <button onClick={handleClick}>Do Something</button>;
 * }
 * ```
 */
export function useAsyncError() {
  const [, setError] = useState();

  return useCallback((error: unknown) => {
    setError(() => {
      throw error;
    });
  }, []);
}

// ============================================================================
// useErrorBoundary Hook
// ============================================================================

export interface UseErrorBoundaryOptions {
  /** Error boundary name (for logging) */
  boundaryName?: string;

  /** Custom fallback render function */
  fallback?: (error: AppError) => React.ReactNode;

  /** Callback when error is caught */
  onError?: (error: AppError, errorInfo: React.ErrorInfo) => void;

  /** Reset error on location change */
  resetOnLocationChange?: boolean;
}

/**
 * Hook for declarative error boundary usage
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { ErrorBoundary } = useErrorBoundary({
 *     boundaryName: 'MyComponent',
 *     resetOnLocationChange: true,
 *   });
 *
 *   return (
 *     <ErrorBoundary>
 *       <ChildComponentThatMightError />
 *     </ErrorBoundary>
 *   );
 * }
 * ```
 */
export function useErrorBoundary(options: UseErrorBoundaryOptions = {}) {
  // Implementation would return a configured ErrorBoundary component
  // This is a placeholder for the actual implementation
  return {
    ErrorBoundary: ({ children }: { children: React.ReactNode }) => children,
  };
}
