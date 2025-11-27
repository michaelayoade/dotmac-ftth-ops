/**
 * MSW Handlers for Billing Plans API Endpoints
 */

import { http, HttpResponse } from "msw";
import type { BillingPlan, ProductCatalogItem } from "../../../hooks/useBillingPlans";

// In-memory storage for test data
let billingPlans: BillingPlan[] = [];
let products: ProductCatalogItem[] = [];
let nextPlanId = 1;
let nextProductId = 1;

// Reset storage between tests
export function resetBillingPlansStorage() {
  billingPlans = [];
  products = [];
  nextPlanId = 1;
  nextProductId = 1;
}

// Helper to create a mock billing plan
export function createMockBillingPlan(overrides?: Partial<BillingPlan>): BillingPlan {
  return {
    plan_id: `plan-${nextPlanId++}`,
    product_id: "prod-1",
    name: "Test Plan",
    display_name: "Test Plan",
    description: "A test billing plan",
    billing_interval: "monthly",
    interval_count: 1,
    price_amount: 99.99,
    currency: "USD",
    trial_days: 14,
    is_active: true,
    features: {},
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock product
export function createMockProduct(overrides?: Partial<ProductCatalogItem>): ProductCatalogItem {
  return {
    product_id: `prod-${nextProductId++}`,
    tenant_id: "tenant-123",
    sku: `SKU-${nextProductId}`,
    name: "Test Product",
    description: "A test product",
    category: "subscription",
    product_type: "standard",
    base_price: 99.99,
    currency: "USD",
    tax_class: "digital",
    is_active: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedBillingPlansData(plansData: BillingPlan[], productsData: ProductCatalogItem[]) {
  billingPlans = [...plansData];
  products = [...productsData];
}

export const billingPlansHandlers = [
  // GET /api/v1/billing/subscriptions/plans - List billing plans
  http.get("*/api/v1/billing/subscriptions/plans*", ({ request, params }) => {
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get("active_only") === "true";
    const productId = url.searchParams.get("product_id");

    let filtered = billingPlans;

    if (activeOnly) {
      filtered = filtered.filter((plan) => plan.is_active);
    }

    if (productId) {
      filtered = filtered.filter((plan) => plan.product_id === productId);
    }

    // Return array directly - axios will wrap it in response.data
    return HttpResponse.json(filtered);
  }),

  // GET /api/v1/billing/catalog/products - List products
  http.get("*/api/v1/billing/catalog/products*", ({ request, params }) => {
    const url = new URL(request.url);
    const isActive = url.searchParams.get("is_active") === "true";

    let filtered = products;

    if (isActive) {
      filtered = filtered.filter((product) => product.is_active);
    }

    // Return array directly - axios will wrap it in response.data
    return HttpResponse.json(filtered);
  }),

  // POST /api/v1/billing/subscriptions/plans - Create plan
  http.post("*/api/v1/billing/subscriptions/plans", async ({ request, params }) => {
    const data = await request.json();

    const newPlan = createMockBillingPlan({
      ...data,
      name: data.product_id ? `Plan for ${data.product_id}` : "New Plan",
    });

    billingPlans.push(newPlan);

    // Return object directly - axios will wrap it in response.data
    return HttpResponse.json(newPlan, { status: 201 });
  }),

  // PATCH /api/v1/billing/subscriptions/plans/:id - Update plan
  http.patch("*/api/v1/billing/subscriptions/plans/:planId", async ({ request, params }) => {
    const { planId } = params;
    const updates = await request.json();

    const index = billingPlans.findIndex((plan) => plan.plan_id === planId);

    if (index === -1) {
      return HttpResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    billingPlans[index] = {
      ...billingPlans[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    // Return object directly - axios will wrap it in response.data
    return HttpResponse.json(billingPlans[index]);
  }),

  // DELETE /api/v1/billing/subscriptions/plans/:id - Delete plan
  http.delete("*/api/v1/billing/subscriptions/plans/:planId", ({ request, params }) => {
    const { planId } = params;
    const index = billingPlans.findIndex((plan) => plan.plan_id === planId);

    if (index === -1) {
      return HttpResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    billingPlans.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
