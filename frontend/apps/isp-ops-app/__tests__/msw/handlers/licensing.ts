/**
 * MSW Handlers for Licensing Framework API
 * Mocks licensing modules, quotas, plans, subscriptions, and entitlements
 */

import { http, HttpResponse } from "msw";

// In-memory storage
let featureModules: any[] = [];
let quotaDefinitions: any[] = [];
let servicePlans: any[] = [];
let currentSubscription: any | null = null;
let quotaUsage: Map<string, number> = new Map();
let nextModuleId = 1;
let nextQuotaId = 1;
let nextPlanId = 1;
let nextSubscriptionId = 1;

const extractNumericSuffix = (value?: string, fallback = 0) => {
  if (!value) {
    return fallback;
  }
  const match = value.match(/(\d+)$/);
  return match ? parseInt(match[1], 10) : fallback;
};

// Factory functions
function createMockModule(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || `module-${nextModuleId++}`,
    module_code: data.module_code || data.code || `MODULE_${Date.now()}`,
    module_name: data.module_name || data.name || "Test Module",
    category: data.category || "AUTOMATION",
    description: data.description || "A test feature module",
    dependencies: data.dependencies || [],
    pricing_model: data.pricing_model || "FLAT_FEE",
    base_price: data.base_price ?? 99.99,
    price_per_unit: data.price_per_unit ?? null,
    config_schema: data.config_schema || {},
    default_config: data.default_config || {},
    is_active: data.is_active ?? data.enabled ?? true,
    is_public: data.is_public ?? true,
    extra_metadata: data.extra_metadata || {},
    capabilities: data.capabilities || [],
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
  };
}

function createMockQuota(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || `quota-${nextQuotaId++}`,
    quota_code: data.quota_code || data.code || `QUOTA_${Date.now()}`,
    quota_name: data.quota_name || data.name || "Test Quota",
    description: data.description || "A test quota definition",
    unit_name: data.unit_name || data.unit || "unit",
    unit_plural: data.unit_plural || (data.unit ? `${data.unit}s` : "units"),
    pricing_model: data.pricing_model || "PER_UNIT",
    overage_rate: data.overage_rate ?? 0,
    is_metered: data.is_metered ?? true,
    reset_period: data.reset_period || data.renewal_period || "MONTHLY",
    is_active: data.is_active ?? true,
    extra_metadata: data.extra_metadata || {},
    default_limit: data.default_limit ?? 100,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
  };
}

function createMockPlan(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || `plan-${nextPlanId++}`,
    plan_code: data.plan_code || data.code || `PLAN_${Date.now()}`,
    plan_name: data.plan_name || data.name || "Test Plan",
    description: data.description || "A test service plan",
    version: data.version ?? 1,
    is_template: data.is_template ?? false,
    is_public: data.is_public ?? true,
    is_custom: data.is_custom ?? false,
    base_price_monthly: data.base_price_monthly ?? data.price ?? 99.99,
    annual_discount_percent: data.annual_discount_percent ?? 0,
    trial_days: data.trial_days ?? 0,
    trial_modules: data.trial_modules || [],
    extra_metadata: data.extra_metadata || {},
    is_active: data.is_active ?? true,
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
    modules: data.modules || [],
    quotas: data.quotas || [],
  };
}

function createMockSubscription(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    id: data.id || `subscription-${nextSubscriptionId++}`,
    tenant_id: data.tenant_id || "tenant-123",
    plan_id: data.plan_id || "plan-1",
    status: data.status || "ACTIVE",
    billing_cycle: data.billing_cycle || "MONTHLY",
    monthly_price: data.monthly_price ?? 199.99,
    annual_price: data.annual_price ?? 1999.99,
    trial_start: data.trial_start || now,
    trial_end: data.trial_end || null,
    current_period_start: data.current_period_start || now,
    current_period_end:
      data.current_period_end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    custom_config: data.custom_config || {},
    addons: data.addons || [],
    modules: data.modules || [],
    quota_usage: data.quota_usage || [],
    created_at: data.created_at || now,
    updated_at: data.updated_at || now,
  };
}

// Seed functions
export function seedModules(modules: any[]): void {
  featureModules = modules;
  nextModuleId = modules.reduce((max, m) => Math.max(max, extractNumericSuffix(m.id)), 0) + 1;
}

export function seedQuotas(quotas: any[]): void {
  quotaDefinitions = quotas;
  nextQuotaId = quotas.reduce((max, q) => Math.max(max, extractNumericSuffix(q.id)), 0) + 1;
}

export function seedPlans(plans: any[]): void {
  servicePlans = plans;
  nextPlanId = plans.reduce((max, p) => Math.max(max, extractNumericSuffix(p.id)), 0) + 1;
}

export function seedSubscription(subscription: any): void {
  currentSubscription = subscription;
}

export function seedQuotaUsage(quotaCode: string, used: number): void {
  quotaUsage.set(quotaCode, used);
}

