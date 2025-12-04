/**
 * Test data factories for customer module
 */

import type {
  Lead,
  Quote,
  SiteSurvey,
  LeadStatus,
  LeadSource,
  QuoteStatus,
  SiteSurveyStatus,
  Serviceability,
} from "../../crm/types";

let leadCounter = 1;
let quoteCounter = 1;
let siteSurveyCounter = 1;
let customerCounter = 1;

/**
 * Create a mock customer with sensible defaults
 */
export const createMockCustomer = (overrides?: Partial<any>) => {
  const id = customerCounter++;
  return {
    id: `cust_${id}`,
    tenant_id: overrides?.tenant_id ?? "tenant_123",
    customer_number: `CUST-${String(id).padStart(5, "0")}`,
    status: overrides?.status ?? "active",

    // Personal Information
    first_name: overrides?.first_name ?? "John",
    last_name: overrides?.last_name ?? "Doe",
    email: overrides?.email ?? `customer${id}@example.com`,
    phone: overrides?.phone ?? `+1555000${String(id).padStart(4, "0")}`,
    company_name: overrides?.company_name,

    // Service Address
    service_address_line1: overrides?.service_address_line1 ?? "123 Main St",
    service_address_line2: overrides?.service_address_line2,
    service_city: overrides?.service_city ?? "Springfield",
    service_state_province: overrides?.service_state_province ?? "IL",
    service_postal_code: overrides?.service_postal_code ?? "62701",
    service_country: overrides?.service_country ?? "US",

    // Billing Address (if different)
    billing_address_line1: overrides?.billing_address_line1,
    billing_address_line2: overrides?.billing_address_line2,
    billing_city: overrides?.billing_city,
    billing_state_province: overrides?.billing_state_province,
    billing_postal_code: overrides?.billing_postal_code,
    billing_country: overrides?.billing_country,

    // Service Details
    service_plan_id: overrides?.service_plan_id ?? "plan_basic",
    service_plan_name: overrides?.service_plan_name ?? "Basic 100Mbps",
    bandwidth_mbps: overrides?.bandwidth_mbps ?? 100,
    monthly_recurring_charge: overrides?.monthly_recurring_charge ?? 49.99,

    // Service Activation
    service_activation_date: overrides?.service_activation_date ?? new Date().toISOString(),
    service_expiration_date: overrides?.service_expiration_date,
    contract_end_date: overrides?.contract_end_date,

    // Account Status
    account_balance: overrides?.account_balance ?? 0,
    last_payment_date: overrides?.last_payment_date,
    last_payment_amount: overrides?.last_payment_amount,

    // Metadata
    notes: overrides?.notes,
    tags: overrides?.tags ?? [],
    custom_fields: overrides?.custom_fields ?? {},

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),

    ...overrides,
  };
};

/**
 * Create a mock lead with sensible defaults
 */
