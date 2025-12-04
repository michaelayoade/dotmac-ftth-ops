"use client";

import { AlertTriangle, Home, MessageSquare, RefreshCw } from "lucide-react";
import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string | null;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo: ErrorInfo, retry: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  level?: "page" | "section" | "component";
  enableRetry?: boolean;
  showErrorDetails?: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorId,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    const { errorId } = this.state;

    this.setState({ errorInfo });

    // Custom error handler
    if (onError && errorId) {
      onError(error, errorInfo, errorId);
    }

    // Report to error tracking service (e.g., Sentry)
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
        tags: {
          errorBoundary: this.props.level || "unknown",
          errorId,
        },
      });
    }
  }

  handleRetry = () => {
    if (this.retryTimeoutId) {
      window.clearTimeout(this.retryTimeoutId);
    }

    this.setState({ hasError: false, error: null, errorInfo: null, errorId: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  override render() {
    const { hasError, error, errorInfo, errorId } = this.state;
    const {
      children,
      fallback,
      level = "component",
      enableRetry = true,
      showErrorDetails = typeof process !== "undefined" && process.env?.NODE_ENV === "development",
    } = this.props;

    if (hasError && error) {
      // Custom fallback
      if (fallback && errorInfo) {
        return fallback(error, errorInfo, this.handleRetry);
      }

      // Default fallback based on level
      return (
        <ErrorFallback
          error={error}
          level={level}
          enableRetry={enableRetry}
          showErrorDetails={showErrorDetails}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
          {...(errorInfo ? { errorInfo } : {})}
          {...(errorId ? { errorId } : {})}
        />
      );
    }

    return children;
  }
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo?: ErrorInfo;
  errorId?: string;
  level: "page" | "section" | "component";
  enableRetry: boolean;
  showErrorDetails: boolean;
  onRetry: () => void;
  onReload: () => void;
}

function ErrorFallback({
  error,
  errorInfo,
  errorId,
  level,
  enableRetry,
  showErrorDetails,
  onRetry,
  onReload,
}: ErrorFallbackProps) {
  const getErrorTitle = () => {
    switch (level) {
      case "page":
        return "Something went wrong with this page";
      case "section":
        return "This section encountered an error";
      case "component":
        return "Something went wrong";
      default:
        return "An unexpected error occurred";
    }
  };

  const getErrorDescription = () => {
    switch (level) {
      case "page":
        return "The page failed to load properly. You can try refreshing or go back to the dashboard.";
      case "section":
        return "This section of the page failed to load. Try refreshing to see if that resolves the issue.";
      case "component":
        return "A component failed to render. This might be temporary.";
      default:
        return "We encountered an unexpected error. Please try again.";
    }
  };

  const getLevelStyles = () => {
    switch (level) {
      case "page":
        return "min-h-screen flex items-center justify-center bg-gray-50";
      case "section":
        return "min-h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-gray-200";
      case "component":
        return "p-4 flex items-center justify-center bg-red-50 border border-red-200 rounded-lg";
      default:
        return "p-4 flex items-center justify-center bg-red-50 border border-red-200 rounded-lg";
    }
  };

  return (
    <div className={getLevelStyles()}>
      <div className="mx-auto max-w-md text-center">
        <div className="mb-4 flex justify-center">
          <AlertTriangle className="h-12 w-12 text-red-500" />
        </div>

        <h3 className="mb-2 font-semibold text-gray-900 text-lg">{getErrorTitle()}</h3>

        <p className="mb-6 text-gray-600">{getErrorDescription()}</p>

        {/* Action buttons */}
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {enableRetry ? (
            <button
              type="button"
              onClick={onRetry}
              onKeyDown={(e) => e.key === "Enter" && onRetry}
              className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </button>
          ) : null}

          {level === "page" && (
            <>
              <button
                type="button"
                onClick={onReload}
                onKeyDown={(e) => e.key === "Enter" && onReload}
                className="inline-flex items-center rounded-lg bg-gray-600 px-4 py-2 font-medium text-sm text-white transition-colors hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload Page
              </button>

              <button
                type="button"
                onClick={() => (window.location.href = "/")}
                className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 text-sm transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Home className="mr-2 h-4 w-4" />
                Go to Dashboard
              </button>
            </>
          )}
        </div>

        {/* Error details for development */}
        {showErrorDetails ? (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer font-medium text-gray-700 text-sm hover:text-gray-900">
              Technical Details
            </summary>
            <div className="mt-2 max-h-40 overflow-auto rounded-lg bg-gray-100 p-4 font-mono text-gray-800 text-xs">
              <div className="mb-2">
                <strong>Error ID:</strong> {errorId}
              </div>
              <div className="mb-2">
                <strong>Error:</strong> {error.message}
              </div>
              {error.stack ? (
                <div className="mb-2">
                  <strong>Stack:</strong>
                  <pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>
                </div>
              ) : null}
              {errorInfo?.componentStack ? (
                <div>
                  <strong>Component Stack:</strong>
                  <pre className="mt-1 whitespace-pre-wrap">{errorInfo.componentStack}</pre>
                </div>
              ) : null}
            </div>
          </details>
        ) : null}

        {/* Support information */}
        <div className="mt-6 rounded-lg bg-blue-50 p-4">
          <div className="flex items-center justify-center text-blue-800">
            <MessageSquare className="mr-2 h-4 w-4" />
            <span className="text-sm">
              Need help? Contact support with error ID:{" "}
              <code className="font-mono text-xs">{errorId}</code>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for manual error reporting
export function useErrorHandler() {
  return React.useCallback((error: Error, context?: string) => {
    const errorId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Report to error tracking service
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        tags: {
          context: context || "manual",
          errorId,
        },
      });
    }

    return errorId;
  }, []);
}

// Higher-order component for class components
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
) {
  const WithErrorBoundaryComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <WrappedComponent {...props} />
    </ErrorBoundary>
  );

  WithErrorBoundaryComponent.displayName = `withErrorBoundary(${WrappedComponent.displayName || WrappedComponent.name})`;

  return WithErrorBoundaryComponent;
}
