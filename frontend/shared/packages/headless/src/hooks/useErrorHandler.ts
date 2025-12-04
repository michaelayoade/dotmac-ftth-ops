/**
 * Standard Error Handler Hook - NO BACKWARD COMPATIBILITY
 * Use only useStandardErrorHandler for all error handling
 */

import { useCallback, useState } from "react";

// NO LEGACY COMPATIBILITY - Import useStandardErrorHandler directly
export { useStandardErrorHandler as useErrorHandler } from "./useStandardErrorHandler";

// Breaking change: Legacy useErrorHandler interfaces removed
// Migration: Replace with useStandardErrorHandler

// Global error handler for API client and other global error handling
type GlobalErrorHandler = (errorInfo: { message: string; error?: Error }) => void;

let globalErrorHandler: GlobalErrorHandler | null = null;

export function setGlobalErrorHandler(handler: GlobalErrorHandler): void {
  globalErrorHandler = handler;
}

export function getGlobalErrorHandler(): GlobalErrorHandler | null {
  return globalErrorHandler;
}

// Error boundary hook for React components
export interface UseErrorBoundaryReturn {
  error: Error | null;
  resetError: () => void;
  showError: (error: Error) => void;
}

export function useErrorBoundary(): UseErrorBoundaryReturn {
  const [error, setError] = useState<Error | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  const showError = useCallback((err: Error) => {
    setError(err);
    if (globalErrorHandler) {
      globalErrorHandler({ message: err.message, error: err });
    }
  }, []);

  return {
    error,
    resetError,
    showError,
  };
}
