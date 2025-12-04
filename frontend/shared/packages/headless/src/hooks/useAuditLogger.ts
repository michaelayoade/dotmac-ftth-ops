/**
 * React Hook for Integrated Audit Logging
 * Provides unified audit logging combining frontend events with backend persistence
 * Follows DRY principles by centralizing audit logic across all frontend apps
 */

import { useCallback, useRef, useEffect } from "react";
import { AuditApiClient } from "../api/clients/AuditApiClient";
import {
  AuditEventType,
  FrontendAuditEventType,
  AuditSeverity,
  AuditOutcome,
} from "../api/types/audit";
import type {
  CreateFrontendAuditEvent,
  AuditContext,
  AuditEvent,
  AuditActor,
} from "../api/types/audit";
import { useISPTenant } from "./useISPTenant";
import { useAuth } from "../auth/context";

interface AuditLoggerConfig {
  serviceName: string;
  batchSize?: number;
  batchTimeout?: number;
  enableLocalStorage?: boolean;
  enableConsoleLogging?: boolean;
}

export interface UseAuditLoggerReturn {
  // Core logging methods
  logEvent: (event: CreateFrontendAuditEvent) => Promise<void>;
  logBatch: (events: CreateFrontendAuditEvent[]) => Promise<void>;

  // Convenience methods for common events
  logAuthEvent: (
    type: AuditEventType,
    outcome: AuditOutcome,
    message: string,
    metadata?: Record<string, any>,
  ) => Promise<void>;
  logDataAccess: (
    operation: string,
    resourceType: string,
    resourceId: string,
    outcome: AuditOutcome,
    metadata?: Record<string, any>,
  ) => Promise<void>;
  logUIEvent: (
    type: FrontendAuditEventType,
    element: string,
    metadata?: Record<string, any>,
  ) => Promise<void>;
  logError: (error: Error, context: string, metadata?: Record<string, any>) => Promise<void>;
  logBusinessEvent: (
    type: AuditEventType,
    workflow: string,
    outcome: AuditOutcome,
    metadata?: Record<string, any>,
  ) => Promise<void>;

  // Batch management
  flushBatch: () => Promise<void>;

  // Health and status
  isHealthy: boolean;
  getQueueSize: () => number;
}

