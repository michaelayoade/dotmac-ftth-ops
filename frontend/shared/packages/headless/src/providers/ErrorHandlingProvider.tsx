/**
 * Error Handling Provider
 * Provides global error handling configuration and services
 */

import React, { createContext, useContext, useCallback, useEffect, useState } from "react";
import {
  ISPError,
  setErrorLogger,
  logError,
  configureGlobalErrorHandling,
  DEFAULT_ERROR_CONFIG,
  type ErrorHandlingConfig,
  type ErrorLogEntry,
} from "../utils/errorUtils";
import { useISPTenant } from "../hooks/useISPTenant";
import { useNotifications } from "../hooks/useNotifications";

export interface ErrorHandlingContextValue {
  config: ErrorHandlingConfig;
  updateConfig: (newConfig: Partial<ErrorHandlingConfig>) => void;
  reportError: (error: ISPError, context?: string) => void;
  clearGlobalErrors: () => void;
  globalErrors: ISPError[];
  errorStats: {
    totalErrors: number;
    criticalErrors: number;
    networkErrors: number;
    authErrors: number;
  };
}

const ErrorHandlingContext = createContext<ErrorHandlingContextValue | null>(null);

export interface ErrorHandlingProviderProps {
  children: React.ReactNode;
  initialConfig?: Partial<ErrorHandlingConfig>;
  onError?: (error: ISPError, logEntry: ErrorLogEntry) => void;
  enableTelemetry?: boolean;
  telemetryEndpoint?: string;
}

export function ErrorHandlingProvider({
  children,
  initialConfig = {},
  onError,
  enableTelemetry = true,
  telemetryEndpoint = "/api/telemetry/errors",
}: ErrorHandlingProviderProps) {
  const [config, setConfig] = useState<ErrorHandlingConfig>({
    ...DEFAULT_ERROR_CONFIG,
    ...initialConfig,
  });

  const [globalErrors, setGlobalErrors] = useState<ISPError[]>([]);
  const { currentTenant } = useISPTenant();
  const { showError } = useNotifications();

  // Error statistics
  const errorStats = React.useMemo(() => {
    const stats = {
      totalErrors: globalErrors.length,
      criticalErrors: 0,
      networkErrors: 0,
      authErrors: 0,
    };

    globalErrors.forEach((error) => {
      if (error.severity === "critical") stats.criticalErrors++;
      if (error.category === "network") stats.networkErrors++;
      if (error.category === "authentication" || error.category === "authorization")
        stats.authErrors++;
    });

    return stats;
  }, [globalErrors]);

  // Configure global error handling
  useEffect(() => {
    configureGlobalErrorHandling(config);
  }, [config]);

  // Setup error logger
  useEffect(() => {
    const logger = (logEntry: ErrorLogEntry) => {
      // Add error to global state
      setGlobalErrors((prev) => {
        const newErrors = [logEntry.error as any, ...prev.slice(0, 49)]; // Keep last 50 errors
        return newErrors;
      });

      // Send to telemetry if enabled
      if (enableTelemetry && telemetryEndpoint) {
        sendToTelemetry(logEntry).catch((telemetryError) => {
          console.warn("Failed to send error telemetry:", telemetryError);
        });
      }

      // Call custom error handler
      onError?.(logEntry.error as ISPError, logEntry);

      // Show critical errors to user immediately
      if (logEntry.error.severity === "critical" && config.enableUserNotifications) {
        showError(`Critical error: ${logEntry.error.userMessage}`, {
          persistent: true,
          actions: logEntry.error.retryable
            ? [
                {
                  label: "Report Issue",
                  action: () => reportIssue(logEntry.error as ISPError),
                },
              ]
            : undefined,
        });
      }
    };

    setErrorLogger(logger);

    return () => {
      setErrorLogger(() => {});
    };
  }, [config, enableTelemetry, telemetryEndpoint, onError, showError]);

  // Telemetry function
  const sendToTelemetry = async (logEntry: ErrorLogEntry) => {
    if (!telemetryEndpoint) return;

    try {
      await fetch(telemetryEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentTenant && { "X-Tenant-ID": currentTenant.id }),
        },
        body: JSON.stringify({
          ...logEntry,
          tenantId: currentTenant?.id,
          timestamp: new Date().toISOString(),
          version: typeof window !== "undefined" ? (window as any).__APP_VERSION__ : "unknown",
        }),
      });
    } catch (telemetryError) {
      // Silently fail telemetry - don't let telemetry errors affect the app
      console.debug("Telemetry error:", telemetryError);
    }
  };

  // Report issue function
  const reportIssue = async (error: ISPError) => {
    try {
      await fetch("/api/support/report-issue", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentTenant && { "X-Tenant-ID": currentTenant.id }),
        },
        body: JSON.stringify({
          errorId: error.id,
          correlationId: error.correlationId,
          userMessage: "Automatically reported critical error",
          context: error.context,
          technicalDetails: error.technicalDetails,
        }),
      });

      showError("Issue reported successfully. Our team will investigate.", {
        type: "success",
      });
    } catch (reportError) {
      showError("Failed to report issue. Please contact support directly.");
    }
  };

  const updateConfig = useCallback((newConfig: Partial<ErrorHandlingConfig>) => {
    setConfig((prev) => ({ ...prev, ...newConfig }));
  }, []);

  const reportError = useCallback(
    (error: ISPError, context?: string) => {
      logError(error, {
        tenantId: currentTenant?.id,
        userId:
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("userId") || undefined
            : undefined,
        sessionId:
          typeof window !== "undefined"
            ? window.sessionStorage.getItem("sessionId") || undefined
            : undefined,
      });

      if (context) {
        console.group(`🔴 Error in ${context}`);
        console.error("Error details:", error);
        console.error("User message:", error.userMessage);
        console.error("Technical details:", error.technicalDetails);
        console.groupEnd();
      }
    },
    [currentTenant],
  );

  const clearGlobalErrors = useCallback(() => {
    setGlobalErrors([]);
  }, []);

  const contextValue: ErrorHandlingContextValue = {
    config,
    updateConfig,
    reportError,
    clearGlobalErrors,
    globalErrors,
    errorStats,
  };

  return (
    <ErrorHandlingContext.Provider value={contextValue}>{children}</ErrorHandlingContext.Provider>
  );
}

