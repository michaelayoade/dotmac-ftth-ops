/**
 * React Hooks for Real-Time Events
 *
 * Provides hooks for SSE and WebSocket connections with automatic
 * connection management, reconnection, and cleanup.
 *
 * NOTE: This hook intentionally does NOT use TanStack Query because:
 * - It manages persistent connections (SSE/WebSocket) rather than REST API calls
 * - TanStack Query is designed for HTTP request/response patterns
 * - Connection lifecycle requires useEffect for cleanup
 * - Real-time subscriptions don't fit the query/mutation model
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "@shared/lib/auth";
import { logger } from "../lib/logger";
import { SSEClient } from "../lib/realtime/sse-client";
import { WebSocketClient, JobControl, CampaignControl } from "../lib/realtime/websocket-client";
import {
  ConnectionStatus,
  type AlertEvent,
  type BaseEvent,
  type EventHandler,
  type EventType,
  type JobProgressEvent,
  type ONUStatusEvent,
  type SubscriberEvent,
  type TicketEvent,
  type WebSocketClientMessage,
} from "../types/realtime";
import { useAppConfig } from "@/providers/AppConfigContext";

// ============================================================================
// SSE Hooks
// ============================================================================

/**
 * Base SSE hook for any endpoint
 */
export function useSSE<T extends BaseEvent>(
  endpoint: string,
  eventType: EventType | string,
  handler: EventHandler<T>,
  enabled = true,
) {
  const { user, isAuthenticated } = useSession();
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SSEClient | null>(null);

  useEffect(() => {
    if (!enabled) {
      logger.debug("SSE hook disabled", { endpoint, eventType });
      return;
    }

    // Don't connect if not authenticated
    if (!isAuthenticated) {
      return;
    }

    logger.info("Establishing SSE connection", { endpoint, eventType });

    // Create SSE client - cookies sent automatically via withCredentials
    const client = new SSEClient({
      endpoint,
      onOpen: () => {
        setStatus(ConnectionStatus.CONNECTED);
        logger.info("SSE connection established", { endpoint, eventType });
      },
      onError: () => {
        setStatus(ConnectionStatus.ERROR);
        setError("Connection error");
        logger.error("SSE connection error", undefined, { endpoint, eventType });
      },
      reconnect: true,
      reconnectInterval: 3000,
    });

    client.connect();
    clientRef.current = client;

    // Subscribe to event
    const unsubscribe = client.subscribe(eventType, handler);

    // Update status
    setStatus(client.getStatus());

    return () => {
      logger.debug("Cleaning up SSE connection", { endpoint, eventType });
      unsubscribe();
      client.close();
      clientRef.current = null;
    };
  }, [endpoint, eventType, enabled, user, isAuthenticated]);

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      logger.info("Manually reconnecting SSE", { endpoint, eventType });
      clientRef.current.reconnect();
    }
  }, [endpoint, eventType]);

  return { status, error, reconnect };
}

/**
 * Hook for ONU status updates
 */
export function useONUStatusEvents(handler: EventHandler<ONUStatusEvent>, enabled = true) {
  const { api } = useAppConfig();
  return useSSE(api.buildUrl("/realtime/onu-status"), "*", handler, enabled);
}

/**
 * Hook for alerts
 */
export function useAlertEvents(handler: EventHandler<AlertEvent>, enabled = true) {
  const { api } = useAppConfig();
  return useSSE(api.buildUrl("/realtime/alerts"), "*", handler, enabled);
}

/**
 * Hook for ticket events
 */
export function useTicketEvents(handler: EventHandler<TicketEvent>, enabled = true) {
  const { api } = useAppConfig();
  return useSSE(api.buildUrl("/realtime/tickets"), "*", handler, enabled);
}

/**
 * Hook for subscriber events
 */
export function useSubscriberEvents(handler: EventHandler<SubscriberEvent>, enabled = true) {
  const { api } = useAppConfig();
  return useSSE(api.buildUrl("/realtime/subscribers"), "*", handler, enabled);
}

// ============================================================================
// WebSocket Hooks
// ============================================================================

/**
 * Base WebSocket hook
 */
