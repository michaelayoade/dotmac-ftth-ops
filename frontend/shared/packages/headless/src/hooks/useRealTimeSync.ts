import { useCallback, useEffect, useRef, useState } from "react";
/**
 * Real-time data synchronization with WebSockets and optimistic updates
 */

import { io, type Socket } from "socket.io-client";

import { useAuthStore } from "@dotmac/headless/auth";
import { useTenantStore } from "@dotmac/headless/stores";

export interface RealTimeEvent {
  type: string;
  data: unknown;
  timestamp: number;
  tenantId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionOptions {
  events?: string[];
  tenantOnly?: boolean;
  userOnly?: boolean;
  filters?: Record<string, unknown>;
}

export interface RealTimeSyncOptions {
  url?: string;
  autoConnect?: boolean;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  debug?: boolean;
}

export interface RealTimeState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  lastEvent: RealTimeEvent | null;
  connectionAttempts: number;
}

// Event handlers type
type EventHandler = (event: RealTimeEvent) => void;

export function useRealTimeSync(
  options: RealTimeSyncOptions = {
    // Implementation pending
  },
) {
  const {
    url = process.env.NEXT_PUBLIC_WEBSOCKET_URL || "ws://localhost:3001",
    autoConnect = true,
    reconnect = true,
    reconnectAttempts = 5,
    reconnectDelay = 1000,
    debug = false,
  } = options;

  const { user, _token } = useAuthStore();
  const { currentTenant } = useTenantStore();

  const socketRef = useRef<Socket | null>(null);
  const eventHandlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const subscriptionsRef = useRef<Set<string>>(new Set());

  const [state, setState] = useState<RealTimeState>({
    connected: false,
    connecting: false,
    error: null,
    lastEvent: null,
    connectionAttempts: 0,
  });

  // Debug logging
  const log = useCallback(
    (message: string, ...args: unknown[]) => {
      if (debug) {
        console.log(`[RealTimeSync] ${message}`, ...args);
      }
    },
    [debug],
  );

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      log("Already connected");
      return;
    }

    if (!user || !token) {
      log("Cannot connect: No user or token");
      return;
    }

    setState((prev) => ({ ...prev, connecting: true, error: null }));
    log("Connecting to", url);

    try {
      const socket = io(url, {
        auth: {
          token,
          userId: user.id,
          tenantId: currentTenant?.tenant?.id,
        },
        transports: ["websocket", "polling"],
        autoConnect: false,
      });

      // Connection events
      socket.on("connect", () => {
        log("Connected to real-time server");
        setState((prev) => ({
          ...prev,
          connected: true,
          connecting: false,
          error: null,
          connectionAttempts: 0,
        }));

        // Re-subscribe to all active subscriptions
        subscriptionsRef.current.forEach((subscription) => {
          socket.emit("subscribe", subscription);
        });
      });

      socket.on("disconnect", (reason) => {
        log("Disconnected:", reason);
        setState((prev) => ({
          ...prev,
          connected: false,
          connecting: false,
          error: `Disconnected: ${reason}`,
        }));

        // Auto-reconnect if enabled
        if (reconnect && reason !== "io client disconnect") {
          const attempts = state.connectionAttempts + 1;
          if (attempts <= reconnectAttempts) {
            log(`Reconnecting in ${reconnectDelay}ms (attempt ${attempts}/${reconnectAttempts})`);
            setTimeout(() => {
              setState((prev) => ({ ...prev, connectionAttempts: attempts }));
              connect();
            }, reconnectDelay * attempts); // Exponential backoff
          }
        }
      });

      socket.on("connect_error", (error) => {
        log("Connection error:", error);
        setState((prev) => ({
          ...prev,
          connected: false,
          connecting: false,
          error: `Connection error: ${error.message}`,
        }));
      });

      // Real-time events
      socket.on("event", (event: RealTimeEvent) => {
        log("Received event:", event);

        setState((prev) => ({ ...prev, lastEvent: event }));

        // Dispatch to event handlers
        const handlers = eventHandlersRef.current.get(event.type);
        if (handlers) {
          handlers.forEach((handler) => {
            try {
              handler(event);
            } catch (_error) {
              // Error handling intentionally empty
            }
          });
        }

        // Dispatch to wildcard handlers
        const wildcardHandlers = eventHandlersRef.current.get("*");
        if (wildcardHandlers) {
          wildcardHandlers.forEach((handler) => {
            try {
              handler(event);
            } catch (_error) {
              // Error handling intentionally empty
            }
          });
        }
      });

      // Authentication events
      socket.on("auth_error", (error) => {
        log("Authentication error:", error);
        setState((prev) => ({
          ...prev,
          connected: false,
          connecting: false,
          error: `Authentication error: ${error}`,
        }));
      });

      // Subscription events
      socket.on("subscription_error", (error) => {
        log("Subscription error:", error);
        setState((prev) => ({
          ...prev,
          error: `Subscription error: ${error}`,
        }));
      });

      socketRef.current = socket;
      socket.connect();
    } catch (error) {
      log("Failed to create socket:", error);
      setState((prev) => ({
        ...prev,
        connecting: false,
        error: `Failed to create socket: ${error}`,
      }));
    }
  }, [
    url,
    user,
    currentTenant,
    reconnect,
    reconnectAttempts,
    reconnectDelay,
    log,
    state.connectionAttempts,
  ]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      log("Disconnecting");
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setState((prev) => ({
      ...prev,
      connected: false,
      connecting: false,
    }));
  }, [log]);

  // Subscribe to events
  const subscribe = useCallback(
    (
      eventType: string,
      handler: EventHandler,
      options: SubscriptionOptions = {
        // Implementation pending
      },
    ) => {
      log("Subscribing to event:", eventType);

      // Add handler
      if (!eventHandlersRef.current.has(eventType)) {
        eventHandlersRef.current.set(eventType, new Set());
      }
      eventHandlersRef.current.get(eventType)?.add(handler);

      // Create subscription key
      const subscriptionKey = JSON.stringify({
        eventType,
        tenantId: options.tenantOnly ? currentTenant?.tenant?.id : undefined,
        userId: options.userOnly ? user?.id : undefined,
        filters: options.filters,
      });

      subscriptionsRef.current.add(subscriptionKey);

      // Send subscription to server
      if (socketRef.current?.connected) {
        socketRef.current.emit("subscribe", subscriptionKey);
      }

      // Return unsubscribe function
      return () => {
        log("Unsubscribing from event:", eventType);

        const handlers = eventHandlersRef.current.get(eventType);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            eventHandlersRef.current.delete(eventType);
          }
        }

        subscriptionsRef.current.delete(subscriptionKey);

        if (socketRef.current?.connected) {
          socketRef.current.emit("unsubscribe", subscriptionKey);
        }
      };
    },
    [log, currentTenant, user],
  );

  // Emit event to server
  const emit = useCallback(
    (
      eventType: string,
      data: unknown,
      options: { broadcast?: boolean; tenantOnly?: boolean } = {
        // Implementation pending
      },
    ) => {
      if (!socketRef.current?.connected) {
        log("Cannot emit: Not connected");
        return false;
      }

      const event: RealTimeEvent = {
        type: eventType,
        data,
        timestamp: Date.now(),
        tenantId: options.tenantOnly ? currentTenant?.tenant?.id : undefined,
        userId: user?.id,
      };

      log("Emitting event:", event);
      socketRef.current.emit("event", event, options);
      return true;
    },
    [log, currentTenant, user],
  );

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && user && token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, user, connect, disconnect]);

  // Reconnect when tenant changes
  useEffect(() => {
    if (socketRef.current?.connected && currentTenant) {
      log("Tenant changed, updating connection");
      disconnect();
      setTimeout(connect, 100); // Brief delay to ensure clean disconnect
    }
  }, [currentTenant, connect, disconnect, log]);

  return {
    // State
    ...state,

    // Connection management
    connect,
    disconnect,
    reconnect: connect,

    // Event management
    subscribe,
    emit,

    // Utilities
    isConnected: state.connected,
    socket: socketRef.current,
  };
}

