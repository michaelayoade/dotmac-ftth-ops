/**
 * Ticketing System Hooks
 *
 * Custom hooks for interacting with the ticketing API
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

// ============================================================================
// Types
// ============================================================================

export type TicketActorType = "customer" | "tenant" | "partner" | "platform";
export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed";
export type TicketPriority = "low" | "normal" | "high" | "urgent";
export type TicketType =
  | "general_inquiry"
  | "billing_issue"
  | "technical_support"
  | "installation_request"
  | "outage_report"
  | "service_upgrade"
  | "service_downgrade"
  | "cancellation_request"
  | "equipment_issue"
  | "speed_issue"
  | "network_issue"
  | "connectivity_issue";

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: TicketActorType;
  sender_user_id?: string;
  body: string;
  attachments: any[];
  created_at: string;
  updated_at: string;
}

export interface TicketSummary {
  id: string;
  ticket_number: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  origin_type: TicketActorType;
  target_type: TicketActorType;
  tenant_id?: string;
  customer_id?: string;
  partner_id?: string;
  assigned_to_user_id?: string;
  last_response_at?: string;
  context: Record<string, any>;

  // ISP-specific fields
  ticket_type?: TicketType;
  service_address?: string;
  sla_due_date?: string;
  sla_breached: boolean;
  escalation_level: number;

  created_at: string;
  updated_at: string;
}

export interface TicketDetail extends TicketSummary {
  messages: TicketMessage[];
  affected_services: string[];
  device_serial_numbers: string[];
  first_response_at?: string;
  resolution_time_minutes?: number;
  escalated_at?: string;
  escalated_to_user_id?: string;
}

export interface CreateTicketRequest {
  subject: string;
  message: string;
  target_type: TicketActorType;
  priority?: TicketPriority;
  partner_id?: string;
  tenant_id?: string;
  metadata?: Record<string, any>;
  attachments?: any[];

  // ISP-specific fields
  ticket_type?: TicketType;
  service_address?: string;
  affected_services?: string[];
  device_serial_numbers?: string[];
}

export interface UpdateTicketRequest {
  status?: TicketStatus;
  priority?: TicketPriority;
  assigned_to_user_id?: string;
  metadata?: Record<string, any>;
  ticket_type?: TicketType;
  service_address?: string;
  affected_services?: string[];
  device_serial_numbers?: string[];
  escalation_level?: number;
  escalated_to_user_id?: string;
}

export interface AddMessageRequest {
  message: string;
  attachments?: any[];
  new_status?: TicketStatus;
}

// ============================================================================
// useTickets Hook - List tickets
// ============================================================================

interface UseTicketsOptions {
  status?: TicketStatus | undefined;
  priority?: TicketPriority | undefined;
  search?: string | undefined;
  autoRefresh?: boolean | undefined;
  refreshInterval?: number | undefined;
}

export function useTickets(options: UseTicketsOptions = {}) {
  const { status, priority, search, autoRefresh = false, refreshInterval = 30000 } = options;

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = {};
      if (status) params["status"] = status;
      if (priority) params["priority"] = priority;
      if (search) params["search"] = search;

      const response = await apiClient.get<TicketSummary[]>("/tickets", {
        params,
      });
      setTickets(response["data"]);
      setError(null);
    } catch (err: any) {
      logger.error("Failed to fetch tickets", toError(err), { status });
      setError(err.response?.["data"]?.detail || "Failed to fetch tickets");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchTickets();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchTickets]);

  return {
    tickets,
    loading,
    error,
    refetch: fetchTickets,
  };
}

// ============================================================================
// useTicket Hook - Single ticket with messages
// ============================================================================

export function useTicket(ticketId: string | null, autoRefresh = false) {
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTicket = useCallback(async () => {
    if (!ticketId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.get<TicketDetail>(`/tickets/${ticketId}`);
      setTicket(response["data"]);
      setError(null);
    } catch (err: any) {
      logger.error("Failed to fetch ticket", toError(err), { ticketId });
      setError(err.response?.["data"]?.detail || "Failed to fetch ticket");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  // Auto-refresh for open/in_progress tickets
  useEffect(() => {
    if (!autoRefresh || !ticketId) return;
    if (ticket?.status === "resolved" || ticket?.status === "closed") return;

    const interval = setInterval(() => {
      fetchTicket();
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(interval);
  }, [autoRefresh, ticketId, ticket?.status, fetchTicket]);

  return {
    ticket,
    loading,
    error,
    refetch: fetchTicket,
  };
}

// ============================================================================
// useCreateTicket Hook
// ============================================================================

export function useCreateTicket() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTicket = useCallback(async (data: CreateTicketRequest) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.post<TicketDetail>("/tickets", data);
      return response["data"];
    } catch (err: any) {
      logger.error("Failed to create ticket", toError(err), { targetType: data["target_type"] });
      setError(err.response?.["data"]?.detail || "Failed to create ticket");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createTicket,
    loading,
    error,
  };
}

// ============================================================================
// useUpdateTicket Hook
// ============================================================================

export function useUpdateTicket() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateTicket = useCallback(async (ticketId: string, data: UpdateTicketRequest) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.patch<TicketDetail>(`/tickets/${ticketId}`, data);
      return response["data"];
    } catch (err: any) {
      logger.error("Failed to update ticket", toError(err), { ticketId });
      setError(err.response?.["data"]?.detail || "Failed to update ticket");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    updateTicket,
    loading,
    error,
  };
}

// ============================================================================
// useAddMessage Hook
// ============================================================================

export function useAddMessage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMessage = useCallback(async (ticketId: string, data: AddMessageRequest) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.post<TicketDetail>(`/tickets/${ticketId}/messages`, data);
      return response["data"];
    } catch (err: any) {
      logger.error("Failed to add ticket message", toError(err), { ticketId });
      setError(err.response?.["data"]?.detail || "Failed to add message");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    addMessage,
    loading,
    error,
  };
}

// ============================================================================
// useTicketStats Hook - Get ticket statistics
// ============================================================================

export interface TicketStats {
  total: number;
  open: number;
  in_progress: number;
  waiting: number;
  resolved: number;
  closed: number;
  by_priority: Record<TicketPriority, number>;
  by_type: Record<string, number>;
  sla_breached: number;
  avg_resolution_time_minutes?: number;
}

export function useTicketStats() {
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);

      const response = await apiClient.get<TicketStats>("/tickets/metrics");
      const metrics = response["data"];

      setStats({
        total: metrics.total ?? 0,
        open: metrics.open ?? 0,
        in_progress: metrics.in_progress ?? 0,
        waiting: metrics.waiting ?? 0,
        resolved: metrics.resolved ?? 0,
        closed: metrics.closed ?? 0,
        by_priority: {
          low: metrics.by_priority?.low ?? 0,
          normal: metrics.by_priority?.normal ?? 0,
          high: metrics.by_priority?.high ?? 0,
          urgent: metrics.by_priority?.urgent ?? 0,
        },
        by_type: metrics.by_type || {},
        sla_breached: metrics.sla_breached ?? 0,
        avg_resolution_time_minutes: metrics.avg_resolution_time_minutes ?? 0,
      });
      setError(null);
    } catch (err: any) {
      logger.error("Failed to fetch ticket stats", toError(err));
      setError(err.response?.["data"]?.detail || "Failed to fetch statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}
