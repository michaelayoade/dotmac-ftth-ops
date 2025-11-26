/**
 * MSW Handlers for Integrations Endpoints
 *
 * These handlers intercept integrations API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type {
  IntegrationResponse,
  IntegrationListResponse,
  IntegrationType,
  IntegrationStatus,
} from "../../../hooks/useIntegrations";

// In-memory storage for test data
let integrations: IntegrationResponse[] = [];

// Reset storage between tests
export function resetIntegrationsStorage() {
  integrations = [];
}

// Helper to create an integration
export function createMockIntegration(
  overrides?: Partial<IntegrationResponse>,
): IntegrationResponse {
  const name = overrides?.name || "test-integration";
  return {
    name,
    type: "email",
    provider: "sendgrid",
    enabled: true,
    status: "ready",
    message: null,
    last_check: new Date().toISOString(),
    settings_count: 5,
    has_secrets: false,
    required_packages: ["sendgrid"],
    metadata: null,
    ...overrides,
  };
}

// Helper to seed initial data
export function seedIntegrationsData(integrationsData: IntegrationResponse[]) {
  integrations = [...integrationsData];
}

export const integrationsHandlers = [
  // GET /api/v1/integrations - List all integrations
  http.get("*/api/v1/integrations", (req, res, ctx) => {
    console.log("[MSW] GET /api/v1/integrations", { totalIntegrations: integrations.length });

    const response: IntegrationListResponse = {
      integrations,
      total: integrations.length,
    };

    return HttpResponse.json(response);
  }),

  // GET /api/v1/integrations/:name - Get single integration
  http.get("*/api/v1/integrations/:name", (req, res, ctx) => {
    const { name } = req.params;

    console.log("[MSW] GET /api/v1/integrations/:name", { name });

    const integration = integrations.find((i) => i.name === name);

    if (!integration) {
      console.log("[MSW] Integration not found", name);
      return HttpResponse.json(
        { error: "Integration not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return HttpResponse.json(integration);
  }),

  // POST /api/v1/integrations/:name/health-check - Trigger health check
  http.post("*/api/v1/integrations/:name/health-check", (req, res, ctx) => {
    const { name } = req.params;

    console.log("[MSW] POST /api/v1/integrations/:name/health-check", { name });

    const integration = integrations.find((i) => i.name === name);

    if (!integration) {
      console.log("[MSW] Integration not found", name);
      return HttpResponse.json(
        { error: "Integration not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Update last_check timestamp
    const updatedIntegration: IntegrationResponse = {
      ...integration,
      last_check: new Date().toISOString(),
      status: integration.enabled ? "ready" : "disabled",
    };

    // Update in storage
    const index = integrations.findIndex((i) => i.name === name);
    if (index !== -1) {
      integrations[index] = updatedIntegration;
    }

    return HttpResponse.json(updatedIntegration);
  }),
];
