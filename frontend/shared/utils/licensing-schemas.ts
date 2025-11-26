/**
 * Zod schemas for licensing framework validation
 */

import { z } from "zod";

// ============================================================================
// Enums
// ============================================================================

export const ModuleCategorySchema = z.enum([
  "NETWORK",
  "OSS_INTEGRATION",
  "BILLING",
  "ANALYTICS",
  "AUTOMATION",
  "COMMUNICATIONS",
  "SECURITY",
  "REPORTING",
  "API_MANAGEMENT",
  "OTHER",
]);
export type ModuleCategory = z.infer<typeof ModuleCategorySchema>;

export const PricingModelSchema = z.enum([
  "FLAT_FEE",
  "PER_UNIT",
  "TIERED",
  "USAGE_BASED",
  "CUSTOM",
  "FREE",
  "BUNDLED",
]);
export type PricingModel = z.infer<typeof PricingModelSchema>;

export const SubscriptionStatusSchema = z.enum([
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "CANCELED",
  "EXPIRED",
  "SUSPENDED",
]);
export type SubscriptionStatus = z.infer<typeof SubscriptionStatusSchema>;

export const BillingCycleSchema = z.enum(["MONTHLY", "ANNUAL"]);
export type BillingCycle = z.infer<typeof BillingCycleSchema>;

// ============================================================================
// Feature Modules
// ============================================================================

export const ModuleCapabilitySchema = z.object({
  id: z.string(),
  module_id: z.string(),
  capability_code: z.string(),
  capability_name: z.string(),
  description: z.string(),
  api_endpoints: z.array(z.string()),
  ui_routes: z.array(z.string()),
  config: z.record(z.any()),
  created_at: z.string(),
});
export type ModuleCapability = z.infer<typeof ModuleCapabilitySchema>;

export const FeatureModuleSchema = z.object({
  id: z.string(),
  module_code: z.string(),
  module_name: z.string(),
  category: ModuleCategorySchema.optional(),
  description: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  pricing_model: PricingModelSchema.optional(),
  base_price: z.number().optional(),
  price_per_unit: z.number().optional(),
  config_schema: z.record(z.any()).optional(),
  default_config: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
  is_public: z.boolean().optional(),
  extra_metadata: z.record(z.any()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  capabilities: z.array(ModuleCapabilitySchema).optional(),
});
export type FeatureModule = z.infer<typeof FeatureModuleSchema>;

// ============================================================================
// Quota Definitions
// ============================================================================

export const QuotaDefinitionSchema = z.object({
  id: z.string(),
  quota_code: z.string(),
  quota_name: z.string(),
  description: z.string().optional(),
  unit_name: z.string().optional(),
  unit_plural: z.string().optional(),
  pricing_model: PricingModelSchema.optional(),
  default_limit: z.number().optional(),
  overage_rate: z.number().optional(),
  is_metered: z.boolean().optional(),
  reset_period: z.string().optional(),
  is_active: z.boolean().optional(),
  extra_metadata: z.record(z.any()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});
export type QuotaDefinition = z.infer<typeof QuotaDefinitionSchema>;

// ============================================================================
// Service Plans
// ============================================================================

export const PricingTierSchema = z.object({
  from: z.number(),
  to: z.number().optional(),
  price_per_unit: z.number(),
});
export type PricingTier = z.infer<typeof PricingTierSchema>;

export const PlanQuotaAllocationSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  quota_id: z.string(),
  included_quantity: z.number(),
  soft_limit: z.number().optional(),
  allow_overage: z.boolean(),
  overage_rate_override: z.number().optional(),
  pricing_tiers: z.array(PricingTierSchema),
  config: z.record(z.any()),
  created_at: z.string(),
  quota: QuotaDefinitionSchema.optional(),
});
export type PlanQuotaAllocation = z.infer<typeof PlanQuotaAllocationSchema>;

export const PlanModuleSchema = z.object({
  id: z.string(),
  plan_id: z.string(),
  module_id: z.string(),
  included_by_default: z.boolean(),
  is_optional_addon: z.boolean(),
  override_price: z.number().optional(),
  trial_only: z.boolean(),
  promotional_until: z.string().optional(),
  config: z.record(z.any()),
  created_at: z.string(),
  module: FeatureModuleSchema.optional(),
});
export type PlanModule = z.infer<typeof PlanModuleSchema>;

