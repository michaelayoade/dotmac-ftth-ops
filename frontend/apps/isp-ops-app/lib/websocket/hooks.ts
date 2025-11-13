/**
 * React Hooks for WebSocket Communication
 *
 * Provides React hooks for subscribing to WebSocket events
 * and managing WebSocket connection state.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import {
  getWebSocketClient,
  WebSocketEventType,
  WebSocketMessage,
  WebSocketConnectionState,
} from "./client";

/**
 * Hook to manage WebSocket connection lifecycle
 */
export function useWebSocket(authToken?: string) {
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>({
    connected: false,
    reconnecting: false,
  });
  const wsClient = useRef(getWebSocketClient());

  useEffect(() => {
    const client = wsClient.current;

    // Subscribe to connection state changes
    const unsubscribe = client.onStateChange(setConnectionState);

    // Get auth token from storage if not provided
    const token =
      authToken ||
      (typeof window !== "undefined"
        ? localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token")
        : null);

    // Connect to WebSocket
    if (token) {
      client.connect();
    }

    // Cleanup on unmount
    return () => {
      unsubscribe();
      // Don't disconnect as other components might be using it
      // client.disconnect();
    };
  }, [authToken]);

  const connect = useCallback((token?: string) => {
    wsClient.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    wsClient.current.disconnect();
  }, []);

  return {
    connectionState,
    connect,
    disconnect,
    isConnected: connectionState.connected,
    isReconnecting: connectionState.reconnecting,
    error: connectionState.error,
  };
}

/**
 * Hook to subscribe to specific WebSocket event
 */
export function useWebSocketEvent<T = any>(
  event: WebSocketEventType | string,
  handler: (message: WebSocketMessage<T>) => void,
  deps: any[] = [],
) {
  const wsClient = useRef(getWebSocketClient());
  const handlerRef = useRef(handler);

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const client = wsClient.current;

    // Create stable handler that calls the current handler
    const stableHandler = (message: WebSocketMessage<T>) => {
      handlerRef.current(message);
    };

    // Subscribe to event
    const unsubscribe = client.on(event, stableHandler);

    // Cleanup on unmount or deps change
    return unsubscribe;
  }, [event, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook to subscribe to multiple WebSocket events
 */
export function useWebSocketEvents<T = any>(
  events: (WebSocketEventType | string)[],
  handler: (message: WebSocketMessage<T>) => void,
  deps: any[] = [],
) {
  const wsClient = useRef(getWebSocketClient());
  const handlerRef = useRef(handler);

  // Update handler ref when it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const client = wsClient.current;

    // Create stable handler that calls the current handler
    const stableHandler = (message: WebSocketMessage<T>) => {
      handlerRef.current(message);
    };

    // Subscribe to all events
    const unsubscribers = events.map((event) => client.on(event, stableHandler));

    // Cleanup on unmount or deps change
    return () => {
      unsubscribers.forEach((unsub) => unsub());
    };
  }, [events.join(","), ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Hook for network monitoring events
 */
export function useNetworkMonitoring() {
  const [deviceUpdates, setDeviceUpdates] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useWebSocketEvent(WebSocketEventType.DEVICE_STATUS_CHANGED, (message) => {
    setDeviceUpdates((prev) => [message.data, ...prev].slice(0, 50)); // Keep last 50
    setLastUpdate(new Date(message.timestamp));
  });

  useWebSocketEvent(WebSocketEventType.DEVICE_METRICS_UPDATE, (message) => {
    setDeviceUpdates((prev) => [message.data, ...prev].slice(0, 50));
    setLastUpdate(new Date(message.timestamp));
  });

  useWebSocketEvent(WebSocketEventType.NETWORK_ALERT, (message) => {
    setAlerts((prev) => [message.data, ...prev].slice(0, 100)); // Keep last 100 alerts
    setLastUpdate(new Date(message.timestamp));
  });

  const clearDeviceUpdates = useCallback(() => {
    setDeviceUpdates([]);
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
  }, []);

  return {
    deviceUpdates,
    alerts,
    lastUpdate,
    clearDeviceUpdates,
    clearAlerts,
    dismissAlert,
  };
}

/**
 * Hook for diagnostic events
 */
export function useDiagnosticEvents(subscriberId?: string) {
  const [runningDiagnostics, setRunningDiagnostics] = useState<Map<string, any>>(new Map());
  const [completedDiagnostics, setCompletedDiagnostics] = useState<any[]>([]);
  const [failedDiagnostics, setFailedDiagnostics] = useState<any[]>([]);

  useWebSocketEvent(WebSocketEventType.DIAGNOSTIC_STARTED, (message) => {
    if (!subscriberId || message.data.subscriber_id === subscriberId) {
      setRunningDiagnostics((prev) => {
        const next = new Map(prev);
        next.set(message.data.diagnostic_id, message.data);
        return next;
      });
    }
  });

  useWebSocketEvent(WebSocketEventType.DIAGNOSTIC_COMPLETED, (message) => {
    if (!subscriberId || message.data.subscriber_id === subscriberId) {
      setRunningDiagnostics((prev) => {
        const next = new Map(prev);
        next.delete(message.data.diagnostic_id);
        return next;
      });
      setCompletedDiagnostics((prev) => [message.data, ...prev].slice(0, 20));
    }
  });

  useWebSocketEvent(WebSocketEventType.DIAGNOSTIC_FAILED, (message) => {
    if (!subscriberId || message.data.subscriber_id === subscriberId) {
      setRunningDiagnostics((prev) => {
        const next = new Map(prev);
        next.delete(message.data.diagnostic_id);
        return next;
      });
      setFailedDiagnostics((prev) => [message.data, ...prev].slice(0, 20));
    }
  });

  return {
    runningDiagnostics: Array.from(runningDiagnostics.values()),
    completedDiagnostics,
    failedDiagnostics,
  };
}

/**
 * Hook for system health events
 */
export function useSystemHealth() {
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useWebSocketEvent(WebSocketEventType.SYSTEM_HEALTH_UPDATE, (message) => {
    setHealthStatus(message.data);
    setLastUpdate(new Date(message.timestamp));
  });

  return {
    healthStatus,
    lastUpdate,
  };
}
