/**
 * Error Alert Component
 *
 * Standardized error display component with retry and dismiss actions
 */

import { AlertCircle, XCircle, RefreshCw, X } from "lucide-react";
import * as React from "react";

import { Alert, AlertDescription, AlertTitle } from "./components/alert";
import { Button } from "./components/button";

// Local type definitions for error handling
export enum ErrorSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
  CRITICAL = "critical",
}

export interface AppError {
  id: string;
  message: string;
  details?: string;
  category?: string;
  severity: ErrorSeverity;
  statusCode?: number;
  code?: string;
  fieldErrors?: Record<string, string[]>;
  timestamp: Date;
  retryable: boolean;
  action?: string;
  context?: Record<string, unknown>;
}

export interface ErrorAlertProps {
  /** Error to display */
  error: AppError | Error | string;

  /** Callback when close button is clicked */
  onClose?: () => void;

  /** Callback when retry button is clicked */
  onRetry?: () => void;

  /** Whether to show retry button */
  showRetry?: boolean;

  /** Whether to show close button */
  showClose?: boolean;

  /** Custom className */
  className?: string;

  /** Variant */
  variant?: "default" | "destructive";
}

/**
 * Normalize error to AppError-like structure
 */
function normalizeError(error: AppError | Error | string): {
  message: string;
  action?: string;
  retryable?: boolean;
  severity?: ErrorSeverity;
} {
  if (typeof error === "string") {
    return { message: error };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return {
    message: error.message,
    action: error.action,
    retryable: error.retryable,
    severity: error.severity,
  };
}

/**
 * Get alert icon based on error severity
 */
function getErrorIcon(severity?: ErrorSeverity) {
  switch (severity) {
    case "critical":
    case "error":
      return <XCircle className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}

/**
 * ErrorAlert Component
 *
 * @example
 * ```tsx
 * <ErrorAlert
 *   error={error}
 *   onClose={clearError}
 *   onRetry={retry}
 *   showRetry
 * />
 * ```
 */
export function ErrorAlert({
  error,
  onClose,
  onRetry,
  showRetry = true,
  showClose = true,
  className,
  variant: variantProp,
}: ErrorAlertProps) {
  const normalized = normalizeError(error);

  // Determine variant from error severity if not explicitly provided
  const variant =
    variantProp ||
    (normalized.severity === "critical" || normalized.severity === "error"
      ? "destructive"
      : "default");

  return (
    <Alert variant={variant} className={className}>
      {getErrorIcon(normalized.severity)}
      <div className="flex-1">
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{normalized.message}</AlertDescription>
        {normalized.action && (
          <AlertDescription className="mt-2 text-xs opacity-80">
            {normalized.action}
          </AlertDescription>
        )}
      </div>

      <div className="flex items-center gap-2">
        {showRetry && onRetry && normalized.retryable && (
          <Button variant="ghost" size="sm" onClick={onRetry} className="h-8 px-2">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}

        {showClose && onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        )}
      </div>
    </Alert>
  );
}

// ============================================================================
// Field Error Component
// ============================================================================

export interface FieldErrorProps {
  /** Error message */
  error?: string | string[];

  /** Custom className */
  className?: string;
}

/**
 * Field Error Component
 *
 * Displays validation error for form fields
 *
 * @example
 * ```tsx
 * <FieldError error={errors.email} />
 * ```
 */
export function FieldError({ error, className }: FieldErrorProps) {
  if (!error) return null;

  const errors = Array.isArray(error) ? error : [error];

  return (
    <div className={className}>
      {errors.map((err, index) => (
        <p key={index} className="text-sm font-medium text-destructive mt-1">
          {err}
        </p>
      ))}
    </div>
  );
}

// ============================================================================
// Inline Error Component
// ============================================================================

export interface InlineErrorProps {
  /** Error message */
  message: string;

  /** Custom className */
  className?: string;
}

/**
 * Inline Error Component
 *
 * Compact error display for inline use
 *
 * @example
 * ```tsx
 * <InlineError message="Something went wrong" />
 * ```
 */
export function InlineError({ message, className }: InlineErrorProps) {
  return (
    <div className={`flex items-center gap-2 text-sm text-destructive ${className}`}>
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}
