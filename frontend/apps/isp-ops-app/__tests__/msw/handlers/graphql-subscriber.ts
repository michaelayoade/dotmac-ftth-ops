/**
 * MSW GraphQL Handlers for Subscriber Dashboard
 * Mocks the SubscriberDashboard GraphQL query with subscribers, sessions, and metrics
 */

import { graphql, HttpResponse } from "msw";

const camelCaseKey = (key: string) => {
  if (key.startsWith("__")) {
    return key;
  }
  return key.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
};

const camelize = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(camelize);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).reduce((acc: Record<string, any>, [key, val]) => {
      const camelKey = typeof key === "string" ? camelCaseKey(key) : key;
      acc[camelKey as string] = camelize(val);
      return acc;
    }, {});
  }
  return value;
};

const respondWithCamelCase = (data: any) => HttpResponse.json({ data: camelize(data) });

const getVariables = <T extends Record<string, any>>(variables?: Record<string, any>) =>
  (variables ?? {}) as T;

// Type definitions matching GraphQL schema
interface Session {
  __typename: "Session";
  radacctid: number;
  username: string;
  nasipaddress: string;
  acctsessionid: string;
  acctsessiontime: number | null;
  acctinputoctets: number | null;
  acctoutputoctets: number | null;
  acctstarttime: string | null;
  acctstoptime?: string | null;
}

interface Subscriber {
  __typename: "Subscriber";
  id: number;
  subscriberId: string;
  username: string;
  enabled: boolean;
  framedIpAddress: string | null;
  bandwidthProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  sessions: Session[];
}

interface SubscriberMetrics {
  __typename: "SubscriberMetrics";
  totalCount: number;
  enabledCount: number;
  disabledCount: number;
  activeSessionsCount: number;
  totalDataUsageMb: number;
}

interface SubscriberDashboardData {
  subscribers: Subscriber[];
  subscriberMetrics: SubscriberMetrics;
}

// In-memory storage
let subscribers: Subscriber[] = [];
let metrics: SubscriberMetrics = {
  __typename: "SubscriberMetrics",
  totalCount: 0,
  enabledCount: 0,
  disabledCount: 0,
  activeSessionsCount: 0,
  totalDataUsageMb: 0,
};

let nextSubscriberId = 1;
let nextSessionId = 1;

// ============================================
// Factory Functions
// ============================================

export function createMockSession(data: Partial<Session> = {}): Session {
  const sessionId = nextSessionId++;
  const now = new Date();
  const startTime = new Date(now.getTime() - 3600000); // 1 hour ago

  return {
    __typename: "Session",
    radacctid: data.radacctid ?? sessionId,
    username: data.username ?? `subscriber${sessionId}@example.com`,
    nasipaddress: data.nasipaddress ?? "10.0.0.1",
    acctsessionid: data.acctsessionid ?? `session-${sessionId}-${Date.now()}`,
    acctsessiontime: data.acctsessiontime ?? 3600, // 1 hour in seconds
    acctinputoctets: data.acctinputoctets ?? 1024 * 1024 * 100, // 100 MB
    acctoutputoctets: data.acctoutputoctets ?? 1024 * 1024 * 50, // 50 MB
    acctstarttime: data.acctstarttime ?? startTime.toISOString(),
    acctstoptime: data.acctstoptime,
  };
}

export function createMockSubscriber(data: Partial<Subscriber> = {}): Subscriber {
  const subscriberId = nextSubscriberId++;
  const now = new Date().toISOString();

  return {
    __typename: "Subscriber",
    id: data.id ?? subscriberId,
    subscriberId: data.subscriberId ?? `SUB-${String(subscriberId).padStart(6, "0")}`,
    username: data.username ?? `subscriber${subscriberId}@example.com`,
    enabled: data.enabled ?? true,
    framedIpAddress:
      data.framedIpAddress ?? `10.10.${Math.floor(subscriberId / 256)}.${subscriberId % 256}`,
    bandwidthProfileId: data.bandwidthProfileId ?? "profile-100mbps",
    createdAt: data.createdAt ?? now,
    updatedAt: data.updatedAt ?? now,
    sessions: data.sessions ?? [],
  };
}

export function createMockSubscriberMetrics(
  data: Partial<SubscriberMetrics> = {},
): SubscriberMetrics {
  return {
    __typename: "SubscriberMetrics",
    totalCount: data.totalCount ?? 0,
    enabledCount: data.enabledCount ?? 0,
    disabledCount: data.disabledCount ?? 0,
    activeSessionsCount: data.activeSessionsCount ?? 0,
    totalDataUsageMb: data.totalDataUsageMb ?? 0,
  };
}

