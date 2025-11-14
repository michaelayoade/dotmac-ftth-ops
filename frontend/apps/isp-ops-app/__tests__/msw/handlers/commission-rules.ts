/**
 * MSW Handlers for Commission Rules API
 * Mocks partner commission rule management endpoints
 */

import { rest } from "msw";

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

export function createMockCommissionRule(
  overrides: Partial<CommissionRule> = {}
): CommissionRule {
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
  // GET /api/v1/partners/commission-rules/partners/:partnerId/applicable - MUST come before /:id route
  rest.get(
    "*/api/v1/partners/commission-rules/partners/:partnerId/applicable",
    (req, res, ctx) => {
      const { partnerId } = req.params;
      const url = new URL(req.url);
      const productId = url.searchParams.get("product_id");
      const customerId = url.searchParams.get("customer_id");

      console.log(
        "[MSW] GET /api/v1/partners/commission-rules/partners/:partnerId/applicable",
        { partnerId, productId, customerId }
      );

      // Filter by partner
      let filtered = rules.filter(
        (r) => r.partner_id === partnerId && r.is_active
      );

      // Filter by product if specified
      if (productId) {
        filtered = filtered.filter((r) =>
          r.applies_to_products?.includes(productId)
        );
      }

      // Filter by customer if specified
      if (customerId) {
        filtered = filtered.filter((r) =>
          r.applies_to_customers?.includes(customerId)
        );
      }

      // Sort by priority (lower number = higher priority)
      filtered.sort((a, b) => a.priority - b.priority);

      console.log(`[MSW] Returning ${filtered.length} applicable rules`);
      return res(ctx.json(filtered));
    }
  ),

  // GET /api/v1/partners/commission-rules/ - List commission rules
  rest.get("*/api/v1/partners/commission-rules/", (req, res, ctx) => {
    const url = new URL(req.url);
    const partnerId = url.searchParams.get("partner_id");
    const isActive = url.searchParams.get("is_active");
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "10");

    console.log("[MSW] GET /api/v1/partners/commission-rules/", {
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
    return res(ctx.json(response));
  }),

  // POST /api/v1/partners/commission-rules/ - Create commission rule
  rest.post("*/api/v1/partners/commission-rules/", async (req, res, ctx) => {
    const createData = await req.json();

    console.log("[MSW] POST /api/v1/partners/commission-rules/", {
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
    return res(ctx.json(newRule));
  }),

  // GET /api/v1/partners/commission-rules/:id - Get single commission rule
  rest.get("*/api/v1/partners/commission-rules/:id", (req, res, ctx) => {
    const { id } = req.params;

    console.log("[MSW] GET /api/v1/partners/commission-rules/:id", { id });

    const rule = rules.find((r) => r.id === id);

    if (!rule) {
      return res(
        ctx.status(404),
        ctx.json({ detail: "Rule not found" })
      );
    }

    return res(ctx.json(rule));
  }),

  // PATCH /api/v1/partners/commission-rules/:id - Update commission rule
  rest.patch(
    "*/api/v1/partners/commission-rules/:id",
    async (req, res, ctx) => {
      const { id } = req.params;
      const updateData = await req.json();

      console.log("[MSW] PATCH /api/v1/partners/commission-rules/:id", {
        id,
        updateData,
      });

      const rule = rules.find((r) => r.id === id);

      if (!rule) {
        return res(
          ctx.status(404),
          ctx.json({ detail: "Rule not found" })
        );
      }

      // Update rule
      Object.assign(rule, updateData, {
        updated_at: new Date().toISOString(),
      });

      console.log("[MSW] Updated commission rule:", rule.id);
      return res(ctx.json(rule));
    }
  ),

  // DELETE /api/v1/partners/commission-rules/:id - Delete commission rule
  rest.delete("*/api/v1/partners/commission-rules/:id", (req, res, ctx) => {
    const { id } = req.params;

    console.log("[MSW] DELETE /api/v1/partners/commission-rules/:id", { id });

    const index = rules.findIndex((r) => r.id === id);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ detail: "Rule not found" })
      );
    }

    rules.splice(index, 1);

    console.log("[MSW] Deleted commission rule:", id);
    return res(ctx.status(200));
  }),
];
