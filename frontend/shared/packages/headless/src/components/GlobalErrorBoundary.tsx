"use client";

import React, { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console in development
    if (process.env["NODE_ENV"] === "development") {
      console.error("GlobalErrorBoundary caught error:", error, errorInfo);
    }

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Send to monitoring service (e.g., Sentry)
    this.logErrorToService(error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // Send to monitoring endpoint
    if (typeof window !== "undefined" && process.env["NEXT_PUBLIC_ERROR_ENDPOINT"]) {
      const errorData = {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: window.navigator.userAgent,
      };

      fetch(process.env["NEXT_PUBLIC_ERROR_ENDPOINT"], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorData),
      }).catch(console.error);
    }

    // If Sentry is available, use it
    if (typeof window !== "undefined" && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    }
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
              <p className="text-gray-600 mb-6">
                We encountered an unexpected error. The issue has been logged and will be
                investigated.
              </p>

              {process.env["NODE_ENV"] === "development" && this.state.error && (
                <details className="text-left mb-6">
                  <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 p-3 bg-gray-100 rounded text-xs">
                    <p className="font-mono text-red-600 mb-2">{this.state.error.message}</p>
                    <pre className="whitespace-pre-wrap text-gray-700">
                      {this.state.error.stack}
                    </pre>
                  </div>
                </details>
              )}

              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Reload Page
                </button>
                <button
                  onClick={() => (window.location.href = "/")}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Go Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for error reporting
export function useErrorHandler() {
  return (error: Error, errorInfo?: ErrorInfo) => {
    // Log to console in development
    if (process.env["NODE_ENV"] === "development") {
      console.error("Error handled:", error, errorInfo);
    }

    // Send to monitoring
    if (typeof window !== "undefined") {
      // Send to custom endpoint
      if (process.env["NEXT_PUBLIC_ERROR_ENDPOINT"]) {
        fetch(process.env["NEXT_PUBLIC_ERROR_ENDPOINT"], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: error.message,
            stack: error.stack,
            componentStack: errorInfo?.componentStack,
            timestamp: new Date().toISOString(),
          }),
        }).catch(console.error);
      }

      // Send to Sentry if available
      if ((window as any).Sentry) {
        (window as any).Sentry.captureException(error);
      }
    }
  };
}
