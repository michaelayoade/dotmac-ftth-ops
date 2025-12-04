/**
 * Test data factories for Platform Admin features
 * (Tenant management, licensing, subscriptions)
 */

import {
  ModuleCategory,
  SubscriptionStatus,
  BillingCycle,
  type Module,
  type Quota,
  type ServicePlan,
  type TenantSubscription,
  type PlanModule,
  type PlanQuota,
  type SubscriptionModule,
  type QuotaUsage,
} from "../../billing/types";

let tenantCounter = 1;
let moduleCounter = 1;
let quotaCounter = 1;
let planCounter = 1;
let subscriptionCounter = 1;

// ============================================================================
// Tenant Factories
// ============================================================================

export interface Tenant {
  id: string;
  tenant_id: string;
  company_name: string;
  subdomain: string;
  status: "active" | "trial" | "suspended" | "cancelled" | "expired";
  owner_email: string;
  owner_name: string;
  plan_id?: string;
  subscription_id?: string;
  created_at: string;
  trial_ends_at?: string;
  suspended_at?: string;
  cancelled_at?: string;
}

export const createMockTenant = (overrides?: Partial<Tenant>): Tenant => {
  const id = tenantCounter++;
  const subdomain = overrides?.subdomain ?? `tenant${id}`;

  return {
    id: `tenant_${id}`,
    tenant_id: `tenant_${id}`,
    company_name: overrides?.company_name ?? `ISP Company ${id}`,
    subdomain,
    status: overrides?.status ?? "active",
    owner_email: overrides?.owner_email ?? `owner${id}@${subdomain}.com`,
    owner_name: overrides?.owner_name ?? `Owner ${id}`,
    plan_id: overrides?.plan_id,
    subscription_id: overrides?.subscription_id,
    created_at: new Date().toISOString(),
    trial_ends_at: overrides?.trial_ends_at,
    suspended_at: overrides?.suspended_at,
    cancelled_at: overrides?.cancelled_at,
  };
};

