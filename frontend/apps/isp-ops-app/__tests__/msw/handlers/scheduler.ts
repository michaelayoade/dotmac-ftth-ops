/**
 * MSW Handlers for Scheduler API Endpoints
 */

import { http, HttpResponse } from "msw";
import type {
  ScheduledJob,
  JobChain,
  ScheduledJobCreate,
  ScheduledJobUpdate,
  ScheduledJobResponse,
  JobChainCreate,
  JobChainResponse,
} from "../../../types";

// In-memory storage for test data
let scheduledJobs: ScheduledJob[] = [];
let jobChains: JobChain[] = [];
let nextScheduledJobId = 1;
let nextJobChainId = 1;

// Reset storage between tests
export function resetSchedulerStorage() {
  scheduledJobs = [];
  jobChains = [];
  nextScheduledJobId = 1;
  nextJobChainId = 1;
}

// Helper to create a mock scheduled job
export function createMockScheduledJob(overrides?: Partial<ScheduledJob>): ScheduledJob {
  return {
    id: `scheduled-job-${nextScheduledJobId++}`,
    tenant_id: "tenant-123",
    name: "Test Scheduled Job",
    job_type: "data_sync",
    cron_expression: "0 0 * * *",
    interval_seconds: null,
    is_active: true,
    max_concurrent_runs: 1,
    priority: "normal",
    last_run_at: null,
    next_run_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    total_runs: 0,
    successful_runs: 0,
    failed_runs: 0,
    created_by: "user-123",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock job chain
export function createMockJobChain(overrides?: Partial<JobChain>): JobChain {
  return {
    id: `chain-${nextJobChainId++}`,
    tenant_id: "tenant-123",
    name: "Test Job Chain",
    description: "A test job chain",
    execution_mode: "sequential",
    is_active: true,
    status: "idle",
    current_step: 0,
    total_steps: 3,
    results: null,
    error_message: null,
    created_by: "user-123",
    created_at: new Date().toISOString(),
    chain_definition: [
      { job_type: "data_sync", parameters: {} },
      { job_type: "report_generation", parameters: {} },
      { job_type: "notification", parameters: {} },
    ],
    stop_on_failure: true,
    timeout_seconds: 3600,
    started_at: null,
    completed_at: null,
    ...overrides,
  };
}

// Helper to seed test data
export function seedSchedulerData(scheduledJobsData?: ScheduledJob[], jobChainsData?: JobChain[]) {
  if (scheduledJobsData) {
    scheduledJobs = [...scheduledJobsData];
  }
  if (jobChainsData) {
    jobChains = [...jobChainsData];
  }
}

export const schedulerHandlers = [
  // GET /api/v1/jobs/scheduler/scheduled-jobs - List scheduled jobs
  http.get("*/api/v1/jobs/scheduler/scheduled-jobs", ({ request, params }) => {
    return HttpResponse.json(scheduledJobs);
  }),

  // GET /api/v1/jobs/scheduler/scheduled-jobs/:id - Get single scheduled job
  http.get("*/api/v1/jobs/scheduler/scheduled-jobs/:id", ({ request, params }) => {
    const { id } = params;
    const job = scheduledJobs.find((j) => j.id === id);

    if (!job) {
      return HttpResponse.json({ error: "Scheduled job not found" }, { status: 404 });
    }

    return HttpResponse.json(job);
  }),

  // POST /api/v1/jobs/scheduler/scheduled-jobs - Create scheduled job
  http.post("*/api/v1/jobs/scheduler/scheduled-jobs", async ({ request, params }) => {
    const data = (await request.json()) as ScheduledJobCreate;

    const newJob: ScheduledJob = {
      id: `scheduled-job-${nextScheduledJobId++}`,
      tenant_id: "tenant-123",
      name: data.name,
      job_type: data.job_type,
      cron_expression: data.cron_expression || null,
      interval_seconds: data.interval_seconds || null,
      is_active: true,
      max_concurrent_runs: data.max_concurrent_runs || 1,
      priority: data.priority || "normal",
      last_run_at: null,
      next_run_at: new Date(Date.now() + 86400000).toISOString(),
      total_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
      created_by: "user-123",
      created_at: new Date().toISOString(),
    };

    scheduledJobs.push(newJob);

    return HttpResponse.json(newJob, { status: 201 });
  }),

  // PATCH /api/v1/jobs/scheduler/scheduled-jobs/:id - Update scheduled job
  http.patch("*/api/v1/jobs/scheduler/scheduled-jobs/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = (await request.json()) as ScheduledJobUpdate;

    const index = scheduledJobs.findIndex((j) => j.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Scheduled job not found" }, { status: 404 });
    }

    scheduledJobs[index] = {
      ...scheduledJobs[index],
      ...updates,
    };

    return HttpResponse.json(scheduledJobs[index]);
  }),

  // POST /api/v1/jobs/scheduler/scheduled-jobs/:id/toggle - Toggle scheduled job active status
  http.post("*/api/v1/jobs/scheduler/scheduled-jobs/:id/toggle", ({ request, params }) => {
    const { id } = params;
    const index = scheduledJobs.findIndex((j) => j.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Scheduled job not found" }, { status: 404 });
    }

    scheduledJobs[index].is_active = !scheduledJobs[index].is_active;

    return HttpResponse.json(scheduledJobs[index]);
  }),

  // DELETE /api/v1/jobs/scheduler/scheduled-jobs/:id - Delete scheduled job
  http.delete("*/api/v1/jobs/scheduler/scheduled-jobs/:id", ({ request, params }) => {
    const { id } = params;
    const index = scheduledJobs.findIndex((j) => j.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Scheduled job not found" }, { status: 404 });
    }

    scheduledJobs.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/v1/jobs/scheduler/chains - List job chains
  http.get("*/api/v1/jobs/scheduler/chains", ({ request, params }) => {
    return HttpResponse.json(jobChains);
  }),

  // GET /api/v1/jobs/scheduler/chains/:id - Get single job chain
  http.get("*/api/v1/jobs/scheduler/chains/:id", ({ request, params }) => {
    const { id } = params;
    const chain = jobChains.find((c) => c.id === id);

    if (!chain) {
      return HttpResponse.json({ error: "Job chain not found" }, { status: 404 });
    }

    return HttpResponse.json(chain);
  }),

  // POST /api/v1/jobs/scheduler/chains - Create job chain
  http.post("*/api/v1/jobs/scheduler/chains", async ({ request, params }) => {
    const data = (await request.json()) as JobChainCreate;

    const newChain: JobChain = {
      id: `chain-${nextJobChainId++}`,
      tenant_id: "tenant-123",
      name: data.name,
      description: data.description || null,
      execution_mode: data.execution_mode || "sequential",
      chain_definition: data.chain_definition,
      is_active: true,
      stop_on_failure: data.stop_on_failure ?? true,
      timeout_seconds: data.timeout_seconds || null,
      status: "idle",
      current_step: 0,
      total_steps: data.chain_definition.length,
      started_at: null,
      completed_at: null,
      results: null,
      error_message: null,
      created_by: "user-123",
      created_at: new Date().toISOString(),
    };

    jobChains.push(newChain);

    return HttpResponse.json(newChain, { status: 201 });
  }),

  // POST /api/v1/jobs/scheduler/chains/:id/execute - Execute job chain
  http.post("*/api/v1/jobs/scheduler/chains/:chainId/execute", ({ request, params }) => {
    const { chainId } = params;
    const index = jobChains.findIndex((c) => c.id === chainId);

    if (index === -1) {
      return HttpResponse.json({ error: "Job chain not found" }, { status: 404 });
    }

    // Update chain status to running
    jobChains[index].status = "running";
    jobChains[index].started_at = new Date().toISOString();
    jobChains[index].current_step = 1;

    return HttpResponse.json(jobChains[index]);
  }),

  // DELETE /api/v1/jobs/scheduler/chains/:id - Delete job chain
  http.delete("*/api/v1/jobs/scheduler/chains/:id", ({ request, params }) => {
    const { id } = params;
    const index = jobChains.findIndex((c) => c.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Job chain not found" }, { status: 404 });
    }

    jobChains.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
