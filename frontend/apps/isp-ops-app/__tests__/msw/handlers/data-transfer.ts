/**
 * MSW Handlers for Data Transfer API
 * Mocks import/export job management, format support, and job cancellation
 */

import { http, HttpResponse } from "msw";
import type {
  TransferJobResponse,
  TransferJobListResponse,
  ImportRequest,
  ExportRequest,
  FormatsResponse,
  TransferType,
  TransferStatus,
  DataFormat,
} from "@/hooks/useDataTransfer";

// In-memory storage
let jobs: TransferJobResponse[] = [];
let nextJobId = 1;

// Factory functions
function createMockJob(data: Partial<TransferJobResponse> = {}): TransferJobResponse {
  const now = new Date().toISOString();
  return {
    job_id: data.job_id || `job-${nextJobId++}`,
    name: data.name || `Transfer Job ${nextJobId}`,
    type: data.type || "import",
    status: data.status || "pending",
    progress: data.progress || 0,
    created_at: data.created_at || now,
    started_at: data.started_at || null,
    completed_at: data.completed_at || null,
    records_processed: data.records_processed || 0,
    records_failed: data.records_failed || 0,
    records_total: data.records_total || null,
    error_message: data.error_message || null,
    metadata: data.metadata || null,
    duration: data.duration || null,
    success_rate: data.success_rate,
    ...data,
  };
}

// Seed functions
export function seedJobs(jobsList: Partial<TransferJobResponse>[]): void {
  jobs = jobsList.map(createMockJob);
}

export function clearDataTransferData(): void {
  jobs = [];
  nextJobId = 1;
}

export function getJob(jobId: string): TransferJobResponse | undefined {
  return jobs.find((j) => j.job_id === jobId);
}

export const dataTransferHandlers = [
  // GET /api/v1/data-transfer/jobs - List transfer jobs
  http.get("*/api/v1/data-transfer/jobs", ({ request }) => {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") as TransferType | null;
    const status = url.searchParams.get("job_status") as TransferStatus | null;
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "20");

    let filteredJobs = [...jobs];

    // Apply filters
    if (type) {
      filteredJobs = filteredJobs.filter((j) => j.type === type);
    }
    if (status) {
      filteredJobs = filteredJobs.filter((j) => j.status === status);
    }

    // Pagination
    const total = filteredJobs.length;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedJobs = filteredJobs.slice(start, end);

    const response: TransferJobListResponse = {
      jobs: paginatedJobs,
      total,
      page,
      page_size: pageSize,
      has_more: end < total,
    };

    return HttpResponse.json(response);
  }),

  // GET /api/v1/data-transfer/jobs/:jobId - Get specific job
  http.get("*/api/v1/data-transfer/jobs/:jobId", ({ params }) => {
    const jobId = params.jobId as string;
    const job = jobs.find((j) => j.job_id === jobId);

    if (!job) {
      return HttpResponse.json({ detail: "Transfer job not found" }, { status: 404 });
    }

    return HttpResponse.json(job);
  }),

  // GET /api/v1/data-transfer/formats - Get supported formats
  http.get("*/api/v1/data-transfer/formats", ({ request }) => {
    const formats: FormatsResponse = {
      import_formats: [
        {
          format: "csv" as DataFormat,
          name: "CSV (Comma-Separated Values)",
          file_extensions: [".csv", ".txt"],
          mime_types: ["text/csv", "text/plain"],
          supports_compression: true,
          supports_streaming: true,
          options: {
            delimiter: ",",
            has_header: true,
            encoding: "utf-8",
          },
        },
        {
          format: "json" as DataFormat,
          name: "JSON (JavaScript Object Notation)",
          file_extensions: [".json"],
          mime_types: ["application/json"],
          supports_compression: true,
          supports_streaming: true,
          options: {
            pretty_print: false,
            encoding: "utf-8",
          },
        },
        {
          format: "excel" as DataFormat,
          name: "Excel Spreadsheet",
          file_extensions: [".xlsx", ".xls"],
          mime_types: [
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "application/vnd.ms-excel",
          ],
          supports_compression: false,
          supports_streaming: false,
          options: {
            sheet_name: "Sheet1",
            has_header: true,
          },
        },
      ],
      export_formats: [
        {
          format: "csv" as DataFormat,
          name: "CSV (Comma-Separated Values)",
          file_extensions: [".csv"],
          mime_types: ["text/csv"],
          supports_compression: true,
          supports_streaming: true,
          options: {
            delimiter: ",",
            include_header: true,
            encoding: "utf-8",
          },
        },
        {
          format: "json" as DataFormat,
          name: "JSON (JavaScript Object Notation)",
          file_extensions: [".json"],
          mime_types: ["application/json"],
          supports_compression: true,
          supports_streaming: true,
          options: {
            pretty_print: true,
            encoding: "utf-8",
          },
        },
      ],
      compression_types: ["none", "gzip", "zip", "bzip2"],
    };

    return HttpResponse.json(formats);
  }),

  // POST /api/v1/data-transfer/import - Create import job
  http.post("*/api/v1/data-transfer/import", async (req) => {
    const body = await req.json<ImportRequest>();

    const newJob = createMockJob({
      type: "import",
      name: `Import from ${body.source_type}`,
      status: "pending",
      metadata: {
        source_type: body.source_type,
        source_path: body.source_path,
        format: body.format,
        validation_level: body.validation_level || "basic",
        dry_run: body.dry_run || false,
      },
    });

    jobs.push(newJob);

    return HttpResponse.json(newJob);
  }),

  // POST /api/v1/data-transfer/export - Create export job
  http.post("*/api/v1/data-transfer/export", async (req) => {
    const body = await req.json<ExportRequest>();

    const newJob = createMockJob({
      type: "export",
      name: `Export to ${body.target_type}`,
      status: "pending",
      metadata: {
        target_type: body.target_type,
        target_path: body.target_path,
        format: body.format,
        compression: body.compression || "none",
        overwrite: body.overwrite || false,
      },
    });

    jobs.push(newJob);

    return HttpResponse.json(newJob);
  }),

  // DELETE /api/v1/data-transfer/jobs/:jobId - Cancel job
  http.delete("*/api/v1/data-transfer/jobs/:jobId", ({ params }) => {
    const jobId = params.jobId as string;
    const jobIndex = jobs.findIndex((j) => j.job_id === jobId);

    if (jobIndex === -1) {
      return HttpResponse.json({ detail: "Transfer job not found" }, { status: 404 });
    }

    // Update job status to cancelled
    jobs[jobIndex] = {
      ...jobs[jobIndex],
      status: "cancelled",
      completed_at: new Date().toISOString(),
    };

    return new HttpResponse(null, { status: 204 });
  }),
];
