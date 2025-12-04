/**
 * CRM Custom Hooks
 *
 * React hooks for managing leads, quotes, and site surveys in the CRM system.
 * Provides data fetching, mutations, and state management for the sales pipeline.
 */

import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/api/client";

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
  metadata?: Record<string, any>;
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
  signature_data?: Record<string, any>;

  // Line Items
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;

  // Metadata
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
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
  metadata?: Record<string, any>;
  notes?: string;
}

export interface QuoteCreateRequest {
  lead_id: string;
  service_plan_name: string;
  bandwidth: string;
  monthly_recurring_charge: number;
  installation_fee?: number | undefined;
  equipment_fee?: number | undefined;
  activation_fee?: number | undefined;
  contract_term_months?: number | undefined;
  early_termination_fee?: number | undefined;
  promo_discount_months?: number | undefined;
  promo_monthly_discount?: number | undefined;
  valid_until: string;
  line_items?:
    | Array<{
        description: string;
        quantity: number;
        unit_price: number;
        total: number;
      }>
    | undefined;
  metadata?: Record<string, any> | undefined;
  notes?: string | undefined;
}

export interface SiteSurveyScheduleRequest {
  lead_id: string;
  scheduled_date: string;
  technician_id?: string | undefined;
  notes?: string | undefined;
}

export interface SiteSurveyCompleteRequest {
  serviceability: Serviceability;
  nearest_fiber_distance_meters?: number | undefined;
  requires_fiber_extension?: boolean | undefined;
  fiber_extension_cost?: number | undefined;
  nearest_olt_id?: string | undefined;
  available_pon_ports?: number | undefined;
  estimated_installation_time_hours?: number | undefined;
  special_equipment_required?: string[] | undefined;
  installation_complexity?: "simple" | "moderate" | "complex" | undefined;
  photos?:
    | Array<{
        url: string;
        description?: string | undefined;
        timestamp: string;
      }>
    | undefined;
  recommendations?: string | undefined;
  obstacles?: string | undefined;
  notes?: string | undefined;
}

// ============================================================================
// Hook 1: useLeads()
// ============================================================================

export interface UseLeadsOptions {
  status?: LeadStatus | undefined;
  source?: LeadSource | undefined;
  assignedToId?: string | undefined;
  partnerId?: string | undefined;
  autoRefresh?: boolean | undefined;
  refreshInterval?: number | undefined;
}

