/**
 * MSW Handlers for Scheduler API Endpoints
 */

import { rest } from 'msw';
import type {
  ScheduledJob,
  JobChain,
  ScheduledJobCreate,
  ScheduledJobUpdate,
  ScheduledJobResponse,
  JobChainCreate,
  JobChainResponse,
} from '../../../types';

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
    tenant_id: 'tenant-123',
    name: 'Test Scheduled Job',
    job_type: 'data_sync',
    cron_expression: '0 0 * * *',
    interval_seconds: null,
    is_active: true,
    max_concurrent_runs: 1,
    priority: 'normal',
    last_run_at: null,
    next_run_at: new Date(Date.now() + 86400000).toISOString(), // 1 day from now
    total_runs: 0,
    successful_runs: 0,
    failed_runs: 0,
    created_by: 'user-123',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock job chain
export function createMockJobChain(overrides?: Partial<JobChain>): JobChain {
  return {
    id: `chain-${nextJobChainId++}`,
    tenant_id: 'tenant-123',
    name: 'Test Job Chain',
    description: 'A test job chain',
    execution_mode: 'sequential',
    is_active: true,
    status: 'idle',
    current_step: 0,
    total_steps: 3,
    results: null,
    error_message: null,
    created_by: 'user-123',
    created_at: new Date().toISOString(),
    chain_definition: [
      { job_type: 'data_sync', parameters: {} },
      { job_type: 'report_generation', parameters: {} },
      { job_type: 'notification', parameters: {} },
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
  rest.get('*/api/v1/jobs/scheduler/scheduled-jobs', (req, res, ctx) => {
    return res(ctx.json(scheduledJobs));
  }),

  // GET /api/v1/jobs/scheduler/scheduled-jobs/:id - Get single scheduled job
  rest.get('*/api/v1/jobs/scheduler/scheduled-jobs/:id', (req, res, ctx) => {
    const { id } = req.params;
    const job = scheduledJobs.find((j) => j.id === id);

    if (!job) {
      return res(ctx.status(404), ctx.json({ error: 'Scheduled job not found' }));
    }

    return res(ctx.json(job));
  }),

  // POST /api/v1/jobs/scheduler/scheduled-jobs - Create scheduled job
  rest.post('*/api/v1/jobs/scheduler/scheduled-jobs', (req, res, ctx) => {
    const data = req.body as ScheduledJobCreate;

    const newJob: ScheduledJob = {
      id: `scheduled-job-${nextScheduledJobId++}`,
      tenant_id: 'tenant-123',
      name: data.name,
      job_type: data.job_type,
      cron_expression: data.cron_expression || null,
      interval_seconds: data.interval_seconds || null,
      is_active: true,
      max_concurrent_runs: data.max_concurrent_runs || 1,
      priority: data.priority || 'normal',
      last_run_at: null,
      next_run_at: new Date(Date.now() + 86400000).toISOString(),
      total_runs: 0,
      successful_runs: 0,
      failed_runs: 0,
      created_by: 'user-123',
      created_at: new Date().toISOString(),
    };

    scheduledJobs.push(newJob);

    return res(ctx.status(201), ctx.json(newJob));
  }),

  // PATCH /api/v1/jobs/scheduler/scheduled-jobs/:id - Update scheduled job
  rest.patch('*/api/v1/jobs/scheduler/scheduled-jobs/:id', (req, res, ctx) => {
    const { id } = req.params;
    const updates = req.body as ScheduledJobUpdate;

    const index = scheduledJobs.findIndex((j) => j.id === id);

    if (index === -1) {
      return res(ctx.status(404), ctx.json({ error: 'Scheduled job not found' }));
    }

    scheduledJobs[index] = {
      ...scheduledJobs[index],
      ...updates,
    };

    return res(ctx.json(scheduledJobs[index]));
  }),

  // POST /api/v1/jobs/scheduler/scheduled-jobs/:id/toggle - Toggle scheduled job active status
  rest.post('*/api/v1/jobs/scheduler/scheduled-jobs/:id/toggle', (req, res, ctx) => {
    const { id } = req.params;
    const index = scheduledJobs.findIndex((j) => j.id === id);

    if (index === -1) {
      return res(ctx.status(404), ctx.json({ error: 'Scheduled job not found' }));
    }

    scheduledJobs[index].is_active = !scheduledJobs[index].is_active;

    return res(ctx.json(scheduledJobs[index]));
  }),

  // DELETE /api/v1/jobs/scheduler/scheduled-jobs/:id - Delete scheduled job
  rest.delete('*/api/v1/jobs/scheduler/scheduled-jobs/:id', (req, res, ctx) => {
    const { id } = req.params;
    const index = scheduledJobs.findIndex((j) => j.id === id);

    if (index === -1) {
      return res(ctx.status(404), ctx.json({ error: 'Scheduled job not found' }));
    }

    scheduledJobs.splice(index, 1);
    return res(ctx.status(204));
  }),

  // GET /api/v1/jobs/scheduler/chains - List job chains
  rest.get('*/api/v1/jobs/scheduler/chains', (req, res, ctx) => {
    return res(ctx.json(jobChains));
  }),

  // GET /api/v1/jobs/scheduler/chains/:id - Get single job chain
  rest.get('*/api/v1/jobs/scheduler/chains/:id', (req, res, ctx) => {
    const { id } = req.params;
    const chain = jobChains.find((c) => c.id === id);

    if (!chain) {
      return res(ctx.status(404), ctx.json({ error: 'Job chain not found' }));
    }

    return res(ctx.json(chain));
  }),

  // POST /api/v1/jobs/scheduler/chains - Create job chain
  rest.post('*/api/v1/jobs/scheduler/chains', (req, res, ctx) => {
    const data = req.body as JobChainCreate;

    const newChain: JobChain = {
      id: `chain-${nextJobChainId++}`,
      tenant_id: 'tenant-123',
      name: data.name,
      description: data.description || null,
      execution_mode: data.execution_mode || 'sequential',
      chain_definition: data.chain_definition,
      is_active: true,
      stop_on_failure: data.stop_on_failure ?? true,
      timeout_seconds: data.timeout_seconds || null,
      status: 'idle',
      current_step: 0,
      total_steps: data.chain_definition.length,
      started_at: null,
      completed_at: null,
      results: null,
      error_message: null,
      created_by: 'user-123',
      created_at: new Date().toISOString(),
    };

    jobChains.push(newChain);

    return res(ctx.status(201), ctx.json(newChain));
  }),

  // POST /api/v1/jobs/scheduler/chains/:id/execute - Execute job chain
  rest.post('*/api/v1/jobs/scheduler/chains/:chainId/execute', (req, res, ctx) => {
    const { chainId } = req.params;
    const index = jobChains.findIndex((c) => c.id === chainId);

    if (index === -1) {
      return res(ctx.status(404), ctx.json({ error: 'Job chain not found' }));
    }

    // Update chain status to running
    jobChains[index].status = 'running';
    jobChains[index].started_at = new Date().toISOString();
    jobChains[index].current_step = 1;

    return res(ctx.json(jobChains[index]));
  }),

  // DELETE /api/v1/jobs/scheduler/chains/:id - Delete job chain
  rest.delete('*/api/v1/jobs/scheduler/chains/:id', (req, res, ctx) => {
    const { id } = req.params;
    const index = jobChains.findIndex((c) => c.id === id);

    if (index === -1) {
      return res(ctx.status(404), ctx.json({ error: 'Job chain not found' }));
    }

    jobChains.splice(index, 1);
    return res(ctx.status(204));
  }),
];
