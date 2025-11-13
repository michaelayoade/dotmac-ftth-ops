/**
 * Audit Provider Component
 * Provides audit logging context across the entire application
 * Implements DRY principle by centralizing audit configuration and management
 */

import React, { createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { useAuditLogger } from "../hooks/useAuditLogger";
import type { UseAuditLoggerReturn } from "../hooks/useAuditLogger";
import {
  AuditEventType,
  AuditOutcome,
  FrontendAuditEventType,
  AuditSeverity,
} from "../api/types/audit";

interface AuditContextType extends UseAuditLoggerReturn {
  serviceName: string;
  isEnabled: boolean;
}

const AuditContext = createContext<AuditContextType | null>(null);

interface AuditProviderProps {
  children: ReactNode;
  serviceName: string;
  enabled?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  enableLocalStorage?: boolean;
  enableConsoleLogging?: boolean;
}

export function AuditProvider({
  children,
  serviceName,
  enabled = true,
  batchSize = 10,
  batchTimeout = 5000,
  enableLocalStorage = true,
  enableConsoleLogging = process.env["NODE_ENV"] === "development",
}: AuditProviderProps) {
  const auditLogger = useAuditLogger({
    serviceName,
    batchSize,
    batchTimeout,
    enableLocalStorage,
    enableConsoleLogging,
  });

  // Log application startup
  useEffect(() => {
    if (enabled) {
      auditLogger.logEvent({
        event_type: AuditEventType.SYSTEM_STARTUP,
        message: `Application ${serviceName} started`,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.LOW,
        actor: { id: "system", type: "system" },
        context: {
          source: serviceName,
          environment: process.env["NODE_ENV"] || "development",
        },
      });
    }
  }, [enabled, serviceName, auditLogger]);

  // Log page visibility changes
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleVisibilityChange = () => {
      const isVisible = !document.hidden;
      auditLogger.logUIEvent(
        isVisible ? FrontendAuditEventType.UI_SESSION_START : FrontendAuditEventType.UI_SESSION_END,
        "page_visibility",
        { visible: isVisible },
      );
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled, auditLogger]);

  // Log unhandled errors
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleError = (event: ErrorEvent) => {
      auditLogger.logError(new Error(event.message), "unhandled_error", {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      auditLogger.logError(
        new Error(event.reason?.message || "Unhandled promise rejection"),
        "unhandled_promise_rejection",
        { reason: event.reason },
      );
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, [enabled, auditLogger]);

  // Flush batch on page unload
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const handleBeforeUnload = () => {
      auditLogger.flushBatch();
      auditLogger.logUIEvent(FrontendAuditEventType.UI_SESSION_END, "page_unload");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled, auditLogger]);

  const contextValue: AuditContextType = {
    ...auditLogger,
    serviceName,
    isEnabled: enabled,
  };

  return <AuditContext.Provider value={contextValue}>{children}</AuditContext.Provider>;
}

export function useAudit(): AuditContextType {
  const context = useContext(AuditContext);
  if (!context) {
    throw new Error("useAudit must be used within an AuditProvider");
  }
  return context;
}

// Higher-order component for easy integration
export function withAudit<P extends object>(
  Component: React.ComponentType<P>,
  serviceName: string,
  auditConfig?: Omit<AuditProviderProps, "children" | "serviceName">,
) {
  return function AuditWrappedComponent(props: P) {
    return (
      <AuditProvider serviceName={serviceName} {...auditConfig}>
        <Component {...props} />
      </AuditProvider>
    );
  };
}
