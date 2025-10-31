/**
 * TypeScript type definitions for ISP Internet Service Plans
 *
 * These types match the backend Pydantic schemas and SQLAlchemy models.
 */

// ============================================================================
// Enums
// ============================================================================

export enum SpeedUnit {
  KBPS = "kbps",
  MBPS = "mbps",
  GBPS = "gbps",
}

export enum DataUnit {
  MB = "MB",
  GB = "GB",
  TB = "TB",
  UNLIMITED = "unlimited",
}

export enum PlanType {
  RESIDENTIAL = "residential",
  BUSINESS = "business",
  ENTERPRISE = "enterprise",
  PROMOTIONAL = "promotional",
}

export enum PlanStatus {
  DRAFT = "draft",
  ACTIVE = "active",
  INACTIVE = "inactive",
  ARCHIVED = "archived",
}

export enum BillingCycle {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  QUARTERLY = "quarterly",
  ANNUAL = "annual",
}

export enum ThrottlePolicy {
  NO_THROTTLE = "no_throttle",
  THROTTLE = "throttle",
  BLOCK = "block",
  OVERAGE_CHARGE = "overage_charge",
}

export enum ValidationSeverity {
  INFO = "info",
  WARNING = "warning",
  ERROR = "error",
}

export enum ValidationStatus {
  PASSED = "passed",
  FAILED = "failed",
  WARNING = "warning",
}

// ============================================================================
// Base Models
// ============================================================================

export interface InternetServicePlan {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;

  // Plan identification
  plan_code: string;
  name: string;
  description: string | null;
  plan_type: PlanType;
  status: PlanStatus;

  // Speed configuration
  download_speed: number;
  upload_speed: number;
  speed_unit: SpeedUnit;

  // Burst speeds
  burst_download_speed: number | null;
  burst_upload_speed: number | null;
  burst_duration_seconds: number | null;

  // Data cap configuration
  has_data_cap: boolean;
  data_cap_amount: number | null;
  data_cap_unit: DataUnit | null;
  throttle_policy: ThrottlePolicy;

  // Throttled speeds
  throttled_download_speed: number | null;
  throttled_upload_speed: number | null;

  // Overage charges
  overage_price_per_unit: number | null;
  overage_unit: DataUnit | null;

  // Fair Usage Policy (FUP)
  has_fup: boolean;
  fup_threshold: number | null;
  fup_threshold_unit: DataUnit | null;
  fup_throttle_speed: number | null;

  // Time-based restrictions
  has_time_restrictions: boolean;
  unrestricted_start_time: string | null; // HH:MM:SS format
  unrestricted_end_time: string | null; // HH:MM:SS format
  unrestricted_data_unlimited: boolean;
  unrestricted_speed_multiplier: number | null;

  // QoS and priority
  qos_priority: number;
  traffic_shaping_enabled: boolean;

  // Pricing
  monthly_price: number;
  setup_fee: number;
  currency: string;
  billing_cycle: BillingCycle;

  // Availability
  is_public: boolean;
  is_promotional: boolean;
  promotion_start_date: string | null;
  promotion_end_date: string | null;

  // Contract terms
  minimum_contract_months: number;
  early_termination_fee: number;

  // Technical specifications
  contention_ratio: string | null;
  ipv4_included: boolean;
  ipv6_included: boolean;
  static_ip_included: boolean;
  static_ip_count: number;

  // Additional services
  router_included: boolean;
  installation_included: boolean;
  technical_support_level: string | null;

  // Metadata
  tags: Record<string, unknown>;
  features: string[];
  restrictions: string[];

  // Validation tracking
  last_validated_at: string | null;
  validation_status: string | null;
  validation_errors: string[];
}

export interface PlanSubscription {
  id: string;
  tenant_id: string;
  created_at: string;
  updated_at: string | null;

  // References
  plan_id: string;
  customer_id: string;
  subscriber_id: string | null;
  subscription_id: string | null;

  // Subscription details
  start_date: string;
  end_date: string | null;
  is_active: boolean;

  // Custom overrides
  custom_download_speed: number | null;
  custom_upload_speed: number | null;
  custom_data_cap: number | null;
  custom_monthly_price: number | null;

  // Usage tracking
  current_period_usage_gb: number;
  last_usage_reset: string | null;

  // Status
  is_suspended: boolean;
  suspension_reason: string | null;
}

// ============================================================================
// Create/Update DTOs
// ============================================================================

export interface InternetServicePlanCreate {
  // Plan identification
  plan_code: string;
  name: string;
  description?: string | null;
  plan_type: PlanType;
  status?: PlanStatus;

  // Speed configuration
  download_speed: number;
  upload_speed: number;
  speed_unit?: SpeedUnit;

  // Burst speeds (optional)
  burst_download_speed?: number | null;
  burst_upload_speed?: number | null;
  burst_duration_seconds?: number | null;

