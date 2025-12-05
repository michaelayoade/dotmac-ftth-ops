/**
 * API Contract Validation Tests
 *
 * Validates that all frontend API calls match backend endpoints.
 * Tests contract compliance between TypeScript interfaces and
 * FastAPI Pydantic models.
 *
 * This catches:
 * - Missing endpoints
 * - Mismatched field names
 * - Type mismatches
 * - Breaking API changes
 */

import { test, expect } from "#e2e/fixtures";

test.describe("API Contract Validation", () => {
  const API_BASE = "http://localhost:8000/api/isp/v1";

  // Helper to validate common response patterns
  function validatePaginatedResponse(data: any) {
    expect(data).toHaveProperty("total");
    expect(typeof data.total).toBe("number");
    expect(data.total).toBeGreaterThanOrEqual(0);
  }

  function validateTimestamp(timestamp: any) {
    expect(typeof timestamp).toBe("string");
    expect(() => new Date(timestamp)).not.toThrow();
  }

  test.describe("User Management Endpoints", () => {
    test("GET /users - list users endpoint exists and returns valid structure", async ({
      request,
    }) => {
      const response = await request.get(`${API_BASE}/user-management/users`);

      // Endpoint should exist (might be 401/403 without auth)
      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        expect(data).toHaveProperty("users");
        expect(Array.isArray(data.users)).toBeTruthy();
        expect(data).toHaveProperty("total");
        expect(data).toHaveProperty("page");
        expect(data).toHaveProperty("page_size");
      }
    });

    test("User interface matches backend model", async ({ request }) => {
      const response = await request.get(`${API_BASE}/user-management/users`);

      if (response.ok()) {
        const data = await response.json();

        if (data.users && data.users.length > 0) {
          const user = data.users[0];

          // Required fields from UserResponse Pydantic model
          expect(user).toHaveProperty("id");
          expect(user).toHaveProperty("email");
          expect(user).toHaveProperty("is_active");
          expect(user).toHaveProperty("created_at");

          // Type validation
          expect(typeof user.id).toBe("string");
          expect(typeof user.email).toBe("string");
          expect(typeof user.is_active).toBe("boolean");
          validateTimestamp(user.created_at);
        }
      }
    });
  });

  test.describe("Settings Endpoints", () => {
    test("GET /admin/settings/categories - categories endpoint exists", async ({ request }) => {
      const response = await request.get(`${API_BASE}/admin/settings/categories`);

      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        expect(Array.isArray(data)).toBeTruthy();

        if (data.length > 0) {
          const category = data[0];
          expect(category).toHaveProperty("category");
          expect(category).toHaveProperty("display_name");
          expect(category).toHaveProperty("description");
          expect(category).toHaveProperty("restart_required");
          expect(category).toHaveProperty("has_sensitive_fields");
        }
      }
    });

    test("GET /admin/settings/category/{name} - category settings endpoint exists", async ({
      request,
    }) => {
      const response = await request.get(`${API_BASE}/admin/settings/category/jwt`);

      expect([200, 401, 403, 404]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        expect(data).toHaveProperty("category");
        expect(data).toHaveProperty("display_name");
        expect(data).toHaveProperty("fields");
        expect(Array.isArray(data.fields)).toBeTruthy();
      }
    });
  });

  test.describe("Plugins Endpoints", () => {
    test("GET /plugins - plugins list endpoint exists", async ({ request }) => {
      const response = await request.get(`${API_BASE}/plugins`);

      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();
        expect(Array.isArray(data)).toBeTruthy();
      }
    });

    test("GET /plugins/instances - plugin instances endpoint exists", async ({ request }) => {
      const response = await request.get(`${API_BASE}/plugins/instances`);

      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        expect(data).toHaveProperty("plugins");
        expect(data).toHaveProperty("total");
        expect(Array.isArray(data.plugins)).toBeTruthy();
      }
    });

    test("Plugin instance matches PluginInstance interface", async ({ request }) => {
      const response = await request.get(`${API_BASE}/plugins/instances`);

      if (response.ok()) {
        const data = await response.json();

        if (data.plugins && data.plugins.length > 0) {
          const plugin = data.plugins[0];

          // Required fields
          expect(plugin).toHaveProperty("id");
          expect(plugin).toHaveProperty("plugin_name");
          expect(plugin).toHaveProperty("instance_name");
          expect(plugin).toHaveProperty("status");
          expect(plugin).toHaveProperty("has_configuration");

          // Type validation
          expect(typeof plugin.id).toBe("string");
          expect(typeof plugin.plugin_name).toBe("string");
          expect(typeof plugin.instance_name).toBe("string");
          expect(typeof plugin.status).toBe("string");
          expect(typeof plugin.has_configuration).toBe("boolean");

          // Enum validation
          const validStatuses = ["registered", "configured", "active", "inactive", "error"];
          expect(validStatuses).toContain(plugin.status);
        }
      }
    });
  });

  test.describe("Monitoring Endpoints", () => {
    test("GET /monitoring/metrics - metrics endpoint exists", async ({ request }) => {
      const response = await request.get(`${API_BASE}/monitoring/metrics?period=24h`);

      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        // Required metrics fields
        expect(data).toHaveProperty("error_rate");
        expect(data).toHaveProperty("total_requests");
        expect(data).toHaveProperty("avg_response_time_ms");
        expect(data).toHaveProperty("successful_requests");
        expect(data).toHaveProperty("failed_requests");
        expect(data).toHaveProperty("top_errors");

        // Type validation
        expect(typeof data.error_rate).toBe("number");
        expect(typeof data.total_requests).toBe("number");
        expect(typeof data.avg_response_time_ms).toBe("number");
        expect(Array.isArray(data.top_errors)).toBeTruthy();
      }
    });

    test("GET /monitoring/logs/stats - log stats endpoint exists", async ({ request }) => {
      const response = await request.get(`${API_BASE}/monitoring/logs/stats?period=24h`);

      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        expect(data).toHaveProperty("total_logs");
        expect(data).toHaveProperty("critical_logs");
        expect(data).toHaveProperty("error_logs");
        expect(data).toHaveProperty("unique_users");
      }
    });

    test("GET /health - health check endpoint exists", async ({ request }) => {
      const response = await request.get("http://localhost:8000/health");

      expect(response.ok()).toBeTruthy();

      const data = await response.json();

      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("checks");
      expect(data).toHaveProperty("timestamp");

      const validStatuses = ["healthy", "degraded", "unhealthy"];
      expect(validStatuses).toContain(data.status);
    });
  });

  test.describe("Data Transfer Endpoints", () => {
    test("GET /data-transfer/jobs - jobs list endpoint exists", async ({ request }) => {
      const response = await request.get(`${API_BASE}/data-transfer/jobs?page=1&page_size=20`);

      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        expect(data).toHaveProperty("jobs");
        expect(data).toHaveProperty("total");
        expect(data).toHaveProperty("page");
        expect(data).toHaveProperty("page_size");
        expect(data).toHaveProperty("has_more");

        expect(Array.isArray(data.jobs)).toBeTruthy();
      }
    });

    test("GET /data-transfer/formats - formats endpoint exists", async ({ request }) => {
      const response = await request.get(`${API_BASE}/data-transfer/formats`);

      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        expect(data).toHaveProperty("import_formats");
        expect(data).toHaveProperty("export_formats");
        expect(data).toHaveProperty("compression_types");

        expect(Array.isArray(data.import_formats)).toBeTruthy();
        expect(Array.isArray(data.export_formats)).toBeTruthy();
        expect(Array.isArray(data.compression_types)).toBeTruthy();
      }
    });
  });

  test.describe("Integrations Endpoints", () => {
    test("GET /integrations - integrations list endpoint exists", async ({ request }) => {
      const response = await request.get(`${API_BASE}/integrations`);

      expect([200, 401, 403]).toContain(response.status());

      if (response.ok()) {
        const data = await response.json();

        expect(data).toHaveProperty("integrations");
        expect(data).toHaveProperty("total");
        expect(Array.isArray(data.integrations)).toBeTruthy();
      }
    });

    test("Integration response matches IntegrationResponse interface", async ({ request }) => {
      const response = await request.get(`${API_BASE}/integrations`);

      if (response.ok()) {
        const data = await response.json();

        if (data.integrations && data.integrations.length > 0) {
          const integration = data.integrations[0];

          // Required fields
          expect(integration).toHaveProperty("name");
          expect(integration).toHaveProperty("type");
          expect(integration).toHaveProperty("provider");
          expect(integration).toHaveProperty("enabled");
          expect(integration).toHaveProperty("status");
          expect(integration).toHaveProperty("settings_count");
          expect(integration).toHaveProperty("has_secrets");
          expect(integration).toHaveProperty("required_packages");

          // Type validation
          expect(typeof integration.name).toBe("string");
          expect(typeof integration.type).toBe("string");
          expect(typeof integration.provider).toBe("string");
          expect(typeof integration.enabled).toBe("boolean");
          expect(typeof integration.status).toBe("string");
          expect(typeof integration.settings_count).toBe("number");
          expect(typeof integration.has_secrets).toBe("boolean");
          expect(Array.isArray(integration.required_packages)).toBeTruthy();
        }
      }
    });
  });

  test.describe("Error Response Formats", () => {
    test("404 errors return consistent format", async ({ request }) => {
      const response = await request.get(`${API_BASE}/nonexistent-endpoint-12345`);

      expect(response.status()).toBe(404);

      const data = await response.json();
      expect(data).toHaveProperty("detail");
    });

    test("Validation errors return consistent format", async ({ request }) => {
      // Attempt to create something with invalid data
      const response = await request.post(`${API_BASE}/data-transfer/import`, {
        data: {
          source_type: "invalid-type",
          source_path: "",
          format: "invalid",
        },
      });

      if (response.status() === 422) {
        const data = await response.json();
        expect(data).toHaveProperty("detail");
      }
    });
  });
});