// Hook for subscribing to specific events
export function useRealTimeEvent(
  eventType: string,
  handler: EventHandler,
  options: SubscriptionOptions = {
    // Implementation pending
  },
  syncOptions: RealTimeSyncOptions = {
    // Implementation pending
  },
) {
  const { subscribe } = useRealTimeSync(syncOptions);

  useEffect(() => {
    return subscribe(eventType, handler, options);
  }, [eventType, handler, subscribe, options]);
}

// Hook for real-time data synchronization with optimistic updates
export function useRealTimeData<T>(
  initialData: T,
  eventType: string,
  options: SubscriptionOptions & {
    optimisticUpdates?: boolean;
    syncOptions?: RealTimeSyncOptions;
  } = {
    // Implementation pending
  },
) {
  const [data, setData] = useState<T>(initialData);
  const [isStale, setIsStale] = useState(false);
  const optimisticUpdatesRef = useRef<Map<string, any>>(new Map());

  const {
    optimisticUpdates = true,
    syncOptions = {
      // Implementation pending
    },
  } = options;

  // Handle real-time updates
  const handleEvent = useCallback((event: RealTimeEvent) => {
    setData(event.data);
    setIsStale(false);

    // Clear any pending optimistic updates for this data
    optimisticUpdatesRef.current.clear();
  }, []);

  useRealTimeEvent(eventType, handleEvent, options, syncOptions);

  // Optimistic update function
  const updateOptimistic = useCallback(
    (updateId: string, updater: (current: T) => T) => {
      if (!optimisticUpdates) {
        return;
      }

      setData((current) => {
        const updated = updater(current);
        optimisticUpdatesRef.current.set(updateId, updated);
        return updated;
      });
      setIsStale(true);
    },
    [optimisticUpdates],
  );

  // Rollback optimistic update
  const rollbackOptimistic = useCallback(
    (updateId: string) => {
      if (optimisticUpdatesRef.current.has(updateId)) {
        optimisticUpdatesRef.current.delete(updateId);
        // Revert to last known good state
        setData(initialData);
        setIsStale(false);
      }
    },
    [initialData],
  );

  return {
    data,
    isStale,
    updateOptimistic,
    rollbackOptimistic,
    setData,
  };
}

// ISP-specific real-time event types
export const ISP_EVENTS = {
  // Network events
  DEVICE_STATUS_CHANGED: "network:device:status",
  DEVICE_METRICS_UPDATED: "network:device:metrics",
  NETWORK_OUTAGE: "network:outage",
  NETWORK_MAINTENANCE: "network:maintenance",

  // Customer events
  CUSTOMER_CREATED: "customer:created",
  CUSTOMER_UPDATED: "customer:updated",
  CUSTOMER_SERVICE_CHANGED: "customer:service:changed",

  // Billing events
  INVOICE_GENERATED: "billing:invoice:generated",
  PAYMENT_RECEIVED: "billing:payment:received",
  PAYMENT_FAILED: "billing:payment:failed",

  // Support events
  TICKET_CREATED: "support:ticket:created",
  TICKET_UPDATED: "support:ticket:updated",
  CHAT_MESSAGE: "support:chat:message",

  // System events
  USER_LOGIN: "system:user:login",
  USER_LOGOUT: "system:user:logout",
  TENANT_UPDATED: "system:tenant:updated",

  // Alerts
  CRITICAL_ALERT: "alert:critical",
  WARNING_ALERT: "alert:warning",
  INFO_ALERT: "alert:info",
} as const;
