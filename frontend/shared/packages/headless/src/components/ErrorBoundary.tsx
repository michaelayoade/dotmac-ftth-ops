"use client";

import React, { type ErrorInfo, type ReactNode } from "react";

import { useErrorBoundary } from "../hooks/useErrorHandler";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, errorInfo?: ErrorInfo) => ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  resetKeys?: Array<string | number>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo,
    });

    this.props.onError?.(error, errorInfo);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps) {
    const { resetOnPropsChange, resetKeys, children } = this.props;
    const { hasError } = this.state;

    // Reset if resetOnPropsChange is enabled and any props changed
    if (hasError && resetOnPropsChange && prevProps.children !== children) {
      this.resetErrorBoundary();
      return;
    }

    // Check if resetKeys changed
    if (
      hasError &&
      resetKeys &&
      prevProps.resetKeys &&
      resetKeys.length === prevProps.resetKeys.length &&
      resetKeys.some((key, index) => key !== prevProps.resetKeys?.[index])
    ) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback(error, errorInfo || undefined);
      }

      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          resetError={this.resetErrorBoundary}
        />
      );
    }

    return children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  resetError: () => void;
}

function DefaultErrorFallback({ error, errorInfo, resetError }: DefaultErrorFallbackProps) {
  const isDevelopment = process.env["NODE_ENV"] === "development";

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gray-50 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <div className="text-center" role="alert">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg
                aria-label="icon"
                className="h-6 w-6 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
              >
                <title>Icon</title>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            <h2 className="mt-4 font-medium text-gray-900 text-lg">Something went wrong</h2>

            <p className="mt-2 text-gray-600 text-sm">
              We encountered an error while loading this page. Please try again or contact support
              if the problem persists.
            </p>

            {isDevelopment ? (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer font-medium text-gray-700 text-sm hover:text-gray-900">
                  Error Details (Development)
                </summary>
                <div className="mt-2 whitespace-pre-wrap rounded bg-gray-100 p-3 font-mono text-gray-800 text-xs">
                  <div className="mb-2">
                    <strong>Error:</strong> {error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Stack:</strong> {error.stack}
                  </div>
                  {errorInfo ? (
                    <div>
                      <strong>Component Stack:</strong> {errorInfo.componentStack}
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}

            <div className="mt-6 flex flex-col space-y-3">
              <button
                type="button"
                onClick={resetError}
                onKeyDown={(e) => e.key === "Enter" && resetError}
                className="flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 font-medium text-sm text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Try Again
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 text-sm shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook-based error boundary for functional components
export function useErrorBoundaryHook() {
  return useErrorBoundary();
}

// Higher-order component wrapper
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">,
) {
  const WrappedComponent = (props: P) => {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
}
