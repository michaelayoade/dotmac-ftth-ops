/**
 * WebSocket Hook for Real-Time ISP Framework Updates
 * Provides real-time connectivity for network monitoring, customer updates, and system events
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { getOperatorAccessToken } from "../utils/operatorAuth";
import { useISPTenant } from "./useISPTenant";
import { usePortalIdAuth } from "./usePortalIdAuth";

export interface WebSocketMessage {
  type: string;
  event: string;
  data: any;
  timestamp: string;
  tenant_id?: string;
  user_id?: string;
}

export interface WebSocketConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  protocols?: string[];
}

interface UseWebSocketReturn {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  connectionQuality: "excellent" | "good" | "poor" | "offline";
  sendMessage: (message: Partial<WebSocketMessage>) => void;
  subscribe: (eventType: string, callback: (data: any) => void) => () => void;
  unsubscribe: (eventType: string) => void;
  reconnect: () => void;
  disconnect: () => void;
}

export function useWebSocket(config: WebSocketConfig = {}): UseWebSocketReturn {
  const { session } = useISPTenant();
  const { isAuthenticated } = usePortalIdAuth();

  const {
    url = process.env["NEXT_PUBLIC_WS_URL"] || "ws://localhost:8000/ws",
    reconnectInterval = 3000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000,
    protocols = ["isp-protocol-v1"],
  } = config;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<
    "excellent" | "good" | "poor" | "offline"
  >("offline");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout>();
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const pingStartTimeRef = useRef<number>(0);

  // Build WebSocket URL with authentication
  const buildWebSocketUrl = useCallback(() => {
    const accessToken = getOperatorAccessToken();
    const tenantId = session?.tenant.id;

    const wsUrl = new URL(url);
    if (accessToken) {
      wsUrl.searchParams.set("token", accessToken);
    }
    if (tenantId) {
      wsUrl.searchParams.set("tenant_id", tenantId);
    }

    return wsUrl.toString();
  }, [url, session?.tenant.id]);

  // Send heartbeat to maintain connection and measure latency
  const sendHeartbeat = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      pingStartTimeRef.current = Date.now();
      wsRef.current.send(
        JSON.stringify({
          type: "heartbeat",
          event: "ping",
          timestamp: new Date().toISOString(),
          tenant_id: session?.tenant.id,
        }),
      );
    }
  }, [session?.tenant.id]);

  // Start heartbeat interval
  const startHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
    }

    heartbeatTimeoutRef.current = setInterval(sendHeartbeat, heartbeatInterval);
    sendHeartbeat(); // Send initial heartbeat
  }, [sendHeartbeat, heartbeatInterval]);

  // Stop heartbeat interval
  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimeoutRef.current) {
      clearInterval(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = undefined;
    }
  }, []);

  // Handle incoming WebSocket messages
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      setLastMessage(message);
      setError(null);

      // Handle heartbeat response and calculate connection quality
      if (message.type === "heartbeat" && message.event === "pong") {
        const latency = Date.now() - pingStartTimeRef.current;
        if (latency < 100) {
          setConnectionQuality("excellent");
        } else if (latency < 300) {
          setConnectionQuality("good");
        } else {
          setConnectionQuality("poor");
        }
        return;
      }

      // Notify subscribers
      const eventSubscribers = subscribersRef.current.get(message.event);
      if (eventSubscribers) {
        eventSubscribers.forEach((callback) => callback(message.data));
      }

      // Notify wildcard subscribers
      const wildcardSubscribers = subscribersRef.current.get("*");
      if (wildcardSubscribers) {
        wildcardSubscribers.forEach((callback) => callback(message));
      }
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
      setError("Invalid message format received");
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!isAuthenticated || !session) {
      return;
    }

    if (
      wsRef.current?.readyState === WebSocket.CONNECTING ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const wsUrl = buildWebSocketUrl();
      wsRef.current = new WebSocket(wsUrl, protocols);

      wsRef.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionQuality("good");
        reconnectAttemptsRef.current = 0;
        setError(null);

        // Send authentication message
        wsRef.current?.send(
          JSON.stringify({
            type: "auth",
            event: "authenticate",
            data: {
              tenant_id: session.tenant.id,
              user_id: session.user.id,
              portal_type: session.portal_type,
              permissions: session.permissions,
            },
            timestamp: new Date().toISOString(),
          }),
        );

        startHeartbeat();
      };

      wsRef.current.onmessage = handleMessage;

      wsRef.current.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        setConnectionQuality("offline");
        stopHeartbeat();

        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          // Attempt to reconnect unless it was a clean close
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttemptsRef.current),
            30000,
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection error occurred");
        setIsConnecting(false);
        setConnectionQuality("offline");
      };
    } catch (err) {
      setIsConnecting(false);
      setError(`Connection failed: ${err}`);
    }
  }, [
    isAuthenticated,
    session,
    buildWebSocketUrl,
    protocols,
    handleMessage,
    startHeartbeat,
    stopHeartbeat,
    reconnectInterval,
    maxReconnectAttempts,
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    stopHeartbeat();

    if (wsRef.current) {
      wsRef.current.close(1000, "Client disconnect");
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setConnectionQuality("offline");
    setError(null);
  }, [stopHeartbeat]);

  // Reconnect to WebSocket
  const reconnect = useCallback(() => {
    disconnect();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // Send message through WebSocket
  const sendMessage = useCallback(
    (message: Partial<WebSocketMessage>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const fullMessage: WebSocketMessage = {
          type: message.type || "message",
          event: message.event || "generic",
          data: message.data || {},
          timestamp: new Date().toISOString(),
          tenant_id: session?.tenant.id,
          user_id: session?.user.id,
          ...message,
        };

        wsRef.current.send(JSON.stringify(fullMessage));
      } else {
        setError("WebSocket is not connected");
      }
    },
    [session?.tenant.id, session?.user.id],
  );

  // Subscribe to specific events
  const subscribe = useCallback((eventType: string, callback: (data: any) => void) => {
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set());
    }
    subscribersRef.current.get(eventType)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = subscribersRef.current.get(eventType);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          subscribersRef.current.delete(eventType);
        }
      }
    };
  }, []);

  // Unsubscribe from events
  const unsubscribe = useCallback((eventType: string) => {
    subscribersRef.current.delete(eventType);
  }, []);

  // Connect when authenticated and tenant is available
  useEffect(() => {
    if (isAuthenticated && session) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, session, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isConnecting,
    error,
    lastMessage,
    connectionQuality,
    sendMessage,
    subscribe,
    unsubscribe,
    reconnect,
    disconnect,
  };
}

// Specialized hooks for specific ISP Framework events
export function useNetworkMonitoring() {
  const webSocket = useWebSocket();
  const [deviceUpdates, setDeviceUpdates] = useState<any[]>([]);
  const [networkAlerts, setNetworkAlerts] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeDevices = webSocket.subscribe("device_status_update", (data) => {
      setDeviceUpdates((prev) => [data, ...prev.slice(0, 49)]); // Keep last 50 updates
    });

    const unsubscribeAlerts = webSocket.subscribe("network_alert", (data) => {
      setNetworkAlerts((prev) => [data, ...prev.slice(0, 19)]); // Keep last 20 alerts
    });

    return () => {
      unsubscribeDevices();
      unsubscribeAlerts();
    };
  }, [webSocket]);

  return {
    ...webSocket,
    deviceUpdates,
    networkAlerts,
    clearDeviceUpdates: () => setDeviceUpdates([]),
    clearNetworkAlerts: () => setNetworkAlerts([]),
  };
}

export function useCustomerActivity() {
  const webSocket = useWebSocket();
  const [customerEvents, setCustomerEvents] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeCustomers = webSocket.subscribe("customer_update", (data) => {
      setCustomerEvents((prev) => [data, ...prev.slice(0, 29)]); // Keep last 30 events
    });

    const unsubscribeServices = webSocket.subscribe("service_update", (data) => {
      setCustomerEvents((prev) => [data, ...prev.slice(0, 29)]);
    });

    return () => {
      unsubscribeCustomers();
      unsubscribeServices();
    };
  }, [webSocket]);

  return {
    ...webSocket,
    customerEvents,
    clearCustomerEvents: () => setCustomerEvents([]),
  };
}

export function useFieldOperations() {
  const webSocket = useWebSocket();
  const [workOrderUpdates, setWorkOrderUpdates] = useState<any[]>([]);
  const [technicianLocations, setTechnicianLocations] = useState<Map<string, any>>(new Map());

  useEffect(() => {
    const unsubscribeWorkOrders = webSocket.subscribe("work_order_update", (data) => {
      setWorkOrderUpdates((prev) => [data, ...prev.slice(0, 19)]);
    });

    const unsubscribeTechLocations = webSocket.subscribe("technician_location_update", (data) => {
      setTechnicianLocations((prev) => new Map(prev.set(data.technician_id, data)));
    });

    return () => {
      unsubscribeWorkOrders();
      unsubscribeTechLocations();
    };
  }, [webSocket]);

  return {
    ...webSocket,
    workOrderUpdates,
    technicianLocations: Array.from(technicianLocations.values()),
    clearWorkOrderUpdates: () => setWorkOrderUpdates([]),
    clearTechnicianLocations: () => setTechnicianLocations(new Map()),
  };
}