export function useAuditLogger(config: AuditLoggerConfig): UseAuditLoggerReturn {
  const {
    serviceName,
    batchSize = 10,
    batchTimeout = 5000,
    enableLocalStorage = true,
    enableConsoleLogging = false,
  } = config;

  const { tenant } = useISPTenant();
  const tenantId = tenant?.id;
  const { user, sessionId } = useAuth();

  const auditClientRef = useRef<AuditApiClient | null>(null);
  const batchQueueRef = useRef<CreateFrontendAuditEvent[]>([]);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isHealthyRef = useRef<boolean>(true);

  // Initialize audit client
  useEffect(() => {
    const baseURL = process.env["NEXT_PUBLIC_API_BASE_URL"] || "/api";
    const headers: Record<string, string> = {};

    if (user?.token) {
      headers["Authorization"] = `Bearer ${user.token}`;
    }

    auditClientRef.current = new AuditApiClient(baseURL, headers);
  }, [user?.token]);

  // Auto-flush batch on timeout
  useEffect(() => {
    const flushOnTimeout = () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }

      batchTimeoutRef.current = setTimeout(() => {
        if (batchQueueRef.current.length > 0) {
          flushBatch();
        }
      }, batchTimeout);
    };

    flushOnTimeout();

    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
    };
  }, [batchTimeout]);

  // Create actor information from current user context
  const createActor = useCallback(() => {
    const actor: AuditActor = {
      id: user?.id || "anonymous",
      type: user?.id ? ("user" as const) : ("anonymous" as const),
    };

    if (user?.name) {
      actor.name = user.name;
    }
    if (user?.email) {
      actor.email = user.email;
    }
    if (sessionId) {
      actor.session_id = sessionId;
    }
    if (typeof navigator !== "undefined") {
      actor.user_agent = navigator.userAgent;
    }

    return actor;
  }, [user, sessionId]);

  // Create context information
  const createContext = useCallback(
    (additionalContext?: Record<string, any>) => {
      return {
        source: serviceName,
        environment: process.env["NODE_ENV"] || "development",
        correlation_id: sessionId ?? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        request_id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        additional: {
          url: typeof window !== "undefined" ? window.location.href : undefined,
          ...additionalContext,
        },
      };
    },
    [serviceName, sessionId],
  );

  // Store event locally for offline support
  const storeLocally = useCallback(
    (event: CreateFrontendAuditEvent) => {
      if (!enableLocalStorage || typeof window === "undefined") return;

      try {
        const stored = localStorage.getItem("audit_events") || "[]";
        const events = JSON.parse(stored);
        events.push({
          ...event,
          timestamp: Date.now(),
          stored_offline: true,
        });

        // Keep only last 100 events locally
        const recentEvents = events.slice(-100);
        localStorage.setItem("audit_events", JSON.stringify(recentEvents));
      } catch (error) {
        console.warn("Failed to store audit event locally:", error);
      }
    },
    [enableLocalStorage],
  );

  // Console logging for development
  const consoleLog = useCallback(
    (event: CreateFrontendAuditEvent) => {
      if (!enableConsoleLogging) return;

      const logLevel =
        event.severity === AuditSeverity.CRITICAL || event.severity === AuditSeverity.HIGH
          ? "error"
          : event.severity === AuditSeverity.MEDIUM
            ? "warn"
            : "info";

      console[logLevel](`[AUDIT] ${event.event_type}: ${event.message}`, {
        actor: event.actor?.id,
        resource: event.resource?.type,
        metadata: event.metadata,
      });
    },
    [enableConsoleLogging],
  );

  // Core event logging function
  const logEvent = useCallback(
    async (event: CreateFrontendAuditEvent) => {
      try {
        const incomingContext = event.context as AuditContext | undefined;
        const resolvedContext = incomingContext ?? createContext();
        const fullEvent: CreateFrontendAuditEvent = {
          ...event,
          actor: event.actor || createActor(),
          context: resolvedContext,
          tenant_id: event.tenant_id ?? tenantId ?? "unknown",
          severity: event.severity || AuditSeverity.LOW,
          outcome: event.outcome || AuditOutcome.SUCCESS,
          service_name: event.service_name || serviceName,
        };

        // Store locally and log to console
        storeLocally(fullEvent);
        consoleLog(fullEvent);

        // Add to batch queue
        batchQueueRef.current.push(fullEvent);

        // Auto-flush if batch is full
        if (batchQueueRef.current.length >= batchSize) {
          await flushBatch();
        }
      } catch (error) {
        console.error("Failed to log audit event:", error);
        isHealthyRef.current = false;
      }
    },
    [createActor, createContext, tenantId, storeLocally, consoleLog, batchSize],
  );

  // Flush the batch queue
  const flushBatch = useCallback(async () => {
    if (!auditClientRef.current || batchQueueRef.current.length === 0) return;

    const eventsToSend = [...batchQueueRef.current];
    batchQueueRef.current = [];

    try {
      const payload = eventsToSend as Omit<AuditEvent, "event_id" | "timestamp">[];
      await auditClientRef.current.logEventsBatch(payload);
      isHealthyRef.current = true;
    } catch (error) {
      console.error("Failed to send audit batch:", error);
      isHealthyRef.current = false;

      // Re-add events to queue for retry
      batchQueueRef.current = [...eventsToSend, ...batchQueueRef.current];
    }
  }, []);

  // Batch logging
  const logBatch = useCallback(
    async (events: CreateFrontendAuditEvent[]) => {
      for (const event of events) {
        await logEvent(event);
      }
    },
    [logEvent],
  );

  // Convenience method for auth events
  const logAuthEvent = useCallback(
    async (
      type: AuditEventType,
      outcome: AuditOutcome,
      message: string,
      metadata?: Record<string, any>,
    ) => {
      const eventPayload: CreateFrontendAuditEvent = {
        event_type: type,
        message,
        outcome,
        severity: outcome === AuditOutcome.FAILURE ? AuditSeverity.HIGH : AuditSeverity.LOW,
        actor: createActor(),
        context: createContext(),
      };

      if (metadata) {
        eventPayload.metadata = metadata;
      }

      await logEvent(eventPayload);
    },
    [logEvent, createActor, createContext],
  );

  // Convenience method for data access events
  const logDataAccess = useCallback(
    async (
      operation: string,
      resourceType: string,
      resourceId: string,
      outcome: AuditOutcome,
      metadata?: Record<string, any>,
    ) => {
      const eventType =
        operation === "create"
          ? AuditEventType.DATA_CREATE
          : operation === "read"
            ? AuditEventType.DATA_READ
            : operation === "update"
              ? AuditEventType.DATA_UPDATE
              : operation === "delete"
                ? AuditEventType.DATA_DELETE
                : AuditEventType.DATA_READ;

      const eventPayload: CreateFrontendAuditEvent = {
        event_type: eventType,
        message: `${operation} operation on ${resourceType} ${resourceId}`,
        outcome,
        severity:
          operation === "delete" && outcome === AuditOutcome.SUCCESS
            ? AuditSeverity.MEDIUM
            : AuditSeverity.LOW,
        actor: createActor(),
        resource: {
          id: resourceId,
          type: resourceType,
        },
        context: createContext(),
      };

      if (metadata) {
        eventPayload.metadata = metadata;
      }

      await logEvent(eventPayload);
    },
    [logEvent, createActor, createContext],
  );

  // Convenience method for UI events
  const logUIEvent = useCallback(
    async (type: FrontendAuditEventType, element: string, metadata?: Record<string, any>) => {
      const eventPayload: CreateFrontendAuditEvent = {
        event_type: type,
        message: `UI interaction: ${element}`,
        outcome: AuditOutcome.SUCCESS,
        severity: AuditSeverity.LOW,
        actor: createActor(),
        context: createContext({ ui_element: element }),
      };

      if (metadata) {
        eventPayload.metadata = metadata;
      }

      await logEvent(eventPayload);
    },
    [logEvent, createActor, createContext],
  );

  // Convenience method for error events
  const logError = useCallback(
    async (error: Error, context: string, metadata?: Record<string, any>) => {
      await logEvent({
        event_type: AuditEventType.SYSTEM_ERROR,
        message: `Error in ${context}: ${error.message}`,
        outcome: AuditOutcome.FAILURE,
        severity: AuditSeverity.HIGH,
        actor: createActor(),
        context: createContext({ error_context: context }),
        metadata: {
          ...metadata,
          error_name: error.name,
          error_message: error.message,
          error_stack: error.stack,
        },
      });
    },
    [logEvent, createActor, createContext],
  );

  // Convenience method for business events
  const logBusinessEvent = useCallback(
    async (
      type: AuditEventType,
      workflow: string,
      outcome: AuditOutcome,
      metadata?: Record<string, any>,
    ) => {
      const eventPayload: CreateFrontendAuditEvent = {
        event_type: type,
        message: `Business workflow: ${workflow}`,
        outcome,
        severity: outcome === AuditOutcome.FAILURE ? AuditSeverity.MEDIUM : AuditSeverity.LOW,
        actor: createActor(),
        context: createContext({ workflow }),
      };

      if (metadata) {
        eventPayload.metadata = metadata;
      }

      await logEvent(eventPayload);
    },
    [logEvent, createActor, createContext],
  );

  return {
    logEvent,
    logBatch,
    logAuthEvent,
    logDataAccess,
    logUIEvent,
    logError,
    logBusinessEvent,
    flushBatch,
    isHealthy: isHealthyRef.current,
    getQueueSize: () => batchQueueRef.current.length,
  };
}
