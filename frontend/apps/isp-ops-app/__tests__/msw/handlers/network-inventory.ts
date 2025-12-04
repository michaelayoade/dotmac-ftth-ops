/**
 * MSW Handlers for Network Inventory API Endpoints (NetBox)
 *
 * These handlers intercept NetBox API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type { NetboxHealth, NetboxSite } from "../../../types";

// In-memory storage for test data
let netboxHealth: NetboxHealth | null = null;
let netboxSites: NetboxSite[] = [];
let nextSiteId = 1;

// Reset storage between tests
export function resetNetworkInventoryStorage() {
  netboxHealth = null;
  netboxSites = [];
  nextSiteId = 1;
}

// Helper to create mock NetBox health
export function createMockNetboxHealth(overrides?: Partial<NetboxHealth>): NetboxHealth {
  return {
    status: "healthy",
    version: "3.5.0",
    database: {
      status: "connected",
      latency_ms: 5,
    },
    redis: {
      status: "connected",
      latency_ms: 2,
    },
    storage: {
      total_gb: 100,
      used_gb: 45,
      free_gb: 55,
    },
    last_check: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock NetBox site
export function createMockNetboxSite(overrides?: Partial<NetboxSite>): NetboxSite {
  return {
    id: nextSiteId++,
    name: `Site ${nextSiteId}`,
    slug: `site-${nextSiteId}`,
    status: {
      value: "active",
      label: "Active",
    },
    region: {
      id: 1,
      name: "Region 1",
      slug: "region-1",
    },
    tenant: {
      id: 1,
      name: "Tenant 1",
      slug: "tenant-1",
    },
    facility: "Facility A",
    asn: 65000,
    time_zone: "UTC",
    description: "Test site",
    physical_address: "123 Main St",
    shipping_address: "123 Main St",
    latitude: 40.7128,
    longitude: -74.006,
    comments: "",
    tags: [],
    custom_fields: {},
    created: new Date().toISOString(),
    last_updated: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to seed initial data
export function seedNetworkInventoryData(health: NetboxHealth | null, sites: NetboxSite[]) {
  netboxHealth = health;
  netboxSites = [...sites];
}

export const networkInventoryHandlers = [
  // GET /api/v1/netbox/health - Get NetBox health
  http.get("*/api/v1/netbox/health", (req, res, ctx) => {
    console.log("[MSW] GET /netbox/health");

    if (!netboxHealth) {
      netboxHealth = createMockNetboxHealth();
    }

    return HttpResponse.json(netboxHealth);
  }),

  // GET /api/v1/netbox/dcim/sites - List NetBox sites
  http.get("*/api/v1/netbox/dcim/sites", (req, res, ctx) => {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    console.log("[MSW] GET /netbox/dcim/sites", {
      limit,
      offset,
      totalSites: netboxSites.length,
    });

    const start = offset;
    const end = offset + limit;
    const paginated = netboxSites.slice(start, end);

    console.log("[MSW] Returning", paginated.length, "sites");

    return HttpResponse.json(paginated);
  }),
];
