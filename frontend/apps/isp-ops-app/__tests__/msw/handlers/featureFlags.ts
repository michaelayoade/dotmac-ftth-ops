/**
 * MSW Handlers for Feature Flags Endpoints
 *
 * These handlers intercept feature flags API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type { FeatureFlag, FlagStatus } from "../../../hooks/useFeatureFlags";

// In-memory storage for test data
let featureFlags: FeatureFlag[] = [];
let flagStatus: FlagStatus = {
  total_flags: 0,
  enabled_flags: 0,
  disabled_flags: 0,
  cache_hits: 0,
  cache_misses: 0,
};

// Reset storage between tests
export function resetFeatureFlagsStorage() {
  featureFlags = [];
  flagStatus = {
    total_flags: 0,
    enabled_flags: 0,
    disabled_flags: 0,
    cache_hits: 0,
    cache_misses: 0,
  };
}

// Helper to create a feature flag
export function createMockFeatureFlag(overrides?: Partial<FeatureFlag>): FeatureFlag {
  return {
    name: "test-feature",
    enabled: false,
    context: {},
    description: "Test feature flag",
    updated_at: Date.now(),
    created_at: Date.now(),
    ...overrides,
  };
}

// Helper to create flag status
export function createMockFlagStatus(overrides?: Partial<FlagStatus>): FlagStatus {
  return {
    total_flags: featureFlags.length,
    enabled_flags: featureFlags.filter((f) => f.enabled).length,
    disabled_flags: featureFlags.filter((f) => !f.enabled).length,
    cache_hits: 100,
    cache_misses: 10,
    last_sync: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedFeatureFlagsData(flags: FeatureFlag[], status?: FlagStatus) {
  featureFlags = [...flags];
  if (status) {
    flagStatus = status;
  } else {
    // Auto-calculate status from flags
    flagStatus = createMockFlagStatus();
  }
}

export const featureFlagsHandlers = [
  // GET /api/v1/feature-flags/flags - List feature flags
  http.get("*/api/v1/feature-flags/flags", ({ request, params }) => {
    const url = new URL(request.url);
    const enabledOnly = url.searchParams.get("enabled_only") === "true";

    console.log("[MSW] GET /api/v1/feature-flags/flags", {
      enabledOnly,
      totalFlags: featureFlags.length,
    });

    let filtered = featureFlags;
    if (enabledOnly) {
      filtered = featureFlags.filter((flag) => flag.enabled);
    }

    console.log("[MSW] Returning", filtered.length, "flags");

    // Hook expects response.data to be array directly, OR response.data.data
    // Since axios wraps in response.data, just return the array
    return HttpResponse.json(filtered);
  }),

  // GET /api/v1/feature-flags/status - Get flag status
  http.get("*/api/v1/feature-flags/status", ({ request, params }) => {
    console.log("[MSW] GET /api/v1/feature-flags/status");

    // Update status counts based on current flags
    const status = createMockFlagStatus();

    // Hook expects response.data to be the status object
    return HttpResponse.json(status);
  }),

  // PUT /api/v1/feature-flags/flags/:name - Toggle flag
  http.put("*/api/v1/feature-flags/flags/:name", async ({ request, params }) => {
    const { name } = params;
    const body = (await request.json()) as { enabled: boolean };

    console.log("[MSW] PUT /api/v1/feature-flags/flags/:name", { name, enabled: body.enabled });

    const flag = featureFlags.find((f) => f.name === name);

    if (!flag) {
      console.log("[MSW] Flag not found", name);
      return HttpResponse.json(
        { error: "Feature flag not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Update flag
    flag.enabled = body.enabled;
    flag.updated_at = Date.now();

    console.log("[MSW] Toggled flag", name, "to", body.enabled);

    return HttpResponse.json(flag);
  }),

  // POST /api/v1/feature-flags/flags/:name - Create flag
  http.post("*/api/v1/feature-flags/flags/:name", async ({ request, params }) => {
    const { name } = params;
    const body = (await request.json()) as Partial<FeatureFlag>;

    console.log("[MSW] POST /api/v1/feature-flags/flags/:name", { name, body });

    // Check if flag already exists
    const existingFlag = featureFlags.find((f) => f.name === name);
    if (existingFlag) {
      return HttpResponse.json(
        { error: "Feature flag already exists", code: "ALREADY_EXISTS" },
        { status: 400 },
      );
    }

    const newFlag = createMockFeatureFlag({
      name: name as string,
      enabled: body.enabled ?? false,
      context: body.context ?? {},
      description: body.description,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    featureFlags.push(newFlag);

    console.log("[MSW] Created flag", name);

    return HttpResponse.json(newFlag, { status: 201 });
  }),

  // DELETE /api/v1/feature-flags/flags/:name - Delete flag
  http.delete("*/api/v1/feature-flags/flags/:name", ({ request, params }) => {
    const { name } = params;

    console.log("[MSW] DELETE /api/v1/feature-flags/flags/:name", { name });

    const index = featureFlags.findIndex((f) => f.name === name);

    if (index === -1) {
      console.log("[MSW] Flag not found", name);
      return HttpResponse.json(
        { error: "Feature flag not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    featureFlags.splice(index, 1);

    console.log("[MSW] Deleted flag", name);

    return new HttpResponse(null, { status: 204 });
  }),
];
