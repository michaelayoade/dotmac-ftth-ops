/**
 * Licensing Framework Types
 *
 * Type definitions for the composable licensing and entitlement system.
 * Uses Zod-inferred types as the source of truth for runtime validation compatibility.
 */

// ============================================================================
// Import and re-export Zod-inferred types (source of truth)
// ============================================================================

import type {
  ModuleCategory as ModuleCategoryType,
  PricingModel as PricingModelType,
  SubscriptionStatus as SubscriptionStatusType,
  BillingCycle as BillingCycleType,
  FeatureModule as FeatureModuleType,
  ModuleCapability as ModuleCapabilityType,
  QuotaDefinition as QuotaDefinitionType,
  ServicePlan as ServicePlanType,
  PlanModule as PlanModuleType,
  PlanQuotaAllocation as PlanQuotaAllocationType,
  PricingTier as PricingTierType,
  TenantSubscription as TenantSubscriptionType,
  SubscriptionModule as SubscriptionModuleType,
  SubscriptionQuotaUsage as SubscriptionQuotaUsageType,
  CheckEntitlementResponse as CheckEntitlementResponseType,
  CheckQuotaResponse as CheckQuotaResponseType,
  PlanPricing as PlanPricingType,
} from "@shared/utils/licensing-schemas";

// Re-export types
export type ModuleCategory = ModuleCategoryType;
export type PricingModel = PricingModelType;
export type SubscriptionStatus = SubscriptionStatusType;
export type BillingCycle = BillingCycleType;
export type FeatureModule = FeatureModuleType;
export type ModuleCapability = ModuleCapabilityType;
export type QuotaDefinition = QuotaDefinitionType;
export type ServicePlan = ServicePlanType;
export type PlanModule = PlanModuleType;
export type PlanQuotaAllocation = PlanQuotaAllocationType;
export type PricingTier = PricingTierType;
export type TenantSubscription = TenantSubscriptionType;
export type SubscriptionModule = SubscriptionModuleType;
export type SubscriptionQuotaUsage = SubscriptionQuotaUsageType;
export type CheckEntitlementResponse = CheckEntitlementResponseType;
export type CheckQuotaResponse = CheckQuotaResponseType;
export type PlanPricing = PlanPricingType;

// Re-export schemas for runtime validation
export {
  ModuleCategorySchema,
  PricingModelSchema,
  SubscriptionStatusSchema,
  BillingCycleSchema,
} from "@shared/utils/licensing-schemas";

// ============================================================================
// Event Types (not in Zod schemas)
// ============================================================================

export type EventType =
  | "SUBSCRIPTION_CREATED"
  | "TRIAL_STARTED"
  | "TRIAL_ENDED"
  | "TRIAL_CONVERTED"
  | "SUBSCRIPTION_RENEWED"
  | "SUBSCRIPTION_UPGRADED"
  | "SUBSCRIPTION_DOWNGRADED"
  | "SUBSCRIPTION_CANCELED"
  | "SUBSCRIPTION_EXPIRED"
  | "SUBSCRIPTION_SUSPENDED"
  | "SUBSCRIPTION_REACTIVATED"
  | "ADDON_ADDED"
  | "ADDON_REMOVED"
  | "QUOTA_EXCEEDED"
  | "QUOTA_WARNING"
  | "PRICE_CHANGED";

// ============================================================================
// Additional Types (not in Zod schemas)
// ============================================================================

export interface FeatureUsageLog {
  id: string;
  subscription_id: string;
  module_id?: string;
  feature_name: string;
  usage_count: number;
  usage_metadata: Record<string, any>;
  logged_at: string;
}

