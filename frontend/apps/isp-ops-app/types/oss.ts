import type { PaginatedResponse } from "./api";

/**
 * ISP-focused domain models consumed by the frontend.
 * These mirror the backend schemas under dotmac.platform.radius,
 * dotmac.platform.services.lifecycle, and dotmac.platform.netbox.
 */

export interface RadiusSubscriber {
  id: number;
  tenant_id: string;
  subscriber_id: string;
  username: string;
  bandwidth_profile_id?: string | null;
  framed_ip_address?: string | null;
  session_timeout?: number | null;
  idle_timeout?: number | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RadiusSession {
  radacctid: number;
  tenant_id: string;
  subscriber_id?: string | null;
  username: string;
  acctsessionid: string;
  nasipaddress: string;
  framedipaddress?: string | null;
  acctstarttime?: string | null;
  acctsessiontime?: number | null;
  acctinputoctets?: number | null;
  acctoutputoctets?: number | null;
  total_bytes: number;
  is_active: boolean;
}

export interface ServiceStatistics {
  total_services: number;
  active_count: number;
  provisioning_count: number;
  suspended_count: number;
  terminated_count: number;
  failed_count: number;
  services_by_type: Record<string, number>;
  healthy_count: number;
  degraded_count: number;
  average_uptime: number;
  active_workflows: number;
  failed_workflows: number;
}

export type ServiceStatusValue =
  | "pending"
  | "provisioning"
  | "provisioning_failed"
  | "active"
  | "suspended"
  | "suspended_fraud"
  | "degraded"
  | "maintenance"
  | "terminating"
  | "terminated"
  | "failed";

export interface ServiceInstanceSummary {
  id: string;
  service_identifier: string;
  service_name: string;
  service_type: string;
  customer_id: string;
  status: ServiceStatusValue;
  provisioning_status?: string | null;
  activated_at?: string | null;
  health_status?: string | null;
  created_at: string;
}

export type ServiceInstanceSummaryResponse = PaginatedResponse<ServiceInstanceSummary>;

export interface ServiceInstanceDetail extends ServiceInstanceSummary {
  subscription_id?: string | null;
  plan_id?: string | null;
  provisioned_at?: string | null;
  suspended_at?: string | null;
  terminated_at?: string | null;
  service_config?: Record<string, unknown>;
  equipment_assigned?: string[];
  ip_address?: string | null;
  vlan_id?: number | null;
  metadata?: Record<string, unknown>;
  notes?: string | null;
}

export interface NetboxHealth {
  healthy: boolean;
  version?: string | null;
  message: string;
}

export interface NetboxSite {
  id: number;
  name: string;
  slug: string;
  status: Record<string, unknown>;
  tenant?: Record<string, unknown> | null;
  facility?: string | null;
  description?: string | null;
  physical_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  created?: string | null;
  last_updated?: string | null;
}

export interface ScheduledJob {
  id: string;
  tenant_id: string;
  name: string;
  job_type: string;
  cron_expression?: string | null;
  interval_seconds?: number | null;
  is_active: boolean;
  max_concurrent_runs: number;
  priority: string;
  last_run_at?: string | null;
  next_run_at?: string | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  created_by: string;
  created_at: string;
}

export interface JobChain {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  execution_mode: string;
  is_active: boolean;
  status: string;
  current_step: number;
  total_steps: number;
  results?: Record<string, unknown> | null;
  error_message?: string | null;
  created_by: string;
  created_at: string;
  chain_definition?: Array<Record<string, unknown>>;
  stop_on_failure?: boolean;
  timeout_seconds?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
}

export type DunningActionType =
  | "email"
  | "sms"
  | "suspend_service"
  | "terminate_service"
  | "webhook"
  | "custom";

export type DunningExecutionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "canceled";

export interface DunningActionConfig {
  type: DunningActionType;
  delay_days: number;
  template?: string;
  webhook_url?: string;
  custom_config?: Record<string, unknown>;
}

export interface DunningExclusionRules {
  min_lifetime_value?: number;
  customer_tiers?: string[];
  customer_tags?: string[];
}

export interface DunningCampaign {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  trigger_after_days: number;
  max_retries: number;
  retry_interval_days: number;
  actions: DunningActionConfig[];
  exclusion_rules: DunningExclusionRules;
  is_active: boolean;
  priority: number;
  total_executions: number;
  successful_executions: number;
  total_recovered_amount: number;
  created_at: string;
  updated_at: string;
}
