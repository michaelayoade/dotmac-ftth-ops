/**
 * WebSocket hook for real-time technician location updates
 *
 * Replaces polling with instant push updates from the server.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { TechnicianLocation } from "./useTechnicians";
import { useGeofenceNotifications } from "./useBrowserNotifications";

interface WebSocketMessage {
  type: "connected" | "initial_state" | "location_update" | "geofence_event" | "pong";
  message?: string;
  connection_id?: string;
  tenant_id?: string;
  data?: TechnicianLocation | TechnicianLocation[] | any;
}

interface UseWebSocketTechnicianLocationsOptions {
  enabled?: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
  autoReconnect?: boolean;
  reconnectInterval?: number;
  enableNotifications?: boolean;
}

interface UseWebSocketTechnicianLocationsReturn {
  technicians: TechnicianLocation[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => void;
}

/**
 * Hook for real-time technician location updates via WebSocket
 *
 * @example
 * ```tsx
 * const { technicians, isConnected } = useWebSocketTechnicianLocations({
 *   enabled: true,
 *   autoReconnect: true,
 * });
 * ```
 */
export function useWebSocketTechnicianLocations(
  options: UseWebSocketTechnicianLocationsOptions = {},
): UseWebSocketTechnicianLocationsReturn {
  const {
    enabled = true,
    onConnect,
    onDisconnect,
    onError,
    autoReconnect = true,
    reconnectInterval = 5000,
    enableNotifications = true,
  } = options;

  // Browser notifications for geofence events
  const { handleGeofenceEvent } = useGeofenceNotifications(enableNotifications);

  const [technicians, setTechnicians] = useState<TechnicianLocation[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Get WebSocket URL (auth cookies are sent automatically; no token param needed)
   */
  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const backendUrl = process.env["NEXT_PUBLIC_API_URL"] || `${window.location.host}`;
    const cleanBackendUrl = backendUrl.replace(/^https?:\/\//, "");
    return `${protocol}//${cleanBackendUrl}/api/v1/field-service/ws/technician-locations`;
  }, []);

  /**
   * Connect to WebSocket
   */
  const connect = useCallback(() => {
    if (!enabled) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setIsConnecting(true);
    setError(null);

    try {
      const url = getWebSocketUrl();
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log("[WebSocket] Connected to technician locations");
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        onConnect?.();

        // Start ping interval to keep connection alive
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("ping");
          }
        }, 30000); // Ping every 30 seconds
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "connected":
              console.log("[WebSocket] Connection confirmed:", message.connection_id);
              break;

            case "initial_state":
              // Received initial state with all technician locations
              if (Array.isArray(message.data)) {
                setTechnicians(message.data);
                console.log(
                  "[WebSocket] Received initial state:",
                  message.data.length,
                  "technicians",
                );
              }
              break;

            case "location_update":
              // Received real-time location update for a single technician
              if (message.data && !Array.isArray(message.data)) {
                const updatedTech = message.data;

                setTechnicians((prev) => {
                  // Check if technician already exists
                  const existingIndex = prev.findIndex(
                    (t) => t.technician_id === updatedTech.technician_id,
                  );

                  if (existingIndex >= 0) {
                    // Update existing technician
                    const updated = [...prev];
                    updated[existingIndex] = updatedTech;
                    return updated;
                  } else {
                    // Add new technician
                    return [...prev, updatedTech];
                  }
                });

                console.log("[WebSocket] Location update:", updatedTech.technician_name);

                // Show geofence message if present
                if (updatedTech.geofence_message) {
                  console.log("[WebSocket] Geofence:", updatedTech.geofence_message);
                }
              }
              break;

            case "geofence_event":
              // Received geofence event (arrival/departure)
              if (message.data) {
                console.log("[WebSocket] Geofence event:", message.data);

                // Trigger browser notification
                if (enableNotifications) {
                  handleGeofenceEvent({
                    technician_name: message.data.technician_name,
                    job_id: message.data.job_id,
                    event_type: message.data.event_type,
                    message: message.data.message,
                  });
                }
              }
              break;

            case "pong":
              // Pong response to our ping
              break;

            default:
              console.warn("[WebSocket] Unknown message type:", message.type);
          }
        } catch (err) {
          console.error("[WebSocket] Failed to parse message:", err);
        }
      };

      ws.onerror = (event) => {
        console.error("[WebSocket] Error:", event);
        setError("WebSocket connection error");
        onError?.(event);
      };

      ws.onclose = (event) => {
        console.log("[WebSocket] Disconnected:", event.code, event.reason);
        setIsConnected(false);
        setIsConnecting(false);
        onDisconnect?.();

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Auto-reconnect if enabled and not a normal close
        if (autoReconnect && event.code !== 1000) {
          console.log(`[WebSocket] Reconnecting in ${reconnectInterval}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, reconnectInterval);
        }
      };

      wsRef.current = ws;
    } catch (err) {
      console.error("[WebSocket] Failed to connect:", err);
      setIsConnecting(false);
      setError(err instanceof Error ? err.message : "Failed to connect");
    }
  }, [
    autoReconnect,
    enableNotifications,
    enabled,
    getWebSocketUrl,
    handleGeofenceEvent,
    onConnect,
    onDisconnect,
    onError,
    reconnectInterval,
  ]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Clear ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      wsRef.current.close(1000, "Component unmounted");
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, []);

  /**
   * Manual reconnect
   */
  const reconnect = useCallback(() => {
    disconnect();
    setTimeout(() => {
      connect();
    }, 100);
  }, [connect, disconnect]);

  // Effect to manage connection lifecycle
  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [connect, disconnect, enabled]);

  return {
    technicians,
    isConnected,
    isConnecting,
    error,
    reconnect,
  };
}
