/**
 * Test Utilities for ISP Ops App
 *
 * Provides helpers for testing React components and hooks with proper setup.
 */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, RenderHookOptions, RenderHookResult } from "@testing-library/react";
import { act } from "@testing-library/react";
import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  NormalizedCacheObject,
  createHttpLink,
} from "@apollo/client";
import "@/lib/graphql/patchApolloCache";
import { server } from "./msw/server";
import {
  resetSubscriberStorage as mswResetSubscriberStorage,
  createMockSubscriber as mswCreateMockSubscriber,
  createMockService as mswCreateMockService,
  seedSubscriberData as mswSeedSubscriberData,
} from "./msw/handlers/subscribers";
import {
  resetWebhookStorage,
  createMockWebhook,
  createMockDelivery,
  seedWebhookData,
} from "./msw/handlers/webhooks";
import {
  resetNotificationStorage,
  createMockNotification,
  createMockTemplate,
  createMockLog,
  seedNotificationData,
} from "./msw/handlers/notifications";
import { http, HttpResponse } from "msw";

/**
 * Creates a QueryClient with test-friendly defaults
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity, // Keep data in cache for the duration of the test
        // Don't disable refetching completely - allow queries to work naturally
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        networkMode: "always",
      },
      mutations: {
        retry: false,
        networkMode: "always",
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      // Suppress React Query errors in tests unless needed
      error: () => {},
    },
  });
}

/**
 * Creates an Apollo Client with test-friendly defaults
 */
export function createTestApolloClient(): ApolloClient<NormalizedCacheObject> {
  const httpLink = createHttpLink({
    uri: "http://localhost:3000/api/v1/graphql",
  });

  return new ApolloClient({
    link: httpLink,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            subscribers: {
              keyArgs: ["search"],
              merge(existing, incoming) {
                return incoming;
              },
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "no-cache",
        errorPolicy: "all",
      },
      query: {
        fetchPolicy: "no-cache",
        errorPolicy: "all",
      },
      mutate: {
        errorPolicy: "all",
      },
    },
  });
}

/**
 * Creates a wrapper component with QueryClientProvider
 */
export function createQueryWrapper(queryClient?: QueryClient) {
  const client = queryClient || createTestQueryClient();

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

/**
 * Creates a wrapper component with ApolloProvider (for GraphQL tests)
 */
export function createApolloWrapper(apolloClient?: ApolloClient<NormalizedCacheObject>) {
  const client = apolloClient || createTestApolloClient();

  return ({ children }: { children: React.ReactNode }) => (
    <ApolloProvider client={client}>{children}</ApolloProvider>
  );
}

/**
 * Renders a hook with QueryClientProvider wrapper
 *
 * @example
 * const { result } = renderHookWithQuery(() => useMyHook());
 */
export function renderHookWithQuery<TProps, TResult>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, "wrapper"> & {
    queryClient?: QueryClient;
  },
): RenderHookResult<TResult, TProps> {
  const { queryClient, ...renderOptions } = options || {};
  const wrapper = createQueryWrapper(queryClient);

  return renderHook(hook, {
    ...renderOptions,
    wrapper,
  });
}

/**
 * Advances fake timers safely within act()
 *
 * Use this when you need to advance timers in tests that use React Query or other
 * libraries that schedule state updates.
 *
 * @example
 * jest.useFakeTimers();
 * await advanceTimersByTimeAsync(1000);
 * jest.useRealTimers();
 */
export async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(ms);
    // Allow any microtasks to complete
    await Promise.resolve();
  });
}

/**
 * Advances fake timers to run all pending timers safely within act()
 *
 * @example
 * jest.useFakeTimers();
 * await runAllTimersAsync();
 * jest.useRealTimers();
 */
export async function runAllTimersAsync(): Promise<void> {
  await act(async () => {
    jest.runAllTimers();
    await Promise.resolve();
  });
}

/**
 * Flushes all pending promises
 *
 * Useful when you need to wait for all pending async operations to complete.
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Waits for a condition to be true with proper act() wrapping
 *
 * @param condition Function that returns true when the condition is met
 * @param timeout Maximum time to wait in ms
 */
