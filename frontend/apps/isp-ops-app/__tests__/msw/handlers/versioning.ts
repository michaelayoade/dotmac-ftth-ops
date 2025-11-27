/**
 * MSW Handlers for API Versioning Management
 * Mocks version management, breaking changes, usage tracking, and configuration
 */

import { http, HttpResponse } from "msw";

// In-memory storage
let versions: any[] = [];
let breakingChanges: any[] = [];
let configuration: any = {
  default_version: "v1",
  supported_versions: ["v1"],
  deprecated_versions: [],
  versioning_strategy: "url_path",
  strict_mode: false,
  auto_upgrade: false,
};
let nextVersionId = 1;
let nextChangeId = 1;

// Factory functions
function createMockVersion(data: Partial<any> = {}): any {
  const now = new Date().toISOString();
  return {
    version: data.version || `v${nextVersionId++}`,
    major: parseInt(data.version?.replace(/\D/g, "") || `${nextVersionId}`),
    minor: data.minor || 0,
    patch: data.patch || 0,
    status: data.status || "active",
    release_date: data.release_date || now,
    deprecation_date: data.deprecation_date || null,
    sunset_date: data.sunset_date || null,
    removal_date: data.removal_date || null,
    is_default: data.is_default || false,
    is_supported: data.is_supported ?? true,
    description: data.description || "",
    documentation_url: data.documentation_url || null,
    changelog_url: data.changelog_url || null,
    migration_guide_url: data.migration_guide_url || null,
    created_at: now,
    updated_at: now,
    ...data,
  };
}

function createMockBreakingChange(data: Partial<any> = {}): any {
  return {
    id: `change-${nextChangeId++}`,
    version: data.version || "v2",
    change_type: data.change_type || "breaking",
    title: data.title || "Breaking Change",
    description: data.description || "Description of breaking change",
    affected_endpoints: data.affected_endpoints || [],
    migration_steps: data.migration_steps || [],
    before_example: data.before_example || null,
    after_example: data.after_example || null,
    severity: data.severity || "medium",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...data,
  };
}

// Seed functions
export function seedVersions(versionsList: any[]): void {
  versions = versionsList;
}

export function seedBreakingChanges(changesList: any[]): void {
  breakingChanges = changesList;
}

export function seedConfiguration(config: any): void {
  configuration = config;
}

export function clearVersioningData(): void {
  versions = [];
  breakingChanges = [];
  configuration = {
    default_version: "v1",
    supported_versions: ["v1"],
    deprecated_versions: [],
    versioning_strategy: "url_path",
    strict_mode: false,
    auto_upgrade: false,
  };
  nextVersionId = 1;
  nextChangeId = 1;
}