export interface SubscriptionEvent {
  id: string;
  subscription_id: string;
  event_type: EventType;
  event_data: Record<string, any>;
  created_by?: string;
  created_at: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface CreateFeatureModuleRequest {
  module_code: string;
  module_name: string;
  category: ModuleCategory;
  description: string;
  dependencies?: string[];
  pricing_model: PricingModel;
  base_price: number;
  price_per_unit?: number;
  config_schema?: Record<string, any>;
  default_config?: Record<string, any>;
  capabilities?: CreateModuleCapabilityRequest[];
}

export interface CreateModuleCapabilityRequest {
  capability_code: string;
  capability_name: string;
  description: string;
  api_endpoints: string[];
  ui_routes: string[];
  config?: Record<string, any>;
}

export interface CreateQuotaDefinitionRequest {
  quota_code: string;
  quota_name: string;
  description: string;
  unit_name: string;
  unit_plural: string;
  pricing_model: PricingModel;
  overage_rate?: number;
  is_metered?: boolean;
  reset_period?: string;
}

export interface CreateServicePlanRequest {
  plan_name: string;
  plan_code: string;
  description: string;
  base_price_monthly: number;
  annual_discount_percent?: number;
  is_template?: boolean;
  is_public?: boolean;
  is_custom?: boolean;
  trial_days?: number;
  trial_modules?: string[];
  modules: PlanModuleConfig[];
  quotas: PlanQuotaConfig[];
  metadata?: Record<string, any>;
}

export interface PlanModuleConfig {
  module_id: string;
  included?: boolean;
  addon?: boolean;
  price?: number;
  trial_only?: boolean;
  promotional_until?: string;
  config?: Record<string, any>;
}

export interface PlanQuotaConfig {
  quota_id: string;
  quantity: number;
  soft_limit?: number;
  allow_overage?: boolean;
  overage_rate?: number;
  tiers?: PricingTier[];
  config?: Record<string, any>;
}

export interface CreateSubscriptionRequest {
  tenant_id: string;
  plan_id: string;
  billing_cycle: BillingCycle;
  start_trial?: boolean;
  custom_config?: Record<string, any>;
}

export interface AddAddonRequest {
  module_id: string;
}

export interface RemoveAddonRequest {
  module_id: string;
}

export interface CheckEntitlementRequest {
  module_code?: string;
  capability_code?: string;
}

export interface CheckQuotaRequest {
  quota_code: string;
  quantity?: number;
}

export interface ConsumeQuotaRequest {
  quota_code: string;
  quantity: number;
  metadata?: Record<string, any>;
}

export interface ReleaseQuotaRequest {
  quota_code: string;
  quantity: number;
  metadata?: Record<string, any>;
}

// ============================================================================
// UI Component Props
// ============================================================================

export interface PlanCardProps {
  plan: ServicePlan;
  currentPlan?: boolean;
  recommended?: boolean;
  onSelect?: (plan: ServicePlan) => void;
  billingCycle?: BillingCycle;
}

export interface ModuleListItemProps {
  module: FeatureModule;
  included: boolean;
  addon?: boolean;
  price?: number;
}

export interface QuotaUsageCardProps {
  quota: SubscriptionQuotaUsage;
  showDetails?: boolean;
}

export interface SubscriptionStatusBadgeProps {
  status: SubscriptionStatus;
}

export interface PlanComparisonTableProps {
  plans: ServicePlan[];
  currentPlanId?: string;
  onSelectPlan: (plan: ServicePlan) => void;
}

// ============================================================================
// Hook Return Types
// ============================================================================

export interface UseLicensingReturn {
  // Feature Modules
  modules: FeatureModule[];
  modulesLoading: boolean;
  modulesError: Error | null;
  createModule: (data: CreateFeatureModuleRequest) => Promise<FeatureModule>;
  updateModule: (id: string, data: Partial<FeatureModule>) => Promise<FeatureModule>;
  getModule: (id: string) => Promise<FeatureModule>;

  // Quotas
  quotas: QuotaDefinition[];
  quotasLoading: boolean;
  quotasError: Error | null;
  createQuota: (data: CreateQuotaDefinitionRequest) => Promise<QuotaDefinition>;
  updateQuota: (id: string, data: Partial<QuotaDefinition>) => Promise<QuotaDefinition>;

  // Service Plans
  plans: ServicePlan[];
  plansLoading: boolean;
  plansError: Error | null;
  createPlan: (data: CreateServicePlanRequest) => Promise<ServicePlan>;
  updatePlan: (id: string, data: Partial<ServicePlan>) => Promise<ServicePlan>;
  getPlan: (id: string) => Promise<ServicePlan>;
  duplicatePlan: (id: string) => Promise<ServicePlan>;
  calculatePlanPrice: (
    id: string,
    params: { billing_period?: string; quantity?: number },
  ) => Promise<PlanPricing>;

  // Subscriptions
  currentSubscription?: TenantSubscription;
  subscriptionLoading: boolean;
  subscriptionError: Error | null;
  createSubscription: (data: CreateSubscriptionRequest) => Promise<TenantSubscription>;
  addAddon: (data: AddAddonRequest) => Promise<void>;
  removeAddon: (data: RemoveAddonRequest) => Promise<void>;

  // Entitlements & Quotas
  checkEntitlement: (data: CheckEntitlementRequest) => Promise<CheckEntitlementResponse>;
  checkQuota: (data: CheckQuotaRequest) => Promise<CheckQuotaResponse>;
  consumeQuota: (data: ConsumeQuotaRequest) => Promise<void>;
  releaseQuota: (data: ReleaseQuotaRequest) => Promise<void>;

  // Utilities
  refetch: () => Promise<void>;
}

// ============================================================================
// Utility Types
// ============================================================================

export type LicensingError = {
  code: string;
  message: string;
  details?: Record<string, any>;
};

export interface QuotaUsageStats {
  total_allocated: number;
  total_used: number;
  utilization_percent: number;
  quotas_at_limit: number;
  quotas_with_overage: number;
  total_overage_charges: number;
}
