import type { Lead as AppLead, Quote as AppQuote, SiteSurvey as AppSiteSurvey } from "@/hooks/useCRM";
import type { Lead as SharedLead, Quote as SharedQuote, SiteSurvey as SharedSiteSurvey } from "@dotmac/features/crm";

type SharedSignature = SharedQuote["signature_data"];

const normalizeSignature = (signature?: Record<string, unknown>): SharedSignature | undefined => {
  if (!signature) {
    return undefined;
  }

  const raw = signature as Record<string, unknown>;
  const nameValue = typeof raw["name"] === "string" && raw["name"].trim().length > 0 ? raw["name"].trim() : "";
  const dateValue = typeof raw["date"] === "string" && raw["date"].trim().length > 0 ? raw["date"].trim() : new Date().toISOString();
  const ipAddress = typeof raw["ip_address"] === "string" ? raw["ip_address"] : undefined;

  return {
    name: nameValue,
    date: dateValue,
    ip_address: ipAddress ?? undefined,
  };
};

export const mapQuoteToShared = (quote: AppQuote): SharedQuote => {
  const normalized = normalizeSignature(quote.signature_data as Record<string, unknown> | undefined);

  return {
    ...quote,
    early_termination_fee: quote.early_termination_fee ?? undefined,
    promo_discount_months: quote.promo_discount_months ?? undefined,
    promo_monthly_discount: quote.promo_monthly_discount ?? undefined,
    sent_at: quote.sent_at ?? undefined,
    viewed_at: quote.viewed_at ?? undefined,
    accepted_at: quote.accepted_at ?? undefined,
    rejected_at: quote.rejected_at ?? undefined,
    rejection_reason: quote.rejection_reason ?? undefined,
    metadata: quote.metadata ?? undefined,
    notes: quote.notes ?? undefined,
    signature_data: normalized,
  };
};

export const mapQuotesToShared = (quotes: AppQuote[]): SharedQuote[] => quotes.map(mapQuoteToShared);

export const mapLeadToShared = (lead: AppLead): SharedLead => ({
  ...lead,
  phone: lead.phone ?? "",
  company_name: lead.company_name ?? "",
  service_address_line2: lead.service_address_line2 ?? "",
  service_coordinates: lead.service_coordinates ?? undefined,
  is_serviceable: lead.is_serviceable ?? undefined,
  serviceability_checked_at: lead.serviceability_checked_at ?? undefined,
  serviceability_notes: lead.serviceability_notes ?? undefined,
  desired_bandwidth: lead.desired_bandwidth ?? undefined,
  estimated_monthly_budget: lead.estimated_monthly_budget ?? undefined,
  desired_installation_date: lead.desired_installation_date ?? undefined,
  assigned_to_id: lead.assigned_to_id ?? undefined,
  partner_id: lead.partner_id ?? undefined,
  qualified_at: lead.qualified_at ?? undefined,
  disqualified_at: lead.disqualified_at ?? undefined,
  disqualification_reason: lead.disqualification_reason ?? undefined,
  converted_at: lead.converted_at ?? undefined,
  converted_to_customer_id: lead.converted_to_customer_id ?? undefined,
  first_contact_date: lead.first_contact_date ?? undefined,
  last_contact_date: lead.last_contact_date ?? undefined,
  expected_close_date: lead.expected_close_date ?? undefined,
  metadata: lead.metadata ?? undefined,
  notes: lead.notes ?? undefined,
});

export const mapLeadsToShared = (leads: AppLead[]): SharedLead[] => leads.map(mapLeadToShared);

export const mapSiteSurveyToShared = (survey: AppSiteSurvey): SharedSiteSurvey => ({
  ...survey,
  completed_date: survey.completed_date ?? undefined,
  technician_id: survey.technician_id ?? undefined,
  serviceability: survey.serviceability ?? undefined,
  nearest_fiber_distance_meters: survey.nearest_fiber_distance_meters ?? undefined,
  fiber_extension_cost: survey.fiber_extension_cost ?? undefined,
  nearest_olt_id: survey.nearest_olt_id ?? undefined,
  available_pon_ports: survey.available_pon_ports ?? undefined,
  estimated_installation_time_hours: survey.estimated_installation_time_hours ?? undefined,
  installation_complexity: survey.installation_complexity ?? undefined,
  recommendations: survey.recommendations ?? undefined,
  obstacles: survey.obstacles ?? undefined,
  metadata: survey.metadata ?? undefined,
  notes: survey.notes ?? undefined,
  photos: survey.photos.map((photo) => ({
    url: photo.url,
    description: photo.description ?? undefined,
    timestamp: photo.timestamp,
  })),
});

export const mapSiteSurveysToShared = (surveys: AppSiteSurvey[]): SharedSiteSurvey[] =>
  surveys.map(mapSiteSurveyToShared);
