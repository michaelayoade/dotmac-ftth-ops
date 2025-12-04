/**
 * Test Utilities for Platform Tenant App
 */

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, RenderOptions, renderHook, RenderHookOptions, RenderHookResult } from "@testing-library/react";

/**
 * Creates a QueryClient with test-friendly defaults
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      error: () => {},
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
 * Renders a hook with QueryClientProvider wrapper
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
 * All providers wrapper for rendering components
 */
interface AllProvidersProps {
  children: React.ReactNode;
  queryClient?: QueryClient;
}

export function AllProviders({ children, queryClient }: AllProvidersProps) {
  const client = queryClient || createTestQueryClient();

  return (
    <QueryClientProvider client={client}>
      {children}
    </QueryClientProvider>
  );
}

/**
 * Custom render with all providers
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, "wrapper"> & { queryClient?: QueryClient },
) {
  const { queryClient, ...renderOptions } = options || {};

  return render(ui, {
    wrapper: ({ children }) => (
      <AllProviders queryClient={queryClient}>{children}</AllProviders>
    ),
    ...renderOptions,
  });
}

/**
 * Create a mock fetch response
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
 * Mock tenant user data factory
 */
export function createMockTenantUser(overrides = {}) {
  return {
    id: "user-123",
    email: "tenant@example.com",
    first_name: "Tenant",
    last_name: "Admin",
    role: "admin",
    tenant_id: "tenant-123",
    tenant_name: "Acme ISP",
    ...overrides,
  };
}

/**
 * Mock tenant profile data factory
 */
export function createMockTenantProfile(overrides = {}) {
  return {
    id: "tenant-123",
    name: "Acme ISP",
    slug: "acme-isp",
    status: "active",
    subscription_tier: "professional",
    created_at: new Date().toISOString(),
    settings: {
      timezone: "UTC",
      currency: "USD",
    },
    ...overrides,
  };
}

/**
 * Mock billing data factory
 */
export function createMockBilling(overrides = {}) {
  return {
    id: "billing-123",
    current_plan: "professional",
    billing_cycle: "monthly",
    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    amount: 299.00,
    payment_method: {
      type: "card",
      last4: "4242",
      brand: "visa",
    },
    ...overrides,
  };
}

/**
 * Mock usage data factory
 */
export function createMockUsage(overrides = {}) {
  return {
    subscribers: 150,
    active_sessions: 120,
    api_calls: 50000,
    storage_gb: 25.5,
    period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    period_end: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock user management data factory
 */
export function createMockTeamUser(overrides = {}) {
  return {
    id: "team-user-123",
    email: "team@example.com",
    first_name: "Team",
    last_name: "Member",
    role: "operator",
    status: "active",
    last_login: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock support ticket factory
 */
export function createMockTicket(overrides = {}) {
  return {
    id: "ticket-123",
    subject: "Platform Issue",
    status: "open",
    priority: "medium",
    category: "technical",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Wait for async operations to complete
 */
export function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

/**
 * Setup fetch mock with a response
 */
export function mockFetch(response: any, options?: { ok?: boolean; status?: number }) {
  (global.fetch as jest.Mock).mockResolvedValue(createFetchResponse(response, options));
}

/**
 * Setup fetch mock to reject
 */
export function mockFetchError(message: string, status = 500) {
  (global.fetch as jest.Mock).mockResolvedValue(
    createFetchResponse({ detail: message }, { ok: false, status })
  );
}