export function useWebSocket(endpoint: string, enabled = true) {
  const { user, isAuthenticated } = useSession();
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!enabled) {
      logger.debug("WebSocket hook disabled", { endpoint });
      return;
    }

    // Don't connect if not authenticated
    if (!isAuthenticated) {
      return;
    }

    logger.info("Establishing WebSocket connection", { endpoint });

    // Create WebSocket client - cookies sent with HTTP upgrade handshake
    const client = new WebSocketClient({
      endpoint,
      onOpen: () => {
        setStatus(ConnectionStatus.CONNECTED);
        logger.info("WebSocket connection established", { endpoint });
      },
      onError: () => {
        setStatus(ConnectionStatus.ERROR);
        setError("Connection error");
        logger.error("WebSocket connection error", undefined, { endpoint });
      },
      onClose: () => {
        setStatus(ConnectionStatus.DISCONNECTED);
        logger.info("WebSocket connection closed", { endpoint });
      },
      reconnect: true,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    });

    client.connect();
    clientRef.current = client;

    setStatus(client.getStatus());

    return () => {
      logger.debug("Cleaning up WebSocket connection", { endpoint });
      client.close();
      clientRef.current = null;
    };
  }, [endpoint, enabled, user, isAuthenticated]);

  const subscribe = useCallback(
    <T extends BaseEvent>(eventType: EventType | string, handler: EventHandler<T>) => {
      if (!clientRef.current) {
        logger.warn("Cannot subscribe: WebSocket client not initialized", { eventType, endpoint });
        return () => {};
      }
      logger.debug("Subscribing to WebSocket event", { eventType, endpoint });
      return clientRef.current.subscribe(eventType, handler);
    },
    [endpoint],
  );

  const send = useCallback(
    (message: unknown) => {
      if (clientRef.current) {
        logger.debug("Sending WebSocket message", { endpoint });
        clientRef.current.send(message as WebSocketClientMessage);
      } else {
        logger.warn("Cannot send: WebSocket client not initialized", { endpoint });
      }
    },
    [endpoint],
  );

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      logger.info("Manually reconnecting WebSocket", { endpoint });
      clientRef.current.reconnect();
    }
  }, [endpoint]);

  return {
    status,
    error,
    isConnected: status === "connected",
    subscribe,
    send,
    reconnect,
    client: clientRef.current,
  };
}

/**
 * Hook for job progress WebSocket with control commands
 */
export function useJobWebSocket(jobId: string | null, enabled = true) {
  const { api } = useAppConfig();
  const endpoint = jobId ? api.buildUrl(`/realtime/ws/jobs/${jobId}`) : "";
  const { client, subscribe, ...rest } = useWebSocket(endpoint, enabled && !!jobId);
  const [jobProgress, setJobProgress] = useState<JobProgressEvent | null>(null);
  const controlRef = useRef<JobControl | null>(null);

  useEffect(() => {
    if (client) {
      controlRef.current = new JobControl(client);
    } else {
      controlRef.current = null;
    }
  }, [client]);

  useEffect(() => {
    if (rest.isConnected) {
      const unsubscribe = subscribe<JobProgressEvent>("*", (event) => {
        setJobProgress(event);
      });
      return unsubscribe;
    }
    return undefined;
  }, [rest.isConnected, subscribe]);

  const cancelJob = useCallback(() => {
    if (controlRef.current) {
      logger.info("Cancelling job", { jobId });
      controlRef.current.cancel();
    }
  }, [jobId]);

  const pauseJob = useCallback(() => {
    if (controlRef.current) {
      logger.info("Pausing job", { jobId });
      controlRef.current.pause();
    }
  }, [jobId]);

  const resumeJob = useCallback(() => {
    if (controlRef.current) {
      logger.info("Resuming job", { jobId });
      controlRef.current.resume();
    }
  }, [jobId]);

  return {
    ...rest,
    jobProgress,
    cancelJob,
    pauseJob,
    resumeJob,
  };
}

/**
 * Hook for campaign progress WebSocket with control commands
 */
export function useCampaignWebSocket(campaignId: string | null, enabled = true) {
  const { api } = useAppConfig();
  const endpoint = campaignId ? api.buildUrl(`/realtime/ws/campaigns/${campaignId}`) : "";
  const { client, subscribe, ...rest } = useWebSocket(endpoint, enabled && !!campaignId);
  const [campaignProgress, setCampaignProgress] = useState<unknown>(null);
  const controlRef = useRef<CampaignControl | null>(null);

  useEffect(() => {
    if (client) {
      controlRef.current = new CampaignControl(client);
    } else {
      controlRef.current = null;
    }
  }, [client]);

  useEffect(() => {
    if (rest.isConnected) {
      const unsubscribe = subscribe("*", (event: unknown) => {
        setCampaignProgress(event);
      });
      return unsubscribe;
    }
    return undefined;
  }, [rest.isConnected, subscribe]);

  const cancelCampaign = useCallback(() => {
    if (controlRef.current) {
      logger.info("Cancelling campaign", { campaignId });
      controlRef.current.cancel();
    }
  }, [campaignId]);

  const pauseCampaign = useCallback(() => {
    if (controlRef.current) {
      logger.info("Pausing campaign", { campaignId });
      controlRef.current.pause();
    }
  }, [campaignId]);

  const resumeCampaign = useCallback(() => {
    if (controlRef.current) {
      logger.info("Resuming campaign", { campaignId });
      controlRef.current.resume();
    }
  }, [campaignId]);

  return {
    ...rest,
    campaignProgress,
    cancelCampaign,
    pauseCampaign,
    resumeCampaign,
  };
}

// ============================================================================
// Composite Hooks
// ============================================================================

/**
 * Hook for all realtime connections
 *
 * IMPORTANT: These hooks now re-export from RealtimeProvider context to prevent
 * duplicate SSE connections. The RealtimeProvider manages all SSE subscriptions
 * in a single place and these hooks consume from that shared context.
 *
 * If you use these hooks, ensure your component tree is wrapped with RealtimeProvider
 * (already done in the dashboard layout).
 */
export { useRealtimeConnections, useRealtimeHealth } from "../contexts/RealtimeProvider";
