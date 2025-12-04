/**
 * MSW Handlers for Partner Portal API
 * Mocks partner portal dashboard, profile, referrals, commissions, customers, statements, and payouts
 */

import { http, HttpResponse } from "msw";

// In-memory storage
let partnerProfile: any = null;
let dashboardStats: any = null;
let referrals: any[] = [];
let commissions: any[] = [];
let customers: any[] = [];
let statements: any[] = [];
let payouts: any[] = [];
let nextReferralId = 1;
let nextCommissionId = 1;
let nextCustomerId = 1;
let nextStatementId = 1;
let nextPayoutId = 1;

// Factory functions
function createMockPartnerProfile(data: Partial<any> = {}): any {
  const now = new Date().toISOString();

  return {
    id: data.id || "partner-portal-1",
    partner_number: data.partner_number || "PTR-001000",
    company_name: data.company_name || "Portal Partner Company",
    legal_name: data.legal_name || undefined,
    website: data.website || undefined,
    status: data.status || "active",
    tier: data.tier || "gold",
    commission_model: data.commission_model || "revenue_share",
    default_commission_rate: data.default_commission_rate ?? 15,
    primary_email: data.primary_email || "portal@partner.com",
    billing_email: data.billing_email || undefined,
    phone: data.phone || undefined,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
    ...data,
  };
}

function createMockDashboardStats(data: Partial<any> = {}): any {
  return {
    total_customers: data.total_customers ?? 50,
    active_customers: data.active_customers ?? 45,
    total_revenue_generated: data.total_revenue_generated ?? 150000,
    total_commissions_earned: data.total_commissions_earned ?? 15000,
    total_commissions_paid: data.total_commissions_paid ?? 12000,
    pending_commissions: data.pending_commissions ?? 3000,
    total_referrals: data.total_referrals ?? 20,
    converted_referrals: data.converted_referrals ?? 12,
    pending_referrals: data.pending_referrals ?? 8,
    conversion_rate: data.conversion_rate ?? 60,
    current_tier: data.current_tier || "gold",
    commission_model: data.commission_model || "revenue_share",
    default_commission_rate: data.default_commission_rate ?? 15,
    ...data,
  };
}

function createMockReferral(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  const referralId = data.id || `referral-${nextReferralId++}`;

  return {
    id: referralId,
    partner_id: data.partner_id || "partner-portal-1",
    lead_name: data.lead_name || `Lead ${nextReferralId}`,
    lead_email: data.lead_email || `lead${nextReferralId}@example.com`,
    lead_phone: data.lead_phone || undefined,
    company_name: data.company_name || undefined,
    status: data.status || "new",
    estimated_value: data.estimated_value || undefined,
    actual_value: data.actual_value || undefined,
    converted_at: data.converted_at || undefined,
    notes: data.notes || undefined,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
    ...data,
  };
}

function createMockCommission(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  const commissionId = data.id || `commission-${nextCommissionId++}`;

  return {
    id: commissionId,
    partner_id: data.partner_id || "partner-portal-1",
    customer_id: data.customer_id || `customer-${nextCustomerId}`,
    invoice_id: data.invoice_id || undefined,
    amount: data.amount ?? 1000,
    commission_rate: data.commission_rate ?? 15,
    commission_amount:
      data.commission_amount ?? (data.amount || 1000) * ((data.commission_rate || 15) / 100),
    status: data.status || "pending",
    event_date: data.event_date || now,
    payment_date: data.payment_date || undefined,
    notes: data.notes || undefined,
    created_at: data.created_at || now,
    ...data,
  };
}

function createMockCustomer(data: Partial<any> = {}): any {
  const customerId = data.id || `portal-customer-${nextCustomerId++}`;
  const now = new Date().toISOString();

  return {
    id: customerId,
    customer_id: data.customer_id || customerId,
    customer_name: data.customer_name || `Customer ${nextCustomerId}`,
    engagement_type: data.engagement_type || "direct",
    custom_commission_rate: data.custom_commission_rate || undefined,
    total_revenue: data.total_revenue ?? 5000,
    total_commissions: data.total_commissions ?? 500,
    start_date: data.start_date || now,
    end_date: data.end_date || undefined,
    is_active: data.is_active ?? true,
    ...data,
  };
}

function createMockStatement(data: Partial<any> = {}): any {
  const statementId = data.id || `statement-${nextStatementId++}`;
  const now = new Date().toISOString();

  return {
    id: statementId,
    payout_id: data.payout_id || null,
    period_start:
      data.period_start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    period_end: data.period_end || now,
    issued_at: data.issued_at || now,
    revenue_total: data.revenue_total ?? 10000,
    commission_total: data.commission_total ?? 1000,
    adjustments_total: data.adjustments_total ?? 0,
    status: data.status || "pending",
    download_url: data.download_url || null,
    ...data,
  };
}

