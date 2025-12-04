/**
 * Type definitions for Job Scheduler API
 */

export enum JobPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export enum JobExecutionMode {
  SEQUENTIAL = "sequential",
  PARALLEL = "parallel",
}

// =============================================================================
// Scheduled Job Types
// =============================================================================

export interface ScheduledJobCreate {
  name: string;
  job_type: string;
  cron_expression?: string | null;
  interval_seconds?: number | null;
  description?: string | null;
  parameters?: Record<string, any> | null;
  priority?: JobPriority;
  max_retries?: number;
  retry_delay_seconds?: number;
  max_concurrent_runs?: number;
  timeout_seconds?: number | null;
}

export interface ScheduledJobUpdate {
  name?: string | null;
  description?: string | null;
  cron_expression?: string | null;
  interval_seconds?: number | null;
  is_active?: boolean | null;
  max_concurrent_runs?: number | null;
  timeout_seconds?: number | null;
  priority?: JobPriority | null;
  max_retries?: number | null;
  retry_delay_seconds?: number | null;
  parameters?: Record<string, any> | null;
}

export interface ScheduledJobResponse {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  job_type: string;
  cron_expression?: string | null;
  interval_seconds?: number | null;
  is_active: boolean;
  max_concurrent_runs: number;
  timeout_seconds?: number | null;
  priority: string;
  max_retries: number;
  retry_delay_seconds: number;
  last_run_at?: string | null;
  next_run_at?: string | null;
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  created_by: string;
  created_at: string;
}

export interface ScheduledJobListResponse {
  scheduled_jobs: ScheduledJobResponse[];
  total: number;
  page: number;
  page_size: number;
}

// =============================================================================
// Job Chain Types
// =============================================================================

export interface JobChainCreate {
  name: string;
  chain_definition: Array<Record<string, any>>;
  execution_mode?: JobExecutionMode;
  description?: string | null;
  stop_on_failure?: boolean;
  timeout_seconds?: number | null;
}

export interface JobChainResponse {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  execution_mode: string;
  chain_definition: Array<Record<string, any>>;
  is_active: boolean;
  stop_on_failure: boolean;
  timeout_seconds?: number | null;
  status: string;
  current_step: number;
  total_steps: number;
  started_at?: string | null;
  completed_at?: string | null;
  results?: Record<string, any> | null;
  error_message?: string | null;
  created_by: string;
  created_at: string;
}

export interface JobChainListResponse {
  chains: JobChainResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface JobChainExecuteResponse {
  chain_id: string;
  status: string;
  message: string;
  started_at: string;
}
