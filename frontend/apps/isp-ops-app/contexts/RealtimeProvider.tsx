"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import {
  useONUStatusEvents,
  useAlertEvents,
  useTicketEvents,
  useSubscriberEvents,
  useRADIUSSessionEvents,
} from "../hooks/useRealtime";
import {
  ConnectionStatus,
  type ONUStatusEvent,
  type AlertEvent,
  type TicketEvent,
  type SubscriberEvent,
  type RADIUSSessionEvent,
} from "../types/realtime";

interface RealtimeContextValue {
  // Events
  onuEvents: ONUStatusEvent[];
  alerts: AlertEvent[];
  tickets: TicketEvent[];
  subscribers: SubscriberEvent[];
  sessions: RADIUSSessionEvent[];

  // Status for each connection
  statuses: {
    onu: ConnectionStatus;
    alerts: ConnectionStatus;
    tickets: ConnectionStatus;
    subscribers: ConnectionStatus;
    sessions: ConnectionStatus;
  };

  // Actions
  clearEvents: () => void;

  // Health metrics
  overallStatus: ConnectionStatus;
  allConnected: boolean;
  anyConnecting: boolean;
  anyError: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

interface RealtimeProviderProps {
  children: ReactNode;
}

/**
 * RealtimeProvider - Singleton provider for realtime SSE connections
 *
 * This provider manages all realtime SSE subscriptions in a single place,
 * preventing duplicate connections when multiple components need access
 * to connection status or events.
 *
 * Usage: Wrap your app layout with this provider and use useRealtime() hook
 * in components that need access to realtime data.
 */
export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const [onuEvents, setOnuEvents] = useState<ONUStatusEvent[]>([]);
  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [tickets, setTickets] = useState<TicketEvent[]>([]);
  const [subscribers, setSubscribers] = useState<SubscriberEvent[]>([]);
  const [sessions, setSessions] = useState<RADIUSSessionEvent[]>([]);

  // Create SSE connections (these will be created once per provider instance)
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

  const statuses = {
    onu: onuStatus.status,
    alerts: alertStatus.status,
    tickets: ticketStatus.status,
    subscribers: subscriberStatus.status,
    sessions: sessionStatus.status,
  };

  // Calculate health metrics
  const allConnected = Object.values(statuses).every(
    (status) => status === ConnectionStatus.CONNECTED,
  );
  const anyConnecting = Object.values(statuses).some(
    (status) => status === ConnectionStatus.CONNECTING || status === ConnectionStatus.RECONNECTING,
  );
  const anyError = Object.values(statuses).some((status) => status === ConnectionStatus.ERROR);

  const overallStatus: ConnectionStatus = allConnected
    ? ConnectionStatus.CONNECTED
    : anyError
      ? ConnectionStatus.ERROR
      : anyConnecting
        ? ConnectionStatus.CONNECTING
        : ConnectionStatus.DISCONNECTED;

  const value: RealtimeContextValue = {
    onuEvents,
    alerts,
    tickets,
    subscribers,
    sessions,
    statuses,
    clearEvents,
    overallStatus,
    allConnected,
    anyConnecting,
    anyError,
  };

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/**
 * Hook to access realtime connection state
 *
 * Returns a safe fallback state if used outside of RealtimeProvider.
 * Logs a warning in development mode to help catch misuse.
 *
 * @returns RealtimeContextValue with connection status, events, and health metrics
 */
export function useRealtime(): RealtimeContextValue {
  const context = useContext(RealtimeContext);

  if (!context) {
    // Log warning in development
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "useRealtime (or useRealtimeHealth/useRealtimeConnections) is being used outside of RealtimeProvider. " +
          "Returning disconnected state. Wrap your component tree with <RealtimeProvider> to enable realtime connections.",
      );
    }

    // Return safe fallback state
    return {
      onuEvents: [],
      alerts: [],
      tickets: [],
      subscribers: [],
      sessions: [],
      statuses: {
        onu: ConnectionStatus.DISCONNECTED,
        alerts: ConnectionStatus.DISCONNECTED,
        tickets: ConnectionStatus.DISCONNECTED,
        subscribers: ConnectionStatus.DISCONNECTED,
        sessions: ConnectionStatus.DISCONNECTED,
      },
      clearEvents: () => {},
      overallStatus: ConnectionStatus.DISCONNECTED,
      allConnected: false,
      anyConnecting: false,
      anyError: false,
    };
  }

  return context;
}

/**
 * Hook for accessing just the health metrics (backward compatibility)
 *
 * @returns Health metrics for all realtime connections
 */
export function useRealtimeHealth() {
  const { overallStatus, allConnected, anyConnecting, anyError, statuses } = useRealtime();

  return {
    overallStatus,
    allConnected,
    anyConnecting,
    anyError,
    statuses,
  };
}

/**
 * Hook for accessing all connection data (backward compatibility)
 *
 * @returns All events and connection statuses
 */
export function useRealtimeConnections() {
  const { onuEvents, alerts, tickets, subscribers, sessions, clearEvents, statuses } =
    useRealtime();

  return {
    onuEvents,
    alerts,
    tickets,
    subscribers,
    sessions,
    clearEvents,
    statuses,
  };
}
