/**
 * Licensing Framework Types
 *
 * Type definitions for the composable licensing and entitlement system.
 */

// ============================================================================
// Enums
// ============================================================================

export enum ModuleCategory {
  NETWORK = "NETWORK",
  OSS_INTEGRATION = "OSS_INTEGRATION",
  BILLING = "BILLING",
  ANALYTICS = "ANALYTICS",
  AUTOMATION = "AUTOMATION",
  COMMUNICATIONS = "COMMUNICATIONS",
  SECURITY = "SECURITY",
  REPORTING = "REPORTING",
  API_MANAGEMENT = "API_MANAGEMENT",
  OTHER = "OTHER",
}

export enum PricingModel {
  FLAT_FEE = "FLAT_FEE",
  PER_UNIT = "PER_UNIT",
  TIERED = "TIERED",
  USAGE_BASED = "USAGE_BASED",
  CUSTOM = "CUSTOM",
  FREE = "FREE",
  BUNDLED = "BUNDLED",
}

export enum SubscriptionStatus {
  TRIAL = "TRIAL",
  ACTIVE = "ACTIVE",
  PAST_DUE = "PAST_DUE",
  CANCELED = "CANCELED",
  EXPIRED = "EXPIRED",
  SUSPENDED = "SUSPENDED",
}

export enum BillingCycle {
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}

export enum EventType {
  SUBSCRIPTION_CREATED = "SUBSCRIPTION_CREATED",
  TRIAL_STARTED = "TRIAL_STARTED",
  TRIAL_ENDED = "TRIAL_ENDED",
  TRIAL_CONVERTED = "TRIAL_CONVERTED",
  SUBSCRIPTION_RENEWED = "SUBSCRIPTION_RENEWED",
  SUBSCRIPTION_UPGRADED = "SUBSCRIPTION_UPGRADED",
  SUBSCRIPTION_DOWNGRADED = "SUBSCRIPTION_DOWNGRADED",
  SUBSCRIPTION_CANCELED = "SUBSCRIPTION_CANCELED",
  SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED",
  SUBSCRIPTION_SUSPENDED = "SUBSCRIPTION_SUSPENDED",
  SUBSCRIPTION_REACTIVATED = "SUBSCRIPTION_REACTIVATED",
  ADDON_ADDED = "ADDON_ADDED",
  ADDON_REMOVED = "ADDON_REMOVED",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  QUOTA_WARNING = "QUOTA_WARNING",
  PRICE_CHANGED = "PRICE_CHANGED",
}

// ============================================================================
// Feature Modules
// ============================================================================

export interface FeatureModule {
  id: string;
  module_code: string;
  module_name: string;
  category: ModuleCategory;
  description: string;
  dependencies: string[];
  pricing_model: PricingModel;
  base_price: number;
  price_per_unit?: number;
  config_schema: Record<string, any>;
  default_config: Record<string, any>;
  is_active: boolean;
  is_public: boolean;
  extra_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  capabilities?: ModuleCapability[];
}

export interface ModuleCapability {
  id: string;
  module_id: string;
  capability_code: string;
  capability_name: string;
  description: string;
  api_endpoints: string[];
  ui_routes: string[];
  config: Record<string, any>;
  created_at: string;
}

// ============================================================================
// Quota Definitions
// ============================================================================

export interface QuotaDefinition {
  id: string;
  quota_code: string;
  quota_name: string;
  description: string;
  unit_name: string;
  unit_plural: string;
  pricing_model: PricingModel;
  overage_rate?: number;
  is_metered: boolean;
  reset_period?: string; // 'MONTHLY', 'QUARTERLY', 'ANNUAL', null for lifetime
  is_active: boolean;
  extra_metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Service Plans
// ============================================================================

export interface ServicePlan {
  id: string;
  plan_name: string;
  plan_code: string;
  description: string;
  version: number;
  is_template: boolean;
  is_public: boolean;
  is_custom: boolean;
  base_price_monthly: number;
  annual_discount_percent: number;
  trial_days: number;
  trial_modules: string[];
  extra_metadata: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  modules?: PlanModule[];
  quotas?: PlanQuotaAllocation[];
}

export interface PlanModule {
  id: string;
  plan_id: string;
  module_id: string;
  included_by_default: boolean;
  is_optional_addon: boolean;
  override_price?: number;
  trial_only: boolean;
  promotional_until?: string;
  config: Record<string, any>;
  created_at: string;
  module?: FeatureModule;
}

export interface PlanQuotaAllocation {
  id: string;
  plan_id: string;
  quota_id: string;
  included_quantity: number;
  soft_limit?: number;
  allow_overage: boolean;
  overage_rate_override?: number;
  pricing_tiers: PricingTier[];
  config: Record<string, any>;
  created_at: string;
  quota?: QuotaDefinition;
}

export interface PricingTier {
  from: number;
  to?: number;
  price_per_unit: number;
}

// ============================================================================
// Subscriptions
// ============================================================================

export interface TenantSubscription {
  id: string;
  tenant_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_cycle: BillingCycle;
  monthly_price: number;
  annual_price?: number;
  trial_start?: string;
  trial_end?: string;
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  custom_config: Record<string, any>;
  created_at: string;
  updated_at: string;
  plan?: ServicePlan;
  modules?: SubscriptionModule[];
  quota_usage?: SubscriptionQuotaUsage[];
}

export interface SubscriptionModule {
  id: string;
  subscription_id: string;
  module_id: string;
  is_enabled: boolean;
  source: "PLAN" | "ADDON" | "TRIAL" | "PROMOTIONAL";
  addon_price?: number;
  expires_at?: string;
  config: Record<string, any>;
  activated_at: string;
  module?: FeatureModule;
}

export interface SubscriptionQuotaUsage {
  id: string;
  subscription_id: string;
  quota_id: string;
  period_start: string;
  period_end?: string;
  allocated_quantity: number;
  current_usage: number;
  overage_quantity: number;
  overage_charges: number;
  last_updated: string;
  quota?: QuotaDefinition;
}

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

export interface CheckEntitlementResponse {
  entitled: boolean;
  message?: string;
  upgrade_path?: ServicePlan[];
}

export interface CheckQuotaRequest {
  quota_code: string;
  quantity?: number;
}

export interface CheckQuotaResponse {
  available: boolean;
  current_usage: number;
  allocated_quantity: number;
  remaining: number;
  will_exceed: boolean;
  overage_allowed: boolean;
  estimated_overage_charge?: number;
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
  calculatePlanPrice: (id: string, params: any) => Promise<{ monthly: number; annual: number }>;

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

export interface PlanPricing {
  monthly_price: number;
  annual_price: number;
  monthly_with_discount: number;
  savings_annual: number;
  base_price: number;
  modules_total: number;
  addons_total: number;
}

export interface QuotaUsageStats {
  total_allocated: number;
  total_used: number;
  utilization_percent: number;
  quotas_at_limit: number;
  quotas_with_overage: number;
  total_overage_charges: number;
}
