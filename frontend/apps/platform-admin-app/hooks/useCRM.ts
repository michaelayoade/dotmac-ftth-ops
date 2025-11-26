/**
 * CRM Custom Hooks
 *
 * React hooks for managing leads, quotes, and site surveys in the CRM system.
 * Provides data fetching, mutations, and state management for the sales pipeline.
 * Migrated to TanStack Query for better caching, optimistic updates, and state management.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { optimisticHelpers, invalidateHelpers } from "@/lib/query-client";

// ============================================================================
// Type Definitions
// ============================================================================

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "site_survey_scheduled"
  | "site_survey_completed"
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

export type SiteSurveyStatus = "scheduled" | "in_progress" | "completed" | "failed" | "canceled";

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
  installation_fee: number;
  equipment_fee: number;
  activation_fee: number;
  total_upfront_cost: number;

  // Contract Terms
  contract_term_months: number;
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
  line_items: Array<{
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

export interface SiteSurvey {
  id: string;
  tenant_id: string;
  survey_number: string;
  status: SiteSurveyStatus;
  lead_id: string;

  // Scheduling
  scheduled_date: string;
  completed_date?: string;
  technician_id?: string;

  // Technical Assessment
  serviceability?: Serviceability;
  nearest_fiber_distance_meters?: number;
  requires_fiber_extension: boolean;
  fiber_extension_cost?: number;

  // Network Details
  nearest_olt_id?: string;
  available_pon_ports?: number;

  // Installation Requirements
  estimated_installation_time_hours?: number;
  special_equipment_required: string[];
  installation_complexity?: "simple" | "moderate" | "complex";

  // Site Photos
  photos: Array<{
    url: string;
    description?: string;
    timestamp: string;
  }>;

  // Survey Results
  recommendations?: string;
  obstacles?: string;

  // Metadata
  metadata?: Record<string, unknown>;
  notes?: string;

  created_at: string;
  updated_at: string;
}

export interface LeadCreateRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | undefined;
  company_name?: string | undefined;
  service_address_line1: string;
  service_address_line2?: string | undefined;
  service_city: string;
  service_state_province: string;
  service_postal_code: string;
  service_country?: string | undefined;
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
  expected_close_date?: string;
  metadata?: Record<string, unknown>;
  notes?: string;
}

export interface QuoteCreateRequest {
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

export interface SiteSurveyScheduleRequest {
  lead_id: string;
  scheduled_date: string;
  technician_id?: string;
  notes?: string;
}

export interface SiteSurveyCompleteRequest {
  serviceability: Serviceability;
  nearest_fiber_distance_meters?: number;
  requires_fiber_extension?: boolean;
  fiber_extension_cost?: number;
  nearest_olt_id?: string;
  available_pon_ports?: number;
  estimated_installation_time_hours?: number;
  special_equipment_required?: string[];
  installation_complexity?: "simple" | "moderate" | "complex";
  photos?: Array<{
    url: string;
    description?: string;
    timestamp: string;
  }>;
  recommendations?: string;
  obstacles?: string;
  notes?: string;
}

// ============================================================================
// Query Key Factory
// ============================================================================

const crmBase = ["crm"] as const;

export const crmKeys = {
  all: crmBase,
  leads: {
    all: [...crmBase, "leads"] as const,
    lists: () => [...crmBase, "leads", "list"] as const,
    list: (filters?: UseLeadsOptions) => [...crmBase, "leads", "list", filters] as const,
    details: () => [...crmBase, "leads", "detail"] as const,
    detail: (id: string) => [...crmBase, "leads", "detail", id] as const,
  },
  quotes: {
    all: [...crmBase, "quotes"] as const,
    lists: () => [...crmBase, "quotes", "list"] as const,
    list: (filters?: UseQuotesOptions) => [...crmBase, "quotes", "list", filters] as const,
    details: () => [...crmBase, "quotes", "detail"] as const,
    detail: (id: string) => [...crmBase, "quotes", "detail", id] as const,
  },
  surveys: {
    all: [...crmBase, "site-surveys"] as const,
    lists: () => [...crmBase, "site-surveys", "list"] as const,
    list: (filters?: UseSiteSurveysOptions) =>
      [...crmBase, "site-surveys", "list", filters] as const,
    details: () => [...crmBase, "site-surveys", "detail"] as const,
    detail: (id: string) => [...crmBase, "site-surveys", "detail", id] as const,
  },
};

// ============================================================================
// API Functions
// ============================================================================

const leadApi = {
  fetchLeads: async (options: UseLeadsOptions = {}): Promise<Lead[]> => {
    const params = new URLSearchParams();
    if (options.status) params.append("status", options.status);
    if (options.source) params.append("source", options.source);
    if (options.assignedToId) params.append("assigned_to_id", options.assignedToId);
    if (options.partnerId) params.append("partner_id", options.partnerId);

    const response = await apiClient.get<Lead[]>(
      `/crm/leads${params.toString() ? `?${params.toString()}` : ""}`,
    );
    return response.data || [];
  },

  createLead: async (data: LeadCreateRequest): Promise<Lead> => {
    const response = await apiClient.post<Lead>("/crm/leads", data);
    return response.data!;
  },

  updateLead: async (id: string, data: LeadUpdateRequest): Promise<Lead> => {
    const response = await apiClient.patch<Lead>(`/crm/leads/${id}`, data);
    return response.data!;
  },

  updateLeadStatus: async (id: string, status: LeadStatus): Promise<void> => {
    await apiClient.patch(`/crm/leads/${id}/status`, { status });
  },

  qualifyLead: async (id: string): Promise<void> => {
    await apiClient.post(`/crm/leads/${id}/qualify`, {});
  },

  disqualifyLead: async (id: string, reason: string): Promise<void> => {
    await apiClient.post(`/crm/leads/${id}/disqualify`, { reason });
  },

  assignLead: async (id: string, userId: string): Promise<void> => {
    await apiClient.post(`/crm/leads/${id}/assign`, { user_id: userId });
  },

  updateServiceability: async (
    id: string,
    serviceability: Serviceability,
    notes?: string,
  ): Promise<void> => {
    await apiClient.patch(`/crm/leads/${id}/serviceability`, {
      serviceability,
      notes,
    });
  },

  convertToCustomer: async (id: string, conversionData?: Record<string, unknown>): Promise<unknown> => {
    const response = await apiClient.post(
      `/crm/leads/${id}/convert-to-customer`,
      conversionData || {},
    );
    return response.data;
  },
};

// ============================================================================
// Hook 1: useLeads()
// ============================================================================

export interface UseLeadsOptions {
  status?: LeadStatus;
  source?: LeadSource;
  assignedToId?: string;
  partnerId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

/**
 * Fetch leads with optional filters
 */