export function clearLicensingData(): void {
  featureModules = [];
  quotaDefinitions = [];
  servicePlans = [];
  currentSubscription = null;
  quotaUsage.clear();
  nextModuleId = 1;
  nextQuotaId = 1;
  nextPlanId = 1;
  nextSubscriptionId = 1;
}

export const licensingHandlers = [
  // ============================================================================
  // Feature Modules Endpoints
  // ============================================================================

  // GET /licensing/modules - List all feature modules
  http.get("*/api/v1/licensing/modules", ({ request }) => {
    return HttpResponse.json(featureModules);
  }),

  // POST /licensing/modules - Create feature module
  http.post("*/api/v1/licensing/modules", async (req) => {
    const body = await req.json<any>();
    const newModule = createMockModule(body);
    featureModules.push(newModule);
    return HttpResponse.json(newModule);
  }),

  // GET /licensing/modules/:id - Get specific module
  http.get("*/api/v1/licensing/modules/:id", ({ params }) => {
    const id = params.id as string;
    const featureModule = featureModules.find((m) => m.id === id);

    if (!featureModule) {
      return HttpResponse.json({ error: "Module not found" }, { status: 404 });
    }

    return HttpResponse.json(featureModule);
  }),

  // PATCH /licensing/modules/:id - Update module
  http.patch("*/api/v1/licensing/modules/:id", async (req) => {
    const { id } = req.params;
    const updates = await req.json<any>();

    const moduleIndex = featureModules.findIndex((m) => m.id === id);
    if (moduleIndex === -1) {
      return HttpResponse.json({ error: "Module not found" }, { status: 404 });
    }

    featureModules[moduleIndex] = {
      ...featureModules[moduleIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(featureModules[moduleIndex]);
  }),

  // ============================================================================
  // Quota Definitions Endpoints
  // ============================================================================

  // GET /licensing/quotas - List all quota definitions
  http.get("*/api/v1/licensing/quotas", ({ request }) => {
    return HttpResponse.json(quotaDefinitions);
  }),

  // POST /licensing/quotas - Create quota definition
  http.post("*/api/v1/licensing/quotas", async (req) => {
    const body = await req.json<any>();
    const newQuota = createMockQuota(body);
    quotaDefinitions.push(newQuota);
    return HttpResponse.json(newQuota);
  }),

  // PATCH /licensing/quotas/:id - Update quota
  http.patch("*/api/v1/licensing/quotas/:id", async (req) => {
    const { id } = req.params;
    const updates = await req.json<any>();

    const quotaIndex = quotaDefinitions.findIndex((q) => q.id === id);
    if (quotaIndex === -1) {
      return HttpResponse.json({ error: "Quota not found" }, { status: 404 });
    }

    quotaDefinitions[quotaIndex] = {
      ...quotaDefinitions[quotaIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(quotaDefinitions[quotaIndex]);
  }),

  // ============================================================================
  // Service Plans Endpoints
  // ============================================================================

  // GET /licensing/plans - List all service plans
  http.get("*/api/v1/licensing/plans", ({ request }) => {
    return HttpResponse.json(servicePlans);
  }),

  // POST /licensing/plans - Create service plan
  http.post("*/api/v1/licensing/plans", async (req) => {
    const body = await req.json<any>();
    const newPlan = createMockPlan(body);
    servicePlans.push(newPlan);
    return HttpResponse.json(newPlan);
  }),

  // GET /licensing/plans/:id - Get specific plan
  http.get("*/api/v1/licensing/plans/:id", ({ params }) => {
    const id = params.id as string;
    const plan = servicePlans.find((p) => p.id === id);

    if (!plan) {
      return HttpResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    return HttpResponse.json(plan);
  }),

  // PATCH /licensing/plans/:id - Update plan
  http.patch("*/api/v1/licensing/plans/:id", async (req) => {
    const { id } = req.params;
    const updates = await req.json<any>();

    const planIndex = servicePlans.findIndex((p) => p.id === id);
    if (planIndex === -1) {
      return HttpResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    servicePlans[planIndex] = {
      ...servicePlans[planIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(servicePlans[planIndex]);
  }),

  // POST /licensing/plans/:id/duplicate - Duplicate plan
  http.post("*/api/v1/licensing/plans/:id/duplicate", ({ params }) => {
    const id = params.id as string;
    const originalPlan = servicePlans.find((p) => p.id === id);

    if (!originalPlan) {
      return HttpResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const duplicatedPlan = createMockPlan({
      ...originalPlan,
      id: undefined, // Will be assigned by createMockPlan
      plan_code: `${originalPlan.plan_code}_COPY`,
      plan_name: `${originalPlan.plan_name} (Copy)`,
    });

    servicePlans.push(duplicatedPlan);
    return HttpResponse.json(duplicatedPlan);
  }),

  // GET /licensing/plans/:id/pricing - Calculate plan pricing
  http.get("*/api/v1/licensing/plans/:id/pricing", ({ request, params }) => {
    const id = params.id as string;
    const url = new URL(request.url);
    const quantity = parseInt(url.searchParams.get("quantity") || "1", 10);
    const billingPeriod = (url.searchParams.get("billing_period") || "MONTHLY").toUpperCase();

    const plan = servicePlans.find((p) => p.id === id);
    if (!plan) {
      return HttpResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const monthlyPrice = plan.base_price_monthly;
    const annualListPrice = monthlyPrice * 12;
    const annualDiscountPercent = plan.annual_discount_percent ?? 0;
    const annualPrice = annualListPrice * (1 - annualDiscountPercent / 100);
    const selectedPrice = billingPeriod === "ANNUAL" ? annualPrice : monthlyPrice;
    const subtotal = selectedPrice * quantity;
    const discountAmount =
      billingPeriod === "ANNUAL" ? (annualListPrice - annualPrice) * quantity : 0;

    return HttpResponse.json({
      billing_period: billingPeriod,
      quantity,
      monthly: monthlyPrice,
      annual: annualPrice,
      subtotal,
      discount_percentage: billingPeriod === "ANNUAL" ? annualDiscountPercent : 0,
      discount_amount: discountAmount,
      total: subtotal,
      currency: "USD",
    });
  }),

  // ============================================================================
  // Subscriptions Endpoints
  // ============================================================================

  // GET /licensing/subscriptions/current - Get current subscription
  http.get("*/api/v1/licensing/subscriptions/current", ({ request }) => {
    if (!currentSubscription) {
      return HttpResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    return HttpResponse.json(currentSubscription);
  }),

  // POST /licensing/subscriptions - Create subscription
  http.post("*/api/v1/licensing/subscriptions", async (req) => {
    const body = await req.json<any>();
    const newSubscription = createMockSubscription(body);
    currentSubscription = newSubscription;
    return HttpResponse.json(newSubscription);
  }),

  // POST /licensing/subscriptions/current/addons - Add addon
  http.post("*/api/v1/licensing/subscriptions/current/addons", async (req) => {
    const body = await req.json<any>();

    if (!currentSubscription) {
      return HttpResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    const addon = {
      module_id: body.module_id,
      quantity: body.quantity || 1,
      added_at: new Date().toISOString(),
    };

    currentSubscription.addons = [...(currentSubscription.addons || []), addon];
    currentSubscription.updated_at = new Date().toISOString();

    return new HttpResponse(null, { status: 204 });
  }),

  // DELETE /licensing/subscriptions/current/addons - Remove addon
  http.delete("*/api/v1/licensing/subscriptions/current/addons", async (req) => {
    const body = await req.json<any>();

    if (!currentSubscription) {
      return HttpResponse.json({ error: "No active subscription" }, { status: 404 });
    }

    currentSubscription.addons = (currentSubscription.addons || []).filter(
      (addon: any) => addon.module_id !== body.module_id,
    );
    currentSubscription.updated_at = new Date().toISOString();

    return new HttpResponse(null, { status: 204 });
  }),

  // ============================================================================
  // Entitlements & Quota Check Endpoints
  // ============================================================================

  // POST /licensing/entitlements/check - Check entitlement
  http.post("*/api/v1/licensing/entitlements/check", async (req) => {
    const body = await req.json<any>();
    const { module_code, capability_code } = body;

    if (!currentSubscription) {
      return HttpResponse.json({ entitled: false, reason: "No active subscription" });
    }

    // For testing, always return entitled unless module_code is "DISABLED_MODULE"
    const entitled = module_code !== "DISABLED_MODULE";

    return HttpResponse.json({
      entitled,
      module_code,
      capability_code,
      reason: entitled ? null : "Module not available in current plan",
    });
  }),

  // POST /licensing/quotas/check - Check quota availability
  http.post("*/api/v1/licensing/quotas/check", async (req) => {
    const body = await req.json<any>();
    const { quota_code, quantity = 1 } = body;

    const quotaDef = quotaDefinitions.find((q) => q.quota_code === quota_code);
    if (!quotaDef) {
      return HttpResponse.json({
        available: false,
        remaining: 0,
        limit: 0,
        used: 0,
        reason: "Quota not found",
      });
    }

    const used = quotaUsage.get(quota_code) || 0;
    const limit = quotaDef.default_limit;
    const remaining = Math.max(0, limit - used);
    const available = remaining >= quantity;

    return HttpResponse.json({
      available,
      remaining,
      limit,
      used,
      quota_code,
      quantity,
      reason: available ? null : "Insufficient quota",
    });
  }),

  // POST /licensing/quotas/consume - Consume quota
  http.post("*/api/v1/licensing/quotas/consume", async (req) => {
    const body = await req.json<any>();
    const { quota_code, quantity = 1 } = body;

    const currentUsage = quotaUsage.get(quota_code) || 0;
    quotaUsage.set(quota_code, currentUsage + quantity);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /licensing/quotas/release - Release quota
  http.post("*/api/v1/licensing/quotas/release", async (req) => {
    const body = await req.json<any>();
    const { quota_code, quantity = 1 } = body;

    const currentUsage = quotaUsage.get(quota_code) || 0;
    quotaUsage.set(quota_code, Math.max(0, currentUsage - quantity));

    return new HttpResponse(null, { status: 204 });
  }),
];