export const ServicePlanSchema = z.object({
  id: z.string(),
  plan_name: z.string(),
  plan_code: z.string(),
  description: z.string().optional(),
  version: z.number().optional(),
  is_template: z.boolean().optional(),
  is_public: z.boolean().optional(),
  is_custom: z.boolean().optional(),
  base_price_monthly: z.number().optional(),
  annual_discount_percent: z.number().optional(),
  trial_days: z.number().optional(),
  trial_modules: z.array(z.string()).optional(),
  extra_metadata: z.record(z.any()).optional(),
  is_active: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  modules: z.array(PlanModuleSchema).optional(),
  quotas: z.array(PlanQuotaAllocationSchema).optional(),
});
export type ServicePlan = z.infer<typeof ServicePlanSchema>;

// ============================================================================
// Subscriptions
// ============================================================================

export const SubscriptionModuleSchema = z.object({
  id: z.string(),
  subscription_id: z.string(),
  module_id: z.string(),
  is_enabled: z.boolean(),
  source: z.enum(["PLAN", "ADDON", "TRIAL", "PROMOTIONAL"]),
  addon_price: z.number().optional(),
  expires_at: z.string().optional(),
  config: z.record(z.any()),
  activated_at: z.string(),
  module: FeatureModuleSchema.optional(),
});
export type SubscriptionModule = z.infer<typeof SubscriptionModuleSchema>;

export const SubscriptionQuotaUsageSchema = z.object({
  id: z.string(),
  subscription_id: z.string(),
  quota_id: z.string(),
  period_start: z.string(),
  period_end: z.string().optional(),
  allocated_quantity: z.number(),
  current_usage: z.number(),
  overage_quantity: z.number(),
  overage_charges: z.number(),
  last_updated: z.string(),
  quota: QuotaDefinitionSchema.optional(),
});
export type SubscriptionQuotaUsage = z.infer<typeof SubscriptionQuotaUsageSchema>;

export const TenantSubscriptionSchema = z.object({
  id: z.string(),
  tenant_id: z.string(),
  plan_id: z.string(),
  status: SubscriptionStatusSchema,
  billing_cycle: BillingCycleSchema,
  monthly_price: z.number().optional(),
  annual_price: z.number().optional(),
  trial_start: z.string().optional(),
  trial_end: z.string().optional(),
  current_period_start: z.string().optional(),
  current_period_end: z.string().optional(),
  stripe_customer_id: z.string().optional(),
  stripe_subscription_id: z.string().optional(),
  custom_config: z.record(z.any()).optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  plan: ServicePlanSchema.optional(),
  modules: z.array(SubscriptionModuleSchema).optional(),
  quota_usage: z.array(SubscriptionQuotaUsageSchema).optional(),
});
export type TenantSubscription = z.infer<typeof TenantSubscriptionSchema>;

// ============================================================================
// API Request/Response Types
// ============================================================================

export const CheckEntitlementResponseSchema = z.object({
  entitled: z.boolean(),
  message: z.string().optional(),
  upgrade_path: z.array(ServicePlanSchema).optional(),
});
export type CheckEntitlementResponse = z.infer<typeof CheckEntitlementResponseSchema>;

export const CheckQuotaResponseSchema = z.object({
  available: z.boolean(),
  current_usage: z.number().optional(),
  allocated_quantity: z.number().optional(),
  remaining: z.number(),
  used: z.number().optional(),
  will_exceed: z.boolean().optional(),
  overage_allowed: z.boolean().optional(),
  estimated_overage_charge: z.number().optional(),
});
export type CheckQuotaResponse = z.infer<typeof CheckQuotaResponseSchema>;

export const PlanPricingSchema = z.object({
  billing_period: z.string().optional(),
  total: z.number().optional(),
  currency: z.string().optional(),
  monthly: z.number().optional(),
  annual: z.number().optional(),
  monthly_price: z.number().optional(),
  annual_price: z.number().optional(),
  monthly_with_discount: z.number().optional(),
  savings_annual: z.number().optional(),
  base_price: z.number().optional(),
  modules_total: z.number().optional(),
  addons_total: z.number().optional(),
});
export type PlanPricing = z.infer<typeof PlanPricingSchema>;
