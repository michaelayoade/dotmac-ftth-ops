/**
 * React Hooks for Real-Time Events
 *
 * Provides hooks for SSE and WebSocket connections with automatic
 * connection management, reconnection, and cleanup.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "@dotmac/better-auth";
import type { ExtendedUser } from "@dotmac/better-auth";
import { SSEClient, SSEEndpoints } from "../lib/realtime/sse-client";
import {
  WebSocketClient,
  WebSocketEndpoints,
  JobControl,
  CampaignControl,
} from "../lib/realtime/websocket-client";
import {
  ConnectionStatus,
  type AlertEvent,
  type BaseEvent,
  type EventHandler,
  type EventType,
  type JobProgressEvent,
  type ONUStatusEvent,
  type RADIUSSessionEvent,
  type SubscriberEvent,
  type TicketEvent,
} from "../types/realtime";
import { useApiConfig } from "@/hooks/useApiConfig";

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
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;
  const authToken = session?.session?.token;
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SSEClient | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (!authToken) {
      setError("Missing auth token");
      return;
    }

    // Create SSE client
    const client = new SSEClient({
      endpoint,
      token: authToken,
      onOpen: () => setStatus(ConnectionStatus.CONNECTED),
      onError: () => {
        setStatus(ConnectionStatus.ERROR);
        setError("Connection error");
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
      unsubscribe();
      client.close();
      clientRef.current = null;
    };
  }, [endpoint, eventType, handler, enabled, user, authToken]);

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.reconnect();
    }
  }, []);

  return { status, error, reconnect };
}

/**
 * Hook for ONU status updates
 */
export function useONUStatusEvents(handler: EventHandler<ONUStatusEvent>, enabled = true) {
  const { buildApiUrl } = useApiConfig();
  return useSSE(buildApiUrl("/realtime/onu-status"), "*", handler, enabled);
}

/**
 * Hook for alerts
 */
export function useAlertEvents(handler: EventHandler<AlertEvent>, enabled = true) {
  const { buildApiUrl } = useApiConfig();
  return useSSE(buildApiUrl("/realtime/alerts"), "*", handler, enabled);
}

/**
 * Hook for ticket events
 */
export function useTicketEvents(handler: EventHandler<TicketEvent>, enabled = true) {
  const { buildApiUrl } = useApiConfig();
  return useSSE(buildApiUrl("/realtime/tickets"), "*", handler, enabled);
}

/**
 * Hook for subscriber events
 */
export function useSubscriberEvents(handler: EventHandler<SubscriberEvent>, enabled = true) {
  const { buildApiUrl } = useApiConfig();
  return useSSE(buildApiUrl("/realtime/subscribers"), "*", handler, enabled);
}

/**
 * Hook for RADIUS session events
 */
export function useRADIUSSessionEvents(handler: EventHandler<RADIUSSessionEvent>, enabled = true) {
  const { buildApiUrl } = useApiConfig();
  return useSSE(buildApiUrl("/realtime/radius-sessions"), "*", handler, enabled);
}

// ============================================================================
// WebSocket Hooks
// ============================================================================

/**
 * Base WebSocket hook
 */
export function useWebSocket(endpoint: string, enabled = true) {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (!session?.session?.token) {
      setError("Missing auth token");
      return;
    }

    const client = new WebSocketClient({
      endpoint,
      token: session.session.token,
      onOpen: () => setStatus(ConnectionStatus.CONNECTED),
      onError: () => {
        setStatus(ConnectionStatus.ERROR);
        setError("Connection error");
      },
      onClose: () => setStatus(ConnectionStatus.DISCONNECTED),
      reconnect: true,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
    });

    client.connect();
    clientRef.current = client;

    setStatus(client.getStatus());

    return () => {
      client.close();
      clientRef.current = null;
    };
  }, [endpoint, enabled, user, session?.session?.token]);

  const subscribe = useCallback(
    <T extends BaseEvent>(eventType: EventType | string, handler: EventHandler<T>) => {
      if (!clientRef.current) {
        return () => {};
      }
      return clientRef.current.subscribe(eventType, handler);
    },
    [],
  );

  const send = useCallback((message: any) => {
    if (clientRef.current) {
      clientRef.current.send(message);
    }
  }, []);

  const reconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.reconnect();
    }
  }, []);

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
 * Hook for RADIUS sessions WebSocket
 */
export function useSessionsWebSocket(handler: EventHandler<RADIUSSessionEvent>, enabled = true) {
  const { buildApiUrl } = useApiConfig();
  const { subscribe, ...rest } = useWebSocket(buildApiUrl("/realtime/ws/sessions"), enabled);

  useEffect(() => {
    if (rest.isConnected) {
      const unsubscribe = subscribe("*", handler);
      return unsubscribe;
    }
    return undefined;
  }, [rest.isConnected, subscribe, handler]);

  return rest;
}

/**
 * Hook for job progress WebSocket with control commands
 */
export function useJobWebSocket(jobId: string | null, enabled = true) {
  const { buildApiUrl } = useApiConfig();
  const endpoint = jobId ? buildApiUrl(`/realtime/ws/jobs/${jobId}`) : "";
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
    controlRef.current?.cancel();
  }, []);

  const pauseJob = useCallback(() => {
    controlRef.current?.pause();
  }, []);

  const resumeJob = useCallback(() => {
    controlRef.current?.resume();
  }, []);

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
  const { buildApiUrl } = useApiConfig();
  const endpoint = campaignId ? buildApiUrl(`/realtime/ws/campaigns/${campaignId}`) : "";
  const { client, subscribe, ...rest } = useWebSocket(endpoint, enabled && !!campaignId);
  const [campaignProgress, setCampaignProgress] = useState<any>(null);
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
      const unsubscribe = subscribe("*", (event: any) => {
        setCampaignProgress(event);
      });
      return unsubscribe;
    }
    return undefined;
  }, [rest.isConnected, subscribe]);

  const cancelCampaign = useCallback(() => {
    controlRef.current?.cancel();
  }, []);

  const pauseCampaign = useCallback(() => {
    controlRef.current?.pause();
  }, []);

  const resumeCampaign = useCallback(() => {
    controlRef.current?.resume();
  }, []);

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
