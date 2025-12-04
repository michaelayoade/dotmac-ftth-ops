/**
 * Shared CRM Types
 *
 * Common types used across CRM features in both apps.
 */

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
  phone: string | undefined;
  company_name: string | undefined;

  // Service Location
  service_address_line1: string;
  service_address_line2: string | undefined;
  service_city: string;
  service_state_province: string;
  service_postal_code: string;
  service_country: string;
  service_coordinates: { lat: number; lon: number } | undefined;

  // Serviceability
  is_serviceable: Serviceability | undefined;
  serviceability_checked_at: string | undefined;
  serviceability_notes: string | undefined;

  // Interest
  interested_service_types: string[];
  desired_bandwidth: string | undefined;
  estimated_monthly_budget: number | undefined;
  desired_installation_date: string | undefined;

  // Assignment
  assigned_to_id: string | undefined;
  partner_id: string | undefined;

  // Qualification
  qualified_at: string | undefined;
  disqualified_at: string | undefined;
  disqualification_reason: string | undefined;

  // Conversion
  converted_at: string | undefined;
  converted_to_customer_id: string | undefined;

  // Tracking
  first_contact_date: string | undefined;
  last_contact_date: string | undefined;
  expected_close_date: string | undefined;

  // Metadata
  metadata: Record<string, any> | undefined;
  notes: string | undefined;

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
  early_termination_fee: number | undefined;
  promo_discount_months: number | undefined;
  promo_monthly_discount: number | undefined;

  // Validity
  valid_until: string;

  // Delivery
  sent_at: string | undefined;
  viewed_at: string | undefined;

  // Acceptance/Rejection
  accepted_at: string | undefined;
  rejected_at: string | undefined;
  rejection_reason: string | undefined;

  // E-Signature
  signature_data:
    | {
        name: string;
        date: string;
        ip_address: string | undefined;
      }
    | undefined;

  // Line Items
  line_items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total: number;
  }>;

  // Metadata
  metadata: Record<string, any> | undefined;
  notes: string | undefined;

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
  completed_date: string | undefined;
  technician_id: string | undefined;

  // Technical Assessment
  serviceability: Serviceability | undefined;
  nearest_fiber_distance_meters: number | undefined;
  requires_fiber_extension: boolean;
  fiber_extension_cost: number | undefined;

  // Network Details
  nearest_olt_id: string | undefined;
  available_pon_ports: number | undefined;

  // Installation Requirements
  estimated_installation_time_hours: number | undefined;
  special_equipment_required: string[];
  installation_complexity: "simple" | "moderate" | "complex" | undefined;

  // Site Photos
  photos: Array<{
    url: string;
    description: string | undefined;
    timestamp: string;
  }>;

  // Survey Results
  recommendations: string | undefined;
  obstacles: string | undefined;

  // Metadata
  metadata: Record<string, any> | undefined;
  notes: string | undefined;

  created_at: string;
  updated_at: string;
}
