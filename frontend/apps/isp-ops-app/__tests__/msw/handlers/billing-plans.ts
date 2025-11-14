/**
 * MSW Handlers for Billing Plans API Endpoints
 */

import { rest } from 'msw';
import type { BillingPlan, ProductCatalogItem } from '../../../hooks/useBillingPlans';

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
    product_id: 'prod-1',
    name: 'Test Plan',
    display_name: 'Test Plan',
    description: 'A test billing plan',
    billing_interval: 'monthly',
    interval_count: 1,
    price_amount: 99.99,
    currency: 'USD',
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
    tenant_id: 'tenant-123',
    sku: `SKU-${nextProductId}`,
    name: 'Test Product',
    description: 'A test product',
    category: 'subscription',
    product_type: 'standard',
    base_price: 99.99,
    currency: 'USD',
    tax_class: 'digital',
    is_active: true,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedBillingPlansData(
  plansData: BillingPlan[],
  productsData: ProductCatalogItem[]
) {
  billingPlans = [...plansData];
  products = [...productsData];
}

export const billingPlansHandlers = [
  // GET /billing/subscriptions/plans - List billing plans
  rest.get('*/billing/subscriptions/plans', (req, res, ctx) => {
    const url = new URL(req.url);
    const activeOnly = url.searchParams.get('active_only') === 'true';
    const productId = url.searchParams.get('product_id');

    let filtered = billingPlans;

    if (activeOnly) {
      filtered = filtered.filter((plan) => plan.is_active);
    }

    if (productId) {
      filtered = filtered.filter((plan) => plan.product_id === productId);
    }

    return res(
      ctx.json({
        success: true,
        data: filtered,
      })
    );
  }),

  // GET /billing/catalog/products - List products
  rest.get('*/billing/catalog/products', (req, res, ctx) => {
    const url = new URL(req.url);
    const isActive = url.searchParams.get('is_active') === 'true';

    let filtered = products;

    if (isActive) {
      filtered = filtered.filter((product) => product.is_active);
    }

    return res(
      ctx.json({
        data: filtered,
      })
    );
  }),

  // POST /billing/subscriptions/plans - Create plan
  rest.post('*/billing/subscriptions/plans', async (req, res, ctx) => {
    const data = await req.json();

    const newPlan = createMockBillingPlan({
      ...data,
      name: data.product_id ? `Plan for ${data.product_id}` : 'New Plan',
    });

    billingPlans.push(newPlan);

    return res(
      ctx.status(201),
      ctx.json({
        success: true,
        data: newPlan,
      })
    );
  }),

  // PATCH /billing/subscriptions/plans/:id - Update plan
  rest.patch('*/billing/subscriptions/plans/:planId', async (req, res, ctx) => {
    const { planId } = req.params;
    const updates = await req.json();

    const index = billingPlans.findIndex((plan) => plan.plan_id === planId);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Plan not found' })
      );
    }

    billingPlans[index] = {
      ...billingPlans[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return res(
      ctx.json({
        data: billingPlans[index],
      })
    );
  }),

  // DELETE /billing/subscriptions/plans/:id - Delete plan
  rest.delete('*/billing/subscriptions/plans/:planId', (req, res, ctx) => {
    const { planId } = req.params;
    const index = billingPlans.findIndex((plan) => plan.plan_id === planId);

    if (index === -1) {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Plan not found' })
      );
    }

    billingPlans.splice(index, 1);
    return res(ctx.status(204));
  }),
];
