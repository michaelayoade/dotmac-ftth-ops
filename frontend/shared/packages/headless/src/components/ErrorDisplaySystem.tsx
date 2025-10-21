/**
 * Enhanced Error Display System
 * Provides structured, context-aware error display components
 */

"use client";

import React from "react";
import {
  EnhancedISPError,
  type EnhancedErrorResponse,
  ErrorCode,
} from "../utils/enhancedErrorHandling";

// Error display component with rich context
export interface EnhancedErrorDisplayProps {
  error: EnhancedISPError | EnhancedErrorResponse;
  showTechnicalDetails?: boolean;
  onRetry?: () => void;
  onContactSupport?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export const EnhancedErrorDisplay: React.FC<EnhancedErrorDisplayProps> = ({
  error,
  showTechnicalDetails = false,
  onRetry,
  onContactSupport,
  onDismiss,
  className = "",
}) => {
  // Normalize error data
  const errorData = error instanceof EnhancedISPError ? error.toEnhancedResponse() : error;

  const severityColors = {
    low: "border-yellow-200 bg-yellow-50 text-yellow-800",
    medium: "border-orange-200 bg-orange-50 text-orange-800",
    high: "border-red-200 bg-red-50 text-red-800",
    critical: "border-red-600 bg-red-100 text-red-900",
  };

  const iconForSeverity = {
    low: "⚠️",
    medium: "🔶",
    high: "❌",
    critical: "🚨",
  };

  const canRetry = errorData.resolution?.retryable && onRetry;
  const retryAfter = errorData.resolution?.retryAfter;

  return (
    <div
      className={`rounded-lg border-2 p-4 ${severityColors[errorData.error.severity]} ${className}`}
    >
      {/* Error Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-2xl" role="img" aria-label={errorData.error.severity}>
            {iconForSeverity[errorData.error.severity]}
          </span>
          <div>
            <h3 className="font-semibold text-lg">
              Error {errorData.error.code}
              {errorData.context.businessProcess && (
                <span className="ml-2 text-sm font-normal opacity-75">
                  ({errorData.context.businessProcess})
                </span>
              )}
            </h3>
            <p className="text-sm opacity-75">
              {errorData.error.category} • {errorData.error.severity} severity
            </p>
          </div>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Dismiss error"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
      </div>

      {/* User Message */}
      <div className="mt-3">
        <p className="text-base font-medium">{errorData.userMessage}</p>

        {/* Context Information */}
        {(errorData.context.operation || errorData.context.resource) && (
          <div className="mt-2 text-sm opacity-75">
            {errorData.context.operation && <span>Operation: {errorData.context.operation}</span>}
            {errorData.context.resource && (
              <span>
                {errorData.context.operation && " • "}
                Resource: {errorData.context.resource}
                {errorData.context.resourceId && ` (${errorData.context.resourceId})`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* User Actions */}
      {errorData.userActions && errorData.userActions.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium mb-2">What you can do:</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            {errorData.userActions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Business Impact Warning */}
      {errorData.context.customerImpact && errorData.context.customerImpact !== "none" && (
        <div className="mt-4 p-3 bg-white bg-opacity-50 rounded border border-current border-opacity-25">
          <div className="flex items-center space-x-2">
            <span className="text-lg">💼</span>
            <div>
              <p className="font-medium text-sm">
                Customer Impact: {errorData.context.customerImpact}
              </p>
              {errorData.context.customerImpact === "high" ||
                (errorData.context.customerImpact === "critical" && (
                  <p className="text-xs mt-1">
                    This error may significantly impact customer experience.
                  </p>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        {canRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            {retryAfter ? `Retry in ${retryAfter}s` : "Try Again"}
          </button>
        )}

        {errorData.resolution?.escalationRequired && onContactSupport && (
          <button
            onClick={onContactSupport}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors text-sm font-medium"
          >
            Contact Support
          </button>
        )}

        {errorData.documentationUrl && (
          <a
            href={errorData.documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm font-medium inline-flex items-center"
          >
            View Documentation
            <svg className="ml-1 h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </a>
        )}
      </div>

      {/* Workaround Section */}
      {errorData.resolution?.workaround && (
        <div className="mt-4 p-3 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-start space-x-2">
            <span className="text-blue-600 text-lg">💡</span>
            <div>
              <p className="font-medium text-blue-800 text-sm">Workaround Available</p>
              <p className="text-blue-700 text-sm mt-1">{errorData.resolution.workaround}</p>
            </div>
          </div>
        </div>
      )}

      {/* Technical Details (Collapsible) */}
      {showTechnicalDetails &&
        (errorData.details.technicalMessage || errorData.details.debugInfo) && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
              Technical Details
            </summary>
            <div className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono">
              <p>
                <strong>Error ID:</strong> {errorData.error.id}
              </p>
              <p>
                <strong>Timestamp:</strong> {errorData.error.timestamp}
              </p>
              {errorData.details.requestId && (
                <p>
                  <strong>Request ID:</strong> {errorData.details.requestId}
                </p>
              )}
              {errorData.context.correlationId && (
                <p>
                  <strong>Correlation ID:</strong> {errorData.context.correlationId}
                </p>
              )}
              {errorData.details.technicalMessage && (
                <p className="mt-2">
                  <strong>Technical Message:</strong> {errorData.details.technicalMessage}
                </p>
              )}
              {errorData.details.debugInfo && (
                <div className="mt-2">
                  <strong>Debug Information:</strong>
                  <pre className="mt-1 whitespace-pre-wrap text-xs">
                    {JSON.stringify(errorData.details.debugInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </details>
        )}
    </div>
  );
};

// Compact error display for inline use
export interface CompactErrorDisplayProps {
  error: EnhancedISPError | EnhancedErrorResponse;
  onRetry?: () => void;
  className?: string;
}

export const CompactErrorDisplay: React.FC<CompactErrorDisplayProps> = ({
  error,
  onRetry,
  className = "",
}) => {
  const errorData = error instanceof EnhancedISPError ? error.toEnhancedResponse() : error;

  const severityColors = {
    low: "text-yellow-600 bg-yellow-50 border-yellow-200",
    medium: "text-orange-600 bg-orange-50 border-orange-200",
    high: "text-red-600 bg-red-50 border-red-200",
    critical: "text-red-800 bg-red-100 border-red-300",
  };

  const canRetry = errorData.resolution?.retryable && onRetry;

  return (
    <div
      className={`flex items-center justify-between p-3 border rounded-md ${severityColors[errorData.error.severity]} ${className}`}
    >
      <div className="flex items-center space-x-2">
        <span className="text-lg">❌</span>
        <div>
          <p className="font-medium text-sm">{errorData.userMessage}</p>
          <p className="text-xs opacity-75">{errorData.error.code}</p>
        </div>
      </div>

      {canRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1 bg-white border border-current rounded text-xs font-medium hover:bg-gray-50 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
};

// Error toast notification
export interface ErrorToastProps {
  error: EnhancedISPError | EnhancedErrorResponse;
  onDismiss: () => void;
  duration?: number;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

export const ErrorToast: React.FC<ErrorToastProps> = ({
  error,
  onDismiss,
  duration = 5000,
  position = "top-right",
}) => {
  const errorData = error instanceof EnhancedISPError ? error.toEnhancedResponse() : error;

  React.useEffect(() => {
    if (duration > 0 && errorData.error.severity !== "critical") {
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss, errorData.error.severity]);

  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  };

  const severityColors = {
    low: "bg-yellow-500 text-white",
    medium: "bg-orange-500 text-white",
    high: "bg-red-500 text-white",
    critical: "bg-red-700 text-white",
  };

  return (
    <div className={`fixed z-50 max-w-md shadow-lg rounded-lg ${positionClasses[position]}`}>
      <div className={`p-4 rounded-lg ${severityColors[errorData.error.severity]}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-lg">❌</span>
            <div>
              <p className="font-medium text-sm">{errorData.userMessage}</p>
              <p className="text-xs opacity-75 mt-1">{errorData.error.code}</p>
            </div>
          </div>

          <button
            onClick={onDismiss}
            className="text-white hover:text-gray-200 transition-colors ml-4"
            aria-label="Dismiss notification"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// Error boundary with enhanced error display
export interface EnhancedErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{
    error: EnhancedISPError;
    resetError: () => void;
  }>;
  onError?: (error: EnhancedISPError, errorInfo: React.ErrorInfo) => void;
}

interface EnhancedErrorBoundaryState {
  hasError: boolean;
  error: EnhancedISPError | null;
}

export class EnhancedErrorBoundary extends React.Component<
  EnhancedErrorBoundaryProps,
  EnhancedErrorBoundaryState
> {
  constructor(props: EnhancedErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): EnhancedErrorBoundaryState {
    const enhancedError = new EnhancedISPError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message,
      context: {
        operation: "react_render",
        component: "ErrorBoundary",
        businessProcess: "ui_rendering",
        customerImpact: "medium",
      },
      technicalDetails: {
        stack: error.stack,
        name: error.name,
      },
    });

    return {
      hasError: true,
      error: enhancedError,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    if (this.props.onError && this.state.error) {
      this.props.onError(this.state.error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const resetError = () => {
        this.setState({ hasError: false, error: null });
      };

      if (this.props.fallback) {
        return <this.props.fallback error={this.state.error} resetError={resetError} />;
      }

      return (
        <EnhancedErrorDisplay
          error={this.state.error}
          onRetry={resetError}
          showTechnicalDetails={true}
          className="m-4"
        />
      );
    }

    return this.props.children;
  }
}

export default {
  EnhancedErrorDisplay,
  CompactErrorDisplay,
  ErrorToast,
  EnhancedErrorBoundary,
};
