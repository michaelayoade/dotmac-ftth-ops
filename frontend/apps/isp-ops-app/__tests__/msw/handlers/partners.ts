/**
 * MSW Handlers for Partners API
 * Mocks partner management and onboarding workflow endpoints
 */

import { http, HttpResponse } from "msw";

// ============================================
// Types
// ============================================

export interface Partner {
  id: string;
  partner_number: string;
  company_name: string;
  legal_name?: string;
  website?: string;
  status: "pending" | "active" | "suspended" | "terminated" | "archived";
  tier: "bronze" | "silver" | "gold" | "platinum" | "direct";
  commission_model: "revenue_share" | "flat_fee" | "tiered" | "hybrid";
  default_commission_rate?: number;
  primary_email: string;
  billing_email?: string;
  phone?: string;
  total_customers: number;
  total_revenue_generated: number;
  total_commissions_earned: number;
  total_commissions_paid: number;
  total_referrals: number;
  converted_referrals: number;
  created_at: string;
  updated_at: string;
}

export interface PartnerListResponse {
  partners: Partner[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================
// In-Memory Storage
// ============================================

let partners: Partner[] = [];
let nextPartnerId = 1;
let nextCustomerId = 1;
let nextLicenseId = 1;
let nextTenantId = 1;
let nextCommissionId = 1;

// ============================================
// Mock Data Generators
// ============================================

export function createMockPartner(overrides: Partial<Partner> = {}): Partner {
  const id = overrides.id || `partner-${nextPartnerId++}`;
  return {
    id,
    partner_number: `PTR-${String(nextPartnerId).padStart(3, "0")}`,
    company_name: "Test Partner Company",
    status: "active",
    tier: "bronze",
    commission_model: "revenue_share",
    primary_email: "partner@example.com",
    total_customers: 0,
    total_revenue_generated: 0,
    total_commissions_earned: 0,
    total_commissions_paid: 0,
    total_referrals: 0,
    converted_referrals: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// Storage Helpers
// ============================================

export function seedPartners(initialPartners: Partner[]): void {
  partners = initialPartners.map((partner, index) => ({
    id: partner.id ?? `partner-${nextPartnerId + index}`,
    ...partner,
  }));
  const maxId = initialPartners.reduce((max, p) => {
    const partnerId = typeof p.id === "string" ? p.id : "";
    const numId = parseInt(partnerId.replace("partner-", ""));
    return isNaN(numId) ? max : Math.max(max, numId);
  }, 0);
  nextPartnerId = maxId + 1;
}

export function clearPartnersData(): void {
  partners = [];
  nextPartnerId = 1;
  nextCustomerId = 1;
  nextLicenseId = 1;
  nextTenantId = 1;
  nextCommissionId = 1;
}

export function getPartners(): Partner[] {
  return [...partners];
}

// ============================================
// MSW Handlers
// ============================================

export const partnersHandlers = [
// GET /api/isp/v1/admin/partners/:id/quota/check - MUST come before /:id route
http.get("*/api/isp/v1/admin/partners/:id/quota/check", ({ request, params }) => {
    const { id } = params;
    const url = new URL(request.url);
    const requestedLicenses = parseInt(url.searchParams.get("requested_licenses") || "0");
    const tenantId = url.searchParams.get("tenant_id");

  console.log("[MSW] GET /api/isp/v1/admin/partners/:id/quota/check", {
      id,
      requestedLicenses,
      tenantId,
    });

    const partner = partners.find((p) => p.id === id);

    if (!partner) {
      return HttpResponse.json({ detail: "Partner not found" }, { status: 404 });
    }

    const quotaAllocated = partner.license_quota || 100;
    const quotaUsed = partner.licenses_allocated || 0;
    const quotaRemaining = quotaAllocated - quotaUsed;
    const canAllocate = requestedLicenses <= quotaRemaining;

    const quotaResult = {
      available: canAllocate,
      quota_remaining: quotaRemaining,
      quota_allocated: quotaAllocated,
      quota_used: quotaUsed,
      requested_licenses: requestedLicenses,
      partner_id: partner.id,
      partner_number: partner.partner_number,
      partner_name: partner.company_name,
      partner_status: partner.status,
      partner_tier: partner.tier,
      can_allocate: canAllocate,
      is_unlimited: false,
      checked_at: new Date().toISOString(),
    };

    console.log("[MSW] Quota check result:", quotaResult);
    return HttpResponse.json(quotaResult);
  }),

// POST /api/isp/v1/admin/partners/onboarding/complete - MUST come before /:id route
http.post("*/api/isp/v1/admin/partners/onboarding/complete", async ({ request, params }) => {
    const onboardingData = await request.json();

  console.log("[MSW] POST /api/isp/v1/admin/partners/onboarding/complete", {
      onboardingData,
    });

    // Create partner
    const newPartner = createMockPartner({
      ...onboardingData.partner_data,
      id: `partner-${nextPartnerId++}`,
    });
    partners.push(newPartner);

    // Create customer
    const customer = {
      customer_id: `cust-${nextCustomerId++}`,
      customer_number: `CUST-${String(nextCustomerId).padStart(3, "0")}`,
      name: `${onboardingData.customer_data.first_name} ${onboardingData.customer_data.last_name}`,
      company_name:
        onboardingData.customer_data.company_name ?? onboardingData.partner_data?.company_name,
      email: onboardingData.customer_data.email,
      phone: onboardingData.customer_data.phone,
      tier: onboardingData.customer_data.tier || "premium",
      partner_id: newPartner.id,
      partner_number: newPartner.partner_number,
      partner_name: newPartner.company_name,
      partner_account_id: `acc-${nextPartnerId}`,
      engagement_type: "managed",
      commission_rate: String(newPartner.default_commission_rate || 15),
      quota_remaining: 49,
      created_at: new Date().toISOString(),
    };

    // Allocate licenses
    const licenses = {
      partner_id: newPartner.id,
      partner_name: newPartner.company_name,
      customer_id: customer.customer_id,
      licenses_allocated: 5,
      license_keys: [`KEY-${nextLicenseId++}`],
      license_ids: [`lic-${nextLicenseId++}`],
      template_id: onboardingData.license_template_id,
      template_name: "Enterprise License",
      product_id: "prod-1",
      quota_before: 50,
      quota_after: 45,
      quota_remaining: 45,
      allocated_at: new Date().toISOString(),
      status: "active",
      engagement_type: "managed",
    };

    // Provision tenant
    const tenantId = nextTenantId++;
    const tenantUrl = onboardingData.white_label_config?.custom_domain
      ? `https://${onboardingData.white_label_config.custom_domain}`
      : `https://tenant${tenantId}.example.com`;

    const tenant = {
      tenant_url: tenantUrl,
      tenant_id: tenantId,
      instance_id: `inst-${tenantId}`,
      deployment_type: onboardingData.deployment_type,
      partner_id: newPartner.id,
      partner_number: newPartner.partner_number,
      partner_name: newPartner.company_name,
      white_label_applied: !!onboardingData.white_label_config,
      white_label_config: onboardingData.white_label_config,
      custom_domain: onboardingData.white_label_config?.custom_domain,
      engagement_type: "managed",
      status: "active",
      allocated_resources: {
        cpu: 4,
        memory_gb: 16,
        storage_gb: 500,
      },
      endpoints: {
        api: onboardingData.white_label_config?.custom_domain
          ? `https://api.${onboardingData.white_label_config.custom_domain}`
          : `https://api.tenant${tenantId}.example.com`,
        web: tenantUrl,
      },
      provisioned_at: new Date().toISOString(),
    };

    const commissionAmount =
      typeof onboardingData.commission?.amount === "number"
        ? onboardingData.commission.amount
        : onboardingData.commission?.amount
          ? parseFloat(onboardingData.commission.amount)
          : 0;

    const commission = {
      commission_id: `comm-${nextCommissionId++}`,
      commission_type: "new_customer",
      amount: commissionAmount.toFixed(2),
      currency: onboardingData.commission?.currency || "USD",
      status: "recorded",
      recorded_at: new Date().toISOString(),
    };

    const onboardingResult = {
      partner: newPartner,
      customer,
      licenses,
      tenant,
      workflow_id: `wf-${Date.now()}`,
      commission,
      status: "completed",
      completed_at: new Date().toISOString(),
    };

    console.log("[MSW] Onboarding completed:", onboardingResult.workflow_id);
    return HttpResponse.json(onboardingResult);
  }),

// GET /api/isp/v1/admin/partners - List partners
http.get("*/api/isp/v1/admin/partners", ({ request, params }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "50");

  console.log("[MSW] GET /api/isp/v1/admin/partners", { status, page, pageSize });

    // Filter by status
    let filtered = [...partners];
    if (status) {
      filtered = filtered.filter((p) => p.status === status);
    }

    // Pagination
    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    const response: PartnerListResponse = {
      partners: paginated,
      total,
      page,
      page_size: pageSize,
    };

    console.log(`[MSW] Returning ${paginated.length}/${total} partners`);
    return HttpResponse.json(response);
  }),

// POST /api/isp/v1/admin/partners - Create partner
http.post("*/api/isp/v1/admin/partners", async ({ request, params }) => {
    const createData = await request.json();

  console.log("[MSW] POST /api/isp/v1/admin/partners", { createData });

    const newPartner = createMockPartner({
      ...createData,
      id: `partner-${nextPartnerId++}`,
      status: "pending",
    });

    partners.push(newPartner);

    console.log("[MSW] Created partner:", newPartner.id);
    return HttpResponse.json(newPartner);
  }),

// GET /api/isp/v1/admin/partners/:id - Get single partner
http.get("*/api/isp/v1/admin/partners/:id", ({ request, params }) => {
    const { id } = params;

  console.log("[MSW] GET /api/isp/v1/admin/partners/:id", { id });

    const partner = partners.find((p) => p.id === id);

    if (!partner) {
      return HttpResponse.json({ detail: "Partner not found" }, { status: 404 });
    }

    return HttpResponse.json(partner);
  }),

// PATCH /api/isp/v1/admin/partners/:id - Update partner
http.patch("*/api/isp/v1/admin/partners/:id", async ({ request, params }) => {
    const { id } = params;
    const updateData = await request.json();

  console.log("[MSW] PATCH /api/isp/v1/admin/partners/:id", { id, updateData });

    const partner = partners.find((p) => p.id === id);

    if (!partner) {
      return HttpResponse.json({ detail: "Partner not found" }, { status: 404 });
    }

    Object.assign(partner, updateData, {
      updated_at: new Date().toISOString(),
    });

    console.log("[MSW] Updated partner:", partner.id);
    return HttpResponse.json(partner);
  }),

// DELETE /api/isp/v1/admin/partners/:id - Delete partner
http.delete("*/api/isp/v1/admin/partners/:id", ({ request, params }) => {
    const { id } = params;

  console.log("[MSW] DELETE /api/isp/v1/admin/partners/:id", { id });

    const index = partners.findIndex((p) => p.id === id);

    if (index === -1) {
      return HttpResponse.json({ detail: "Partner not found" }, { status: 404 });
    }

    partners.splice(index, 1);

    console.log("[MSW] Deleted partner:", id);
    return new HttpResponse(null, { status: 200 });
  }),

// POST /api/isp/v1/admin/partners/:id/customers - Create partner customer
http.post("*/api/isp/v1/admin/partners/:id/customers", async ({ request, params }) => {
    const { id } = params;
    const requestData = await request.json();

  console.log("[MSW] POST /api/isp/v1/admin/partners/:id/customers", {
      id,
      requestData,
    });

    const partner = partners.find((p) => p.id === id);

    if (!partner) {
      return HttpResponse.json({ detail: "Partner not found" }, { status: 404 });
    }

    const customerData = requestData.customer_data;
    const customer = {
      customer_id: `cust-${nextCustomerId++}`,
      customer_number: `CUST-${String(nextCustomerId).padStart(3, "0")}`,
      name: `${customerData.first_name} ${customerData.last_name}`,
      email: customerData.email,
      phone: customerData.phone,
      company_name: customerData.company_name,
      tier: customerData.tier || "premium",
      partner_id: partner.id,
      partner_number: partner.partner_number,
      partner_name: partner.company_name,
      partner_account_id: `acc-${partner.id}`,
      engagement_type: requestData.engagement_type || "managed",
      commission_rate: String(
        requestData.custom_commission_rate || partner.default_commission_rate || 15,
      ),
      quota_remaining: 49,
      status: "active",
      created_at: new Date().toISOString(),
    };

    // Update partner stats
    partner.total_customers += 1;
    partner.updated_at = new Date().toISOString();

    console.log("[MSW] Created customer:", customer.customer_id);
    return HttpResponse.json(customer);
  }),

// POST /api/isp/v1/admin/partners/:id/licenses/allocate - Allocate licenses
http.post("*/api/isp/v1/admin/partners/:id/licenses/allocate", async ({ request, params }) => {
    const { id } = params;
    const allocationData = await request.json();

  console.log("[MSW] POST /api/isp/v1/admin/partners/:id/licenses/allocate", {
      id,
      allocationData,
    });

    const partner = partners.find((p) => p.id === id);

    if (!partner) {
      return HttpResponse.json({ detail: "Partner not found" }, { status: 404 });
    }

    const licenseCount = allocationData.license_count || 1;

    // Check quota
    const quotaAllocated = partner.license_quota || 100;
    const quotaUsed = partner.licenses_allocated || 0;
    const quotaRemaining = quotaAllocated - quotaUsed;

    if (licenseCount > quotaRemaining) {
      return HttpResponse.json({ detail: "Insufficient license quota" }, { status: 400 });
    }
    const licenseKeys = Array.from({ length: licenseCount }, (_, i) => `KEY-${nextLicenseId + i}`);
    const licenseIds = Array.from({ length: licenseCount }, (_, i) => `lic-${nextLicenseId + i}`);
    nextLicenseId += licenseCount;

    const allocationResult = {
      partner_id: partner.id,
      partner_name: partner.company_name,
      customer_id: allocationData.customer_id,
      licenses_allocated: licenseCount,
      license_keys: licenseKeys,
      license_ids: licenseIds,
      template_id: allocationData.license_template_id,
      template_name: "Enterprise License",
      product_id: "prod-1",
      quota_before: 50,
      quota_after: 50 - licenseCount,
      quota_remaining: 50 - licenseCount,
      allocated_at: new Date().toISOString(),
      status: "active",
      engagement_type: "managed",
    };

    console.log("[MSW] Allocated licenses:", licenseCount);
    return HttpResponse.json(allocationResult);
  }),

// POST /api/isp/v1/admin/partners/:id/tenants/provision - Provision tenant
http.post("*/api/isp/v1/admin/partners/:id/tenants/provision", async ({ request, params }) => {
    const { id } = params;
    const provisionData = await request.json();

  console.log("[MSW] POST /api/isp/v1/admin/partners/:id/tenants/provision", {
      id,
      provisionData,
    });

    const partner = partners.find((p) => p.id === id);

    if (!partner) {
      return HttpResponse.json({ detail: "Partner not found" }, { status: 404 });
    }

    const tenantId = provisionData.tenant_id || nextTenantId++;
    const tenantUrl = provisionData.white_label_config?.custom_domain
      ? `https://${provisionData.white_label_config.custom_domain}`
      : `https://tenant${tenantId}.example.com`;

    const tenantResult = {
      tenant_url: tenantUrl,
      tenant_id: tenantId,
      instance_id: `inst-${tenantId}`,
      deployment_type: provisionData.deployment_type,
      partner_id: partner.id,
      partner_number: partner.partner_number,
      partner_name: partner.company_name,
      white_label_applied: !!provisionData.white_label_config,
      white_label_config: provisionData.white_label_config,
      custom_domain: provisionData.white_label_config?.custom_domain,
      engagement_type: "managed",
      status: "active",
      allocated_resources: {
        cpu: 4,
        memory_gb: 16,
        storage_gb: 500,
      },
      endpoints: {
        api: provisionData.white_label_config?.custom_domain
          ? `https://api.${provisionData.white_label_config.custom_domain}`
          : `https://api.tenant${tenantId}.example.com`,
        web: tenantUrl,
      },
      provisioned_at: new Date().toISOString(),
    };

    console.log("[MSW] Provisioned tenant:", tenantId);
    return HttpResponse.json(tenantResult);
  }),

// POST /api/isp/v1/admin/partners/:id/commissions - Record commission
http.post("*/api/isp/v1/admin/partners/:id/commissions", async ({ request, params }) => {
    const { id } = params;
    const commissionData = await request.json();

  console.log("[MSW] POST /api/isp/v1/admin/partners/:id/commissions", {
      id,
      commissionData,
    });

    const partner = partners.find((p) => p.id === id);

    if (!partner) {
      return HttpResponse.json({ detail: "Partner not found" }, { status: 404 });
    }

    const commissionAmount =
      typeof commissionData.amount === "string"
        ? parseFloat(commissionData.amount)
        : commissionData.amount;

    const commissionResult = {
      commission_id: `comm-${nextCommissionId++}`,
      partner_id: partner.id,
      partner_number: partner.partner_number,
      partner_name: partner.company_name,
      customer_id: commissionData.customer_id,
      commission_type: commissionData.commission_type,
      amount: commissionAmount.toFixed(2),
      currency: commissionData.currency || "USD",
      status: "pending",
      event_date: new Date().toISOString(),
      invoice_id: commissionData.invoice_id,
      partner_balance: (partner.total_commissions_earned + commissionAmount).toFixed(2),
      partner_outstanding_balance: (
        partner.total_commissions_earned -
        partner.total_commissions_paid +
        commissionAmount
      ).toFixed(2),
      metadata: commissionData.metadata,
    };

    // Update partner stats
    partner.total_commissions_earned += commissionAmount;
    partner.updated_at = new Date().toISOString();

    console.log("[MSW] Recorded commission:", commissionResult.commission_id);
    return HttpResponse.json(commissionResult);
  }),
];