export function useLeads(options: UseLeadsOptions = {}) {
  return useQuery({
    queryKey: crmKeys.leads.list(options),
    queryFn: () => leadApi.fetchLeads(options),
    staleTime: 60000, // 1 minute
    refetchInterval: options.autoRefresh ? options.refreshInterval || 60000 : false,
  });
}

/**
 * Create a new lead with optimistic update
 */
export function useCreateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: leadApi.createLead,
    onMutate: async (newLead) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });

      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      const optimisticLead = {
        id: `temp-${Date.now()}`,
        tenant_id: "",
        lead_number: `TEMP-${Date.now()}`,
        status: "new" as LeadStatus,
        priority: newLead.priority || 2,
        interested_service_types: newLead.interested_service_types || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newLead,
      } as Lead;

      optimisticHelpers.addToList(queryClient, crmKeys.leads.lists(), optimisticLead, {
        position: "start",
      });

      logger.info("Creating lead optimistically", { lead: optimisticLead });

      return { previousLeads, optimisticLead };
    },
    onError: (error, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to create lead", error);
    },
    onSuccess: (data, variables, context) => {
      if (context?.optimisticLead) {
        optimisticHelpers.updateInList(
          queryClient,
          crmKeys.leads.lists(),
          context.optimisticLead.id,
          data,
        );
      }
      logger.info("Lead created successfully", { lead: data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

/**
 * Update a lead with optimistic update
 */
export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...data }: LeadUpdateRequest & { id: string }) =>
      leadApi.updateLead(id, data),
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });

      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, updates);

      logger.info("Updating lead optimistically", { id, updates });

      return { previousLeads, id };
    },
    onError: (error, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to update lead", error);
    },
    onSuccess: (data) => {
      logger.info("Lead updated successfully", { lead: data });
    },
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

/**
 * Update lead status with optimistic update
 */
