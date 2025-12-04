/**
 * MSW Handlers for Subscriber API Endpoints
 *
 * These handlers intercept subscriber-related API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type {
  Subscriber,
  SubscriberService,
  SubscriberStatistics,
  CreateSubscriberRequest,
  UpdateSubscriberRequest,
  SubscriberStatus,
  ConnectionType,
} from "../../../hooks/useSubscribers";

// In-memory storage for test data
let subscribers: Subscriber[] = [];
let services: SubscriberService[] = [];
let nextSubscriberId = 1;
let nextServiceId = 1;

// Reset storage between tests
export function resetSubscriberStorage() {
  subscribers = [];
  services = [];
  nextSubscriberId = 1;
  nextServiceId = 1;
}

// Helper to create a subscriber
export function createMockSubscriber(overrides?: Partial<Subscriber>): Subscriber {
  return {
    id: `sub-${nextSubscriberId++}`,
    tenant_id: "tenant-1",
    subscriber_id: `SUB-${String(nextSubscriberId).padStart(3, "0")}`,
    first_name: "John",
    last_name: "Doe",
    email: `subscriber${nextSubscriberId}@example.com`,
    phone: "+1234567890",
    service_address: "123 Main St",
    service_city: "New York",
    service_state: "NY",
    service_postal_code: "10001",
    service_country: "USA",
    status: "active",
    connection_type: "ftth",
    service_plan: "Premium 1000",
    bandwidth_mbps: 1000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a subscriber service
export function createMockService(
  subscriberId: string,
  overrides?: Partial<SubscriberService>,
): SubscriberService {
  return {
    id: `svc-${nextServiceId++}`,
    subscriber_id: subscriberId,
    service_type: "internet",
    service_name: "Fiber 1000",
    status: "active",
    bandwidth_mbps: 1000,
    monthly_fee: 99.99,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedSubscriberData(
  subscribersData: Subscriber[],
  servicesData: SubscriberService[],
) {
  subscribers = [...subscribersData];
  services = [...servicesData];
}

// Helper to create subscriber statistics
export function createMockStatistics(): SubscriberStatistics {
  const byStatus: Record<SubscriberStatus, number> = {
    active: 0,
    suspended: 0,
    pending: 0,
    inactive: 0,
    terminated: 0,
  };

  const byConnectionType: Record<ConnectionType, number> = {
    ftth: 0,
    fttb: 0,
    wireless: 0,
    hybrid: 0,
  };

  subscribers.forEach((sub) => {
    byStatus[sub.status] = (byStatus[sub.status] || 0) + 1;
    byConnectionType[sub.connection_type] = (byConnectionType[sub.connection_type] || 0) + 1;
  });

  return {
    total_subscribers: subscribers.length,
    active_subscribers: byStatus.active,
    suspended_subscribers: byStatus.suspended,
    pending_subscribers: byStatus.pending,
    new_this_month: 0,
    churn_this_month: 0,
    average_uptime: 99.5,
    total_bandwidth_gbps:
      subscribers.reduce((acc, sub) => acc + (sub.bandwidth_mbps || 0), 0) / 1000,
    by_connection_type: byConnectionType,
    by_status: byStatus,
  };
}

export const subscriberHandlers = [
  // GET /subscribers - List subscribers
  http.get("*/subscribers", ({ request, params }) => {
    const url = new URL(request.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const search = url.searchParams.get("search");
    const city = url.searchParams.get("city");
    const servicePlan = url.searchParams.get("service_plan");
    const statuses = url.searchParams.getAll("status");
    const connectionTypes = url.searchParams.getAll("connection_type");
    const sortBy = url.searchParams.get("sort_by") || "id";
    const sortOrder = url.searchParams.get("sort_order") || "asc";

    console.log("[MSW] GET /subscribers", {
      offset,
      limit,
      search,
      city,
      statuses,
      connectionTypes,
      totalSubscribers: subscribers.length,
    });

    let filtered = subscribers;

    // Filter by status
    if (statuses.length > 0) {
      filtered = filtered.filter((sub) => statuses.includes(sub.status));
    }

    // Filter by connection type
    if (connectionTypes.length > 0) {
      filtered = filtered.filter((sub) => connectionTypes.includes(sub.connection_type));
    }

    // Filter by city
    if (city) {
      filtered = filtered.filter((sub) => sub.service_city.toLowerCase() === city.toLowerCase());
    }

    // Filter by service plan
    if (servicePlan) {
      filtered = filtered.filter((sub) => sub.service_plan === servicePlan);
    }

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.first_name.toLowerCase().includes(searchLower) ||
          sub.last_name.toLowerCase().includes(searchLower) ||
          sub.email.toLowerCase().includes(searchLower) ||
          sub.subscriber_id.toLowerCase().includes(searchLower),
      );
    }

    // Sort
    filtered.sort((a, b) => {
      const aValue = a[sortBy as keyof Subscriber] || "";
      const bValue = b[sortBy as keyof Subscriber] || "";

      let comparison = 0;
      if (sortOrder === "asc") {
        comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        comparison = aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }

      // If values are equal, use ID as secondary sort for stability
      if (comparison === 0) {
        return a.id > b.id ? 1 : a.id < b.id ? -1 : 0;
      }

      return comparison;
    });

    // Paginate
    const start = offset;
    const end = offset + limit;
    const paginated = filtered.slice(start, end);

    console.log("[MSW] Returning", paginated.length, "subscribers");

    // Return in the format expected by the hook
    return HttpResponse.json({
      items: paginated,
      total: filtered.length,
    });
  }),

  // GET /subscribers/statistics - Get subscriber statistics
  // NOTE: This MUST come before /subscribers/:id to avoid matching "statistics" as an ID
  http.get("*/subscribers/statistics", ({ request, params }) => {
    const stats = createMockStatistics();
    return HttpResponse.json(stats);
  }),

  // GET /subscribers/:id/services - Get subscriber services
  // NOTE: This MUST come before /subscribers/:id to avoid matching "services" as an ID
  http.get("*/subscribers/:id/services", ({ request, params }) => {
    const { id } = params;

    const subscriberServices = services.filter((svc) => svc.subscriber_id === id);

    return HttpResponse.json(subscriberServices);
  }),

  // GET /subscribers/:id - Get single subscriber
  // NOTE: This must come AFTER all specific routes like /statistics and /:id/services
  http.get("*/subscribers/:id", ({ request, params }) => {
    const { id } = params;

    const subscriber = subscribers.find((sub) => sub.id === id);

    if (!subscriber) {
      return HttpResponse.json(
        { error: "Subscriber not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return HttpResponse.json(subscriber);
  }),

  // POST /subscribers - Create subscriber
  http.post("*/subscribers", async ({ request, params }) => {
    const data = (await request.json()) as CreateSubscriberRequest;

    const newSubscriber = createMockSubscriber({
      ...data,
      id: `sub-${nextSubscriberId}`,
    });

    subscribers.push(newSubscriber);

    return HttpResponse.json(newSubscriber, { status: 201 });
  }),

  // PATCH /subscribers/:id - Update subscriber
  http.patch("*/subscribers/:id", async ({ request, params }) => {
    const { id } = params;
    const updates = (await request.json()) as UpdateSubscriberRequest;

    const index = subscribers.findIndex((sub) => sub.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Subscriber not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    subscribers[index] = {
      ...subscribers[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json(subscribers[index]);
  }),

  // DELETE /subscribers/:id - Delete subscriber
  http.delete("*/subscribers/:id", ({ request, params }) => {
    const { id } = params;

    const index = subscribers.findIndex((sub) => sub.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Subscriber not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    subscribers.splice(index, 1);

    return new HttpResponse(null, { status: 204 });
  }),

  // POST /subscribers/:id/suspend - Suspend subscriber
  http.post("*/subscribers/:id/suspend", ({ request, params }) => {
    const { id } = params;

    const index = subscribers.findIndex((sub) => sub.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Subscriber not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    subscribers[index].status = "suspended";
    subscribers[index].updated_at = new Date().toISOString();

    return HttpResponse.json(subscribers[index], { status: 200 });
  }),

  // POST /subscribers/:id/activate - Activate subscriber
  http.post("*/subscribers/:id/activate", ({ request, params }) => {
    const { id } = params;

    const index = subscribers.findIndex((sub) => sub.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Subscriber not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    subscribers[index].status = "active";
    subscribers[index].updated_at = new Date().toISOString();

    return HttpResponse.json(subscribers[index], { status: 200 });
  }),

  // POST /subscribers/:id/terminate - Terminate subscriber
  http.post("*/subscribers/:id/terminate", ({ request, params }) => {
    const { id } = params;

    const index = subscribers.findIndex((sub) => sub.id === id);

    if (index === -1) {
      return HttpResponse.json(
        { error: "Subscriber not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    subscribers[index].status = "terminated";
    subscribers[index].updated_at = new Date().toISOString();

    return HttpResponse.json(subscribers[index], { status: 200 });
  }),
];
