/**
 * Fault Management Hooks
 *
 * Custom hooks for interacting with the fault management API
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";

// ============================================================================
// Types
// ============================================================================

export type AlarmSeverity = "critical" | "major" | "minor" | "warning" | "info";
export type AlarmStatus = "active" | "acknowledged" | "cleared" | "resolved";
export type AlarmSource = "genieacs" | "voltha" | "netbox" | "manual" | "api";

export interface Alarm {
  id: string;
  tenant_id: string;
  alarm_id: string;
  severity: AlarmSeverity;
  status: AlarmStatus;
  source: AlarmSource;
  alarm_type: string;
  title: string;
  description?: string;
  message?: string;

  resource_type?: string;
  resource_id?: string;
  resource_name?: string;

  customer_id?: string;
  customer_name?: string;
  subscriber_count: number;

  correlation_id?: string;
  correlation_action: string;
  parent_alarm_id?: string;
  is_root_cause: boolean;

  first_occurrence: string;
  last_occurrence: string;
  occurrence_count: number;
  acknowledged_at?: string;
  cleared_at?: string;
  resolved_at?: string;

  assigned_to?: string;
  ticket_id?: string;

  tags: Record<string, any>;
  metadata: Record<string, any>;
  probable_cause?: string;
  recommended_action?: string;

  created_at: string;
  updated_at: string;
}

export interface AlarmStatistics {
  total_alarms: number;
  active_alarms: number;
  critical_alarms: number;
  acknowledged_alarms: number;
  resolved_last_24h: number;
  affected_subscribers: number;
  total_impacted_subscribers?: number;
  by_severity: Record<AlarmSeverity, number>;
  by_status: Record<AlarmStatus, number>;
  by_source: Record<AlarmSource, number>;
}

export interface AlarmQueryParams {
  severity?: AlarmSeverity[];
  status?: AlarmStatus[];
  source?: AlarmSource[];
  alarm_type?: string;
  resource_type?: string;
  resource_id?: string;
  customer_id?: string;
  assigned_to?: string;
  is_root_cause?: boolean;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

export interface SLACompliance {
  date: string;
  compliance_percentage: number;
  target_percentage: number;
  uptime_minutes: number;
  downtime_minutes: number;
  sla_breaches: number;
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch and manage alarms
 */
export function useAlarms(params?: AlarmQueryParams) {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAlarms = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Build query string
      const queryParams = new URLSearchParams();
      if (params?.severity) params.severity.forEach((s) => queryParams.append("severity", s));
      if (params?.status) params.status.forEach((s) => queryParams.append("status", s));
      if (params?.source) params.source.forEach((s) => queryParams.append("source", s));
      if (params?.alarm_type) queryParams.set("alarm_type", params.alarm_type);
      if (params?.resource_type) queryParams.set("resource_type", params.resource_type);
      if (params?.resource_id) queryParams.set("resource_id", params.resource_id);
      if (params?.customer_id) queryParams.set("customer_id", params.customer_id);
      if (params?.assigned_to) queryParams.set("assigned_to", params.assigned_to);
      if (params?.is_root_cause !== undefined)
        queryParams.set("is_root_cause", String(params.is_root_cause));
      if (params?.from_date) queryParams.set("from_date", params.from_date);
      if (params?.to_date) queryParams.set("to_date", params.to_date);
      if (params?.limit) queryParams.set("limit", String(params.limit));
      if (params?.offset) queryParams.set("offset", String(params.offset));

      const endpoint = `/faults/alarms${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await apiClient.get(endpoint);

      if (response.data) {
        setAlarms(response.data as Alarm[]);
      }
    } catch (err) {
      setError(err as Error);
      console.error("Failed to fetch alarms:", err);
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  return {
    alarms,
    isLoading,
    error,
    refetch: fetchAlarms,
  };
}

/**
 * Hook to fetch alarm statistics
 */
export function useAlarmStatistics() {
  const [statistics, setStatistics] = useState<AlarmStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStatistics = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await apiClient.get("/faults/alarms/statistics");

      if (response.data) {
        setStatistics(response.data as AlarmStatistics);
      }
    } catch (err) {
      setError(err as Error);
      console.error("Failed to fetch alarm statistics:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatistics();
  }, [fetchStatistics]);

  return {
    statistics,
    isLoading,
    error,
    refetch: fetchStatistics,
  };
}

/**
 * Hook for alarm operations (acknowledge, clear, etc.)
 */
export function useAlarmOperations() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const acknowledgeAlarms = useCallback(async (alarmIds: string[], note?: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const promises = alarmIds.map((id) =>
        apiClient.post(`/faults/alarms/${id}/acknowledge`, { note }),
      );

      await Promise.all(promises);
      return true;
    } catch (err) {
      setError(err as Error);
      console.error("Failed to acknowledge alarms:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAlarms = useCallback(async (alarmIds: string[]) => {
    try {
      setIsLoading(true);
      setError(null);

      const promises = alarmIds.map((id) => apiClient.post(`/faults/alarms/${id}/clear`, {}));

      await Promise.all(promises);
      return true;
    } catch (err) {
      setError(err as Error);
      console.error("Failed to clear alarms:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createTickets = useCallback(async (alarmIds: string[], priority: string = "normal") => {
    try {
      setIsLoading(true);
      setError(null);

      const promises = alarmIds.map((id) =>
        apiClient.post(`/faults/alarms/${id}/create-ticket`, { priority }),
      );

      await Promise.all(promises);
      return true;
    } catch (err) {
      setError(err as Error);
      console.error("Failed to create tickets:", err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    acknowledgeAlarms,
    clearAlarms,
    createTickets,
    isLoading,
    error,
  };
}

/**
 * Hook to fetch SLA compliance data
 */
export function useSLACompliance(days: number = 30) {
  const [data, setData] = useState<SLACompliance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCompliance = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);

      const response = await apiClient.get(
        `/faults/sla/compliance?from_date=${fromDate.toISOString()}`,
      );

      if (response.data) {
        setData(response.data as SLACompliance[]);
      }
    } catch (err) {
      setError(err as Error);
      console.error("Failed to fetch SLA compliance:", err);
    } finally {
      setIsLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchCompliance,
  };
}

/**
 * Hook to fetch alarm details (history, notes, etc.)
 */
export function useAlarmDetails(alarmId: string | null) {
  const [history, setHistory] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!alarmId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Fetch history and notes in parallel
      const [historyResponse, notesResponse] = await Promise.all([
        apiClient.get(`/faults/alarms/${alarmId}/history`),
        apiClient.get(`/faults/alarms/${alarmId}/notes`),
      ]);

      setHistory(historyResponse.data || []);
      setNotes(notesResponse.data || []);
    } catch (err) {
      setError(err as Error);
      console.error("Failed to fetch alarm details:", err);
    } finally {
      setIsLoading(false);
    }
  }, [alarmId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const addNote = useCallback(
    async (content: string) => {
      if (!alarmId) return false;

      try {
        await apiClient.post(`/faults/alarms/${alarmId}/notes`, { content });
        await fetchDetails(); // Refresh notes
        return true;
      } catch (err) {
        setError(err as Error);
        console.error("Failed to add note:", err);
        return false;
      }
    },
    [alarmId, fetchDetails],
  );

  return {
    history,
    notes,
    isLoading,
    error,
    refetch: fetchDetails,
    addNote,
  };
}
