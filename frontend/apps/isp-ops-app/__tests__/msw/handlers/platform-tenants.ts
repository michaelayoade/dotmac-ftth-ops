/**
 * MSW Handlers for Platform Admin Tenants API
 * Mocks platform-admin tenant management endpoints
 */

import { http, HttpResponse } from "msw";
import type {
  TenantDetails,
  PlatformTenantListResponse,
  TenantUser,
  TenantStatistics,
} from "@/lib/services/platform-admin-tenant-service";

// ============================================
// In-Memory Storage
// ============================================

let tenants: TenantDetails[] = [];
let tenantUsers: Map<string, TenantUser[]> = new Map();
let tenantStatistics: Map<string, TenantStatistics> = new Map();
let nextTenantId = 1;
let nextUserId = 1;

// ============================================
// Mock Data Generators
// ============================================

export function createMockTenant(overrides: Partial<TenantDetails> = {}): TenantDetails {
  const id = overrides.id || `tenant-${nextTenantId++}`;
  const name = overrides.name || `Tenant ${nextTenantId}`;
  const slug = overrides.slug || name.toLowerCase().replace(/\s+/g, "-");

  return {
    id,
    name,
    slug,
    status: "active",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    settings: {},
    subscription: {
      plan: "professional",
      status: "active",
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    usage: {
      users: 5,
      storage_gb: 10,
      api_calls_month: 1000,
    },
    limits: {
      max_users: 50,
      max_storage_gb: 100,
      max_api_calls_month: 10000,
    },
    ...overrides,
  };
}

export function createMockTenantUser(overrides: Partial<TenantUser> = {}): TenantUser {
  const id = overrides.id || `user-${nextUserId++}`;
  const name = overrides.name || `User ${nextUserId}`;
  const email = overrides.email || `user${nextUserId}@example.com`;

  return {
    id,
    name,
    email,
    roles: ["user"],
    status: "active",
    created_at: new Date().toISOString(),
    last_login: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTenantStatistics(
  overrides: Partial<TenantStatistics> = {},
): TenantStatistics {
  const now = new Date().toISOString();
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

  return {
    total_users: 10,
    active_users: 8,
    total_api_calls: 5000,
    storage_used_gb: 25.5,
    created_at: ninetyDaysAgo,
    last_activity: now,
    ...overrides,
  };
}

// ============================================
// Storage Helpers
// ============================================

export function seedPlatformTenants(tenantsList: Partial<TenantDetails>[]): void {
  tenants = tenantsList.map(createMockTenant);
}

export function seedTenantUsers(tenantId: string, usersList: Partial<TenantUser>[]): void {
  tenantUsers.set(tenantId, usersList.map(createMockTenantUser));
}

export function clearPlatformTenantsData(): void {
  tenants = [];
  tenantUsers.clear();
  tenantStatistics.clear();
  nextTenantId = 1;
  nextUserId = 1;
}

export function getPlatformTenants(): TenantDetails[] {
  return [...tenants];
}

// ============================================
// MSW Handlers
// ============================================

export const platformTenantsHandlers = [
  // GET /platform-admin/tenants - List tenants
  http.get("*/api/v1/platform-admin/tenants", ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");

    console.log("[MSW] GET /platform-admin/tenants", { page, limit, status, search });

    // Filter by status
    let filtered = [...tenants];
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }

    // Filter by search (name or slug)
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) || t.slug.toLowerCase().includes(searchLower),
      );
    }

    // Pagination
    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    const response: PlatformTenantListResponse = {
      tenants: paginated,
      total,
      page,
      limit,
    };

    console.log(`[MSW] Returning ${paginated.length}/${total} tenants`);
    return HttpResponse.json(response);
  }),

  // GET /platform-admin/tenants/:tenantId/details - Get tenant details
  http.get("*/api/v1/platform-admin/tenants/:tenantId/details", ({ params }) => {
    const tenantId = params.tenantId as string;
    console.log(`[MSW] GET /platform-admin/tenants/${tenantId}/details`);

    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    return HttpResponse.json(tenant);
  }),

  // GET /platform-admin/tenants/:tenantId/users - Get tenant users
  http.get("*/api/v1/platform-admin/tenants/:tenantId/users", ({ params }) => {
    const tenantId = params.tenantId as string;
    console.log(`[MSW] GET /platform-admin/tenants/${tenantId}/users`);

    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    const users = tenantUsers.get(tenantId as string) || [];
    console.log(`[MSW] Returning ${users.length} users for tenant ${tenantId}`);
    return HttpResponse.json(users);
  }),

  // GET /platform-admin/tenants/:tenantId/statistics - Get tenant statistics
  http.get("*/api/v1/platform-admin/tenants/:tenantId/statistics", ({ params }) => {
    const tenantId = params.tenantId as string;
    console.log(`[MSW] GET /platform-admin/tenants/${tenantId}/statistics`);

    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    let stats = tenantStatistics.get(tenantId as string);
    if (!stats) {
      stats = createMockTenantStatistics();
      tenantStatistics.set(tenantId as string, stats);
    }

    return HttpResponse.json(stats);
  }),

  // PATCH /platform-admin/tenants/:tenantId/settings - Update tenant settings
  http.patch("*/api/v1/platform-admin/tenants/:tenantId/settings", async ({ params, request }) => {
    const tenantId = params.tenantId as string;
    const body = await request.json<{ settings: Record<string, any> }>();
    console.log(`[MSW] PATCH /platform-admin/tenants/${tenantId}/settings`);

    const tenantIndex = tenants.findIndex((t) => t.id === tenantId);
    if (tenantIndex === -1) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    tenants[tenantIndex] = {
      ...tenants[tenantIndex],
      settings: {
        ...tenants[tenantIndex].settings,
        ...body.settings,
      },
      updated_at: new Date().toISOString(),
    };

    console.log(`[MSW] Updated settings for tenant ${tenantId}`);
    return HttpResponse.json(tenants[tenantIndex]);
  }),

  // PATCH /platform-admin/tenants/:tenantId/limits - Update tenant limits
  http.patch("*/api/v1/platform-admin/tenants/:tenantId/limits", async ({ params, request }) => {
    const tenantId = params.tenantId as string;
    const body = await request.json<{ limits: Partial<TenantDetails["limits"]> }>();
    console.log(`[MSW] PATCH /platform-admin/tenants/${tenantId}/limits`);

    const tenantIndex = tenants.findIndex((t) => t.id === tenantId);
    if (tenantIndex === -1) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    tenants[tenantIndex] = {
      ...tenants[tenantIndex],
      limits: {
        ...tenants[tenantIndex].limits,
        ...body.limits,
      },
      updated_at: new Date().toISOString(),
    };

    console.log(`[MSW] Updated limits for tenant ${tenantId}`);
    return HttpResponse.json(tenants[tenantIndex]);
  }),

  // POST /platform-admin/tenants/:tenantId/users/:userId/disable - Disable tenant user
  http.post("*/api/v1/platform-admin/tenants/:tenantId/users/:userId/disable", ({ params }) => {
    const tenantId = params.tenantId as string;
    const userId = params.userId as string;
    console.log(`[MSW] POST /platform-admin/tenants/${tenantId}/users/${userId}/disable`);

    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    const users = tenantUsers.get(tenantId as string);
    if (users) {
      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex].status = "disabled";
        console.log(`[MSW] Disabled user ${userId} for tenant ${tenantId}`);
      }
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /platform-admin/tenants/:tenantId/users/:userId/enable - Enable tenant user
  http.post("*/api/v1/platform-admin/tenants/:tenantId/users/:userId/enable", ({ params }) => {
    const tenantId = params.tenantId as string;
    const userId = params.userId as string;
    console.log(`[MSW] POST /platform-admin/tenants/${tenantId}/users/${userId}/enable`);

    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    const users = tenantUsers.get(tenantId as string);
    if (users) {
      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex].status = "active";
        console.log(`[MSW] Enabled user ${userId} for tenant ${tenantId}`);
      }
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /platform-admin/tenants/:tenantId - Delete tenant (soft delete)
  http.delete("*/api/v1/platform-admin/tenants/:tenantId", async ({ params }) => {
    const tenantId = params.tenantId as string;
    console.log(`[MSW] DELETE /platform-admin/tenants/${tenantId}`);

    const tenantIndex = tenants.findIndex((t) => t.id === tenantId);
    if (tenantIndex === -1) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    // Soft delete - change status to disabled
    tenants[tenantIndex].status = "disabled";
    tenants[tenantIndex].updated_at = new Date().toISOString();
    console.log(`[MSW] Soft deleted tenant ${tenantId}`);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /platform-admin/tenants/:tenantId/restore - Restore deleted tenant
  http.post("*/api/v1/platform-admin/tenants/:tenantId/restore", ({ params }) => {
    const tenantId = params.tenantId as string;
    console.log(`[MSW] POST /platform-admin/tenants/${tenantId}/restore`);

    const tenantIndex = tenants.findIndex((t) => t.id === tenantId);
    if (tenantIndex === -1) {
      console.log(`[MSW] Tenant ${tenantId} not found`);
      return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
    }

    tenants[tenantIndex].status = "active";
    tenants[tenantIndex].updated_at = new Date().toISOString();
    console.log(`[MSW] Restored tenant ${tenantId}`);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /platform-admin/tenants/:tenantId/impersonate - Impersonate tenant
  http.post(
    "*/api/v1/platform-admin/tenants/:tenantId/impersonate",
    async ({ params, request }) => {
      const tenantId = params.tenantId as string;
      const body = await request.json<{ duration?: number }>();
      console.log(`[MSW] POST /platform-admin/tenants/${tenantId}/impersonate`);

      const tenant = tenants.find((t) => t.id === tenantId);
      if (!tenant) {
        console.log(`[MSW] Tenant ${tenantId} not found`);
        return HttpResponse.json({ detail: "Tenant not found" }, { status: 404 });
      }

      const duration = body.duration || 3600; // Default 1 hour

      const response = {
        access_token: `mock-access-token-${tenantId}-${Date.now()}`,
        expires_in: duration,
        refresh_token: `mock-refresh-token-${tenantId}-${Date.now()}`,
      };

      console.log(`[MSW] Generated impersonation token for tenant ${tenantId}`);
      return HttpResponse.json(response);
    },
  ),
];
