import type { Lead as AppLead, Quote as AppQuote } from "@/hooks/useCRM";
import type { Lead as SharedLead, Quote as SharedQuote } from "@dotmac/features/crm";

type SharedSignature = SharedQuote["signature_data"];

const normalizeSignature = (signature?: Record<string, unknown>): SharedSignature | undefined => {
  if (!signature) {
    return undefined;
  }

  const raw = signature as Record<string, unknown>;
  const nameValue =
    typeof raw["name"] === "string" && raw["name"].trim().length > 0 ? raw["name"].trim() : "";
  const dateValue =
    typeof raw["date"] === "string" && raw["date"].trim().length > 0
      ? raw["date"].trim()
      : new Date().toISOString();
  const ipAddress = typeof raw["ip_address"] === "string" ? raw["ip_address"] : undefined;

  return {
    name: nameValue,
    date: dateValue,
    ip_address: ipAddress ?? undefined,
  };
};

export const mapQuoteToShared = (quote: AppQuote): SharedQuote => {
  const normalized = normalizeSignature(
    quote.signature_data as Record<string, unknown> | undefined,
  );

  return {
    ...quote,
    installation_fee: quote.installation_fee ?? 0,
    equipment_fee: quote.equipment_fee ?? 0,
    activation_fee: quote.activation_fee ?? 0,
    contract_term_months: quote.contract_term_months ?? 0,
    total_upfront_cost: quote.total_upfront_cost ?? 0,
    line_items: quote.line_items ?? [],
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

export const mapQuotesToShared = (quotes: AppQuote[]): SharedQuote[] =>
  quotes.map(mapQuoteToShared);

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