export const createTrialTenant = (overrides?: Partial<Tenant>): Tenant => {
  return createMockTenant({
    status: "trial",
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
};

export const createSuspendedTenant = (overrides?: Partial<Tenant>): Tenant => {
  return createMockTenant({
    status: "suspended",
    suspended_at: new Date().toISOString(),
    ...overrides,
  });
};

export const createExpiredTenant = (overrides?: Partial<Tenant>): Tenant => {
  return createMockTenant({
    status: "expired",
    trial_ends_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
};

// ============================================================================
// Module Factories
// ============================================================================

export const createMockModule = (overrides?: Partial<Module>): Module => {
  const id = moduleCounter++;
  const moduleName = overrides?.module_name ?? `Module ${id}`;

  return {
    id: `mod_${id}`,
    module_name: moduleName,
    module_code: overrides?.module_code ?? `module_${id}`.toUpperCase(),
    description: overrides?.description ?? `Description for ${moduleName}`,
    category: overrides?.category ?? ModuleCategory.NETWORK,
    is_core: overrides?.is_core ?? false,
    dependencies: overrides?.dependencies ?? [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

export const createCoreModule = (overrides?: Partial<Module>): Module => {
  return createMockModule({
    is_core: true,
    module_name: "Core Billing",
    module_code: "CORE_BILLING",
    category: ModuleCategory.BILLING,
    ...overrides,
  });
};

export const createPremiumModule = (overrides?: Partial<Module>): Module => {
  return createMockModule({
    module_name: "Advanced Analytics",
    module_code: "ADVANCED_ANALYTICS",
    category: ModuleCategory.ANALYTICS,
    is_core: false,
    ...overrides,
  });
};

// ============================================================================
// Quota Factories
// ============================================================================

export const createMockQuota = (overrides?: Partial<Quota>): Quota => {
  const id = quotaCounter++;
  const quotaName = overrides?.quota_name ?? `Quota ${id}`;

  return {
    id: `quota_${id}`,
    quota_name: quotaName,
    quota_code: overrides?.quota_code ?? `QUOTA_${id}`.toUpperCase(),
    unit_name: overrides?.unit_name ?? "units",
    description: overrides?.description ?? `Description for ${quotaName}`,
  };
};

export const createCustomerQuota = (overrides?: Partial<Quota>): Quota => {
  return createMockQuota({
    quota_name: "Customer Limit",
    quota_code: "MAX_CUSTOMERS",
    unit_name: "customers",
    description: "Maximum number of customers allowed",
    ...overrides,
  });
};

export const createUserQuota = (overrides?: Partial<Quota>): Quota => {
  return createMockQuota({
    quota_name: "User Limit",
    quota_code: "MAX_USERS",
    unit_name: "users",
    description: "Maximum number of staff users",
    ...overrides,
  });
};

// ============================================================================
// Service Plan Factories
// ============================================================================

export const createMockServicePlan = (overrides?: Partial<ServicePlan>): ServicePlan => {
  const id = planCounter++;
  const planName = overrides?.plan_name ?? `Plan ${id}`;

  return {
    id: `plan_${id}`,
    plan_name: planName,
    plan_code: overrides?.plan_code ?? `PLAN_${id}`.toUpperCase(),
    description: overrides?.description ?? `Description for ${planName}`,
    base_price_monthly: overrides?.base_price_monthly ?? 99.0,
    annual_discount_percent: overrides?.annual_discount_percent ?? 10,
    trial_days: overrides?.trial_days ?? 14,
    is_public: overrides?.is_public ?? true,
    is_active: overrides?.is_active ?? true,
    modules: overrides?.modules ?? [],
    quotas: overrides?.quotas ?? [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

export const createFreePlan = (overrides?: Partial<ServicePlan>): ServicePlan => {
  return createMockServicePlan({
    plan_name: "Free Plan",
    plan_code: "FREE",
    base_price_monthly: 0,
    trial_days: 0,
    modules: [
      {
        id: "pm_1",
        module_id: "mod_core_billing",
        included_by_default: true,
      } as PlanModule,
    ],
    quotas: [
      {
        id: "pq_1",
        quota_id: "quota_customers",
        included_quantity: 10,
        overage_allowed: false,
      } as PlanQuota,
    ],
    ...overrides,
  });
};

export const createStarterPlan = (overrides?: Partial<ServicePlan>): ServicePlan => {
  return createMockServicePlan({
    plan_name: "Starter Plan",
    plan_code: "STARTER",
    base_price_monthly: 49.0,
    trial_days: 14,
    modules: [
      {
        id: "pm_1",
        module_id: "mod_core_billing",
        included_by_default: true,
      } as PlanModule,
    ],
    quotas: [
      {
        id: "pq_1",
        quota_id: "quota_customers",
        included_quantity: 100,
        overage_allowed: true,
        overage_rate: 0.5,
      } as PlanQuota,
    ],
    ...overrides,
  });
};

export const createProfessionalPlan = (overrides?: Partial<ServicePlan>): ServicePlan => {
  return createMockServicePlan({
    plan_name: "Professional Plan",
    plan_code: "PROFESSIONAL",
    base_price_monthly: 149.0,
    trial_days: 14,
    modules: [
      {
        id: "pm_1",
        module_id: "mod_core_billing",
        included_by_default: true,
      } as PlanModule,
      {
        id: "pm_2",
        module_id: "mod_analytics",
        included_by_default: true,
      } as PlanModule,
    ],
    quotas: [
      {
        id: "pq_1",
        quota_id: "quota_customers",
        included_quantity: 1000,
        overage_allowed: true,
        overage_rate: 0.25,
      } as PlanQuota,
    ],
    ...overrides,
  });
};

// ============================================================================
// Subscription Factories
// ============================================================================

export const createMockSubscription = (
  overrides?: Partial<TenantSubscription>,
): TenantSubscription => {
  const id = subscriptionCounter++;
  const now = new Date();
  const monthFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return {
    id: `sub_${id}`,
    tenant_id: overrides?.tenant_id ?? `tenant_${id}`,
    plan_id: overrides?.plan_id ?? "plan_starter",
    status: overrides?.status ?? SubscriptionStatus.ACTIVE,
    billing_cycle: overrides?.billing_cycle ?? BillingCycle.MONTHLY,
    monthly_price: overrides?.monthly_price ?? 49.0,
    trial_end: overrides?.trial_end,
    current_period_start: overrides?.current_period_start ?? now.toISOString(),
    current_period_end: overrides?.current_period_end ?? monthFromNow.toISOString(),
    modules: overrides?.modules ?? [],
    quota_usage: overrides?.quota_usage ?? [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
};

export const createTrialSubscription = (
  overrides?: Partial<TenantSubscription>,
): TenantSubscription => {
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  return createMockSubscription({
    status: SubscriptionStatus.TRIAL,
    trial_end: trialEnd.toISOString(),
    monthly_price: 0,
    ...overrides,
  });
};

export const createActiveSubscription = (
  overrides?: Partial<TenantSubscription>,
): TenantSubscription => {
  return createMockSubscription({
    status: SubscriptionStatus.ACTIVE,
    ...overrides,
  });
};

export const createExpiredSubscription = (
  overrides?: Partial<TenantSubscription>,
): TenantSubscription => {
  const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  return createMockSubscription({
    status: SubscriptionStatus.EXPIRED,
    current_period_end: pastDate.toISOString(),
    ...overrides,
  });
};

// ============================================================================
// Quota Usage Factories
// ============================================================================

export const createMockQuotaUsage = (overrides?: Partial<QuotaUsage>): QuotaUsage => {
  return {
    id: `qu_${Math.random().toString(36).substr(2, 9)}`,
    quota_id: overrides?.quota_id ?? "quota_customers",
    allocated_quantity: overrides?.allocated_quantity ?? 100,
    current_usage: overrides?.current_usage ?? 50,
    overage_quantity: overrides?.overage_quantity ?? 0,
    overage_charges: overrides?.overage_charges ?? 0,
    quota: overrides?.quota,
  };
};

export const createQuotaUsageAtLimit = (overrides?: Partial<QuotaUsage>): QuotaUsage => {
  const allocated = overrides?.allocated_quantity ?? 100;

  return createMockQuotaUsage({
    allocated_quantity: allocated,
    current_usage: allocated,
    overage_quantity: 0,
    overage_charges: 0,
    ...overrides,
  });
};

export const createQuotaUsageWithOverage = (overrides?: Partial<QuotaUsage>): QuotaUsage => {
  const allocated = overrides?.allocated_quantity ?? 100;
  const usage = overrides?.current_usage ?? 120;
  const overage = usage - allocated;
  const overageRate = 0.5;

  return createMockQuotaUsage({
    allocated_quantity: allocated,
    current_usage: usage,
    overage_quantity: overage,
    overage_charges: overage * overageRate,
    ...overrides,
  });
};

// ============================================================================
// Helper Functions
// ============================================================================

export const isTenantTrialExpired = (tenant: Tenant): boolean => {
  if (!tenant.trial_ends_at) return false;
  return new Date(tenant.trial_ends_at) < new Date();
};

export const hasActiveTrial = (subscription: TenantSubscription): boolean => {
  if (subscription.status !== SubscriptionStatus.TRIAL) return false;
  if (!subscription.trial_end) return false;
  return new Date(subscription.trial_end) > new Date();
};

export const isQuotaExceeded = (quotaUsage: QuotaUsage): boolean => {
  return quotaUsage.current_usage >= quotaUsage.allocated_quantity;
};

export const getQuotaRemaining = (quotaUsage: QuotaUsage): number => {
  return Math.max(0, quotaUsage.allocated_quantity - quotaUsage.current_usage);
};

export const getQuotaUtilization = (quotaUsage: QuotaUsage): number => {
  return (quotaUsage.current_usage / quotaUsage.allocated_quantity) * 100;
};

export const resetPlatformCounters = () => {
  tenantCounter = 1;
  moduleCounter = 1;
  quotaCounter = 1;
  planCounter = 1;
  subscriptionCounter = 1;
};