export function useUpdateLeadStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: LeadStatus }) =>
      leadApi.updateLeadStatus(id, status),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });

      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, { status });

      logger.info("Updating lead status optimistically", { id, status });

      return { previousLeads };
    },
    onError: (error, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to update lead status", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

/**
 * Qualify a lead with optimistic update
 */
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

      logger.info("Qualifying lead optimistically", { id });

      return { previousLeads };
    },
    onError: (error, id, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to qualify lead", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

/**
 * Disqualify a lead with optimistic update
 */
export function useDisqualifyLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      leadApi.disqualifyLead(id, reason),
    onMutate: async ({ id, reason }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });

      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, {
        status: "disqualified" as LeadStatus,
        disqualified_at: new Date().toISOString(),
        disqualification_reason: reason,
      });

      logger.info("Disqualifying lead optimistically", { id, reason });

      return { previousLeads };
    },
    onError: (error, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to disqualify lead", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

/**
 * Assign a lead with optimistic update
 */
export function useAssignLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) => leadApi.assignLead(id, userId),
    onMutate: async ({ id, userId }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });

      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, {
        assigned_to_id: userId,
      });

      logger.info("Assigning lead optimistically", { id, userId });

      return { previousLeads };
    },
    onError: (error, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to assign lead", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

/**
 * Update lead serviceability with optimistic update
 */
export function useUpdateServiceability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      serviceability,
      notes,
    }: {
      id: string;
      serviceability: Serviceability;
      notes?: string;
    }) => leadApi.updateServiceability(id, serviceability, notes),
    onMutate: async ({ id, serviceability, notes }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });

      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, {
        is_serviceable: serviceability,
        serviceability_checked_at: new Date().toISOString(),
        serviceability_notes: notes || undefined,
      });

      logger.info("Updating serviceability optimistically", { id, serviceability });

      return { previousLeads };
    },
    onError: (error, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to update serviceability", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

/**
 * Convert lead to customer with optimistic update
 */
export function useConvertToCustomer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, conversionData }: { id: string; conversionData?: Record<string, unknown> }) =>
      leadApi.convertToCustomer(id, conversionData),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.leads.lists() });

      const previousLeads = queryClient.getQueryData(crmKeys.leads.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.leads.lists(), id, {
        status: "won" as LeadStatus,
        converted_at: new Date().toISOString(),
      });

      logger.info("Converting lead to customer optimistically", { id });

      return { previousLeads };
    },
    onError: (error, variables, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(crmKeys.leads.lists(), context.previousLeads);
      }
      logger.error("Failed to convert lead to customer", error);
    },
    onSuccess: (data) => {
      logger.info("Lead converted to customer successfully", { data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.leads.lists() });
    },
  });
}

const quoteApi = {
  fetchQuotes: async (options: UseQuotesOptions = {}): Promise<Quote[]> => {
    const params = new URLSearchParams();
    if (options.leadId) params.append("lead_id", options.leadId);
    if (options.status) params.append("status", options.status);

    const response = await apiClient.get<Quote[]>(
      `/crm/quotes${params.toString() ? `?${params.toString()}` : ""}`,
    );
    return response.data || [];
  },

  createQuote: async (data: QuoteCreateRequest): Promise<Quote> => {
    const response = await apiClient.post<Quote>("/crm/quotes", data);
    return response.data!;
  },

  sendQuote: async (id: string): Promise<void> => {
    await apiClient.post(`/crm/quotes/${id}/send`, {});
  },

  acceptQuote: async (id: string, signatureData?: Record<string, unknown>): Promise<void> => {
    await apiClient.post(`/crm/quotes/${id}/accept`, { signature_data: signatureData });
  },

  rejectQuote: async (id: string, reason: string): Promise<void> => {
    await apiClient.post(`/crm/quotes/${id}/reject`, { reason });
  },

  deleteQuote: async (id: string): Promise<void> => {
    await apiClient.delete(`/crm/quotes/${id}`);
  },
};

// ============================================================================
// Hook 2: useQuotes()
// ============================================================================

export interface UseQuotesOptions {
  leadId?: string;
  status?: QuoteStatus;
}

/**
 * Fetch quotes with optional filters
 */