  // Data cap configuration
  has_data_cap?: boolean;
  data_cap_amount?: number | null;
  data_cap_unit?: DataUnit | null;
  throttle_policy?: ThrottlePolicy;

  // Throttled speeds (optional)
  throttled_download_speed?: number | null;
  throttled_upload_speed?: number | null;

  // Overage charges (optional)
  overage_price_per_unit?: number | null;
  overage_unit?: DataUnit | null;

  // Fair Usage Policy (optional)
  has_fup?: boolean;
  fup_threshold?: number | null;
  fup_threshold_unit?: DataUnit | null;
  fup_throttle_speed?: number | null;

  // Time-based restrictions (optional)
  has_time_restrictions?: boolean;
  unrestricted_start_time?: string | null;
  unrestricted_end_time?: string | null;
  unrestricted_data_unlimited?: boolean;
  unrestricted_speed_multiplier?: number | null;

  // QoS
  qos_priority?: number;
  traffic_shaping_enabled?: boolean;

  // Pricing
  monthly_price: number;
  setup_fee?: number;
  currency?: string;
  billing_cycle?: BillingCycle;

  // Availability
  is_public?: boolean;
  is_promotional?: boolean;
  promotion_start_date?: string | null;
  promotion_end_date?: string | null;

  // Contract terms
  minimum_contract_months?: number;
  early_termination_fee?: number;

  // Technical specifications
  contention_ratio?: string | null;
  ipv4_included?: boolean;
  ipv6_included?: boolean;
  static_ip_included?: boolean;
  static_ip_count?: number;

  // Additional services
  router_included?: boolean;
  installation_included?: boolean;
  technical_support_level?: string | null;

  // Metadata
  tags?: Record<string, unknown>;
  features?: string[];
  restrictions?: string[];
}

export type InternetServicePlanUpdate = Partial<InternetServicePlanCreate>;

export interface PlanSubscriptionCreate {
  plan_id: string;
  customer_id: string;
  subscriber_id: string;
  start_date: string;
  custom_download_speed?: number | null;
  custom_upload_speed?: number | null;
  custom_data_cap?: number | null;
  custom_monthly_price?: number | null;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface PlanValidationRequest {
  // Test parameters
  test_download_usage_gb?: number;
  test_upload_usage_gb?: number;
  test_duration_hours?: number;
  test_concurrent_users?: number;

  // Validation toggles
  validate_speeds?: boolean;
  validate_data_caps?: boolean;
  validate_pricing?: boolean;
  validate_time_restrictions?: boolean;
  validate_qos?: boolean;
}

export interface ValidationResult {
  check_name: string;
  passed: boolean;
  severity: ValidationSeverity;
  message: string;
  details: Record<string, unknown>;
}

export interface PlanValidationResponse {
  plan_id: string;
  plan_code: string;
  overall_status: ValidationStatus;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  warning_checks: number;
  results: ValidationResult[];

  // Simulation results
  estimated_monthly_cost: number;
  estimated_overage_cost: number;
  data_cap_exceeded: boolean;
  throttling_triggered: boolean;
  average_download_speed_mbps: number;
  average_upload_speed_mbps: number;
  peak_download_speed_mbps: number;
  peak_upload_speed_mbps: number;
  validated_at: string;
}

// ============================================================================
// Comparison Types
// ============================================================================

export interface PlanComparison {
  plans: InternetServicePlan[];
  comparison_matrix: Record<string, unknown[]>;
  recommendations: string[];
}

// ============================================================================
// Usage Types
// ============================================================================

export interface UsageUpdateRequest {
  download_gb: number;
  upload_gb: number;
  timestamp?: string;
}

// ============================================================================
// Statistics Types
// ============================================================================

export interface PlanStatistics {
  plan_id: string;
  active_subscriptions: number;
  monthly_recurring_revenue: number;
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface ListPlansParams {
  plan_type?: PlanType;
  status?: PlanStatus;
  is_public?: boolean;
  is_promotional?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListSubscriptionsParams {
  plan_id?: string;
  customer_id?: string;
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

// ============================================================================
// UI Helper Types
// ============================================================================

export interface PlanFormData extends InternetServicePlanCreate {
  // Additional UI-specific fields if needed
}

export interface ValidationSimulationConfig {
  usageScenario: "light" | "moderate" | "heavy" | "custom";
  downloadGB: number;
  uploadGB: number;
  durationHours: number;
  concurrentUsers: number;
}

export interface PlanCardProps {
  plan: InternetServicePlan;
  onEdit?: (plan: InternetServicePlan) => void;
  onDelete?: (planId: string) => void;
  onValidate?: (planId: string) => void;
  onCompare?: (planId: string) => void;
}

export interface ValidationResultsProps {
  validation: PlanValidationResponse;
  onRevalidate?: () => void;
}