export function createMockSubscriberDashboard(
  data: Partial<SubscriberDashboardData> = {},
): SubscriberDashboardData {
  const subs = data.subscribers ?? [];
  const activeCount = subs.filter((s) => s.sessions.length > 0).length;
  const enabledCount = subs.filter((s) => s.enabled).length;
  const totalDataUsageMb = subs.reduce((total, sub) => {
    const subData = sub.sessions.reduce((subTotal, session) => {
      const inputMB = (session.acctinputoctets ?? 0) / (1024 * 1024);
      const outputMB = (session.acctoutputoctets ?? 0) / (1024 * 1024);
      return subTotal + inputMB + outputMB;
    }, 0);
    return total + subData;
  }, 0);

  return {
    subscribers: subs,
    subscriberMetrics: data.subscriberMetrics ?? {
      __typename: "SubscriberMetrics",
      totalCount: subs.length,
      enabledCount: enabledCount,
      disabledCount: subs.length - enabledCount,
      activeSessionsCount: activeCount,
      totalDataUsageMb: Math.round(totalDataUsageMb * 100) / 100,
    },
  };
}

// ============================================
// Storage Management
// ============================================

export function seedGraphQLSubscriberData(subscribersList: Partial<Subscriber>[]): void {
  subscribers = subscribersList.map(createMockSubscriber);
  recalculateMetrics();
}

export function clearGraphQLSubscriberData(): void {
  subscribers = [];
  metrics = {
    __typename: "SubscriberMetrics",
    totalCount: 0,
    enabledCount: 0,
    disabledCount: 0,
    activeSessionsCount: 0,
    totalDataUsageMb: 0,
  };
  nextSubscriberId = 1;
  nextSessionId = 1;
}

function recalculateMetrics(): void {
  const enabledCount = subscribers.filter((s) => s.enabled).length;
  const activeSessionsCount = subscribers.filter((s) => s.sessions.length > 0).length;
  const totalDataUsageMb = subscribers.reduce((total, sub) => {
    const subData = sub.sessions.reduce((subTotal, session) => {
      const inputMB = (session.acctinputoctets ?? 0) / (1024 * 1024);
      const outputMB = (session.acctoutputoctets ?? 0) / (1024 * 1024);
      return subTotal + inputMB + outputMB;
    }, 0);
    return total + subData;
  }, 0);

  metrics = {
    __typename: "SubscriberMetrics",
    totalCount: subscribers.length,
    enabledCount: enabledCount,
    disabledCount: subscribers.length - enabledCount,
    activeSessionsCount: activeSessionsCount,
    totalDataUsageMb: Math.round(totalDataUsageMb * 100) / 100,
  };
}

// ============================================
// MSW GraphQL Handlers
// ============================================

export const graphqlSubscriberHandlers = [
  // SubscriberDashboard query
  graphql.query("SubscriberDashboard", ({ variables }) => {
    const { limit = 50, search } = getVariables<{ limit?: number; search?: string }>(variables);

    let filtered = [...subscribers];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.username.toLowerCase().includes(searchLower) ||
          s.subscriberId.toLowerCase().includes(searchLower) ||
          s.framedIpAddress?.toLowerCase().includes(searchLower),
      );
    }

    // Apply limit
    const limited = filtered.slice(0, limit);

    return respondWithCamelCase({
      subscribers: limited,
      subscriberMetrics: metrics,
    });
  }),

  // Individual Subscriber query
  graphql.query("Subscriber", ({ variables }) => {
    const { username } = getVariables<{ username?: string }>(variables);

    const subscriber = subscribers.find((s) => s.username === username);

    if (!subscriber) {
      return respondWithCamelCase({
        subscribers: [],
      });
    }

    return respondWithCamelCase({
      subscribers: [subscriber],
    });
  }),

  // Active Sessions query
  graphql.query("ActiveSessions", ({ variables }) => {
    const { limit = 100, username } = getVariables<{ limit?: number; username?: string }>(
      variables,
    );

    let allSessions: Session[] = [];

    if (username) {
      const subscriber = subscribers.find((s) => s.username === username);
      allSessions = subscriber?.sessions ?? [];
    } else {
      allSessions = subscribers.flatMap((s) => s.sessions);
    }

    const limited = allSessions.slice(0, limit);

    return respondWithCamelCase({
      sessions: limited,
    });
  }),

  // Subscriber Metrics query
  graphql.query("SubscriberMetrics", ({ variables }) => {
    return respondWithCamelCase({
      subscriberMetrics: metrics,
    });
  }),
];