export function useQuotes(options: UseQuotesOptions = {}) {
  return useQuery({
    queryKey: crmKeys.quotes.list(options),
    queryFn: () => quoteApi.fetchQuotes(options),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Create a new quote with optimistic update
 */
export function useCreateQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: quoteApi.createQuote,
    onMutate: async (newQuote) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });

      const previousQuotes = queryClient.getQueryData(crmKeys.quotes.lists());

      const optimisticQuote = {
        id: `temp-${Date.now()}`,
        tenant_id: "",
        quote_number: `TEMP-${Date.now()}`,
        status: "draft" as QuoteStatus,
        total_upfront_cost:
          (newQuote.installation_fee || 0) +
          (newQuote.equipment_fee || 0) +
          (newQuote.activation_fee || 0),
        contract_term_months: newQuote.contract_term_months || 12,
        line_items: newQuote.line_items || [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newQuote,
      } as Quote;

      optimisticHelpers.addToList(queryClient, crmKeys.quotes.lists(), optimisticQuote, {
        position: "start",
      });

      logger.info("Creating quote optimistically", { quote: optimisticQuote });

      return { previousQuotes, optimisticQuote };
    },
    onError: (error, variables, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
      logger.error("Failed to create quote", error);
    },
    onSuccess: (data, variables, context) => {
      if (context?.optimisticQuote) {
        optimisticHelpers.updateInList(
          queryClient,
          crmKeys.quotes.lists(),
          context.optimisticQuote.id,
          data,
        );
      }
      logger.info("Quote created successfully", { quote: data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

/**
 * Send a quote with optimistic update
 */
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

      logger.info("Sending quote optimistically", { id });

      return { previousQuotes };
    },
    onError: (error, id, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
      logger.error("Failed to send quote", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

/**
 * Accept a quote with optimistic update
 */
export function useAcceptQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, signatureData }: { id: string; signatureData?: Record<string, unknown> }) =>
      quoteApi.acceptQuote(id, signatureData),
    onMutate: async ({ id, signatureData }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });

      const previousQuotes = queryClient.getQueryData(crmKeys.quotes.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.quotes.lists(), id, {
        status: "accepted" as QuoteStatus,
        accepted_at: new Date().toISOString(),
        signature_data: signatureData || undefined,
      });

      logger.info("Accepting quote optimistically", { id });

      return { previousQuotes };
    },
    onError: (error, variables, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
      logger.error("Failed to accept quote", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

/**
 * Reject a quote with optimistic update
 */
export function useRejectQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => quoteApi.rejectQuote(id, reason),
    onMutate: async ({ id, reason }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });

      const previousQuotes = queryClient.getQueryData(crmKeys.quotes.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.quotes.lists(), id, {
        status: "rejected" as QuoteStatus,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      });

      logger.info("Rejecting quote optimistically", { id, reason });

      return { previousQuotes };
    },
    onError: (error, variables, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
      logger.error("Failed to reject quote", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

/**
 * Delete a quote with optimistic update
 */
export function useDeleteQuote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => quoteApi.deleteQuote(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.quotes.lists() });

      const previousQuotes = queryClient.getQueryData(crmKeys.quotes.lists());

      optimisticHelpers.removeFromList(queryClient, crmKeys.quotes.lists(), id);

      logger.info("Deleting quote optimistically", { id });

      return { previousQuotes };
    },
    onError: (error, id, context) => {
      if (context?.previousQuotes) {
        queryClient.setQueryData(crmKeys.quotes.lists(), context.previousQuotes);
      }
      logger.error("Failed to delete quote", error);
    },
    onSuccess: (data, id) => {
      queryClient.removeQueries({ queryKey: crmKeys.quotes.detail(id) });
      logger.info("Quote deleted successfully", { id });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.quotes.lists() });
    },
  });
}

const siteSurveyApi = {
  fetchSurveys: async (options: UseSiteSurveysOptions = {}): Promise<SiteSurvey[]> => {
    const params = new URLSearchParams();
    if (options.leadId) params.append("lead_id", options.leadId);
    if (options.status) params.append("status", options.status);
    if (options.technicianId) params.append("technician_id", options.technicianId);

    const response = await apiClient.get<SiteSurvey[]>(
      `/crm/site-surveys${params.toString() ? `?${params.toString()}` : ""}`,
    );
    return response.data || [];
  },

  scheduleSurvey: async (data: SiteSurveyScheduleRequest): Promise<SiteSurvey> => {
    const response = await apiClient.post<SiteSurvey>("/crm/site-surveys", data);
    return response.data!;
  },

  startSurvey: async (id: string): Promise<void> => {
    await apiClient.post(`/crm/site-surveys/${id}/start`, {});
  },

  completeSurvey: async (id: string, data: SiteSurveyCompleteRequest): Promise<void> => {
    await apiClient.post(`/crm/site-surveys/${id}/complete`, data);
  },

  cancelSurvey: async (id: string, reason?: string): Promise<void> => {
    await apiClient.post(`/crm/site-surveys/${id}/cancel`, { reason });
  },
};