export function useLeads(options: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLeads = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.status) params.append("status", options.status);
      if (options.source) params.append("source", options.source);
      if (options.assignedToId) params.append("assigned_to_id", options.assignedToId);
      if (options.partnerId) params.append("partner_id", options.partnerId);

      const response = await apiClient.get<Lead[]>(
        `/crm/leads${params.toString() ? `?${params.toString()}` : ""}`,
      );

      if (response.data) {
        setLeads(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch leads"));
    } finally {
      setIsLoading(false);
    }
  }, [options.status, options.source, options.assignedToId, options.partnerId]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Auto-refresh
  useEffect(() => {
    if (options.autoRefresh) {
      const interval = setInterval(fetchLeads, options.refreshInterval || 60000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [options.autoRefresh, options.refreshInterval, fetchLeads]);

  const createLead = useCallback(async (data: LeadCreateRequest): Promise<Lead | null> => {
    try {
      const response = await apiClient.post<Lead>("/crm/leads", data);
      if (response.data) {
        setLeads((prev) => [response.data, ...prev]);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error("Failed to create lead:", err);
      throw err;
    }
  }, []);

  const updateLead = useCallback(
    async (id: string, data: LeadUpdateRequest): Promise<Lead | null> => {
      try {
        const response = await apiClient.patch<Lead>(`/crm/leads/${id}`, data);
        if (response.data) {
          setLeads((prev) => prev.map((l) => (l.id === id ? response.data : l)));
          return response.data;
        }
        return null;
      } catch (err) {
        console.error("Failed to update lead:", err);
        throw err;
      }
    },
    [],
  );

  const updateLeadStatus = useCallback(async (id: string, status: LeadStatus): Promise<boolean> => {
    try {
      await apiClient.patch(`/crm/leads/${id}/status`, { status });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
      return true;
    } catch (err) {
      console.error("Failed to update lead status:", err);
      return false;
    }
  }, []);

  const qualifyLead = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiClient.post(`/crm/leads/${id}/qualify`, {});
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                status: "qualified" as LeadStatus,
                qualified_at: new Date().toISOString(),
              }
            : l,
        ),
      );
      return true;
    } catch (err) {
      console.error("Failed to qualify lead:", err);
      return false;
    }
  }, []);

  const disqualifyLead = useCallback(async (id: string, reason: string): Promise<boolean> => {
    try {
      await apiClient.post(`/crm/leads/${id}/disqualify`, { reason });
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                status: "disqualified" as LeadStatus,
                disqualified_at: new Date().toISOString(),
                disqualification_reason: reason,
              }
            : l,
        ),
      );
      return true;
    } catch (err) {
      console.error("Failed to disqualify lead:", err);
      return false;
    }
  }, []);

  const assignLead = useCallback(async (id: string, userId: string): Promise<boolean> => {
    try {
      await apiClient.post(`/crm/leads/${id}/assign`, { user_id: userId });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, assigned_to_id: userId } : l)));
      return true;
    } catch (err) {
      console.error("Failed to assign lead:", err);
      return false;
    }
  }, []);

  const updateServiceability = useCallback(
    async (id: string, serviceability: Serviceability, notes?: string): Promise<boolean> => {
      try {
        await apiClient.patch(`/crm/leads/${id}/serviceability`, {
          serviceability,
          notes,
        });
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id
              ? ({
                  ...l,
                  is_serviceable: serviceability,
                  serviceability_checked_at: new Date().toISOString(),
                  serviceability_notes: notes || undefined,
                } as Lead)
              : l,
          ),
        );
        return true;
      } catch (err) {
        console.error("Failed to update serviceability:", err);
        return false;
      }
    },
    [],
  );

  const convertToCustomer = useCallback(
    async (id: string, conversionData?: Record<string, any>): Promise<any> => {
      try {
        const response = await apiClient.post(
          `/crm/leads/${id}/convert-to-customer`,
          conversionData || {},
        );
        if (response.data) {
          // Update lead status to 'won'
          setLeads((prev) =>
            prev.map((l) =>
              l.id === id
                ? {
                    ...l,
                    status: "won" as LeadStatus,
                    converted_at: response.data.converted_at || new Date().toISOString(),
                    converted_to_customer_id: response.data.converted_to_customer_id,
                  }
                : l,
            ),
          );
          return response.data;
        }
        return null;
      } catch (err) {
        console.error("Failed to convert lead to customer:", err);
        throw err;
      }
    },
    [],
  );

  return {
    leads,
    isLoading,
    error,
    refetch: fetchLeads,
    createLead,
    updateLead,
    updateLeadStatus,
    qualifyLead,
    disqualifyLead,
    assignLead,
    updateServiceability,
    convertToCustomer,
  };
}

// ============================================================================
// Hook 2: useQuotes()
// ============================================================================

export interface UseQuotesOptions {
  leadId?: string | undefined;
  status?: QuoteStatus | undefined;
}