export const versioningHandlers = [
  // ============================================================================
  // Version Management Endpoints
  // ============================================================================

  // GET /api/v1/admin/versions - List all versions
  http.get("*/api/v1/admin/versions", ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const isSupported = url.searchParams.get("is_supported");
    const includeRemoved = url.searchParams.get("include_removed");

    let filteredVersions = [...versions];

    if (status) {
      filteredVersions = filteredVersions.filter((v) => v.status === status);
    }

    if (isSupported !== null) {
      filteredVersions = filteredVersions.filter(
        (v) => v.is_supported === (isSupported === "true"),
      );
    }

    if (includeRemoved !== "true") {
      filteredVersions = filteredVersions.filter((v) => v.status !== "removed");
    }

    return HttpResponse.json({ versions: filteredVersions });
  }),

  // GET /api/v1/admin/versions/config - MUST come before :version param route
  http.get("*/api/v1/admin/versions/config", ({ request }) => {
    return HttpResponse.json(configuration);
  }),

  // GET /api/v1/admin/versions/metrics/adoption - MUST come before :version param route
  http.get("*/api/v1/admin/versions/metrics/adoption", ({ request }) => {
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "30");

    const adoptionMetrics = {
      total_clients: 100,
      versions: versions.map((v) => ({
        version: v.version,
        request_count: Math.floor(Math.random() * 10000),
        unique_clients: Math.floor(Math.random() * 50),
        error_rate: Math.random() * 0.05,
        avg_response_time: Math.random() * 200,
        last_used: new Date().toISOString(),
        adoption_percentage: Math.random() * 100,
      })),
      deprecated_usage: 5,
      sunset_warnings: 10,
      migration_progress: [],
    };

    return HttpResponse.json(adoptionMetrics);
  }),

  // GET /api/v1/admin/versions/:version/usage - Version usage stats
  http.get("*/api/v1/admin/versions/:version/usage", ({ request, params }) => {
    const version = params.version as string;
    const url = new URL(request.url);
    const days = parseInt(url.searchParams.get("days") || "30");

    const versionData = versions.find((v) => v.version === version);
    if (!versionData) {
      return HttpResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const usageStats = {
      version: version as string,
      request_count: Math.floor(Math.random() * 10000),
      unique_clients: Math.floor(Math.random() * 50),
      error_rate: Math.random() * 0.05,
      avg_response_time: Math.random() * 200,
      last_used: new Date().toISOString(),
      adoption_percentage: Math.random() * 100,
    };

    return HttpResponse.json(usageStats);
  }),

  // GET /api/v1/admin/versions/:version/health - Version health check
  http.get("*/api/v1/admin/versions/:version/health", ({ params }) => {
    const version = params.version as string;

    const versionData = versions.find((v) => v.version === version);
    if (!versionData) {
      return HttpResponse.json({ error: "Version not found" }, { status: 404 });
    }

    const healthCheck = {
      version: version as string,
      is_healthy: true,
      issues: [],
      endpoint_health: [
        {
          endpoint: "/api/test",
          is_available: true,
          avg_response_time: 120,
          error_rate: 0.01,
        },
      ],
      last_check: new Date().toISOString(),
    };

    return HttpResponse.json(healthCheck);
  }),

  // PATCH /api/v1/admin/versions/config - MUST come before :version param route
  http.patch("*/api/v1/admin/versions/config", async (req) => {
    const updates = await req.json<any>();
    configuration = { ...configuration, ...updates };
    return HttpResponse.json(configuration);
  }),

  // ============================================================================
  // Breaking Changes Endpoints - MUST come before :version param routes
  // ============================================================================

  // GET /api/v1/admin/versions/breaking-changes - List breaking changes
  http.get("*/api/v1/admin/versions/breaking-changes", ({ request }) => {
    const url = new URL(request.url);
    const version = url.searchParams.get("version");
    const changeType = url.searchParams.get("change_type");
    const severity = url.searchParams.get("severity");

    let filteredChanges = [...breakingChanges];

    if (version) {
      filteredChanges = filteredChanges.filter((c) => c.version === version);
    }

    if (changeType) {
      filteredChanges = filteredChanges.filter((c) => c.change_type === changeType);
    }

    if (severity) {
      filteredChanges = filteredChanges.filter((c) => c.severity === severity);
    }

    return HttpResponse.json({ changes: filteredChanges });
  }),

  // GET /api/v1/admin/versions/breaking-changes/:id - Get breaking change
  http.get("*/api/v1/admin/versions/breaking-changes/:id", ({ params }) => {
    const id = params.id as string;
    const change = breakingChanges.find((c) => c.id === id);

    if (!change) {
      return HttpResponse.json({ error: "Breaking change not found" }, { status: 404 });
    }

    return HttpResponse.json(change);
  }),

  // POST /api/v1/admin/versions/breaking-changes - Create breaking change
  http.post("*/api/v1/admin/versions/breaking-changes", async (req) => {
    const body = await req.json<any>();
    const newChange = createMockBreakingChange(body);
    breakingChanges.push(newChange);
    return HttpResponse.json(newChange);
  }),

  // PATCH /api/v1/admin/versions/breaking-changes/:id - Update breaking change
  http.patch("*/api/v1/admin/versions/breaking-changes/:id", async ({ params, request }) => {
    const id = params.id as string;
    const updates = await request.json<any>();

    const changeIndex = breakingChanges.findIndex((c) => c.id === id);
    if (changeIndex === -1) {
      return HttpResponse.json({ error: "Breaking change not found" }, { status: 404 });
    }

    breakingChanges[changeIndex] = {
      ...breakingChanges[changeIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(breakingChanges[changeIndex]);
  }),

  // DELETE /api/v1/admin/versions/breaking-changes/:id - Delete breaking change
  http.delete("*/api/v1/admin/versions/breaking-changes/:id", ({ params }) => {
    const id = params.id as string;

    const changeIndex = breakingChanges.findIndex((c) => c.id === id);
    if (changeIndex === -1) {
      return HttpResponse.json({ error: "Breaking change not found" }, { status: 404 });
    }

    breakingChanges.splice(changeIndex, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /api/v1/admin/versions/:version - Get specific version
  http.get("*/api/v1/admin/versions/:version", ({ params }) => {
    const version = params.version as string;

    const versionData = versions.find((v) => v.version === version);

    if (!versionData) {
      return HttpResponse.json({ error: "Version not found" }, { status: 404 });
    }

    return HttpResponse.json(versionData);
  }),

  // POST /api/v1/admin/versions - Create version
  http.post("*/api/v1/admin/versions", async (req) => {
    const body = await req.json<any>();
    const newVersion = createMockVersion(body);

    // If this is set as default, update other versions
    if (body.is_default) {
      versions.forEach((v) => (v.is_default = false));
      configuration.default_version = newVersion.version;
    }

    versions.push(newVersion);
    configuration.supported_versions.push(newVersion.version);

    return HttpResponse.json(newVersion);
  }),

  // PATCH /api/v1/admin/versions/:version - Update version
  http.patch("*/api/v1/admin/versions/:version", async (req) => {
    const { version } = req.params;
    const updates = await req.json<any>();

    const versionIndex = versions.findIndex((v) => v.version === version);
    if (versionIndex === -1) {
      return HttpResponse.json({ error: "Version not found" }, { status: 404 });
    }

    versions[versionIndex] = {
      ...versions[versionIndex],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(versions[versionIndex]);
  }),

  // POST /api/v1/admin/versions/:version/deprecate - Deprecate version
  http.post("*/api/v1/admin/versions/:version/deprecate", async (req) => {
    const { version } = req.params;
    const body = await req.json<any>();

    const versionIndex = versions.findIndex((v) => v.version === version);
    if (versionIndex === -1) {
      return HttpResponse.json({ error: "Version not found" }, { status: 404 });
    }

    versions[versionIndex] = {
      ...versions[versionIndex],
      status: "deprecated",
      deprecation_date: body.deprecation_date,
      sunset_date: body.sunset_date,
      removal_date: body.removal_date,
      updated_at: new Date().toISOString(),
    };

    configuration.deprecated_versions.push(version);
    configuration.supported_versions = configuration.supported_versions.filter(
      (v: string) => v !== version,
    );

    return HttpResponse.json(versions[versionIndex]);
  }),

  // POST /api/v1/admin/versions/:version/undeprecate - Un-deprecate version
  http.post("*/api/v1/admin/versions/:version/undeprecate", ({ params }) => {
    const version = params.version as string;

    const versionIndex = versions.findIndex((v) => v.version === version);
    if (versionIndex === -1) {
      return HttpResponse.json({ error: "Version not found" }, { status: 404 });
    }

    versions[versionIndex] = {
      ...versions[versionIndex],
      status: "active",
      deprecation_date: null,
      sunset_date: null,
      removal_date: null,
      updated_at: new Date().toISOString(),
    };

    configuration.deprecated_versions = configuration.deprecated_versions.filter(
      (v: string) => v !== version,
    );
    if (!configuration.supported_versions.includes(version)) {
      configuration.supported_versions.push(version as string);
    }

    return HttpResponse.json(versions[versionIndex]);
  }),

  // POST /api/v1/admin/versions/:version/set-default - Set default version
  http.post("*/api/v1/admin/versions/:version/set-default", ({ params }) => {
    const version = params.version as string;

    const versionIndex = versions.findIndex((v) => v.version === version);
    if (versionIndex === -1) {
      return HttpResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Update all versions
    versions.forEach((v, idx) => {
      if (idx === versionIndex) {
        v.is_default = true;
      } else {
        v.is_default = false;
      }
    });

    configuration.default_version = version;

    return HttpResponse.json(versions[versionIndex]);
  }),

  // DELETE /api/v1/admin/versions/:version - Remove version
  http.delete("*/api/v1/admin/versions/:version", ({ params }) => {
    const version = params.version as string;

    const versionIndex = versions.findIndex((v) => v.version === version);
    if (versionIndex === -1) {
      return HttpResponse.json({ error: "Version not found" }, { status: 404 });
    }

    versions.splice(versionIndex, 1);
    configuration.supported_versions = configuration.supported_versions.filter(
      (v: string) => v !== version,
    );
    configuration.deprecated_versions = configuration.deprecated_versions.filter(
      (v: string) => v !== version,
    );

    return new HttpResponse(null, { status: 204 });
  }),
];
