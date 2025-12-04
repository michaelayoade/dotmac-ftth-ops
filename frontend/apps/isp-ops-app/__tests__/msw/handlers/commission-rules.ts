/**
 * MSW Handlers for Commission Rules API
 * Mocks partner commission rule management endpoints
 */

import { http, HttpResponse } from "msw";

// ============================================
// Types
// ============================================

export type CommissionModel = "revenue_share" | "flat_fee" | "tiered" | "hybrid";

export interface CommissionRule {
  id: string;
  partner_id: string;
  tenant_id: string;
  rule_name: string;
  description?: string;
  commission_type: CommissionModel;
  commission_rate?: number;
  flat_fee_amount?: number;
  tier_config?: Record<string, any>;
  applies_to_products?: string[];
  applies_to_customers?: string[];
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface CommissionRuleListResponse {
  rules: CommissionRule[];
  total: number;
  page: number;
  page_size: number;
}

// ============================================
// In-Memory Storage
// ============================================

let rules: CommissionRule[] = [];
let nextRuleId = 1;

// ============================================
// Mock Data Generators
// ============================================

export function createMockCommissionRule(overrides: Partial<CommissionRule> = {}): CommissionRule {
  const id = overrides.id || `rule-${nextRuleId++}`;
  return {
    id,
    partner_id: "partner-123",
    tenant_id: "tenant-456",
    rule_name: "Default Commission Rule",
    commission_type: "revenue_share",
    commission_rate: 0.15,
    effective_from: "2024-01-01T00:00:00Z",
    is_active: true,
    priority: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// Storage Helpers
// ============================================

export function seedCommissionRulesData(initialRules: CommissionRule[]): void {
  rules = [...initialRules];
  // Update next ID to avoid conflicts
  const maxId = initialRules.reduce((max, rule) => {
    const numId = parseInt(rule.id.replace("rule-", ""));
    return isNaN(numId) ? max : Math.max(max, numId);
  }, 0);
  nextRuleId = maxId + 1;
}

export function clearCommissionRulesData(): void {
  rules = [];
  nextRuleId = 1;
}

export function getCommissionRules(): CommissionRule[] {
  return [...rules];
}

// ============================================
// MSW Handlers
// ============================================

export const commissionRulesHandlers = [
// GET /api/isp/v1/admin/partners/commission-rules/partners/:partnerId/applicable - MUST come before /:id route
http.get(
  "*/api/isp/v1/admin/partners/commission-rules/partners/:partnerId/applicable",
    ({ request, params }) => {
      const { partnerId } = params;
      const url = new URL(request.url);
      const productId = url.searchParams.get("product_id");
      const customerId = url.searchParams.get("customer_id");

      console.log("[MSW] GET /api/isp/v1/admin/partners/commission-rules/partners/:partnerId/applicable", {
        partnerId,
        productId,
        customerId,
      });

      // Filter by partner
      let filtered = rules.filter((r) => r.partner_id === partnerId && r.is_active);

      // Filter by product if specified
      if (productId) {
        filtered = filtered.filter((r) => r.applies_to_products?.includes(productId));
      }

      // Filter by customer if specified
      if (customerId) {
        filtered = filtered.filter((r) => r.applies_to_customers?.includes(customerId));
      }

      // Sort by priority (lower number = higher priority)
      filtered.sort((a, b) => a.priority - b.priority);

      console.log(`[MSW] Returning ${filtered.length} applicable rules`);
      return HttpResponse.json(filtered);
    },
  ),

// GET /api/isp/v1/admin/partners/commission-rules/ - List commission rules
http.get("*/api/isp/v1/admin/partners/commission-rules/", ({ request, params }) => {
    const url = new URL(request.url);
    const partnerId = url.searchParams.get("partner_id");
    const isActive = url.searchParams.get("is_active");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "10");

    console.log("[MSW] GET /api/isp/v1/admin/partners/commission-rules/", {
      partnerId,
      isActive,
      page,
      pageSize,
    });

    // Apply filters
    let filtered = [...rules];

    if (partnerId) {
      filtered = filtered.filter((r) => r.partner_id === partnerId);
    }

    if (isActive !== null) {
      const activeFilter = isActive === "true";
      filtered = filtered.filter((r) => r.is_active === activeFilter);
    }

    // Pagination
    const total = filtered.length;
    const offset = (page - 1) * pageSize;
    const paginated = filtered.slice(offset, offset + pageSize);

    const response: CommissionRuleListResponse = {
      rules: paginated,
      total,
      page,
      page_size: pageSize,
    };

    console.log(`[MSW] Returning ${paginated.length}/${total} rules`);
    return HttpResponse.json(response);
  }),

// POST /api/isp/v1/admin/partners/commission-rules/ - Create commission rule
http.post("*/api/isp/v1/admin/partners/commission-rules/", async ({ request, params }) => {
    const createData = await request.json();

    console.log("[MSW] POST /api/isp/v1/admin/partners/commission-rules/", {
      createData,
    });

    const newRule = createMockCommissionRule({
      ...createData,
      id: `rule-${nextRuleId++}`,
      tenant_id: "tenant-456",
      is_active: createData.is_active ?? true,
      priority: createData.priority ?? 1,
    });

    rules.push(newRule);

    console.log("[MSW] Created commission rule:", newRule.id);
    return HttpResponse.json(newRule);
  }),

// GET /api/isp/v1/admin/partners/commission-rules/:id - Get single commission rule
http.get("*/api/isp/v1/admin/partners/commission-rules/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] GET /api/isp/v1/admin/partners/commission-rules/:id", { id });

    const rule = rules.find((r) => r.id === id);

    if (!rule) {
      return HttpResponse.json({ detail: "Rule not found" }, { status: 404 });
    }

    return HttpResponse.json(rule);
  }),

// PATCH /api/isp/v1/admin/partners/commission-rules/:id - Update commission rule
http.patch("*/api/isp/v1/admin/partners/commission-rules/:id", async ({ request, params }) => {
    const { id } = params;
    const updateData = await request.json();

    console.log("[MSW] PATCH /api/isp/v1/admin/partners/commission-rules/:id", {
      id,
      updateData,
    });

    const rule = rules.find((r) => r.id === id);

    if (!rule) {
      return HttpResponse.json({ detail: "Rule not found" }, { status: 404 });
    }

    // Update rule
    Object.assign(rule, updateData, {
      updated_at: new Date().toISOString(),
    });

    console.log("[MSW] Updated commission rule:", rule.id);
    return HttpResponse.json(rule);
  }),

// DELETE /api/isp/v1/admin/partners/commission-rules/:id - Delete commission rule
http.delete("*/api/isp/v1/admin/partners/commission-rules/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] DELETE /api/isp/v1/admin/partners/commission-rules/:id", { id });

    const index = rules.findIndex((r) => r.id === id);

    if (index === -1) {
      return HttpResponse.json({ detail: "Rule not found" }, { status: 404 });
    }

    rules.splice(index, 1);

    console.log("[MSW] Deleted commission rule:", id);
    return new HttpResponse(null, { status: 200 });
  }),
];
