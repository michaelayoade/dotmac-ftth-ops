/**
 * React Hooks for Real-Time Events
 *
 * Provides hooks for SSE and WebSocket connections with automatic
 * connection management, reconnection, and cleanup.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "./useAuth";
import { apiClient } from "../lib/api/client";
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

// Get API base URL from environment
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

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
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<SSEClient | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Get token from auth context - using optional chaining to prevent crashes
    const token =
      apiClient?.defaults?.headers?.common?.["Authorization"]?.toString().replace("Bearer ", "") ||
      "";

    if (!token) {
      setError("No authentication token available");
      return;
    }

    // Create SSE client
    const client = new SSEClient({
      endpoint,
      token,
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
  }, [endpoint, eventType, enabled, user]);

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
  return useSSE(
    `${API_BASE_URL}/api/v1/realtime/onu-status`,
    "*", // Listen to all ONU events
    handler,
    enabled,
  );
}

/**
 * Hook for alerts
 */
export function useAlertEvents(handler: EventHandler<AlertEvent>, enabled = true) {
  return useSSE(`${API_BASE_URL}/api/v1/realtime/alerts`, "*", handler, enabled);
}

/**
 * Hook for ticket events
 */
export function useTicketEvents(handler: EventHandler<TicketEvent>, enabled = true) {
  return useSSE(`${API_BASE_URL}/api/v1/realtime/tickets`, "*", handler, enabled);
}

/**
 * Hook for subscriber events
 */
export function useSubscriberEvents(handler: EventHandler<SubscriberEvent>, enabled = true) {
  return useSSE(`${API_BASE_URL}/api/v1/realtime/subscribers`, "*", handler, enabled);
}

/**
 * Hook for RADIUS session events
 */
export function useRADIUSSessionEvents(handler: EventHandler<RADIUSSessionEvent>, enabled = true) {
  return useSSE(`${API_BASE_URL}/api/v1/realtime/radius-sessions`, "*", handler, enabled);
}

// ============================================================================
// WebSocket Hooks
// ============================================================================

/**
 * Base WebSocket hook
 */
export function useWebSocket(endpoint: string, enabled = true) {
  const { user } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [error, setError] = useState<string | null>(null);
  const clientRef = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token =
      apiClient?.defaults?.headers?.common?.["Authorization"]?.toString().replace("Bearer ", "") ||
      "";

    if (!token) {
      setError("No authentication token available");
      return;
    }

    const client = new WebSocketClient({
      endpoint,
      token,
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
  }, [endpoint, enabled, user]);

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
  const { subscribe, ...rest } = useWebSocket(
    `${API_BASE_URL}/api/v1/realtime/ws/sessions`,
    enabled,
  );

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
  const endpoint = jobId ? `${API_BASE_URL}/api/v1/realtime/ws/jobs/${jobId}` : "";
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
  const endpoint = campaignId ? `${API_BASE_URL}/api/v1/realtime/ws/campaigns/${campaignId}` : "";
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
 */
export function useRealtimeConnections() {
  const [onuEvents, setOnuEvents] = useState<ONUStatusEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [tickets, setTickets] = useState<TicketEvent[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberEvent[]>([]);
  const [sessions, setSessions] = useState<RADIUSSessionEvent[]>([]);

  // SSE connections
  const onuStatus = useONUStatusEvents((event) => {
    setOnuEvents((prev) => [...prev.slice(-99), event]); // Keep last 100
  });

  const alertStatus = useAlertEvents((event) => {
    setAlerts((prev) => [...prev.slice(-99), event]);
  });

  const ticketStatus = useTicketEvents((event) => {
    setTickets((prev) => [...prev.slice(-99), event]);
  });

  const subscriberStatus = useSubscriberEvents((event) => {
    setSubscribers((prev) => [...prev.slice(-99), event]);
  });

  const sessionStatus = useRADIUSSessionEvents((event) => {
    setSessions((prev) => [...prev.slice(-99), event]);
  });

  const clearEvents = useCallback(() => {
    setOnuEvents([]);
    setAlerts([]);
    setTickets([]);
    setSubscribers([]);
    setSessions([]);
  }, []);

  return {
    onuEvents,
    alerts,
    tickets,
    subscribers,
    sessions,
    clearEvents,
    statuses: {
      onu: onuStatus.status,
      alerts: alertStatus.status,
      tickets: ticketStatus.status,
      subscribers: subscriberStatus.status,
      sessions: sessionStatus.status,
    },
  };
}

/**
 * Hook for connection health monitoring
 */
export function useRealtimeHealth() {
  const { statuses } = useRealtimeConnections();

  const allConnected = Object.values(statuses).every((status) => status === "connected");
  const anyConnecting = Object.values(statuses).some(
    (status) => status === "connecting" || status === "reconnecting",
  );
  const anyError = Object.values(statuses).some((status) => status === "error");

  const overallStatus: ConnectionStatus = allConnected
    ? ConnectionStatus.CONNECTED
    : anyError
      ? ConnectionStatus.ERROR
      : anyConnecting
        ? ConnectionStatus.CONNECTING
        : ConnectionStatus.DISCONNECTED;

  return {
    overallStatus,
    allConnected,
    anyConnecting,
    anyError,
    statuses,
  };
}
