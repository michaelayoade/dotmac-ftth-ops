"use client";

/**
 * Real-Time Alerts Notification System
 *
 * Subscribes to alert events and displays toast notifications
 * for critical system and network alerts.
 */

import { useEffect } from "react";
import { useToast } from "@dotmac/ui";
import { AlertCircle, AlertTriangle, Info, XCircle } from "lucide-react";
import { useAlertEvents } from "../../hooks/useRealtime";
import type { AlertEvent } from "../../types/realtime";

export interface RealtimeAlertsProps {
  /**
   * Enable alert notifications
   */
  enabled?: boolean;
  /**
   * Minimum severity level to show notifications
   */
  minSeverity?: "info" | "warning" | "error" | "critical";
  /**
   * Custom alert handler
   */
  onAlert?: (alert: AlertEvent) => void;
}

const SEVERITY_LEVELS = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

export function RealtimeAlerts({
  enabled = true,
  minSeverity = "warning",
  onAlert,
}: RealtimeAlertsProps) {
  const minLevel = SEVERITY_LEVELS[minSeverity];
  const { toast } = useToast();

  useAlertEvents((event) => {
    // Check if alert meets minimum severity
    const eventLevel = SEVERITY_LEVELS[event.severity];
    if (eventLevel < minLevel) {
      return;
    }

    // Call custom handler if provided
    if (onAlert) {
      onAlert(event);
    }

    // Show toast notification based on event type and severity
    if (event.event_type === "alert.raised") {
      showAlertToast(event, toast);
    } else if (event.event_type === "alert.cleared") {
      showClearedToast(event, toast);
    }
  }, enabled);

  return null; // This is a background component
}

/**
 * Show toast notification for raised alert
 */
function showAlertToast(event: AlertEvent, toast: ReturnType<typeof useToast>["toast"]) {
  const { severity, message, source } = event;

  const description = `Source: ${source}`;

  switch (severity) {
    case "critical":
    case "error":
      toast({
        title: message,
        description,
        variant: "destructive",
      });
      break;

    case "warning":
    case "info":
      toast({
        title: message,
        description,
        variant: "default",
      });
      break;
  }
}

/**
 * Show toast notification for cleared alert
 */
function showClearedToast(event: AlertEvent, toast: ReturnType<typeof useToast>["toast"]) {
  toast({
    title: "Alert Cleared",
    description: `${event.message} (Source: ${event.source})`,
    variant: "default",
  });
}

/**
 * Alert counter component for displaying active alerts count
 */
export function useAlertCount() {
  const [activeAlerts, setActiveAlerts] = React.useState<Map<string, AlertEvent>>(new Map());

  useAlertEvents((event) => {
    if (event.event_type === "alert.raised") {
      setActiveAlerts((prev) => {
        const next = new Map(prev);
        next.set(event.alert_id, event);
        return next;
      });
    } else if (event.event_type === "alert.cleared") {
      setActiveAlerts((prev) => {
        const next = new Map(prev);
        next.delete(event.alert_id);
        return next;
      });
    }
  });

  return {
    count: activeAlerts.size,
    alerts: Array.from(activeAlerts.values()),
    criticalCount: Array.from(activeAlerts.values()).filter((a) => a.severity === "critical")
      .length,
    errorCount: Array.from(activeAlerts.values()).filter((a) => a.severity === "error").length,
  };
}

// Need to import React for useState
import React from "react";