export async function waitForCondition(condition: () => boolean, timeout = 1000): Promise<void> {
  const startTime = Date.now();

  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error(`Timeout waiting for condition after ${timeout}ms`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

/**
 * Mock API response helper
 *
 * @example
 * mockApiClient.get.mockResolvedValue(createApiResponse({ data: 'test' }));
 */
export function createApiResponse<T>(data: T, meta?: Record<string, any>) {
  return {
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Mock API error helper
 *
 * @example
 * mockApiClient.get.mockRejectedValue(createApiError('Not found', 404));
 */
export function createApiError(message: string, status = 400) {
  const error: any = new Error(message);
  error.response = {
    status,
    data: {
      error: message,
      code: `ERROR_${status}`,
    },
  };
  return error;
}

/**
 * Setup fetch mock for a test
 *
 * @example
 * setupFetchMock();
 * global.fetch.mockResolvedValue(createFetchResponse({ data: 'test' }));
 */
export function setupFetchMock() {
  if (!global.fetch || typeof (global.fetch as any).mockClear !== "function") {
    global.fetch = jest.fn();
  }
  (global.fetch as jest.Mock).mockClear();
}

/**
 * Create a fetch response
 *
 * @example
 * global.fetch.mockResolvedValue(createFetchResponse({ data: 'test' }));
 */
export function createFetchResponse<T>(data: T, options: { ok?: boolean; status?: number } = {}) {
  const { ok = true, status = 200 } = options;

  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    headers: new Headers({ "content-type": "application/json" }),
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
    blob: jest.fn().mockResolvedValue(new Blob([JSON.stringify(data)])),
  };
}

/**
 * Mock data factories
 */

export const createMockPlugin = (overrides = {}) => ({
  id: "plugin-123",
  name: "Test Plugin",
  description: "A test plugin",
  version: "1.0.0",
  enabled: true,
  category: "integration",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

/**
 * MSW-specific utilities
 */

// Re-export MSW helpers
export {
  server,
  resetWebhookStorage,
  createMockWebhook,
  createMockDelivery,
  seedWebhookData,
  resetNotificationStorage,
  createMockNotification,
  createMockTemplate,
  createMockLog,
  seedNotificationData,
};

// Billing Plans helpers
export {
  resetBillingPlansStorage,
  createMockBillingPlan,
  createMockProduct,
  seedBillingPlansData,
} from "./msw/handlers/billing-plans";

// Dunning helpers
export {
  resetDunningStorage,
  createMockDunningCampaign,
  createMockDunningExecution,
  seedDunningData,
} from "./msw/handlers/dunning";

// Credit Notes helpers
export {
  resetCreditNotesStorage,
  createMockCreditNote,
  seedCreditNotesData,
} from "./msw/handlers/credit-notes";

// Invoice Actions helpers
export { resetInvoiceActionsStorage } from "./msw/handlers/invoice-actions";

// Network Monitoring helpers
export {
  resetNetworkMonitoringStorage,
  createMockNetworkOverview,
  createMockDevice,
  createMockDeviceMetrics,
  createMockTrafficStats,
  createMockAlert,
  createMockAlertRule,
  seedNetworkMonitoringData,
} from "./msw/handlers/network-monitoring";

// Network Inventory (NetBox) helpers
export {
  resetNetworkInventoryStorage,
  createMockNetboxHealth,
  createMockNetboxSite,
  seedNetworkInventoryData,
} from "./msw/handlers/network-inventory";

// RADIUS helpers
export {
  resetRADIUSStorage,
  createMockRADIUSSubscriber,
  createMockRADIUSSession,
  seedRADIUSData,
} from "./msw/handlers/radius";

// Subscriber helpers
export {
  mswResetSubscriberStorage as resetSubscriberStorage,
  mswCreateMockSubscriber as createMockSubscriber,
  mswCreateMockService as createMockService,
  mswSeedSubscriberData as seedSubscriberData,
};

// Fault helpers
export {
  resetFaultStorage,
  createMockAlarm,
  createMockHistory,
  createMockNote,
  seedFaultData,
} from "./msw/handlers/faults";

// User helpers
export { resetUserStorage, createMockUser, seedUserData } from "./msw/handlers/users";

// API Keys helpers
export { resetApiKeysStorage, createMockApiKey, seedApiKeysData } from "./msw/handlers/apiKeys";

// Integrations helpers
export {
  resetIntegrationsStorage,
  createMockIntegration,
  seedIntegrationsData,
} from "./msw/handlers/integrations";

// Health helpers
export {
  resetHealthStorage,
  createMockHealthSummary,
  createMockServiceHealth as createMockHealthService,
  seedHealthData,
  makeHealthCheckFail,
  makeHealthCheckSucceed,
} from "./msw/handlers/health";

// Feature Flags helpers
export {
  resetFeatureFlagsStorage,
  createMockFeatureFlag,
  createMockFlagStatus,
  seedFeatureFlagsData,
} from "./msw/handlers/featureFlags";

// Operations/Monitoring helpers
export {
  resetOperationsStorage,
  createMockMetrics,
  createMockLogStats,
  createMockOperationsServiceHealth,
  createMockSystemHealth,
  seedOperationsData,
} from "./msw/handlers/operations";

// Jobs helpers
export {
  resetJobsStorage,
  createMockJob,
  createMockFieldInstallationJob,
  seedJobsData,
} from "./msw/handlers/jobs";

// Scheduler helpers
export {
  resetSchedulerStorage,
  createMockScheduledJob,
  createMockJobChain,
  seedSchedulerData,
} from "./msw/handlers/scheduler";

// Logs helpers
export { resetLogsStorage, createMockLogEntry, seedLogsData } from "./msw/handlers/logs";

// Service Lifecycle helpers
export {
  resetServiceLifecycleStorage,
  createMockServiceInstance,
  seedServiceLifecycleData,
  createMockServiceStatistics,
} from "./msw/handlers/service-lifecycle";

// Orchestration helpers
export {
  resetOrchestrationStorage,
  createMockWorkflow,
  createMockWorkflowStep,
  seedOrchestrationData,
} from "./msw/handlers/orchestration";

// Partners helpers
export { clearPartnersData, createMockPartner, seedPartners } from "./msw/handlers/partners";

// Technicians helpers
export {
  resetTechniciansStorage,
  createMockTechnician,
  createMockTechnicianLocation,
  seedTechniciansData,
  seedLocationHistory,
} from "./msw/handlers/technicians";

// GraphQL Subscriber helpers
export {
  clearGraphQLSubscriberData,
  seedGraphQLSubscriberData,
  createMockSubscriber as createMockGraphQLSubscriber,
  createMockSession as createMockGraphQLSession,
  createMockSubscriberMetrics as createMockGraphQLSubscriberMetrics,
  createMockSubscriberDashboard as createMockGraphQLSubscriberDashboard,
} from "./msw/handlers/graphql-subscriber";

/**
 * Add a runtime handler to MSW server
 *
 * Useful for overriding default handlers in specific tests
 *
 * @example
 * addMockHandler(
 *   http.get('/api/v1/webhooks', () => {
 *     return HttpResponse.json({ error: 'Server error' }, { status: 500 });
 *   })
 * );
 */
export function addMockHandler(...handlers: Parameters<typeof server.use>) {
  server.use(...handlers);
}

/**
 * Override a specific API endpoint for a test
 *
 * @example
 * overrideApiEndpoint('get', '/api/v1/webhooks', (req, res, ctx) => {
 *   return res(ctx.status(404), ctx.json({ error: 'Not found' }));
 * });
 */
export function overrideApiEndpoint(
  method: "get" | "post" | "patch" | "put" | "delete",
  path: string,
  handler: Parameters<typeof http.get>[1],
) {
  const httpMethod = http[method];
  // Add wildcard to match full URLs with host
  const fullPath = path.startsWith("*") ? path : `*${path}`;
  server.use(httpMethod(fullPath, handler as any));
}

/**
 * Make an API endpoint fail with a specific error
 *
 * @example
 * makeApiEndpointFail('get', '/api/v1/webhooks', 'Network error', 500);
 */
export function makeApiEndpointFail(
  method: "get" | "post" | "patch" | "put" | "delete",
  path: string,
  errorMessage: string,
  status = 500,
) {
  overrideApiEndpoint(method, path, ({ request }) => {
    return HttpResponse.json({ error: errorMessage, code: "TEST_ERROR" }, { status });
  });
}

/**
 * Make an API endpoint return specific data
 *
 * @example
 * makeApiEndpointReturn('get', '/api/v1/webhooks', { data: [] });
 */
export function makeApiEndpointReturn(
  method: "get" | "post" | "patch" | "put" | "delete",
  path: string,
  data: any,
  status = 200,
) {
  overrideApiEndpoint(method, path, ({ request }) => {
    return HttpResponse.json(data, { status });
  });
}
