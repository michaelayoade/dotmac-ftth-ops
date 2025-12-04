"use client";

import type React from "react";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";

export interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  retry?: () => Promise<void>;
  isRetrying?: boolean;
}

// Generic error fallback
export function GenericErrorFallback({ error, resetError, retry, isRetrying }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="mb-4 h-12 w-12 text-red-500" />
      <h3 className="mb-2 font-semibold text-gray-900 text-lg">Something went wrong</h3>
      <p className="mb-4 text-gray-600">{error?.message || "An unexpected error occurred"}</p>
      <div className="flex space-x-3">
        {retry ? (
          <button
            type="button"
            onClick={retry}
            onKeyDown={(e) => e.key === "Enter" && retry}
            disabled={isRetrying}
            className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        ) : null}
        {resetError ? (
          <button
            type="button"
            onClick={resetError}
            onKeyDown={(e) => e.key === "Enter" && resetError}
            className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Network error fallback
export function NetworkErrorFallback({ resetError, retry, isRetrying }: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <WifiOff className="mb-4 h-12 w-12 text-red-500" />
      <h3 className="mb-2 font-semibold text-gray-900 text-lg">Connection Problem</h3>
      <p className="mb-4 text-gray-600">
        Unable to connect to our servers. Please check your internet connection and try again.
      </p>
      <div className="flex space-x-3">
        {retry ? (
          <button
            type="button"
            onClick={retry}
            onKeyDown={(e) => e.key === "Enter" && retry}
            disabled={isRetrying}
            className="flex items-center rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} />
            {isRetrying ? "Reconnecting..." : "Retry Connection"}
          </button>
        ) : null}
        {resetError ? (
          <button
            type="button"
            onClick={resetError}
            onKeyDown={(e) => e.key === "Enter" && resetError}
            className="rounded-lg bg-gray-600 px-4 py-2 text-white hover:bg-gray-700"
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Loading error fallback
export function LoadingErrorFallback({ error, resetError, retry, isRetrying }: ErrorFallbackProps) {
  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
      <div className="flex items-start">
        <AlertCircle className="mt-0.5 mr-3 h-5 w-5 text-yellow-600" />
        <div className="flex-1">
          <h4 className="font-medium text-sm text-yellow-800">Failed to load data</h4>
          <p className="mt-1 text-sm text-yellow-700">
            {error?.message || "Unable to load the requested information"}
          </p>
          <div className="mt-3 flex space-x-2">
            {retry ? (
              <button
                type="button"
                onClick={retry}
                onKeyDown={(e) => e.key === "Enter" && retry}
                disabled={isRetrying}
                className="flex items-center rounded bg-yellow-600 px-3 py-1 text-white text-xs hover:bg-yellow-700 disabled:opacity-50"
              >
                <RefreshCw className={`mr-1 h-3 w-3 ${isRetrying ? "animate-spin" : ""}`} />
                {isRetrying ? "Retrying..." : "Retry"}
              </button>
            ) : null}
            {resetError ? (
              <button
                type="button"
                onClick={resetError}
                onKeyDown={(e) => e.key === "Enter" && resetError}
                className="rounded bg-gray-600 px-3 py-1 text-white text-xs hover:bg-gray-700"
              >
                Reset
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline error fallback for smaller components
export function InlineErrorFallback({ error, retry, isRetrying }: ErrorFallbackProps) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-4 text-center">
      <div>
        <AlertCircle className="mr-2 inline h-4 w-4 text-red-500" />
        <span className="text-red-700 text-sm">{error?.message || "Error loading content"}</span>
        {retry ? (
          <button
            type="button"
            onClick={retry}
            onKeyDown={(e) => e.key === "Enter" && retry}
            disabled={isRetrying}
            className="ml-3 text-red-700 text-xs underline hover:text-red-900 disabled:opacity-50"
          >
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

// Empty state fallback
export function EmptyStateFallback({
  title = "No data available",
  description = "There&apos;s nothing to show here yet.",
  action,
  actionLabel = "Try again",
}: {
  title?: string;
  description?: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 h-24 w-24 text-gray-400">
        <svg
          aria-label="icon"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
        >
          <title>Icon</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 4.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
          />
        </svg>
      </div>
      <h3 className="mb-2 font-semibold text-gray-900 text-lg">{title}</h3>
      <p className="mb-4 text-gray-600">{description}</p>
      {action ? (
        <button
          type="button"
          onClick={action}
          onKeyDown={(e) => e.key === "Enter" && action}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

// Unauthorized access fallback
export function UnauthorizedFallback({
  onLogin,
  message = "You need to be logged in to access this content.",
}: {
  onLogin?: () => void;
  message?: string;
}) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 h-12 w-12 text-yellow-500">
        <svg
          aria-label="icon"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
        >
          <title>Icon</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <h3 className="mb-2 font-semibold text-gray-900 text-lg">Access Required</h3>
      <p className="mb-4 text-gray-600">{message}</p>
      {onLogin ? (
        <button
          type="button"
          onClick={onLogin}
          onKeyDown={(e) => e.key === "Enter" && onLogin}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Log In
        </button>
      ) : null}
    </div>
  );
}

// Maintenance mode fallback
export function MaintenanceFallback({
  estimatedTime,
  contactSupport,
}: {
  estimatedTime?: string;
  contactSupport?: () => void;
}) {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto mb-4 h-12 w-12 text-orange-500">
        <svg
          aria-label="icon"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
        >
          <title>Icon</title>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z"
          />
        </svg>
      </div>
      <h3 className="mb-2 font-semibold text-gray-900 text-lg">Under Maintenance</h3>
      <p className="mb-4 text-gray-600">
        We're performing some maintenance to improve your experience. Please check back soon.
      </p>
      {estimatedTime ? (
        <p className="mb-4 text-gray-500 text-sm">Estimated completion: {estimatedTime}</p>
      ) : null}
      {contactSupport ? (
        <button
          type="button"
          onClick={contactSupport}
          onKeyDown={(e) => e.key === "Enter" && contactSupport}
          className="text-blue-600 text-sm underline hover:text-blue-800"
        >
          Contact Support
        </button>
      ) : null}
    </div>
  );
}

// Higher-order component to wrap components with error fallbacks
export function withErrorFallback<P extends object>(
  Component: React.ComponentType<P>,
  _fallbackComponent: React.ComponentType<ErrorFallbackProps> = GenericErrorFallback,
) {
  return function WrappedComponent(props: P) {
    // This would be used with an error boundary or error hook
    return <Component {...props} />;
  };
}
