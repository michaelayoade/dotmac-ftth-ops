/**
 * Ticketing System Hooks
 *
 * Custom hooks for interacting with the ticketing API using TanStack Query
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { optimisticHelpers, invalidateHelpers } from "@/lib/query-client";

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

// ============================================================================
// Query Key Factory
// ============================================================================

export const ticketingKeys = {
  all: ["ticketing"] as const,
  lists: () => [...ticketingKeys.all, "list"] as const,
  list: (filters?: { status?: TicketStatus }) => [...ticketingKeys.lists(), filters] as const,
  details: () => [...ticketingKeys.all, "detail"] as const,
  detail: (id: string) => [...ticketingKeys.details(), id] as const,
  stats: () => [...ticketingKeys.all, "stats"] as const,
};

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
// API Functions
// ============================================================================

const ticketingApi = {
  fetchTickets: async (filters?: { status?: TicketStatus }): Promise<TicketSummary[]> => {
    const params: Record<string, any> = {};
    if (filters?.status) params['status'] = filters.status;

    const response = await apiClient.get<TicketSummary[]>("/tickets", { params });
    return response.data;
  },

  fetchTicket: async (ticketId: string): Promise<TicketDetail> => {
    const response = await apiClient.get<TicketDetail>(`/tickets/${ticketId}`);
    return response.data;
  },

  createTicket: async (data: CreateTicketRequest): Promise<TicketDetail> => {
    const response = await apiClient.post<TicketDetail>("/tickets", data);
    return response.data;
  },

  updateTicket: async (ticketId: string, data: UpdateTicketRequest): Promise<TicketDetail> => {
    const response = await apiClient.patch<TicketDetail>(`/tickets/${ticketId}`, data);
    return response.data;
  },

  addMessage: async (ticketId: string, data: AddMessageRequest): Promise<TicketDetail> => {
    const response = await apiClient.post<TicketDetail>(`/tickets/${ticketId}/messages`, data);
    return response.data;
  },

  fetchStats: async (): Promise<TicketStats> => {
    const response = await apiClient.get<TicketSummary[]>("/tickets");
    const tickets = response.data;

    const stats: TicketStats = {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      in_progress: tickets.filter((t) => t.status === "in_progress").length,
      waiting: tickets.filter((t) => t.status === "waiting").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      closed: tickets.filter((t) => t.status === "closed").length,
      by_priority: {
        low: tickets.filter((t) => t.priority === "low").length,
        normal: tickets.filter((t) => t.priority === "normal").length,
        high: tickets.filter((t) => t.priority === "high").length,
        urgent: tickets.filter((t) => t.priority === "urgent").length,
      },
      by_type: {},
      sla_breached: tickets.filter((t) => t.sla_breached).length,
    };

    tickets.forEach((ticket) => {
      if (ticket.ticket_type) {
        stats.by_type[ticket.ticket_type] = (stats.by_type[ticket.ticket_type] || 0) + 1;
      }
    });

    return stats;
  },
};

// ============================================================================
// useTickets Hook - List tickets
// ============================================================================

interface UseTicketsOptions {
  status?: TicketStatus;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useTickets(options: UseTicketsOptions = {}) {
  const { status, autoRefresh = false, refreshInterval = 30000 } = options;

  const query = useQuery({
    queryKey: ticketingKeys.list({ status }),
    queryFn: () => ticketingApi.fetchTickets({ status }),
    staleTime: 60000, // 1 minute
    refetchInterval: autoRefresh ? refreshInterval : false,
  });

  return {
    tickets: query.data || [],
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}

// ============================================================================
// useTicket Hook - Single ticket with messages
// ============================================================================

export function useTicket(ticketId: string | null, autoRefresh = false) {
  const query = useQuery({
    queryKey: ticketingKeys.detail(ticketId || ""),
    queryFn: () => ticketingApi.fetchTicket(ticketId!),
    enabled: !!ticketId,
    staleTime: 60000, // 1 minute
    refetchInterval: (query) => {
      if (!autoRefresh || !ticketId) return false;
      const data = query.state.data;
      if (data?.status === "resolved" || data?.status === "closed") return false;
      return 10000; // Poll every 10 seconds for active tickets
    },
  });

  return {
    ticket: query.data || null,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}

// ============================================================================
// useCreateTicket Hook
// ============================================================================

export function useCreateTicket() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ticketingApi.createTicket,
    onMutate: async (newTicket) => {
      await queryClient.cancelQueries({ queryKey: ticketingKeys.lists() });

      const previousTickets = queryClient.getQueryData(ticketingKeys.lists());

      const optimisticTicket: TicketSummary = {
        id: `temp-${Date.now()}`,
        ticket_number: "TEMP-000",
        subject: newTicket.subject,
        status: "open",
        priority: newTicket.priority || "normal",
        origin_type: "platform",
        target_type: newTicket.target_type,
        tenant_id: newTicket.tenant_id,
        partner_id: newTicket.partner_id,
        context: newTicket.metadata || {},
        ticket_type: newTicket.ticket_type,
        service_address: newTicket.service_address,
        sla_breached: false,
        escalation_level: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      optimisticHelpers.addToList(queryClient, ticketingKeys.lists(), optimisticTicket, {
        position: "start",
      });

      logger.info("Creating ticket optimistically", { ticket: optimisticTicket });

      return { previousTickets, optimisticTicket };
    },
    onError: (error, newTicket, context) => {
      if (context?.previousTickets) {
        queryClient.setQueryData(ticketingKeys.lists(), context.previousTickets);
      }
      logger.error("Failed to create ticket", toError(error), { targetType: newTicket.target_type });
    },
    onSuccess: (data, variables, context) => {
      if (context?.optimisticTicket) {
        optimisticHelpers.updateInList(
          queryClient,
          ticketingKeys.lists(),
          context.optimisticTicket.id,
          data,
        );
      }
      logger.info("Ticket created", { ticket: data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ticketingKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ticketingKeys.stats() });
    },
  });

  return {
    createTicket: mutation.mutate,
    createTicketAsync: mutation.mutateAsync,
    loading: mutation.isPending,
    error: mutation.error ? String(mutation.error) : null,
  };
}

// ============================================================================
// useUpdateTicket Hook
// ============================================================================

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: UpdateTicketRequest }) =>
      ticketingApi.updateTicket(ticketId, data),
    onMutate: async ({ ticketId, data }) => {
      await queryClient.cancelQueries({ queryKey: ticketingKeys.detail(ticketId) });
      await queryClient.cancelQueries({ queryKey: ticketingKeys.lists() });

      const previousTicket = queryClient.getQueryData(ticketingKeys.detail(ticketId));
      const previousTickets = queryClient.getQueryData(ticketingKeys.lists());

      optimisticHelpers.updateItem(queryClient, ticketingKeys.detail(ticketId), data);
      optimisticHelpers.updateInList(queryClient, ticketingKeys.lists(), ticketId, data);

      logger.info("Updating ticket optimistically", { ticketId, updates: data });

      return { previousTicket, previousTickets, ticketId };
    },
    onError: (error, variables, context) => {
      if (context) {
        if (context.previousTicket) {
          queryClient.setQueryData(ticketingKeys.detail(context.ticketId), context.previousTicket);
        }
        if (context.previousTickets) {
          queryClient.setQueryData(ticketingKeys.lists(), context.previousTickets);
        }
      }
      logger.error("Failed to update ticket", toError(error), { ticketId: variables.ticketId });
    },
    onSuccess: (data) => {
      logger.info("Ticket updated", { ticket: data });
    },
    onSettled: (data, error, variables) => {
      invalidateHelpers.invalidateRelated(queryClient, [
        ticketingKeys.detail(variables.ticketId),
        ticketingKeys.lists(),
        ticketingKeys.stats(),
      ]);
    },
  });

  return {
    updateTicket: (ticketId: string, data: UpdateTicketRequest) =>
      mutation.mutate({ ticketId, data }),
    updateTicketAsync: (ticketId: string, data: UpdateTicketRequest) =>
      mutation.mutateAsync({ ticketId, data }),
    loading: mutation.isPending,
    error: mutation.error ? String(mutation.error) : null,
  };
}

// ============================================================================
// useAddMessage Hook
// ============================================================================

export function useAddMessage() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ ticketId, data }: { ticketId: string; data: AddMessageRequest }) =>
      ticketingApi.addMessage(ticketId, data),
    onMutate: async ({ ticketId, data }) => {
      await queryClient.cancelQueries({ queryKey: ticketingKeys.detail(ticketId) });

      const previousTicket = queryClient.getQueryData(ticketingKeys.detail(ticketId));

      const optimisticMessage: TicketMessage = {
        id: `temp-${Date.now()}`,
        ticket_id: ticketId,
        sender_type: "platform",
        body: data.message,
        attachments: data.attachments || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<TicketDetail>(
        ticketingKeys.detail(ticketId) as any,
        (old) => {
          if (!old) return old;
          return {
            ...old,
            messages: [...(old.messages || []), optimisticMessage],
            status: data.new_status || old.status,
          };
        },
      );

      logger.info("Adding message optimistically", { ticketId, message: optimisticMessage });

      return { previousTicket, optimisticMessage, ticketId };
    },
    onError: (error, variables, context) => {
      if (context?.previousTicket) {
        queryClient.setQueryData(
          ticketingKeys.detail(context.ticketId),
          context.previousTicket,
        );
      }
      logger.error("Failed to add ticket message", toError(error), { ticketId: variables.ticketId });
    },
    onSuccess: (data, variables) => {
      queryClient.setQueryData(ticketingKeys.detail(variables.ticketId), data);
      logger.info("Message added to ticket", { ticketId: variables.ticketId });
    },
    onSettled: (data, error, variables) => {
      invalidateHelpers.invalidateRelated(queryClient, [
        ticketingKeys.detail(variables.ticketId),
        ticketingKeys.lists(),
      ]);
    },
  });

  return {
    addMessage: (ticketId: string, data: AddMessageRequest) =>
      mutation.mutate({ ticketId, data }),
    addMessageAsync: (ticketId: string, data: AddMessageRequest) =>
      mutation.mutateAsync({ ticketId, data }),
    loading: mutation.isPending,
    error: mutation.error ? String(mutation.error) : null,
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
  const query = useQuery({
    queryKey: ticketingKeys.stats(),
    queryFn: ticketingApi.fetchStats,
    staleTime: 60000, // 1 minute
  });

  return {
    stats: query.data || null,
    loading: query.isLoading,
    error: query.error ? String(query.error) : null,
    refetch: query.refetch,
  };
}