// ============================================================================
// Hook 3: useSiteSurveys()
// ============================================================================

export interface UseSiteSurveysOptions {
  leadId?: string;
  status?: SiteSurveyStatus;
  technicianId?: string;
}

/**
 * Fetch site surveys with optional filters
 */
export function useSiteSurveys(options: UseSiteSurveysOptions = {}) {
  return useQuery({
    queryKey: crmKeys.surveys.list(options),
    queryFn: () => siteSurveyApi.fetchSurveys(options),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Schedule a new site survey with optimistic update
 */
export function useScheduleSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: siteSurveyApi.scheduleSurvey,
    onMutate: async (newSurvey) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.surveys.lists() });

      const previousSurveys = queryClient.getQueryData(crmKeys.surveys.lists());

      const optimisticSurvey = {
        id: `temp-${Date.now()}`,
        tenant_id: "",
        survey_number: `TEMP-${Date.now()}`,
        status: "scheduled" as SiteSurveyStatus,
        requires_fiber_extension: false,
        special_equipment_required: [],
        photos: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...newSurvey,
      } as SiteSurvey;

      optimisticHelpers.addToList(queryClient, crmKeys.surveys.lists(), optimisticSurvey, {
        position: "start",
      });

      logger.info("Scheduling survey optimistically", { survey: optimisticSurvey });

      return { previousSurveys, optimisticSurvey };
    },
    onError: (error, variables, context) => {
      if (context?.previousSurveys) {
        queryClient.setQueryData(crmKeys.surveys.lists(), context.previousSurveys);
      }
      logger.error("Failed to schedule survey", error);
    },
    onSuccess: (data, variables, context) => {
      if (context?.optimisticSurvey) {
        optimisticHelpers.updateInList(
          queryClient,
          crmKeys.surveys.lists(),
          context.optimisticSurvey.id,
          data,
        );
      }
      logger.info("Survey scheduled successfully", { survey: data });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.surveys.lists() });
    },
  });
}

/**
 * Start a site survey with optimistic update
 */
export function useStartSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => siteSurveyApi.startSurvey(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.surveys.lists() });

      const previousSurveys = queryClient.getQueryData(crmKeys.surveys.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.surveys.lists(), id, {
        status: "in_progress" as SiteSurveyStatus,
      });

      logger.info("Starting survey optimistically", { id });

      return { previousSurveys };
    },
    onError: (error, id, context) => {
      if (context?.previousSurveys) {
        queryClient.setQueryData(crmKeys.surveys.lists(), context.previousSurveys);
      }
      logger.error("Failed to start survey", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.surveys.lists() });
    },
  });
}

/**
 * Complete a site survey with optimistic update
 */
export function useCompleteSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: SiteSurveyCompleteRequest }) =>
      siteSurveyApi.completeSurvey(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.surveys.lists() });

      const previousSurveys = queryClient.getQueryData(crmKeys.surveys.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.surveys.lists(), id, {
        status: "completed" as SiteSurveyStatus,
        completed_date: new Date().toISOString(),
        ...data,
      });

      logger.info("Completing survey optimistically", { id, data });

      return { previousSurveys };
    },
    onError: (error, variables, context) => {
      if (context?.previousSurveys) {
        queryClient.setQueryData(crmKeys.surveys.lists(), context.previousSurveys);
      }
      logger.error("Failed to complete survey", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.surveys.lists() });
    },
  });
}

/**
 * Cancel a site survey with optimistic update
 */
export function useCancelSurvey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      siteSurveyApi.cancelSurvey(id, reason),
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: crmKeys.surveys.lists() });

      const previousSurveys = queryClient.getQueryData(crmKeys.surveys.lists());

      optimisticHelpers.updateInList(queryClient, crmKeys.surveys.lists(), id, {
        status: "canceled" as SiteSurveyStatus,
      });

      logger.info("Canceling survey optimistically", { id });

      return { previousSurveys };
    },
    onError: (error, variables, context) => {
      if (context?.previousSurveys) {
        queryClient.setQueryData(crmKeys.surveys.lists(), context.previousSurveys);
      }
      logger.error("Failed to cancel survey", error);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: crmKeys.surveys.lists() });
    },
  });
}
