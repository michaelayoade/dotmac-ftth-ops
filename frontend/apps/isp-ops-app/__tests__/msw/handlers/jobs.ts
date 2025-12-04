/**
 * MSW Handlers for Jobs API Endpoints
 */

import { http, HttpResponse } from "msw";
import type { Job, FieldInstallationJob, JobsResponse } from "../../../hooks/useJobs";

// In-memory storage for test data
let jobs: Job[] = [];
let nextJobId = 1;

// Reset storage between tests
export function resetJobsStorage() {
  jobs = [];
  nextJobId = 1;
}

// Helper to create a mock job
export function createMockJob(overrides?: Partial<Job>): Job {
  return {
    id: `job-${nextJobId++}`,
    tenant_id: "tenant-123",
    job_type: "bulk_notification",
    status: "pending",
    title: "Test Job",
    description: "A test job",
    items_total: 100,
    items_processed: 0,
    items_failed: 0,
    error_message: null,
    parameters: {},
    created_by: "user-123",
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancelled_by: null,
    assigned_technician_id: null,
    assigned_to: null,
    scheduled_start: null,
    scheduled_end: null,
    actual_start: null,
    actual_end: null,
    location_lat: null,
    location_lng: null,
    service_address: null,
    ...overrides,
  };
}

// Helper to create a mock field installation job
export function createMockFieldInstallationJob(
  overrides?: Partial<FieldInstallationJob>,
): FieldInstallationJob {
  return {
    id: `job-${nextJobId++}`,
    tenant_id: "tenant-123",
    job_type: "field_installation",
    status: "assigned",
    title: "Field Installation",
    description: "Install fiber connection",
    items_total: 1,
    items_processed: 0,
    items_failed: 0,
    error_message: null,
    parameters: {
      ticket_id: "ticket-123",
      ticket_number: "TKT-001",
      customer_id: "customer-123",
      order_id: "order-123",
      order_number: "ORD-001",
      priority: "high",
      required_skills: ["fiber_installation"],
    },
    created_by: "user-123",
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    cancelled_at: null,
    cancelled_by: null,
    assigned_technician_id: "tech-123",
    assigned_to: "John Doe",
    scheduled_start: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    scheduled_end: new Date(Date.now() + 7200000).toISOString(), // 2 hours from now
    actual_start: null,
    actual_end: null,
    location_lat: 37.7749,
    location_lng: -122.4194,
    service_address: "123 Main St, San Francisco, CA 94102",
    ...overrides,
  };
}

// Helper to seed test data
export function seedJobsData(jobsData: Job[]) {
  jobs = [...jobsData];
}

export const jobsHandlers = [
  // GET /api/v1/jobs - List jobs with filters
  http.get("*/api/v1/jobs", ({ request, params }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const jobType = url.searchParams.get("job_type");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    let filtered = jobs;

    // Filter by status
    if (status) {
      filtered = filtered.filter((job) => job.status === status);
    }

    // Filter by job type
    if (jobType) {
      filtered = filtered.filter((job) => job.job_type === jobType);
    }

    // Apply pagination
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    const response: JobsResponse = {
      jobs: paginated,
      total_count: total,
      limit,
      offset,
    };

    return HttpResponse.json(response);
  }),

  // POST /api/v1/jobs/:id/cancel - Cancel a job
  http.post("*/api/v1/jobs/:id/cancel", ({ request, params }) => {
    const { id } = params;
    const job = jobs.find((j) => j.id === id);

    if (!job) {
      return HttpResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Only allow cancelling certain statuses
    if (job.status === "completed" || job.status === "cancelled") {
      return HttpResponse.json(
        { error: "Cannot cancel a job that is already completed or cancelled" },
        { status: 400 },
      );
    }

    job.status = "cancelled";
    job.cancelled_at = new Date().toISOString();
    job.cancelled_by = "user-123";

    return HttpResponse.json(job);
  }),

  // GET /api/v1/jobs/:id - Get single job
  http.get("*/api/v1/jobs/:id", ({ request, params }) => {
    const { id } = params;
    const job = jobs.find((j) => j.id === id);

    if (!job) {
      return HttpResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return HttpResponse.json(job);
  }),

  // POST /api/v1/jobs - Create a new job
  http.post("*/api/v1/jobs", async ({ request, params }) => {
    const data = (await request.json()) as Partial<Job>;

    const newJob = createMockJob({
      ...data,
      id: `job-${nextJobId++}`,
      created_at: new Date().toISOString(),
    });

    jobs.push(newJob);

    return HttpResponse.json(newJob, { status: 201 });
  }),

  // PATCH /api/v1/jobs/:id - Update a job
  http.patch("*/api/v1/jobs/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = (await request.json()) as Partial<Job>;

    const index = jobs.findIndex((j) => j.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Job not found" }, { status: 404 });
    }

    jobs[index] = {
      ...jobs[index],
      ...updates,
    };

    return HttpResponse.json(jobs[index]);
  }),
];