/**
 * Hook to access error handling context
 */
export function useErrorHandling(): ErrorHandlingContextValue {
  const context = useContext(ErrorHandlingContext);
  if (!context) {
    throw new Error("useErrorHandling must be used within an ErrorHandlingProvider");
  }
  return context;
}

/**
 * Hook for reporting errors programmatically
 */
export function useErrorReporting() {
  const { reportError } = useErrorHandling();

  return {
    reportError,
    reportApiError: (error: unknown, endpoint: string) => {
      const ispError = ISPError.classifyError(error, `API: ${endpoint}`);
      reportError(ispError, endpoint);
    },
    reportComponentError: (error: unknown, componentName: string) => {
      const ispError = ISPError.classifyError(error, `Component: ${componentName}`);
      reportError(ispError, componentName);
    },
    reportBusinessError: (message: string, context?: string, details?: Record<string, any>) => {
      const ispError = new ISPError({
        message,
        category: "business",
        severity: "medium",
        context,
        retryable: false,
        technicalDetails: details,
      });
      reportError(ispError, context);
    },
  };
}

/**
 * Development error overlay component
 */
export function ErrorDevOverlay() {
  const { globalErrors, errorStats, clearGlobalErrors } = useErrorHandling();
  const [isVisible, setIsVisible] = useState(false);

  // Only show in development
  if (process.env["NODE_ENV"] !== "development") {
    return null;
  }

  if (!isVisible && globalErrors.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {!isVisible && globalErrors.length > 0 && (
        <button
          onClick={() => setIsVisible(true)}
          className="bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-red-700 transition-colors"
        >
          🔴 {errorStats.totalErrors} Error
          {errorStats.totalErrors !== 1 ? "s" : ""}
          {errorStats.criticalErrors > 0 && (
            <span className="ml-1 bg-red-800 px-1 rounded text-xs">
              {errorStats.criticalErrors} Critical
            </span>
          )}
        </button>
      )}

      {isVisible && (
        <div className="bg-white border border-red-200 rounded-lg shadow-xl max-w-md w-96 max-h-96 overflow-hidden">
          <div className="flex items-center justify-between p-3 bg-red-50 border-b">
            <h3 className="font-semibold text-red-800">Recent Errors</h3>
            <div className="flex gap-2">
              <button
                onClick={clearGlobalErrors}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Clear
              </button>
              <button
                onClick={() => setIsVisible(false)}
                className="text-red-600 hover:text-red-800"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-80 p-2">
            {globalErrors.map((error, index) => (
              <div
                key={`${error.id}-${index}`}
                className="mb-2 p-2 bg-gray-50 rounded border text-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`px-1 rounded text-xs font-medium ${
                      error.severity === "critical"
                        ? "bg-red-100 text-red-800"
                        : error.severity === "high"
                          ? "bg-orange-100 text-orange-800"
                          : error.severity === "medium"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {error.severity}
                  </span>
                  <span className="text-gray-500">
                    {new Date(error.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="font-medium text-gray-900 mb-1">{error.message}</div>
                <div className="text-gray-600">{error.context}</div>
                {error.userMessage && (
                  <div className="text-blue-600 mt-1">User: {error.userMessage}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
