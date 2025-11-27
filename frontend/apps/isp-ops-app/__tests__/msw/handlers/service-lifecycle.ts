/**
 * MSW Handlers for Service Lifecycle API Endpoints
 *
 * These handlers intercept service lifecycle-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type {
  ServiceStatistics,
  ServiceInstanceSummary,
  ServiceInstanceDetail,
  ServiceStatusValue,
} from "../../../types/oss";

// In-memory storage for test data
let services: ServiceInstanceDetail[] = [];
let nextServiceId = 1;

// Reset storage between tests
export function resetServiceLifecycleStorage() {
  services = [];
  nextServiceId = 1;
}

// Helper to create a service instance
export function createMockServiceInstance(
  overrides?: Partial<ServiceInstanceDetail>,
): ServiceInstanceDetail {
  const id = `service-${nextServiceId++}`;
  const serviceIdentifier = `SVC-${String(nextServiceId).padStart(4, "0")}`;

  return {
    id,
    service_identifier: serviceIdentifier,
    service_name: "Fiber Internet Service",
    service_type: "internet",
    customer_id: "customer-1",
    status: "active",
    provisioning_status: null,
    activated_at: new Date().toISOString(),
    health_status: "healthy",
    created_at: new Date().toISOString(),
    subscription_id: null,
    plan_id: null,
    provisioned_at: new Date().toISOString(),
    suspended_at: null,
    terminated_at: null,
    service_config: {
      bandwidth: "1000Mbps",
      vlan: 100,
    },
    equipment_assigned: ["ONT-12345", "Router-67890"],
    ip_address: "192.168.1.100",
    vlan_id: 100,
    metadata: {},
    notes: null,
    ...overrides,
  };
}

// Helper to seed initial data
export function seedServiceLifecycleData(servicesData: ServiceInstanceDetail[]) {
  services = [...servicesData];
}

// Helper to create service statistics
export function createMockServiceStatistics(): ServiceStatistics {
  const servicesByType: Record<string, number> = {};

  let activeCount = 0;
  let provisioningCount = 0;
  let suspendedCount = 0;
  let terminatedCount = 0;
  let failedCount = 0;
  let healthyCount = 0;
  let degradedCount = 0;

  services.forEach((service) => {
    // Count by status
    switch (service.status) {
      case "active":
        activeCount++;
        break;
      case "provisioning":
        provisioningCount++;
        break;
      case "suspended":
      case "suspended_fraud":
        suspendedCount++;
        break;
      case "terminated":
        terminatedCount++;
        break;
      case "failed":
      case "provisioning_failed":
        failedCount++;
        break;
    }

    // Count by type
    servicesByType[service.service_type] = (servicesByType[service.service_type] || 0) + 1;

    // Count by health
    if (service.health_status === "healthy") {
      healthyCount++;
    } else if (service.health_status === "degraded") {
      degradedCount++;
    }
  });

  return {
    total_services: services.length,
    active_count: activeCount,
    provisioning_count: provisioningCount,
    suspended_count: suspendedCount,
    terminated_count: terminatedCount,
    failed_count: failedCount,
    services_by_type: servicesByType,
    healthy_count: healthyCount,
    degraded_count: degradedCount,
    average_uptime: 99.5,
    active_workflows: 0,
    failed_workflows: 0,
  };
}

export const serviceLifecycleHandlers = [
  // GET /services/lifecycle/statistics - Get service statistics
  // NOTE: This MUST come before /services/lifecycle/services to avoid matching "statistics" incorrectly
  http.get("*/services/lifecycle/statistics", ({ request, params }) => {
    console.log("[MSW] GET /services/lifecycle/statistics");

    const stats = createMockServiceStatistics();
    return HttpResponse.json(stats);
  }),

  // GET /services/lifecycle/services - List service instances
  http.get("*/services/lifecycle/services", ({ request, params }) => {
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const status = url.searchParams.get("status");
    const serviceType = url.searchParams.get("service_type");

    console.log("[MSW] GET /services/lifecycle/services", {
      offset,
      limit,
      status,
      serviceType,
      totalServices: services.length,
    });

    let filtered = services;

    // Filter by status
    if (status) {
      filtered = filtered.filter((service) => service.status === status);
    }

    // Filter by service type
    if (serviceType) {
      filtered = filtered.filter((service) => service.service_type === serviceType);
    }

    // Paginate
    const start = offset;
    const end = offset + limit;
    const paginated = filtered.slice(start, end);

    // Convert to summary format
    const summaries: ServiceInstanceSummary[] = paginated.map((service) => ({
      id: service.id,
      service_identifier: service.service_identifier,
      service_name: service.service_name,
      service_type: service.service_type,
      customer_id: service.customer_id,
      status: service.status,
      provisioning_status: service.provisioning_status,
      activated_at: service.activated_at,
      health_status: service.health_status,
      created_at: service.created_at,
    }));

    console.log("[MSW] Returning", summaries.length, "services");

    return HttpResponse.json(summaries);
  }),

  // GET /services/lifecycle/services/:id - Get single service instance
  // NOTE: This must come AFTER /statistics route
  http.get("*/services/lifecycle/services/:id", ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] GET /services/lifecycle/services/:id", { id });

    const service = services.find((s) => s.id === id);

    if (!service) {
      return HttpResponse.json(
        { error: "Service instance not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return HttpResponse.json(service);
  }),

  // POST /services/lifecycle/services/provision - Provision new service
  http.post("*/services/lifecycle/services/provision", async ({ request, params }) => {
    const payload = await request.json();

    console.log("[MSW] POST /services/lifecycle/services/provision", { payload });

    const newService = createMockServiceInstance({
      ...payload,
      status: "provisioning",
      provisioning_status: "in_progress",
      activated_at: null,
      provisioned_at: null,
    });

    services.push(newService);

    return HttpResponse.json({ service_instance_id: newService.id }, { status: 201 });
  }),

  // POST /services/lifecycle/services/:id/activate - Activate service
  http.post("*/services/lifecycle/services/:id/activate", async ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] POST /services/lifecycle/services/:id/activate", { id });

    const index = services.findIndex((s) => s.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Service instance not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const currentStatus = services[index].status;

    // Validate state transition
    if (!["provisioning", "suspended"].includes(currentStatus)) {
      return HttpResponse.json(
        {
          error: `Cannot activate service in ${currentStatus} status`,
          code: "INVALID_STATE_TRANSITION",
        },
        { status: 400 },
      );
    }

    services[index].status = "active";
    services[index].activated_at = new Date().toISOString();
    services[index].provisioned_at = services[index].provisioned_at || new Date().toISOString();
    services[index].suspended_at = null;

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /services/lifecycle/services/:id/suspend - Suspend service
  http.post("*/services/lifecycle/services/:id/suspend", async ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] POST /services/lifecycle/services/:id/suspend", { id });

    const index = services.findIndex((s) => s.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Service instance not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const currentStatus = services[index].status;

    // Validate state transition
    if (currentStatus !== "active") {
      return HttpResponse.json(
        {
          error: `Cannot suspend service in ${currentStatus} status`,
          code: "INVALID_STATE_TRANSITION",
        },
        { status: 400 },
      );
    }

    services[index].status = "suspended";
    services[index].suspended_at = new Date().toISOString();

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /services/lifecycle/services/:id/resume - Resume service
  http.post("*/services/lifecycle/services/:id/resume", async ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] POST /services/lifecycle/services/:id/resume", { id });

    const index = services.findIndex((s) => s.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Service instance not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    const currentStatus = services[index].status;

    // Validate state transition
    if (!["suspended", "suspended_fraud"].includes(currentStatus)) {
      return HttpResponse.json(
        {
          error: `Cannot resume service in ${currentStatus} status`,
          code: "INVALID_STATE_TRANSITION",
        },
        { status: 400 },
      );
    }

    services[index].status = "active";
    services[index].suspended_at = null;

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /services/lifecycle/services/:id/terminate - Terminate service
  http.post("*/services/lifecycle/services/:id/terminate", async ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] POST /services/lifecycle/services/:id/terminate", { id });

    const index = services.findIndex((s) => s.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Service instance not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    services[index].status = "terminated";
    services[index].terminated_at = new Date().toISOString();

    return new HttpResponse(null, { status: 204 });
  }),

  // PATCH /services/lifecycle/services/:id - Modify service
  http.patch("*/services/lifecycle/services/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = await request.json();

    console.log("[MSW] PATCH /services/lifecycle/services/:id", { id, updates });

    const index = services.findIndex((s) => s.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Service instance not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Merge updates (excluding status and lifecycle fields)
    const { status, activated_at, provisioned_at, suspended_at, terminated_at, ...allowedUpdates } =
      updates;

    services[index] = {
      ...services[index],
      ...allowedUpdates,
    };

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /services/lifecycle/services/:id/health-check - Run health check
  http.post("*/services/lifecycle/services/:id/health-check", async ({ request, params }) => {
    const { id } = params;

    console.log("[MSW] POST /services/lifecycle/services/:id/health-check", { id });

    const index = services.findIndex((s) => s.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Service instance not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Simulate health check update
    services[index].health_status = "healthy";

    return new HttpResponse(null, { status: 204 });
  }),
];
