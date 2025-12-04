/**
 * MSW Handlers for Tenant Onboarding API
 * Mocks tenant onboarding automation endpoints
 */

import { http, HttpResponse } from "msw";

// In-memory storage
let onboardingStatuses: Map<string, any> = new Map();
let onboardingHistory: any[] = [];
let nextHistoryId = 1;

// Factory functions
function createMockOnboardingStatus(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    tenant_id: data.tenant_id || "tenant-1",
    status: data.status || "pending",
    completed: data.completed ?? false,
    metadata: data.metadata || {},
    updated_at: data.updated_at || now,
    ...data,
  };
}

function createMockOnboardingResponse(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    tenant: data.tenant || {
      id: data.tenant_id || `tenant-${Date.now()}`,
      name: data.tenant_name || "Test Tenant",
      slug: data.tenant_slug || "test-tenant",
      plan: data.tenant_plan || "basic",
      contact_email: data.contact_email || "contact@example.com",
      contact_phone: data.contact_phone || null,
      billing_email: data.billing_email || null,
      address: data.address || null,
      city: data.city || null,
      state: data.state || null,
      postal_code: data.postal_code || null,
      country: data.country || null,
      is_active: true,
      onboarding_status: data.onboarding_status || "complete",
      created_at: now,
      updated_at: now,
    },
    created: data.created ?? true,
    onboarding_status: data.onboarding_status || "complete",
    admin_user_id: data.admin_user_id || (data.admin_user ? `user-${Date.now()}` : undefined),
    admin_user_password:
      data.admin_user_password ||
      (data.admin_user?.generate_password ? "GeneratedPassword123!" : undefined),
    invitations: data.invitations || [],
    applied_settings: data.applied_settings || [],
    metadata: data.metadata || {},
    feature_flags_updated: data.feature_flags_updated ?? false,
    warnings: data.warnings || [],
    logs: data.logs || [
      "Starting tenant onboarding process",
      "Tenant created successfully",
      "Onboarding completed",
    ],
    ...data,
  };
}

function createMockOnboardingHistoryEntry(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || `history-${nextHistoryId++}`,
    tenant_id: data.tenant_id || "tenant-1",
    tenant_name: data.tenant_name || "Test Tenant",
    tenant_slug: data.tenant_slug || "test-tenant",
    status: data.status || "complete",
    created: data.created ?? true,
    admin_user_created: data.admin_user_created ?? false,
    invitations_sent: data.invitations_sent || 0,
    settings_applied: data.settings_applied || 0,
    feature_flags_updated: data.feature_flags_updated ?? false,
    warnings: data.warnings || [],
    created_at: data.created_at || now,
    completed_at: data.completed_at || now,
    ...data,
  };
}

// Seed functions
export function seedOnboardingStatuses(statusesList: Partial<any>[]): void {
  onboardingStatuses.clear();
  statusesList.forEach((status) => {
    const mockStatus = createMockOnboardingStatus(status);
    onboardingStatuses.set(mockStatus.tenant_id, mockStatus);
  });
}

export function seedOnboardingHistory(historyList: Partial<any>[]): void {
  onboardingHistory = historyList.map(createMockOnboardingHistoryEntry);
}

export function clearTenantOnboardingData(): void {
  onboardingStatuses.clear();
  onboardingHistory = [];
  nextHistoryId = 1;
}

export const tenantOnboardingHandlers = [
  // POST /api/v1/tenants/onboarding - Onboard a new or existing tenant
  http.post("*/api/v1/tenants/onboarding", async (req) => {
    const body = await req.json<any>();

    // Validate required fields
    if (!body.tenant && !body.tenant_id) {
      return HttpResponse.json(
        { detail: "Either tenant or tenant_id must be provided" },
        { status: 400 },
      );
    }

    if (body.tenant && !body.tenant.name) {
      return HttpResponse.json({ detail: "Tenant name is required" }, { status: 400 });
    }

    if (body.tenant && !body.tenant.slug) {
      return HttpResponse.json({ detail: "Tenant slug is required" }, { status: 400 });
    }

    // Simulate onboarding process
    const tenantId = body.tenant_id || `tenant-${Date.now()}`;
    const created = !body.tenant_id;

    const response = createMockOnboardingResponse({
      tenant_id: tenantId,
      tenant_name: body.tenant?.name,
      tenant_slug: body.tenant?.slug,
      tenant_plan: body.tenant?.plan,
      contact_email: body.tenant?.contact_email,
      contact_phone: body.tenant?.contact_phone,
      billing_email: body.tenant?.billing_email,
      address: body.tenant?.address,
      city: body.tenant?.city,
      state: body.tenant?.state,
      postal_code: body.tenant?.postal_code,
      country: body.tenant?.country,
      created,
      onboarding_status: body.options?.mark_onboarding_complete ? "complete" : "pending",
      admin_user: body.admin_user,
      admin_user_password: body.admin_user?.generate_password ? "GeneratedPassword123!" : undefined,
      invitations: body.invitations || [],
      applied_settings: body.settings?.map((s: any) => s.key) || [],
      metadata: body.metadata || {},
      feature_flags_updated: !!body.feature_flags && Object.keys(body.feature_flags).length > 0,
      warnings: [],
      logs: [
        "Starting tenant onboarding process",
        created ? "Creating new tenant" : "Using existing tenant",
        body.admin_user ? "Creating admin user" : "Skipping admin user creation",
        body.options?.apply_default_settings
          ? "Applying default settings"
          : "Skipping default settings",
        body.invitations?.length
          ? `Sending ${body.invitations.length} invitations`
          : "No invitations to send",
        body.feature_flags ? "Updating feature flags" : "No feature flags to update",
        body.options?.mark_onboarding_complete
          ? "Marking onboarding as complete"
          : "Onboarding status: pending",
        "Onboarding process completed",
      ],
    });

    // Store onboarding status
    const status = createMockOnboardingStatus({
      tenant_id: tenantId,
      status: response.onboarding_status,
      completed: response.onboarding_status === "complete",
      metadata: {
        created,
        admin_user_created: !!body.admin_user,
        invitations_sent: body.invitations?.length || 0,
        settings_applied: body.settings?.length || 0,
        feature_flags_updated: response.feature_flags_updated,
      },
    });
    onboardingStatuses.set(tenantId, status);

    // Add to history
    const historyEntry = createMockOnboardingHistoryEntry({
      tenant_id: tenantId,
      tenant_name: body.tenant?.name,
      tenant_slug: body.tenant?.slug,
      status: response.onboarding_status,
      created,
      admin_user_created: !!body.admin_user,
      invitations_sent: body.invitations?.length || 0,
      settings_applied: body.settings?.length || 0,
      feature_flags_updated: response.feature_flags_updated,
      warnings: response.warnings,
    });
    onboardingHistory.push(historyEntry);

    return HttpResponse.json(response);
  }),

  // GET /api/v1/tenants/:tenantId/onboarding/status - Get onboarding status for a tenant
  http.get("*/api/v1/tenants/:tenantId/onboarding/status", ({ params }) => {
    const tenantId = params.tenantId as string;

    const status = onboardingStatuses.get(tenantId as string);

    if (!status) {
      return HttpResponse.json(
        { detail: "Onboarding status not found for tenant" },
        { status: 404 },
      );
    }

    return HttpResponse.json(status);
  }),
];