function createMockPayout(data: Partial<any> = {}): any {
  const payoutId = data.id || `payout-${nextPayoutId++}`;
  const now = new Date().toISOString();

  return {
    id: payoutId,
    partner_id: data.partner_id || "partner-portal-1",
    total_amount: data.total_amount ?? 5000,
    currency: data.currency || "USD",
    commission_count: data.commission_count ?? 10,
    payment_reference: data.payment_reference || null,
    payment_method: data.payment_method || "bank_transfer",
    status: data.status || "completed",
    payout_date: data.payout_date || now,
    completed_at: data.completed_at || now,
    period_start:
      data.period_start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    period_end: data.period_end || now,
    notes: data.notes || null,
    failure_reason: data.failure_reason || null,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
    ...data,
  };
}

// Seed functions
export function seedPartnerPortal(data: {
  profile?: Partial<any>;
  dashboard?: Partial<any>;
  referrals?: Partial<any>[];
  commissions?: Partial<any>[];
  customers?: Partial<any>[];
  statements?: Partial<any>[];
  payouts?: Partial<any>[];
}): void {
  if (data.profile) {
    partnerProfile = createMockPartnerProfile(data.profile);
  }
  if (data.dashboard) {
    dashboardStats = createMockDashboardStats(data.dashboard);
  }
  if (data.referrals) {
    referrals = data.referrals.map(createMockReferral);
  }
  if (data.commissions) {
    commissions = data.commissions.map(createMockCommission);
  }
  if (data.customers) {
    customers = data.customers.map(createMockCustomer);
  }
  if (data.statements) {
    statements = data.statements.map(createMockStatement);
  }
  if (data.payouts) {
    payouts = data.payouts.map(createMockPayout);
  }
}

export function clearPartnerPortalData(): void {
  partnerProfile = null;
  dashboardStats = null;
  referrals = [];
  commissions = [];
  customers = [];
  statements = [];
  payouts = [];
  nextReferralId = 1;
  nextCommissionId = 1;
  nextCustomerId = 1;
  nextStatementId = 1;
  nextPayoutId = 1;
}

// ============================================
// MSW Handlers
// ============================================

export const partnerPortalHandlers = [
// GET /api/isp/v1/partners/portal/dashboard - Get dashboard statistics
http.get("*/api/isp/v1/partners/portal/dashboard", ({ request }) => {
    if (!dashboardStats) {
      dashboardStats = createMockDashboardStats();
    }

    return HttpResponse.json(dashboardStats);
  }),

// GET /api/isp/v1/partners/portal/profile - Get partner profile
http.get("*/api/isp/v1/partners/portal/profile", ({ request }) => {
    if (!partnerProfile) {
      partnerProfile = createMockPartnerProfile();
    }

    return HttpResponse.json(partnerProfile);
  }),

// PATCH /api/isp/v1/partners/portal/profile - Update partner profile
http.patch("*/api/isp/v1/partners/portal/profile", async (req) => {
    const body = await req.json<any>();

    if (!partnerProfile) {
      return HttpResponse.json({ detail: "Profile not found" }, { status: 404 });
    }

    partnerProfile = {
      ...partnerProfile,
      ...body,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(partnerProfile);
  }),

// GET /api/isp/v1/partners/portal/referrals - Get referrals
http.get("*/api/isp/v1/partners/portal/referrals", ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const paginated = referrals.slice(offset, offset + limit);

    return HttpResponse.json(paginated);
  }),

// POST /api/isp/v1/partners/portal/referrals - Submit referral
http.post("*/api/isp/v1/partners/portal/referrals", async (req) => {
    const body = await req.json<any>();

    const newReferral = createMockReferral({
      lead_name: body.lead_name,
      lead_email: body.lead_email,
      lead_phone: body.lead_phone,
      company_name: body.company_name,
      estimated_value: body.estimated_value,
      notes: body.notes,
    });

    referrals.push(newReferral);

    // Update dashboard stats
    if (dashboardStats) {
      dashboardStats.total_referrals += 1;
      dashboardStats.pending_referrals += 1;
    }

    return HttpResponse.json(newReferral);
  }),

// GET /api/isp/v1/partners/portal/commissions - Get commissions
http.get("*/api/isp/v1/partners/portal/commissions", ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const paginated = commissions.slice(offset, offset + limit);

    return HttpResponse.json(paginated);
  }),

// GET /api/isp/v1/partners/portal/customers - Get customers
http.get("*/api/isp/v1/partners/portal/customers", ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const paginated = customers.slice(offset, offset + limit);

    return HttpResponse.json(paginated);
  }),

// GET /api/isp/v1/partners/portal/statements - Get statements
http.get("*/api/isp/v1/partners/portal/statements", ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const paginated = statements.slice(offset, offset + limit);

    return HttpResponse.json(paginated);
  }),

// GET /api/isp/v1/partners/portal/payouts - Get payout history
http.get("*/api/isp/v1/partners/portal/payouts", ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    const paginated = payouts.slice(offset, offset + limit);

    return HttpResponse.json(paginated);
  }),
];
