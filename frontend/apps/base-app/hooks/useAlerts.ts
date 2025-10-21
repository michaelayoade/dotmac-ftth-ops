import { useState, useEffect, useCallback } from "react";
import {
  alertService,
  Alert,
  AlertStats,
  AlertSeverity,
  AlertCategory,
} from "@/lib/services/alert-service";

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    total: 0,
    critical: 0,
    warning: 0,
    info: 0,
    byCategory: {
      security: 0,
      billing: 0,
      performance: 0,
      system: 0,
      compliance: 0,
    },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscribe to alert updates
    const unsubscribe = alertService.subscribe((newAlerts) => {
      setAlerts(newAlerts);
      setStats(alertService.getAlertStats());
      setLoading(false);
    });

    // Cleanup
    return () => {
      unsubscribe();
    };
  }, []);

  const dismissAlert = useCallback((alertId: string) => {
    alertService.dismissAlert(alertId);
  }, []);

  const refreshAlerts = useCallback(async () => {
    setLoading(true);
    await alertService.refresh();
    setLoading(false);
  }, []);

  const getAlertsBySeverity = useCallback((severity: AlertSeverity) => {
    return alertService.getAlertsBySeverity(severity);
  }, []);

  const getAlertsByCategory = useCallback((category: AlertCategory) => {
    return alertService.getAlertsByCategory(category);
  }, []);

  return {
    alerts,
    stats,
    loading,
    dismissAlert,
    refreshAlerts,
    getAlertsBySeverity,
    getAlertsByCategory,
  };
}

export function useCriticalAlerts() {
  const { alerts } = useAlerts();
  return alerts.filter((alert) => alert.severity === "critical");
}

export function useSecurityAlerts() {
  const { alerts } = useAlerts();
  return alerts.filter((alert) => alert.category === "security");
}

export function useBillingAlerts() {
  const { alerts } = useAlerts();
  return alerts.filter((alert) => alert.category === "billing");
}
