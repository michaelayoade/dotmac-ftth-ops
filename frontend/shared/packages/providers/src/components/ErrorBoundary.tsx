import * as React from "react";
import type { PortalType } from "../UniversalProviders";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  portal: PortalType;
  fallback?: string | React.ComponentType<ErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorFallbackProps {
  error: Error;
  errorInfo?: React.ErrorInfo;
  resetError: () => void;
  portal: PortalType;
}

/**
 * Universal Error Boundary with portal-specific fallbacks
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo });

    // Log error to monitoring service
    this.logError(error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);
  }

  private logError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Send to monitoring service (e.g., Sentry, LogRocket)
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Portal-specific error logging
    const portalContext = {
      portal: this.props.portal,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // This would integrate with your monitoring service
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "exception", {
        description: error.message,
        fatal: true,
        custom_map: portalContext,
      });
    }
  };

  private resetError = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.getFallbackComponent();

      return (
        <FallbackComponent
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          resetError={this.resetError}
          portal={this.props.portal}
        />
      );
    }

    return this.props.children;
  }

  private getFallbackComponent(): React.ComponentType<ErrorFallbackProps> {
    if (typeof this.props.fallback === "function") {
      return this.props.fallback;
    }

    // Portal-specific fallbacks
    switch (this.props.portal) {
      case "admin":
        return AdminErrorFallback;
      case "customer":
        return CustomerErrorFallback;
      case "reseller":
        return ResellerErrorFallback;
      case "technician":
        return TechnicianErrorFallback;
      case "management":
        return ManagementErrorFallback;
      default:
        return DefaultErrorFallback;
    }
  }
}

/**
 * Default error fallback component
 */
function DefaultErrorFallback({ error, resetError, portal }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
          <svg
            className="w-6 h-6 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-semibold text-gray-900 text-center mb-2">
          Something went wrong
        </h1>

        <p className="text-gray-600 text-center mb-6">
          We're sorry, but something unexpected happened. Please try refreshing the page.
        </p>

        <div className="space-y-3">
          <button
            onClick={resetError}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try again
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Refresh page
          </button>
        </div>

        {process.env["NODE_ENV"] === "development" && (
          <details className="mt-6 p-4 bg-red-50 rounded-md">
            <summary className="cursor-pointer text-sm font-medium text-red-800">
              Error Details (Development)
            </summary>
            <pre className="mt-2 text-xs text-red-700 whitespace-pre-wrap">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Portal-specific error fallbacks
 */
function AdminErrorFallback(props: ErrorFallbackProps) {
  return <DefaultErrorFallback {...props} />;
}

function CustomerErrorFallback(props: ErrorFallbackProps) {
  return <DefaultErrorFallback {...props} />;
}

function ResellerErrorFallback(props: ErrorFallbackProps) {
  return <DefaultErrorFallback {...props} />;
}

function TechnicianErrorFallback(props: ErrorFallbackProps) {
  return <DefaultErrorFallback {...props} />;
}

function ManagementErrorFallback(props: ErrorFallbackProps) {
  return <DefaultErrorFallback {...props} />;
}

export type { ErrorFallbackProps };

// Higher-order component to wrap components with the ErrorBoundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    portal: PortalType;
    fallback?: ErrorBoundaryProps["fallback"];
    onError?: ErrorBoundaryProps["onError"];
  },
) {
  const { portal, fallback, onError } = options;
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary portal={portal} fallback={fallback} onError={onError}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// AsyncErrorBoundary alias for compatibility (can be enhanced separately)
export const AsyncErrorBoundary = ErrorBoundary;
