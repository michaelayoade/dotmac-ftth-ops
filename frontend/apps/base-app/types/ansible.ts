// Ansible/AWX Types

export interface JobTemplate {
  id: number;
  name: string;
  description?: string | null;
  job_type?: string | null;
  inventory?: number | null;
  project?: number | null;
  playbook?: string | null;
}

export interface Job {
  id: number;
  name: string;
  status: string;
  created: string;
  started?: string | null;
  finished?: string | null;
  elapsed?: number | null;
}

export interface JobLaunchRequest {
  template_id: number;
  extra_vars?: Record<string, any> | null;
}

export interface JobLaunchResponse {
  job_id: number;
  status: string;
  message: string;
}

export interface AWXHealthResponse {
  healthy: boolean;
  message: string;
  total_templates?: number | null;
}
