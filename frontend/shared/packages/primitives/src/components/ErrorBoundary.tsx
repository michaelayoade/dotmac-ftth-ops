/**
 * Error Boundary for graceful component failure handling
 */

"use client";

import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo, errorId: string) => void;
  isolate?: boolean; // Whether to isolate this boundary from parent boundaries
}

interface ErrorFallbackProps {
  error: Error;
  errorId: string;
  onRetry?: () => void;
  componentName?: string;
}

// Default error fallback component
const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  errorId,
  onRetry,
  componentName = "Component",
}) => (
  <div
    className="flex flex-col items-center justify-center p-6 bg-red-50 border border-red-200 rounded-lg"
    role="alert"
    aria-live="polite"
  >
    <div className="text-red-600 mb-2">
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
    </div>
    <h3 className="text-lg font-semibold text-red-900 mb-2">{componentName} Error</h3>
    <p className="text-sm text-red-700 text-center mb-4">
      Something went wrong while rendering this component.
    </p>
    <details className="mb-4 text-xs text-red-600">
      <summary className="cursor-pointer hover:text-red-800">
        Technical Details (ID: {errorId})
      </summary>
      <pre className="mt-2 p-2 bg-red-100 rounded text-xs overflow-auto max-w-md">
        {error.message}
      </pre>
    </details>
    {onRetry && (
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        aria-label="Retry loading component"
      >
        Try Again
      </button>
    )}
  </div>
);

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Generate unique error ID for tracking
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      hasError: true,
      error,
      errorId,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError } = this.props;
    const { errorId } = this.state;

    // Log error to console in development
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
      console.group(`🚨 Component Error (${errorId})`);
      console.error("Error:", error);
      console.error("Error Info:", errorInfo);
      console.groupEnd();
    }

    // Update state with error info
    this.setState({ errorInfo });

    // Call custom error handler if provided
    if (onError && errorId) {
      try {
        onError(error, errorInfo, errorId);
      } catch (handlerError) {
        console.error("Error in error handler:", handlerError);
      }
    }

    // Report to error tracking service in production
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      this.reportError(error, errorInfo, errorId);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo, errorId: string) => {
    // This would integrate with your error reporting service
    // Examples: Sentry, Rollbar, Bugsnag, etc.
    try {
      // Mock error reporting - replace with actual service
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorId,
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch((reportingError) => {
        console.error("Failed to report error:", reportingError);
      });
    } catch (reportingError) {
      console.error("Error reporting failed:", reportingError);
    }
  };

  private handleRetry = () => {
    // Clear any existing retry timeout
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }

    // Reset error state after a brief delay to prevent infinite retry loops
    this.retryTimeoutId = setTimeout(() => {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        errorId: "",
      });
    }, 100);
  };

  override componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  override render() {
    const { children, fallback, isolate } = this.props;
    const { hasError, error, errorId } = this.state;

    if (hasError && error) {
      // If we have a custom fallback, use it
      if (fallback) {
        return fallback;
      }

      // Use default error fallback
      return (
        <DefaultErrorFallback
          error={error}
          errorId={errorId}
          onRetry={this.handleRetry}
          componentName={this.getComponentName()}
        />
      );
    }

    return children;
  }

  private getComponentName(): string {
    // Try to extract component name from error stack
    const { error } = this.state;
    if (error?.stack) {
      const match = error.stack.match(/at\s+([A-Z][A-Za-z0-9]*)/);
      const matchedName = match?.[1];
      if (matchedName) {
        return matchedName;
      }
    }
    return "Component";
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryConfig?: Omit<ErrorBoundaryProps, "children">,
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryConfig}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}

// Hook for manual error reporting
export function useErrorHandler() {
  return React.useCallback((error: Error, context?: string) => {
    const errorId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.error(`Manual error report (${errorId}):`, error);

    // Report to error service in production
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          errorId,
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          type: "manual",
        }),
      }).catch(console.error);
    }
  }, []);
}
