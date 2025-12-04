/**
 * MSW Handlers for RADIUS API Endpoints
 *
 * These handlers intercept RADIUS API calls during tests,
 * providing realistic responses without hitting a real server.
 */

import { http, HttpResponse } from "msw";
import type { RADIUSSubscriber, RADIUSSession } from "../../../hooks/useRADIUS";

// In-memory storage for test data
let radiusSubscribers: RADIUSSubscriber[] = [];
let radiusSessions: RADIUSSession[] = [];
let nextSubscriberId = 1;
let nextSessionId = 1;

// Reset storage between tests
export function resetRADIUSStorage() {
  radiusSubscribers = [];
  radiusSessions = [];
  nextSubscriberId = 1;
  nextSessionId = 1;
}

// Helper to create a mock RADIUS subscriber
export function createMockRADIUSSubscriber(
  overrides?: Partial<RADIUSSubscriber>,
): RADIUSSubscriber {
  return {
    id: nextSubscriberId++,
    tenant_id: "tenant-123",
    subscriber_id: `sub-${nextSubscriberId}`,
    username: `user${nextSubscriberId}@example.com`,
    enabled: true,
    bandwidth_profile_id: "profile-1",
    framed_ipv4_address: `10.0.0.${nextSubscriberId}`,
    framed_ipv6_address: `2001:db8::${nextSubscriberId}`,
    delegated_ipv6_prefix: `2001:db8:${nextSubscriberId}::/48`,
    session_timeout: 86400,
    idle_timeout: 3600,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create a mock RADIUS session
export function createMockRADIUSSession(overrides?: Partial<RADIUSSession>): RADIUSSession {
  return {
    radacctid: nextSessionId++,
    tenant_id: "tenant-123",
    subscriber_id: `sub-${nextSessionId}`,
    username: `user${nextSessionId}@example.com`,
    acctsessionid: `session-${nextSessionId}`,
    nasipaddress: "192.168.1.1",
    framedipaddress: `10.0.0.${nextSessionId}`,
    framedipv6address: `2001:db8::${nextSessionId}`,
    framedipv6prefix: `2001:db8:${nextSessionId}::/64`,
    delegatedipv6prefix: `2001:db8:${nextSessionId}::/48`,
    acctstarttime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    acctsessiontime: 3600, // 1 hour in seconds
    acctinputoctets: 1000000, // 1 MB
    acctoutputoctets: 500000, // 500 KB
    ...overrides,
  };
}

// Helper to seed initial data
export function seedRADIUSData(subscribers: RADIUSSubscriber[], sessions: RADIUSSession[]) {
  radiusSubscribers = [...subscribers];
  radiusSessions = [...sessions];
}

export const radiusHandlers = [
  // GET /api/v1/radius/subscribers - List RADIUS subscribers
  http.get("*/api/v1/radius/subscribers", (req, res, ctx) => {
    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");

    console.log("[MSW] GET /api/v1/radius/subscribers", {
      offset,
      limit,
      totalSubscribers: radiusSubscribers.length,
    });

    const start = offset;
    const end = offset + limit;
    const paginated = radiusSubscribers.slice(start, end);

    console.log("[MSW] Returning", paginated.length, "subscribers");

    // Hook expects response to be the array directly (not wrapped)
    return HttpResponse.json(paginated);
  }),

  // GET /api/v1/radius/sessions - List RADIUS sessions
  http.get("*/api/v1/radius/sessions", (req, res, ctx) => {
    console.log("[MSW] GET /api/v1/radius/sessions", {
      totalSessions: radiusSessions.length,
    });

    // Hook expects response to be the array directly (not wrapped)
    return HttpResponse.json(radiusSessions);
  }),
];