export function useQuotes(options: UseQuotesOptions = {}) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchQuotes = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.leadId) params.append("lead_id", options.leadId);
      if (options.status) params.append("status", options.status);

      const response = await apiClient.get<Quote[]>(
        `/crm/quotes${params.toString() ? `?${params.toString()}` : ""}`,
      );

      if (response.data) {
        setQuotes(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch quotes"));
    } finally {
      setIsLoading(false);
    }
  }, [options.leadId, options.status]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const createQuote = useCallback(async (data: QuoteCreateRequest): Promise<Quote | null> => {
    try {
      const response = await apiClient.post<Quote>("/crm/quotes", data);
      if (response.data) {
        setQuotes((prev) => [response.data, ...prev]);
        return response.data;
      }
      return null;
    } catch (err) {
      console.error("Failed to create quote:", err);
      throw err;
    }
  }, []);

  const sendQuote = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiClient.post(`/crm/quotes/${id}/send`, {});
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                status: "sent" as QuoteStatus,
                sent_at: new Date().toISOString(),
              }
            : q,
        ),
      );
      return true;
    } catch (err) {
      console.error("Failed to send quote:", err);
      return false;
    }
  }, []);

  const acceptQuote = useCallback(
    async (id: string, signatureData?: Record<string, any>): Promise<boolean> => {
      try {
        await apiClient.post(`/crm/quotes/${id}/accept`, {
          signature_data: signatureData,
        });
        setQuotes((prev) =>
          prev.map((q) =>
            q.id === id
              ? ({
                  ...q,
                  status: "accepted" as QuoteStatus,
                  accepted_at: new Date().toISOString(),
                  signature_data: signatureData || undefined,
                } as Quote)
              : q,
          ),
        );
        return true;
      } catch (err) {
        console.error("Failed to accept quote:", err);
        return false;
      }
    },
    [],
  );

  const rejectQuote = useCallback(async (id: string, reason: string): Promise<boolean> => {
    try {
      await apiClient.post(`/crm/quotes/${id}/reject`, { reason });
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === id
            ? {
                ...q,
                status: "rejected" as QuoteStatus,
                rejected_at: new Date().toISOString(),
                rejection_reason: reason,
              }
            : q,
        ),
      );
      return true;
    } catch (err) {
      console.error("Failed to reject quote:", err);
      return false;
    }
  }, []);

  const deleteQuote = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiClient.delete(`/crm/quotes/${id}`);
      setQuotes((prev) => prev.filter((q) => q.id !== id));
      return true;
    } catch (err) {
      console.error("Failed to delete quote:", err);
      return false;
    }
  }, []);

  return {
    quotes,
    isLoading,
    error,
    refetch: fetchQuotes,
    createQuote,
    sendQuote,
    acceptQuote,
    rejectQuote,
    deleteQuote,
  };
}

// ============================================================================
// Hook 3: useSiteSurveys()
// ============================================================================

export interface UseSiteSurveysOptions {
  leadId?: string;
  status?: SiteSurveyStatus;
  technicianId?: string;
}

export function useSiteSurveys(options: UseSiteSurveysOptions = {}) {
  const [surveys, setSurveys] = useState<SiteSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSurveys = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (options.leadId) params.append("lead_id", options.leadId);
      if (options.status) params.append("status", options.status);
      if (options.technicianId) params.append("technician_id", options.technicianId);

      const response = await apiClient.get<SiteSurvey[]>(
        `/crm/site-surveys${params.toString() ? `?${params.toString()}` : ""}`,
      );

      if (response.data) {
        setSurveys(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to fetch site surveys"));
    } finally {
      setIsLoading(false);
    }
  }, [options.leadId, options.status, options.technicianId]);

  useEffect(() => {
    fetchSurveys();
  }, [fetchSurveys]);

  const scheduleSurvey = useCallback(
    async (data: SiteSurveyScheduleRequest): Promise<SiteSurvey | null> => {
      try {
        const response = await apiClient.post<SiteSurvey>("/crm/site-surveys", data);
        if (response.data) {
          setSurveys((prev) => [response.data, ...prev]);
          return response.data;
        }
        return null;
      } catch (err) {
        console.error("Failed to schedule survey:", err);
        throw err;
      }
    },
    [],
  );

  const startSurvey = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiClient.post(`/crm/site-surveys/${id}/start`, {});
      setSurveys((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "in_progress" as SiteSurveyStatus } : s)),
      );
      return true;
    } catch (err) {
      console.error("Failed to start survey:", err);
      return false;
    }
  }, []);

  const completeSurvey = useCallback(
    async (id: string, data: SiteSurveyCompleteRequest): Promise<boolean> => {
      try {
        await apiClient.post(`/crm/site-surveys/${id}/complete`, data);
        setSurveys((prev) =>
          prev.map((s) =>
            s.id === id
              ? ({
                  ...s,
                  status: "completed" as SiteSurveyStatus,
                  completed_date: new Date().toISOString(),
                  ...data,
                } as SiteSurvey)
              : s,
          ),
        );
        return true;
      } catch (err) {
        console.error("Failed to complete survey:", err);
        return false;
      }
    },
    [],
  );

  const cancelSurvey = useCallback(async (id: string, reason?: string): Promise<boolean> => {
    try {
      await apiClient.post(`/crm/site-surveys/${id}/cancel`, { reason });
      setSurveys((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: "canceled" as SiteSurveyStatus } : s)),
      );
      return true;
    } catch (err) {
      console.error("Failed to cancel survey:", err);
      return false;
    }
  }, []);

  return {
    surveys,
    isLoading,
    error,
    refetch: fetchSurveys,
    scheduleSurvey,
    startSurvey,
    completeSurvey,
    cancelSurvey,
  };
}
