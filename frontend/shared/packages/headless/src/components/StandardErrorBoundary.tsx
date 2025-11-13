/**
 * Standardized Error Boundary Component
 * Provides consistent error boundary handling with ISP Framework patterns
 */

import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { ISPError, classifyError, logError } from "../utils/errorUtils";

export interface ErrorBoundaryState {
  hasError: boolean;
  error: ISPError | null;
  errorId: string | null;
  retryCount: number;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
  onError?: (error: ISPError, errorInfo: ErrorInfo) => void;
  enableRetry?: boolean;
  maxRetries?: number;
  context?: string;
  level?: "application" | "component" | "widget";
}

export interface ErrorFallbackProps {
  error: ISPError;
  errorId: string;
  retryCount: number;
  onRetry: () => void;
  onClearError: () => void;
  level: "application" | "component" | "widget";
  hasReachedMaxRetries: boolean;
}

export class StandardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    const ispError = classifyError(error, "Error Boundary");
    return {
      hasError: true,
      error: ispError,
      errorId: ispError.id,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { onError, context } = this.props;
    const ispError = classifyError(error, context || "Error Boundary");

    // Log the error with component stack
    logError(ispError, {
      url: typeof window !== "undefined" ? window.location.href : "Unknown",
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "Unknown",
    });

    // Call custom error handler
    onError?.(ispError, errorInfo);

    // Update state with the classified error
    this.setState({
      error: ispError,
      errorId: ispError.id,
    });
  }

  override componentWillUnmount(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  handleRetry = (): void => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      return;
    }

    this.setState((prevState) => ({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: prevState.retryCount + 1,
    }));

    // Add a small delay before retry to prevent rapid retries
    this.retryTimeoutId = setTimeout(() => {
      // Force re-render
      this.forceUpdate();
    }, 100);
  };

  handleClearError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
      retryCount: 0,
    });
  };

  override render(): ReactNode {
    const { hasError, error, errorId, retryCount } = this.state;
    const {
      children,
      fallback: CustomFallback,
      enableRetry = true,
      maxRetries = 3,
      level = "component",
    } = this.props;

    if (hasError && error && errorId) {
      const hasReachedMaxRetries = retryCount >= maxRetries;
      const fallbackProps: ErrorFallbackProps = {
        error,
        errorId,
        retryCount,
        onRetry: this.handleRetry,
        onClearError: this.handleClearError,
        level,
        hasReachedMaxRetries,
      };

      if (CustomFallback) {
        return <CustomFallback {...fallbackProps} />;
      }

      // Default fallback based on level
      switch (level) {
        case "application":
          return <ApplicationErrorFallback {...fallbackProps} />;
        case "widget":
          return <WidgetErrorFallback {...fallbackProps} />;
        default:
          return <ComponentErrorFallback {...fallbackProps} />;
      }
    }

    return children;
  }
}

/**
 * Default Error Fallback Components
 */

const ApplicationErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  onRetry,
  hasReachedMaxRetries,
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
    <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 mb-2">Application Error</h1>

        <p className="text-gray-600 mb-4">{error.userMessage}</p>

        <div className="text-sm text-gray-500 mb-6">Error ID: {errorId}</div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {!hasReachedMaxRetries && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Try Again
            </button>
          )}

          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  </div>
);

const ComponentErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  onRetry,
  onClearError,
  hasReachedMaxRetries,
}) => (
  <div className="border border-red-200 rounded-md bg-red-50 p-4">
    <div className="flex">
      <div className="flex-shrink-0">
        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
      </div>

      <div className="ml-3">
        <h3 className="text-sm font-medium text-red-800">Component Error</h3>

        <p className="text-sm text-red-700 mt-1">{error.userMessage}</p>

        <div className="text-xs text-red-600 mt-1">ID: {errorId}</div>

        <div className="mt-3 flex gap-2">
          {!hasReachedMaxRetries && (
            <button
              onClick={onRetry}
              className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200 focus:outline-none focus:ring-1 focus:ring-red-500"
            >
              Retry
            </button>
          )}

          <button
            onClick={onClearError}
            className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded hover:bg-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </div>
);

const WidgetErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  onRetry,
  hasReachedMaxRetries,
}) => (
  <div className="flex items-center justify-center p-2 text-sm text-gray-500 bg-gray-50 border rounded">
    <svg
      className="h-4 w-4 mr-2 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>

    <span className="flex-1">Unable to load</span>

    {!hasReachedMaxRetries && (
      <button
        onClick={onRetry}
        className="ml-2 text-blue-600 hover:text-blue-800 focus:outline-none"
      >
        Retry
      </button>
    )}
  </div>
);

/**
 * HOC for wrapping components with standardized error boundary
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
) {
  const WrappedComponent = (props: P) => (
    <StandardErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </StandardErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

/**
 * Hook for programmatic error boundary control
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);

  const captureError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  // Throw error to trigger error boundary
  if (error) {
    throw error;
  }

  return { captureError, clearError };
}
