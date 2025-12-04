/**
 * Error Boundary
 *
 * Wrapper that connects the shared ErrorBoundary to app-specific logger.
 */

"use client";

import {
  ErrorBoundary as SharedErrorBoundary,
  useAsyncError,
  withErrorBoundary,
} from "@dotmac/features/error-handling";
import { logger } from "@/lib/logger";
import { type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export function ErrorBoundary({ children, fallback, onError }: Props) {
  return (
    <SharedErrorBoundary
      logger={logger}
      {...(fallback ? { fallback } : {})}
      {...(onError ? { onError } : {})}
    >
      {children}
    </SharedErrorBoundary>
  );
}

// Re-export utility functions
export { useAsyncError, withErrorBoundary };
