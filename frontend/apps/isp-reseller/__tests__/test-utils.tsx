/**
 * Test Utilities for ISP Reseller App
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
 * Mock reseller data factory
 */
export function createMockReseller(overrides = {}) {
  return {
    id: "reseller-123",
    email: "reseller@example.com",
    company_name: "Acme Resellers",
    contact_name: "Jane Doe",
    phone: "+1234567890",
    partner_code: "ACME001",
    commission_rate: 10,
    status: "active",
    ...overrides,
  };
}

/**
 * Mock commission data factory
 */
export function createMockCommission(overrides = {}) {
  return {
    id: "comm-123",
    amount: 150.00,
    status: "pending",
    customer_name: "John Doe",
    service_type: "Premium 100Mbps",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock referral data factory
 */
export function createMockReferral(overrides = {}) {
  return {
    id: "ref-123",
    customer_name: "New Customer",
    customer_email: "newcustomer@example.com",
    status: "pending",
    service_selected: "Basic 50Mbps",
    referral_code: "REF123",
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock statement data factory
 */
export function createMockStatement(overrides = {}) {
  return {
    id: "stmt-123",
    period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    period_end: new Date().toISOString(),
    total_commissions: 1500.00,
    paid_amount: 1000.00,
    pending_amount: 500.00,
    status: "partial",
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
