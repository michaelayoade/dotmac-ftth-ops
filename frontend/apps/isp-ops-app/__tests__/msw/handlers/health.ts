/**
 * MSW Handlers for Health Check Endpoints
 *
 * These handlers intercept health check API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type { HealthSummary, ServiceHealth } from "../../../hooks/useHealth";

// In-memory storage for test data
let healthData: HealthSummary | null = null;
let shouldFail = false;
let failureStatus = 500;

// Reset storage between tests
export function resetHealthStorage() {
  healthData = null;
  shouldFail = false;
  failureStatus = 500;
}

// Helper to create a service health object
export function createMockServiceHealth(overrides?: Partial<ServiceHealth>): ServiceHealth {
  return {
    name: "test-service",
    status: "healthy",
    message: "Service is running",
    required: true,
    uptime: 99.9,
    responseTime: 50,
    lastCheck: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a health summary
export function createMockHealthSummary(overrides?: Partial<HealthSummary>): HealthSummary {
  return {
    status: "healthy",
    healthy: true,
    services: [
      createMockServiceHealth({ name: "database", status: "healthy" }),
      createMockServiceHealth({ name: "cache", status: "healthy" }),
      createMockServiceHealth({ name: "queue", status: "healthy" }),
    ],
    failed_services: [],
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedHealthData(health: HealthSummary) {
  healthData = health;
}

// Helper to make health check fail
export function makeHealthCheckFail(status = 500) {
  shouldFail = true;
  failureStatus = status;
}

// Helper to make health check succeed
export function makeHealthCheckSucceed() {
  shouldFail = false;
}

export const healthHandlers = [
  // GET /api/v1/ready - Get health status
  http.get("*/api/v1/ready", (req, res, ctx) => {
    console.log("[MSW] GET /api/v1/ready", { shouldFail, hasData: !!healthData });

    // Handle forced failure
    if (shouldFail) {
      if (failureStatus === 403) {
        return HttpResponse.json(
          {
            error: {
              message: "You do not have permission to view service health.",
            },
          },
          { status: 403 },
        );
      }

      return res(
        ctx.status(failureStatus),
        ctx.json({
          error: {
            message: "Service health check failed",
          },
        }),
      );
    }

    // Return seeded data or default healthy state
    const response = healthData || createMockHealthSummary();

    // Wrap in success format if not already wrapped
    // The hook expects either direct data or { success: true, data: ... }
    return HttpResponse.json({ success: true, data: response });
  }),
];
