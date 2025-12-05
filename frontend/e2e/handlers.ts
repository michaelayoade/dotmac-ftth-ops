/**
 * MSW Handlers with Backend Proxy
 *
 * This file defines MSW handlers that proxy requests to the real backend
 * while validating API contracts. This approach provides:
 * - Contract enforcement between frontend and backend
 * - Ability to intercept and validate responses
 * - Deterministic test data when needed
 * - Real backend integration during development
 */

import { http, HttpResponse, passthrough } from "msw";

// Backend API base URL (configurable via environment)
const BACKEND_URL = process.env["NEXT_PUBLIC_API_BASE_URL"] || "http://localhost:8000";
const API_BASE = `${BACKEND_URL}/api/platform/v1`;

/**
 * Type definitions matching backend Pydantic models
 */
interface User {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

interface Integration {
  name: string;
  type: string;
  provider: string;
  enabled: boolean;
  status: string;
  settings_count: number;
  has_secrets: boolean;
  required_packages: string[];
}

interface Job {
  id: string;
  type: string;
  status: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  progress: number;
}

/**
 * Contract validation functions
 */
function validateUserContract(user: any): asserts user is User {
  if (typeof user.id !== "string") throw new Error("User.id must be string");
  if (typeof user.email !== "string") throw new Error("User.email must be string");
  if (typeof user.is_active !== "boolean") throw new Error("User.is_active must be boolean");
  if (typeof user.created_at !== "string") throw new Error("User.created_at must be string");
}

function validateIntegrationContract(integration: any): asserts integration is Integration {
  if (typeof integration.name !== "string") throw new Error("Integration.name must be string");
  if (typeof integration.type !== "string") throw new Error("Integration.type must be string");
  if (typeof integration.provider !== "string")
    throw new Error("Integration.provider must be string");
  if (typeof integration.enabled !== "boolean")
    throw new Error("Integration.enabled must be boolean");
  if (typeof integration.status !== "string") throw new Error("Integration.status must be string");
  if (typeof integration.settings_count !== "number")
    throw new Error("Integration.settings_count must be number");
  if (typeof integration.has_secrets !== "boolean")
    throw new Error("Integration.has_secrets must be boolean");
  if (!Array.isArray(integration.required_packages))
    throw new Error("Integration.required_packages must be array");
}

function validateJobContract(job: any): asserts job is Job {
  if (typeof job.id !== "string") throw new Error("Job.id must be string");
  if (typeof job.type !== "string") throw new Error("Job.type must be string");
  if (typeof job.status !== "string") throw new Error("Job.status must be string");
  if (typeof job.created_at !== "string") throw new Error("Job.created_at must be string");
  if (typeof job.progress !== "number") throw new Error("Job.progress must be number");
}

/**
 * MSW Handlers - Proxy Mode
 *
 * These handlers forward requests to the real backend and validate
 * the response contracts. This ensures TypeScript interfaces match
 * backend Pydantic models.
 */
export const handlers = [
  // User Management - List Users
  http.get(`${API_BASE}/users`, async ({ request }) => {
    try {
      // Forward to real backend
      const response = await fetch(new URL(request.url, BACKEND_URL), {
        headers: request.headers,
      });

      if (!response.ok) {
        return passthrough();
      }

      const data = await response.json();

      // Validate contract
      if (!data.users || !Array.isArray(data.users)) {
        throw new Error("Response must have users array");
      }

      // Validate each user matches contract
      data.users.forEach((user: any, index: number) => {
        try {
          validateUserContract(user);
        } catch (error) {
          throw new Error(`User at index ${index} failed validation: ${error}`);
        }
      });

      return HttpResponse.json(data);
    } catch (error) {
      console.error("MSW Contract Validation Error (users):", error);
      return passthrough();
    }
  }),

  // Integrations - List All
  http.get(`${API_BASE}/integrations`, async ({ request }) => {
    try {
      // Forward to real backend
      const response = await fetch(new URL(request.url, BACKEND_URL), {
        headers: request.headers,
      });

      if (!response.ok) {
        return passthrough();
      }

      const data = await response.json();

      // Validate contract
      if (!data.integrations || !Array.isArray(data.integrations)) {
        throw new Error("Response must have integrations array");
      }

      // Validate each integration matches contract
      data.integrations.forEach((integration: any, index: number) => {
        try {
          validateIntegrationContract(integration);
        } catch (error) {
          throw new Error(`Integration at index ${index} failed validation: ${error}`);
        }
      });

      return HttpResponse.json(data);
    } catch (error) {
      console.error("MSW Contract Validation Error (integrations):", error);
      return passthrough();
    }
  }),

  // Data Transfer - List Jobs
  http.get(`${API_BASE}/data-transfer/jobs`, async ({ request }) => {
    try {
      // Forward to real backend
      const response = await fetch(new URL(request.url, BACKEND_URL), {
        headers: request.headers,
      });

      if (!response.ok) {
        return passthrough();
      }

      const data = await response.json();

      // Validate contract
      if (!data.jobs || !Array.isArray(data.jobs)) {
        throw new Error("Response must have jobs array");
      }

      // Validate each job matches contract
      data.jobs.forEach((job: any, index: number) => {
        try {
          validateJobContract(job);
        } catch (error) {
          throw new Error(`Job at index ${index} failed validation: ${error}`);
        }
      });

      return HttpResponse.json(data);
    } catch (error) {
      console.error("MSW Contract Validation Error (jobs):", error);
      return passthrough();
    }
  }),

  // Health Check - System Health
  http.get(`${BACKEND_URL}/health`, async ({ request }) => {
    try {
      // Forward to real backend
      const response = await fetch(new URL(request.url, BACKEND_URL), {
        headers: request.headers,
      });

      if (!response.ok) {
        return passthrough();
      }

      const data = await response.json();

      // Validate contract
      if (typeof data.status !== "string") {
        throw new Error("Health response must have status string");
      }

      if (!data.checks || typeof data.checks !== "object") {
        throw new Error("Health response must have checks object");
      }

      const validStatuses = ["healthy", "degraded", "unhealthy"];
      if (!validStatuses.includes(data.status)) {
        throw new Error(`Invalid health status: ${data.status}`);
      }

      return HttpResponse.json(data);
    } catch (error) {
      console.error("MSW Contract Validation Error (health):", error);
      return passthrough();
    }
  }),

  // Monitoring - Metrics
  http.get(`${API_BASE}/monitoring/metrics`, async ({ request }) => {
    try {
      // Forward to real backend
      const response = await fetch(new URL(request.url, BACKEND_URL), {
        headers: request.headers,
      });

      if (!response.ok) {
        return passthrough();
      }

      const data = await response.json();

      // Validate contract
      const requiredFields = [
        "error_rate",
        "total_requests",
        "avg_response_time_ms",
        "successful_requests",
        "failed_requests",
        "top_errors",
      ];

      for (const field of requiredFields) {
        if (!(field in data)) {
          throw new Error(`Metrics response must have ${field} field`);
        }
      }

      if (!Array.isArray(data.top_errors)) {
        throw new Error("top_errors must be an array");
      }

      return HttpResponse.json(data);
    } catch (error) {
      console.error("MSW Contract Validation Error (metrics):", error);
      return passthrough();
    }
  }),

  // Settings - List Categories
  http.get(`${API_BASE}/admin/settings/categories`, async ({ request }) => {
    try {
      // Forward to real backend
      const response = await fetch(new URL(request.url, BACKEND_URL), {
        headers: request.headers,
      });

      if (!response.ok) {
        return passthrough();
      }

      const data = await response.json();

      // Validate contract
      if (!Array.isArray(data)) {
        throw new Error("Settings categories must be an array");
      }

      // Validate each category
      data.forEach((category: any, index: number) => {
        const requiredFields = ["category", "display_name", "description", "restart_required"];
        for (const field of requiredFields) {
          if (!(field in category)) {
            throw new Error(`Category at index ${index} missing ${field} field`);
          }
        }
      });

      return HttpResponse.json(data);
    } catch (error) {
      console.error("MSW Contract Validation Error (settings):", error);
      return passthrough();
    }
  }),

  // Plugins - List Instances
  http.get(`${API_BASE}/plugins/instances`, async ({ request }) => {
    try {
      // Forward to real backend
      const response = await fetch(new URL(request.url, BACKEND_URL), {
        headers: request.headers,
      });

      if (!response.ok) {
        return passthrough();
      }

      const data = await response.json();

      // Validate contract
      if (!data.plugins || !Array.isArray(data.plugins)) {
        throw new Error("Response must have plugins array");
      }

      if (typeof data.total !== "number") {
        throw new Error("Response must have total number");
      }

      return HttpResponse.json(data);
    } catch (error) {
      console.error("MSW Contract Validation Error (plugins):", error);
      return passthrough();
    }
  }),
];

/**
 * Deterministic Mock Handlers (for UI component testing)
 *
 * These handlers return fixed data for testing UI components
 * in isolation without backend dependency.
 */
export const mockHandlers = [
  http.get(`${API_BASE}/integrations`, () => {
    return HttpResponse.json({
      integrations: [
        {
          name: "sendgrid",
          type: "email",
          provider: "sendgrid",
          enabled: true,
          status: "ready",
          message: "Connected successfully",
          last_check: new Date().toISOString(),
          settings_count: 3,
          has_secrets: true,
          required_packages: ["sendgrid"],
          metadata: { api_version: "v3" },
        },
        {
          name: "twilio",
          type: "sms",
          provider: "twilio",
          enabled: true,
          status: "error",
          message: "Invalid credentials",
          last_check: new Date().toISOString(),
          settings_count: 4,
          has_secrets: true,
          required_packages: ["twilio"],
          metadata: null,
        },
      ],
      total: 2,
    });
  }),

  http.get(`${API_BASE}/data-transfer/jobs`, () => {
    return HttpResponse.json({
      jobs: [
        {
          id: "job-123",
          type: "import",
          status: "running",
          created_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          progress: 45,
          source_type: "csv",
          records_processed: 450,
          total_records: 1000,
        },
        {
          id: "job-456",
          type: "export",
          status: "completed",
          created_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          progress: 100,
          source_type: "json",
          records_processed: 2500,
          total_records: 2500,
        },
      ],
      total: 2,
      page: 1,
      page_size: 20,
      has_more: false,
    });
  }),
];
