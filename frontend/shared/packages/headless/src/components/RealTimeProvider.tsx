/**
 * Real-Time Provider for ISP Framework
 * Manages WebSocket connections and real-time data distribution
 */

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import {
  useWebSocket,
  useNetworkMonitoring,
  useCustomerActivity,
  useFieldOperations,
} from "../hooks/useWebSocket";

interface RealTimeContextValue {
  // WebSocket connection
  isConnected: boolean;
  isConnecting: boolean;
  connectionQuality: "excellent" | "good" | "poor" | "offline";
  error: string | null;

  // Network monitoring
  deviceUpdates: any[];
  networkAlerts: any[];

  // Customer activity
  customerEvents: any[];

  // Field operations
  workOrderUpdates: any[];
  technicianLocations: any[];

  // Actions
  reconnect: () => void;
  sendMessage: (message: any) => void;
  subscribe: (eventType: string, callback: (data: any) => void) => () => void;
}

const RealTimeContext = createContext<RealTimeContextValue | null>(null);

export function useRealTime(): RealTimeContextValue {
  const context = useContext(RealTimeContext);
  if (!context) {
    throw new Error("useRealTime must be used within a RealTimeProvider");
  }
  return context;
}

interface RealTimeProviderProps {
  children: ReactNode;
  enabled?: boolean;
}

export function RealTimeProvider({ children, enabled = true }: RealTimeProviderProps) {
  const webSocket = useWebSocket();
  const networkMonitoring = useNetworkMonitoring();
  const customerActivity = useCustomerActivity();
  const fieldOperations = useFieldOperations();

  if (!enabled) {
    // Return a mock context when real-time is disabled
    const mockContext: RealTimeContextValue = {
      isConnected: false,
      isConnecting: false,
      connectionQuality: "offline",
      error: null,
      deviceUpdates: [],
      networkAlerts: [],
      customerEvents: [],
      workOrderUpdates: [],
      technicianLocations: [],
      reconnect: () => {},
      sendMessage: () => {},
      subscribe: () => () => {},
    };

    return <RealTimeContext.Provider value={mockContext}>{children}</RealTimeContext.Provider>;
  }

  const contextValue: RealTimeContextValue = {
    isConnected: webSocket.isConnected,
    isConnecting: webSocket.isConnecting,
    connectionQuality: webSocket.connectionQuality,
    error: webSocket.error,
    deviceUpdates: networkMonitoring.deviceUpdates,
    networkAlerts: networkMonitoring.networkAlerts,
    customerEvents: customerActivity.customerEvents,
    workOrderUpdates: fieldOperations.workOrderUpdates,
    technicianLocations: fieldOperations.technicianLocations,
    reconnect: webSocket.reconnect,
    sendMessage: webSocket.sendMessage,
    subscribe: webSocket.subscribe,
  };

  return <RealTimeContext.Provider value={contextValue}>{children}</RealTimeContext.Provider>;
}
