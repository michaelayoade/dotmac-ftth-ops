"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
}

interface WebSocketContextValue {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  subscribe: (channel: string, callback: (data: any) => void) => () => void;
  sendMessage: (type: string, data: any) => void;
  connectionStatus: "connecting" | "connected" | "disconnected" | "error";
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

/**
 * WebSocketProvider
 *
 * Provides real-time WebSocket connection for the application.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Channel-based subscriptions
 * - Connection status tracking
 * - Message broadcasting to subscribers
 * - Graceful disconnect handling
 *
 * Setup:
 * 1. Wrap your app with WebSocketProvider
 * 2. Use useWebSocket hook to subscribe to updates
 * 3. Configure WebSocket endpoint in environment variables
 */
export function WebSocketProvider({
  children,
  url,
  autoConnect = true,
  reconnectInterval = 3000,
  maxReconnectAttempts = 10,
}: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    "connecting" | "connected" | "disconnected" | "error"
  >("disconnected");

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map());

  // Get WebSocket URL from props or environment
  const wsUrl =
    url ||
    process.env["NEXT_PUBLIC_WEBSOCKET_URL"] ||
    `ws://${typeof window !== "undefined" ? window.location.host : "localhost:8000"}/ws`;

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      setConnectionStatus("connecting");
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (process.env["NODE_ENV"] !== "production") {
          console.log("WebSocket connected");
        }
        setIsConnected(true);
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;

        // Auth cookies are sent automatically. Add token handshake here if needed.
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          // Broadcast to channel subscribers
          const subscribers = subscribersRef.current.get(message.type);
          if (subscribers) {
            subscribers.forEach((callback) => {
              try {
                callback(message.data);
              } catch (error) {
                console.error("Error in WebSocket subscriber callback:", error);
              }
            });
          }

          // Also broadcast to 'all' channel subscribers
          const allSubscribers = subscribersRef.current.get("*");
          if (allSubscribers) {
            allSubscribers.forEach((callback) => {
              try {
                callback(message);
              } catch (error) {
                console.error('Error in WebSocket "all" subscriber callback:', error);
              }
            });
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        if (process.env["NODE_ENV"] !== "production") {
          console.log("WebSocket disconnected");
        }
        setIsConnected(false);
        setConnectionStatus("disconnected");
        wsRef.current = null;

        // Attempt to reconnect
        if (autoConnect && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(
            reconnectInterval * Math.pow(2, reconnectAttemptsRef.current),
            30000,
          );
          if (process.env["NODE_ENV"] !== "production") {
            console.log(`Reconnecting in ${delay}ms...`);
          }

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Error creating WebSocket connection:", error);
      setConnectionStatus("error");
    }
  }, [wsUrl, autoConnect, reconnectInterval, maxReconnectAttempts]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus("disconnected");
  }, []);

  const subscribe = useCallback((channel: string, callback: (data: any) => void) => {
    if (!subscribersRef.current.has(channel)) {
      subscribersRef.current.set(channel, new Set());
    }

    subscribersRef.current.get(channel)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subscribers = subscribersRef.current.get(channel);
      if (subscribers) {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          subscribersRef.current.delete(channel);
        }
      }
    };
  }, []);

  const sendMessage = useCallback((type: string, data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
        }),
      );
    } else {
      console.warn("WebSocket is not connected. Message not sent:", {
        type,
        data,
      });
    }
  }, []);

  // Connect on mount if autoConnect is true
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  const value: WebSocketContextValue = {
    isConnected,
    lastMessage,
    subscribe,
    sendMessage,
    connectionStatus,
  };

  return <WebSocketContext.Provider value={value}>{children}</WebSocketContext.Provider>;
}

/**
 * useWebSocket Hook
 *
 * Subscribe to WebSocket updates for specific channels
 *
 * @param channel - Channel to subscribe to (e.g., 'subscriber_update', 'bandwidth_update')
 * @param callback - Function called when message received on this channel
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isConnected } = useWebSocket("subscriber_update", (data) => {
 *     console.log("Subscriber updated:", data);
 *     // Update UI with new data
 *   });
 *
 *   return <div>Connected: {isConnected ? 'Yes' : 'No'}</div>;
 * }
 * ```
 */
export function useWebSocket(channel?: string, callback?: (data: any) => void) {
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error("useWebSocket must be used within WebSocketProvider");
  }

  useEffect(() => {
    if (channel && callback) {
      return context.subscribe(channel, callback);
    }
    return undefined;
  }, [channel, callback, context]);

  return context;
}

/**
 * useWebSocketSubscription Hook
 *
 * Subscribe to WebSocket updates with automatic state management
 *
 * @param channel - Channel to subscribe to
 * @returns [data, setData] - Current data and setter function
 *
 * @example
 * ```tsx
 * function NetworkStats() {
 *   const [stats] = useWebSocketSubscription<BandwidthStats>("bandwidth_update");
 *
 *   return (
 *     <div>
 *       Upload: {stats?.upload_mbps} Mbps
 *       Download: {stats?.download_mbps} Mbps
 *     </div>
 *   );
 * }
 * ```
 */
export function useWebSocketSubscription<T = any>(
  channel: string,
): [T | null, React.Dispatch<React.SetStateAction<T | null>>] {
  const [data, setData] = useState<T | null>(null);
  const context = useContext(WebSocketContext);

  if (!context) {
    throw new Error("useWebSocketSubscription must be used within WebSocketProvider");
  }

  useEffect(() => {
    return context.subscribe(channel, (newData: T) => {
      setData(newData);
    });
  }, [channel, context]);

  return [data, setData];
}