export const createMockLead = (overrides?: Partial<Lead>): Lead => {
  const id = leadCounter++;
  const status: LeadStatus = overrides?.status ?? "new";
  const source: LeadSource = overrides?.source ?? "website";

  return {
    id: `lead_${id}`,
    tenant_id: overrides?.tenant_id ?? "tenant_123",
    lead_number: `LEAD-${String(id).padStart(5, "0")}`,
    status,
    source,
    priority: overrides?.priority ?? 2,

    // Contact
    first_name: overrides?.first_name ?? "Jane",
    last_name: overrides?.last_name ?? "Smith",
    email: overrides?.email ?? `lead${id}@example.com`,
    phone: overrides?.phone ?? `+1555100${String(id).padStart(4, "0")}`,
    company_name: overrides?.company_name,

    // Service Location
    service_address_line1: overrides?.service_address_line1 ?? "456 Oak Ave",
    service_address_line2: overrides?.service_address_line2,
    service_city: overrides?.service_city ?? "Springfield",
    service_state_province: overrides?.service_state_province ?? "IL",
    service_postal_code: overrides?.service_postal_code ?? "62702",
    service_country: overrides?.service_country ?? "US",
    service_coordinates: overrides?.service_coordinates,

    // Serviceability
    is_serviceable: overrides?.is_serviceable,
    serviceability_checked_at: overrides?.serviceability_checked_at,
    serviceability_notes: overrides?.serviceability_notes,

    // Interest
    interested_service_types: overrides?.interested_service_types ?? ["fiber"],
    desired_bandwidth: overrides?.desired_bandwidth ?? "100Mbps",
    estimated_monthly_budget: overrides?.estimated_monthly_budget ?? 50,
    desired_installation_date: overrides?.desired_installation_date,

    // Assignment
    assigned_to_id: overrides?.assigned_to_id,
    partner_id: overrides?.partner_id,

    // Qualification
    qualified_at: overrides?.qualified_at,
    disqualified_at: overrides?.disqualified_at,
    disqualification_reason: overrides?.disqualification_reason,

    // Conversion
    converted_at: overrides?.converted_at,
    converted_to_customer_id: overrides?.converted_to_customer_id,

    // Tracking
    first_contact_date: overrides?.first_contact_date,
    last_contact_date: overrides?.last_contact_date,
    expected_close_date: overrides?.expected_close_date,

    // Metadata
    metadata: overrides?.metadata,
    notes: overrides?.notes,

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

/**
 * Create a qualified lead
 */
export const createQualifiedLead = (overrides?: Partial<Lead>): Lead => {
  return createMockLead({
    status: "qualified",
    is_serviceable: "serviceable",
    qualified_at: new Date().toISOString(),
    ...overrides,
  });
};

/**
 * Create a converted lead
 */
export const createConvertedLead = (overrides?: Partial<Lead>): Lead => {
  return createMockLead({
    status: "won",
    is_serviceable: "serviceable",
    qualified_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    converted_at: new Date().toISOString(),
    converted_to_customer_id: "cust_123",
    ...overrides,
  });
};

/**
 * Create a mock quote
 */
export const createMockQuote = (overrides?: Partial<Quote>): Quote => {
  const id = quoteCounter++;
  const status: QuoteStatus = overrides?.status ?? "draft";

  return {
    id: `quote_${id}`,
    tenant_id: overrides?.tenant_id ?? "tenant_123",
    quote_number: `QUOTE-${String(id).padStart(5, "0")}`,
    status,
    lead_id: overrides?.lead_id ?? "lead_1",

    // Quote Details
    service_plan_name: overrides?.service_plan_name ?? "Premium 500Mbps",
    bandwidth: overrides?.bandwidth ?? "500Mbps",
    monthly_recurring_charge: overrides?.monthly_recurring_charge ?? 79.99,
    installation_fee: overrides?.installation_fee ?? 199.99,
    equipment_fee: overrides?.equipment_fee ?? 99.99,
    activation_fee: overrides?.activation_fee ?? 49.99,
    total_upfront_cost: overrides?.total_upfront_cost ?? 349.97,

    // Contract Terms
    contract_term_months: overrides?.contract_term_months ?? 12,
    early_termination_fee: overrides?.early_termination_fee ?? 200,
    promo_discount_months: overrides?.promo_discount_months,
    promo_monthly_discount: overrides?.promo_monthly_discount,

    // Validity
    valid_until:
      overrides?.valid_until ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),

    // Delivery
    sent_at: overrides?.sent_at,
    viewed_at: overrides?.viewed_at,

    // Acceptance/Rejection
    accepted_at: overrides?.accepted_at,
    rejected_at: overrides?.rejected_at,
    rejection_reason: overrides?.rejection_reason,

    // E-Signature
    signature_data: overrides?.signature_data,

    // Line Items
    line_items: overrides?.line_items ?? [
      {
        description: "Monthly Service - Premium 500Mbps",
        quantity: 1,
        unit_price: 79.99,
        total: 79.99,
      },
      {
        description: "Installation Fee",
        quantity: 1,
        unit_price: 199.99,
        total: 199.99,
      },
    ],

    // Metadata
    metadata: overrides?.metadata,
    notes: overrides?.notes,

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

/**
 * Create an accepted quote
 */
export const createAcceptedQuote = (overrides?: Partial<Quote>): Quote => {
  return createMockQuote({
    status: "accepted",
    sent_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    viewed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    accepted_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    signature_data: {
      name: "Jane Smith",
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      ip_address: "192.168.1.100",
    },
    ...overrides,
  });
};

/**
 * Create a mock site survey
 */
export const createMockSiteSurvey = (overrides?: Partial<SiteSurvey>): SiteSurvey => {
  const id = siteSurveyCounter++;
  const status: SiteSurveyStatus = overrides?.status ?? "scheduled";

  return {
    id: `survey_${id}`,
    tenant_id: overrides?.tenant_id ?? "tenant_123",
    survey_number: `SURVEY-${String(id).padStart(5, "0")}`,
    status,
    lead_id: overrides?.lead_id ?? "lead_1",

    // Scheduling
    scheduled_date:
      overrides?.scheduled_date ?? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    completed_date: overrides?.completed_date,
    technician_id: overrides?.technician_id ?? "tech_1",

    // Technical Assessment
    serviceability: overrides?.serviceability,
    nearest_fiber_distance_meters: overrides?.nearest_fiber_distance_meters,
    requires_fiber_extension: overrides?.requires_fiber_extension ?? false,
    fiber_extension_cost: overrides?.fiber_extension_cost,

    // Network Details
    nearest_olt_id: overrides?.nearest_olt_id,
    available_pon_ports: overrides?.available_pon_ports,

    // Installation Requirements
    estimated_installation_time_hours: overrides?.estimated_installation_time_hours,
    special_equipment_required: overrides?.special_equipment_required ?? [],
    installation_complexity: overrides?.installation_complexity,

    // Site Photos
    photos: overrides?.photos ?? [],

    // Survey Results
    recommendations: overrides?.recommendations,
    obstacles: overrides?.obstacles,

    // Metadata
    metadata: overrides?.metadata,
    notes: overrides?.notes,

    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

/**
 * Create a completed site survey
 */
export const createCompletedSiteSurvey = (overrides?: Partial<SiteSurvey>): SiteSurvey => {
  return createMockSiteSurvey({
    status: "completed",
    scheduled_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    completed_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    serviceability: "serviceable",
    nearest_fiber_distance_meters: 50,
    requires_fiber_extension: false,
    installation_complexity: "simple",
    estimated_installation_time_hours: 2,
    ...overrides,
  });
};

/**
 * Create an active customer (fully onboarded)
 */
export const createActiveCustomer = (overrides?: Partial<any>) => {
  return createMockCustomer({
    status: "active",
    service_activation_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    account_balance: 0,
    last_payment_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    last_payment_amount: 49.99,
    ...overrides,
  });
};

/**
 * Create a suspended customer
 */
export const createSuspendedCustomer = (overrides?: Partial<any>) => {
  return createMockCustomer({
    status: "suspended",
    account_balance: 149.97, // 3 months overdue
    last_payment_date: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
    last_payment_amount: 49.99,
    ...overrides,
  });
};

/**
 * Reset counters (useful between test suites)
 */
export const resetCustomerCounters = () => {
  leadCounter = 1;
  quoteCounter = 1;
  siteSurveyCounter = 1;
  customerCounter = 1;
};
