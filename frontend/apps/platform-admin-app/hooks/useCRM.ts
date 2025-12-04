/**
 * CRM Custom Hooks (Platform)
 *
 * Leads and quotes management for platform tenant CRM. Site surveys live in ISP ops,
 * so this module only exposes lead/quote primitives needed for tenant onboarding flows.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { optimisticHelpers } from "@/lib/query-client";

// ============================================================================
// Type Definitions
// ============================================================================

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "quote_sent"
  | "negotiating"
  | "won"
  | "lost"
  | "disqualified";

export type LeadSource =
  | "website"
  | "referral"
  | "partner"
  | "cold_call"
  | "social_media"
  | "event"
  | "advertisement"
  | "walk_in"
  | "other";

export type QuoteStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "accepted"
  | "rejected"
  | "expired"
  | "revised";

export type Serviceability =
  | "serviceable"
  | "not_serviceable"
  | "pending_expansion"
  | "requires_construction";

export interface Lead {
  id: string;
  tenant_id: string;
  lead_number: string;
  status: LeadStatus;
  source: LeadSource;
  priority: number; // 1=High, 2=Medium, 3=Low

  // Contact
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;

  // Service Location
  service_address_line1: string;
  service_address_line2?: string;
  service_city: string;
  service_state_province: string;
  service_postal_code: string;
  service_country: string;
  service_coordinates?: { lat: number; lon: number };

  // Serviceability
  is_serviceable?: Serviceability;
  serviceability_checked_at?: string;
  serviceability_notes?: string;

  // Interest
  interested_service_types: string[];
  desired_bandwidth?: string;
  estimated_monthly_budget?: number;
  desired_installation_date?: string;

  // Assignment
  assigned_to_id?: string;
  partner_id?: string;

  // Qualification
  qualified_at?: string;
  disqualified_at?: string;
  disqualification_reason?: string;

  // Conversion
  converted_at?: string;
  converted_to_customer_id?: string;

  // Tracking
  first_contact_date?: string;
  last_contact_date?: string;
  expected_close_date?: string;

  // Metadata
  metadata?: Record<string, unknown>;
  notes?: string;

  created_at: string;
  updated_at: string;
}

export interface Quote {
  id: string;
  tenant_id: string;
  quote_number: string;
  status: QuoteStatus;
  lead_id: string;

  // Quote Details
  service_plan_name: string;
  bandwidth: string;
  monthly_recurring_charge: number;
  installation_fee?: number;
  equipment_fee?: number;
  activation_fee?: number;
  total_upfront_cost?: number;

  // Contract Terms
  contract_term_months?: number;
  early_termination_fee?: number;
  promo_discount_months?: number;
  promo_monthly_discount?: number;

  // Validity
  valid_until: string;

  // Delivery
  sent_at?: string;
  viewed_at?: string;

  // Acceptance/Rejection
  accepted_at?: string;
  rejected_at?: string;
  rejection_reason?: string;

  // E-Signature
  signature_data?: Record<string, unknown>;

  // Line Items
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;

  // Metadata
  metadata?: Record<string, unknown>;
  notes?: string;

  created_at: string;
  updated_at: string;
}

export interface LeadCreateRequest {
  tenant_id?: string;
  lead_number?: string;
  status?: LeadStatus;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  service_address_line1: string;
  service_address_line2?: string;
  service_city: string;
  service_state_province: string;
  service_postal_code: string;
  service_country?: string;
  service_coordinates?: { lat: number; lon: number };
  source: LeadSource;
  interested_service_types?: string[];
  desired_bandwidth?: string;
  estimated_monthly_budget?: number;
  desired_installation_date?: string;
  assigned_to_id?: string;
  partner_id?: string;
  priority?: number;
  metadata?: Record<string, unknown>;
  notes?: string;
}

export interface LeadUpdateRequest {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  service_address_line1?: string;
  service_address_line2?: string;
  service_city?: string;
  service_state_province?: string;
  service_postal_code?: string;
  service_country?: string;
  service_coordinates?: { lat: number; lon: number };
  source?: LeadSource;
  interested_service_types?: string[];
  desired_bandwidth?: string;
  estimated_monthly_budget?: number;
  desired_installation_date?: string;
  assigned_to_id?: string;
  partner_id?: string;
  priority?: number;
  status?: LeadStatus;
  expected_close_date?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
}

export interface QuoteCreateRequest {
  tenant_id?: string;
  quote_number?: string;
  lead_id: string;
  service_plan_name: string;
  bandwidth: string;
  monthly_recurring_charge: number;
  installation_fee?: number;
  equipment_fee?: number;
  activation_fee?: number;
  contract_term_months?: number;
  early_termination_fee?: number;
  promo_discount_months?: number;
  promo_monthly_discount?: number;
  valid_until: string;
  line_items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;
  metadata?: Record<string, unknown>;
  notes?: string;
}

export interface QuoteUpsertRequest extends QuoteCreateRequest {
  id?: string;
  status?: QuoteStatus;
}

// ============================================================================
// Query Key Factory
// ============================================================================

type LeadFilters = {
  status?: LeadStatus | "";
  source?: LeadSource;
  assignedTo?: string;
  search?: string;
};

type QuoteFilters = {
  status?: QuoteStatus;
  leadId?: string;
};

export const crmKeys = {
  leads: {
    all: ["crm", "leads"] as const,
    lists: (filters: LeadFilters = {}) => ["crm", "leads", "list", filters] as const,
    detail: (id: string) => ["crm", "leads", id] as const,
  },
  quotes: {
    all: ["crm", "quotes"] as const,
    lists: (filters: QuoteFilters = {}) => ["crm", "quotes", "list", filters] as const,
    detail: (id: string) => ["crm", "quotes", id] as const,
  },
};

// ============================================================================
// API Helpers
// ============================================================================

const leadApi = {
  fetchLeads: async (filters: LeadFilters = {}): Promise<Lead[]> => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.source) params.append("source", filters.source);
    if (filters.assignedTo) params.append("assigned_to", filters.assignedTo);
    if (filters.search) params.append("search", filters.search);

    const query = params.toString();
    const response = await apiClient.get<Lead[]>(`/crm/leads${query ? `?${query}` : ""}`);
    return response.data ?? [];
  },

  createLead: async (data: LeadCreateRequest): Promise<Lead> => {
    const response = await apiClient.post<Lead>("/crm/leads", data);
    return response.data!;
  },

  updateLead: async ({
    id,
    data,
  }: {
    id: string;
    data: Partial<LeadUpdateRequest>;
  }): Promise<Lead> => {
    const response = await apiClient.patch<Lead>(`/crm/leads/${id}`, data);
    return response.data!;
  },

  qualifyLead: async (id: string): Promise<void> => {
    await apiClient.post(`/crm/leads/${id}/qualify`, {});
  },

  disqualifyLead: async ({ id, reason }: { id: string; reason: string }): Promise<void> => {
    await apiClient.post(`/crm/leads/${id}/disqualify`, { reason });
  },

  convertToCustomer: async ({
    id,
    data,
  }: {
    id: string;
    data?: Record<string, unknown>;
  }): Promise<Record<string, unknown>> => {
    const response = await apiClient.post(`/crm/leads/${id}/convert-to-customer`, data ?? {});
    return response.data ?? {};
  },
};

const quoteApi = {
  fetchQuotes: async (filters: QuoteFilters = {}): Promise<Quote[]> => {
    const params = new URLSearchParams();
    if (filters.status) params.append("status", filters.status);
    if (filters.leadId) params.append("lead_id", filters.leadId);

    const query = params.toString();
    const response = await apiClient.get<Quote[]>(`/crm/quotes${query ? `?${query}` : ""}`);
    return response.data ?? [];
  },

  upsertQuote: async (data: QuoteUpsertRequest): Promise<Quote> => {
    const hasId = Boolean(data.id);
    if (hasId) {
      const response = await apiClient.patch<Quote>(`/crm/quotes/${data.id}`, data);
      return response.data!;
    }
    const response = await apiClient.post<Quote>("/crm/quotes", data);
    return response.data!;
  },

  sendQuote: async (id: string): Promise<void> => {
    await apiClient.post(`/crm/quotes/${id}/send`, {});
  },

  acceptQuote: async ({
    id,
    signatureData,
  }: {
    id: string;
    signatureData?: Record<string, unknown>;
  }): Promise<void> => {
    await apiClient.post(`/crm/quotes/${id}/accept`, { signature_data: signatureData });
  },

  rejectQuote: async ({ id, reason }: { id: string; reason: string }): Promise<void> => {
    await apiClient.post(`/crm/quotes/${id}/reject`, { reason });
  },

  deleteQuote: async (id: string): Promise<void> => {
    await apiClient.delete(`/crm/quotes/${id}`);
  },
};

// ============================================================================
// Lead Hooks
// ============================================================================

interface UseLeadsOptions extends LeadFilters {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useLeads(options: UseLeadsOptions = {}) {
  const { autoRefresh = false, refreshInterval = 60000, ...filters } = options;

  return useQuery({
    queryKey: crmKeys.leads.lists(filters),
    queryFn: () => leadApi.fetchLeads(filters),
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: autoRefresh ? refreshInterval : 60000,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadApi.createLead,
    onMutate: async (newLead) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });
      const previousLeads = queryClient.getQueryData<Lead[]>(crmKeys.leads.lists());

      const optimisticLead: Lead = {
        id: `temp-${Date.now()}`,
        tenant_id: newLead.tenant_id ?? "tenant",
        lead_number: newLead.lead_number ?? `TEMP-${Date.now()}`,
        status: newLead.status ?? "new",
        priority: newLead.priority ?? 2,
        interested_service_types: newLead.interested_service_types ?? [],
        service_country: newLead.service_country ?? "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newLead,
      } as Lead;

      optimisticHelpers.addToList(queryClient, crmKeys.leads.lists(), optimisticLead, {
        position: "start",
      });
      logger.info("Creating lead optimistically", { leadId: optimisticLead.id });

      return { previousLeads, optimisticLead };
    },
    onError: (error, _variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to create lead", error);
    },
    onSuccess: (data, _variables, context) => {
      if (context?.optimisticLead) {
        optimisticHelpers.updateInList(
          queryClient,
          crmKeys.leads.lists(),
          context.optimisticLead.id,
          data,
        );
      } else {
        optimisticHelpers.addToList(queryClient, crmKeys.leads.lists(), data, {
          position: "start",
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<LeadUpdateRequest>) =>
      leadApi.updateLead({ id, data }),
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.detail(id) });
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });

      const previousLead = queryClient.getQueryData(crmKeys.leads.detail(id));
      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateItem(queryClient, crmKeys.leads.detail(id), updates);
      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, updates);

      return { previousLead, previousLeads };
    },
    onError: (_error, variables, context) => {
      if (context?.previousLead) {
        queryClient.setQueryData(crmKeys.leads.detail(variables.id), context.previousLead);
      }
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
    },
    onSettled: (_, __, variables) => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      leadApi.updateLead({ id, data: { status } }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });
      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, {
        status,
        updated_at: new Date().toISOString(),
      });

      return { previousLeads };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

export function useQualifyLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => leadApi.qualifyLead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });
      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, {
        status: "qualified" as LeadStatus,
        qualified_at: new Date().toISOString(),
      });

      return { previousLeads };
    },
    onError: (_error, _id, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

export function useDisqualifyLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      leadApi.disqualifyLead({ id, reason }),
    onMutate: async ({ id, reason }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });
      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, {
        status: "disqualified" as LeadStatus,
        disqualification_reason: reason,
        disqualified_at: new Date().toISOString(),
      });

      return { previousLeads };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

export function useConvertToCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: Record<string, unknown> }) =>
      leadApi.convertToCustomer({ id, data }),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });
      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, {
        status: "won" as LeadStatus,
        converted_at: new Date().toISOString(),
      });

      return { previousLeads };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

// ============================================================================
// Quote Hooks
// ============================================================================

interface UseQuotesOptions extends QuoteFilters {
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useQuotes(options: UseQuotesOptions = {}) {
  const { autoRefresh = false, refreshInterval = 60000, ...filters } = options;

  return useQuery({
    queryKey: crmKeys.quotes.lists(filters),
    queryFn: () => quoteApi.fetchQuotes(filters),
    refetchInterval: autoRefresh ? refreshInterval : false,
    staleTime: autoRefresh ? refreshInterval : 60000,
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: QuoteUpsertRequest) => quoteApi.upsertQuote(data),
    onMutate: async (newQuote) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });
      const previousQuotes = queryClient.getQueryData<Quote[]>(crmKeys.quotes.lists());

      const optimisticQuote: Quote = {
        id: newQuote.id ?? `temp-${Date.now()}`,
        tenant_id: newQuote.tenant_id ?? "tenant",
        quote_number: newQuote.quote_number ?? `TEMP-${Date.now()}`,
        status: newQuote.status ?? "draft",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newQuote,
      } as Quote;

      optimisticHelpers.addToList(queryClient, crmKeys.quotes.lists(), optimisticQuote, {
        position: "start",
      });

      return { previousQuotes, optimisticQuote };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
    },
    onSuccess: (data, _variables, context) => {
      if (context?.optimisticQuote) {
        optimisticHelpers.updateInList(
          queryClient,
          crmKeys.quotes.lists(),
          context.optimisticQuote.id,
          data,
        );
      } else {
        optimisticHelpers.addToList(queryClient, crmKeys.quotes.lists(), data, {
          position: "start",
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

export function useSendQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => quoteApi.sendQuote(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });
      const previousQuotes = queryClient.getQueryData(crmKeys.quotes.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.quotes.lists(), id, {
        status: "sent" as QuoteStatus,
        sent_at: new Date().toISOString(),
      });

      return { previousQuotes };
    },
    onError: (_error, _id, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

export function useAcceptQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, signatureData }: { id: string; signatureData?: Record<string, unknown> }) =>
      quoteApi.acceptQuote({ id, signatureData }),
    onMutate: async ({ id, signatureData }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });
      const previousQuotes = queryClient.getQueryData(crmKeys.quotes.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.quotes.lists(), id, {
        status: "accepted" as QuoteStatus,
        accepted_at: new Date().toISOString(),
        signature_data: signatureData,
      });

      return { previousQuotes };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

export function useRejectQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      quoteApi.rejectQuote({ id, reason }),
    onMutate: async ({ id, reason }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });
      const previousQuotes = queryClient.getQueryData(crmKeys.quotes.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.quotes.lists(), id, {
        status: "rejected" as QuoteStatus,
        rejection_reason: reason,
        rejected_at: new Date().toISOString(),
      });

      return { previousQuotes };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => quoteApi.deleteQuote(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });
      const previousQuotes = queryClient.getQueryData(crmKeys.quotes.lists());

      optimisticHelpers.removeFromList(queryClient, crmKeys.quotes.lists(), id);

      return { previousQuotes };
    },
    onError: (_error, _id, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}
