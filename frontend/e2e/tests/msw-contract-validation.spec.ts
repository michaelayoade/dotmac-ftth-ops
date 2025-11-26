/**
 * MSW Contract Validation Tests
 *
 * These tests assert that our Node-based MSW server can enforce API contracts
 * before responses reach the UI. Each handler performs the validation logic
 * and replies with 500 when a contract violation is detected.
 */

import { test, expect } from "#e2e/fixtures";
import { server } from "../msw-setup";
import { http, HttpResponse } from "msw";

const API_BASE = process.env.BACKEND_URL
  ? `${process.env.BACKEND_URL}/api/v1`
  : "http://localhost:8000/api/v1";

type IntegrationStatus = "disabled" | "configuring" | "ready" | "error" | "deprecated";

interface Integration {
  name: string;
  type: string;
  provider: string;
  enabled: boolean;
  status: IntegrationStatus;
  settings_count: number;
  has_secrets: boolean;
  required_packages: string[];
  message?: string;
  last_check?: string;
  metadata?: Record<string, unknown> | null;
}

type IntegrationsResponse = {
  integrations: Integration[];
  total: number;
};

type DataTransferJobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
type DataTransferJobType = "import" | "export";

interface DataTransferJob {
  id: string;
  type: DataTransferJobType;
  status: DataTransferJobStatus;
  created_at: string;
  progress: number;
}

interface DataTransferResponse {
  jobs: DataTransferJob[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

function assertIntegrationsContract(payload: IntegrationsResponse) {
  if (!Array.isArray(payload.integrations)) {
    throw new Error("Response must include an integrations array");
  }
  if (typeof payload.total !== "number") {
    throw new Error("Response must include numeric total");
  }
  payload.integrations.forEach((integration, index) => {
    if (typeof integration.name !== "string")
      throw new Error(`integration[${index}]: name must be string`);
    if (typeof integration.type !== "string")
      throw new Error(`integration[${index}]: type must be string`);
    if (typeof integration.provider !== "string")
      throw new Error(`integration[${index}]: provider must be string`);
    if (typeof integration.enabled !== "boolean")
      throw new Error(`integration[${index}]: enabled must be boolean`);
    if (typeof integration.status !== "string")
      throw new Error(`integration[${index}]: status must be string`);
    if (!["disabled", "configuring", "ready", "error", "deprecated"].includes(integration.status)) {
      throw new Error(`integration[${index}]: invalid status ${integration.status}`);
    }
    if (typeof integration.settings_count !== "number")
      throw new Error(`integration[${index}]: settings_count must be number`);
    if (typeof integration.has_secrets !== "boolean")
      throw new Error(`integration[${index}]: has_secrets must be boolean`);
    if (!Array.isArray(integration.required_packages))
      throw new Error(`integration[${index}]: required_packages must be array`);
    if (integration.message && typeof integration.message !== "string") {
      throw new Error(`integration[${index}]: message must be string when provided`);
    }
    if (integration.last_check && typeof integration.last_check !== "string") {
      throw new Error(`integration[${index}]: last_check must be ISO string when provided`);
    }
    if (integration.metadata && typeof integration.metadata !== "object") {
      throw new Error(`integration[${index}]: metadata must be an object when provided`);
    }
  });
}

function assertDataTransferContract(payload: DataTransferResponse) {
  if (!Array.isArray(payload.jobs)) throw new Error("jobs must be array");
  for (const field of ["total", "page", "page_size"]) {
    if (typeof (payload as any)[field] !== "number") {
      throw new Error(`${field} must be number`);
    }
  }
  if (typeof payload.has_more !== "boolean") throw new Error("has_more must be boolean");

  payload.jobs.forEach((job, index) => {
    if (typeof job.id !== "string") throw new Error(`jobs[${index}]: id must be string`);
    if (!["import", "export"].includes(job.type)) {
      throw new Error(`jobs[${index}]: invalid type ${job.type}`);
    }
    if (!["pending", "running", "completed", "failed", "cancelled"].includes(job.status)) {
      throw new Error(`jobs[${index}]: invalid status ${job.status}`);
    }
    if (typeof job.created_at !== "string") {
      throw new Error(`jobs[${index}]: created_at must be string`);
    }
    if (typeof job.progress !== "number") {
      throw new Error(`jobs[${index}]: progress must be number`);
    }
    if (job.progress < 0 || job.progress > 100) {
      throw new Error(`jobs[${index}]: progress must be between 0 and 100`);
    }
  });
}

const integrationsPath = `${API_BASE}/integrations`;
const dataTransferJobsPath = `${API_BASE}/data-transfer/jobs`;

function registerIntegrationHandler(payload: IntegrationsResponse) {
  server.use(
    http.get(integrationsPath, () => {
      try {
        assertIntegrationsContract(payload);
        return HttpResponse.json(payload);
      } catch (error) {
        return HttpResponse.json(
          { error: error instanceof Error ? error.message : "Contract validation failed" },
          { status: 500 },
        );
      }
    }),
  );
}

function registerDataTransferHandler(payload: DataTransferResponse) {
  server.use(
    http.get(dataTransferJobsPath, () => {
      try {
        assertDataTransferContract(payload);
        return HttpResponse.json(payload);
      } catch (error) {
        return HttpResponse.json(
          { error: error instanceof Error ? error.message : "Contract validation failed" },
          { status: 500 },
        );
      }
    }),
  );
}

test.describe("MSW contract enforcement", () => {
  test("returns 200 for valid integrations payload", async ({ request }) => {
    registerIntegrationHandler({
      integrations: [
        {
          name: "sendgrid",
          type: "email",
          provider: "sendgrid",
          enabled: true,
          status: "ready",
          settings_count: 3,
          has_secrets: true,
          required_packages: ["sendgrid"],
          message: "Connected",
          last_check: new Date().toISOString(),
          metadata: { version: "v3" },
        },
      ],
      total: 1,
    });

    const response = await request.get(integrationsPath);
    expect(response.status()).toBe(200);
    const data = (await response.json()) as IntegrationsResponse;
    expect(Array.isArray(data.integrations)).toBe(true);
    expect(data.integrations[0].name).toBe("sendgrid");
  });

  test("fails contract when integrations payload is invalid", async ({ request }) => {
    registerIntegrationHandler({
      integrations: [
        {
          name: "broken",
          type: "email",
          provider: "broken-provider",
          enabled: true,
          status: "broken-status" as IntegrationStatus,
          settings_count: 2,
          has_secrets: false,
          required_packages: [],
        },
      ],
      total: 1,
    });

    const response = await request.get(integrationsPath);
    expect(response.status()).toBe(500);
    const { error } = await response.json();
    expect(error).toContain("invalid status");
  });

  test("returns 200 for valid data transfer payload", async ({ request }) => {
    registerDataTransferHandler({
      jobs: [
        {
          id: "job-1",
          type: "import",
          status: "running",
          created_at: new Date().toISOString(),
          progress: 45,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
      has_more: false,
    });

    const response = await request.get(dataTransferJobsPath);
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as DataTransferResponse;
    expect(payload.jobs[0].status).toBe("running");
  });

  test("fails contract when data transfer payload is invalid", async ({ request }) => {
    registerDataTransferHandler({
      jobs: [
        {
          id: "job-err",
          type: "export",
          status: "completed",
          created_at: new Date().toISOString(),
          progress: 120,
        },
      ],
      total: 1,
      page: 1,
      page_size: 20,
      has_more: false,
    });

    const response = await request.get(dataTransferJobsPath);
    expect(response.status()).toBe(500);
    const { error } = await response.json();
    expect(error).toContain("progress must be between 0 and 100");
  });
});
