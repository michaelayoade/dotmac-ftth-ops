/**
 * Test Utilities for ISP Customer App
 *
 * Provides helpers for testing React components and hooks with proper setup.
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
 * Mock API response helper
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
 * Mock customer data factory
 */
export function createMockCustomer(overrides = {}) {
  return {
    id: "cust-123",
    email: "customer@example.com",
    first_name: "John",
    last_name: "Doe",
    account_number: "ACC-001",
    phone: "+1234567890",
    ...overrides,
  };
}

/**
 * Mock invoice data factory
 */
export function createMockInvoice(overrides = {}) {
  return {
    id: "inv-123",
    invoice_number: "INV-2024-001",
    amount: 99.99,
    status: "unpaid",
    due_date: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock service data factory
 */
export function createMockService(overrides = {}) {
  return {
    id: "svc-123",
    plan_name: "Premium 100Mbps",
    status: "active",
    download_speed: 100,
    upload_speed: 20,
    monthly_price: 49.99,
    start_date: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Mock usage data factory
 */
export function createMockUsageData(overrides = {}) {
  return {
    total_download_gb: 150.5,
    total_upload_gb: 25.3,
    period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    period_end: new Date().toISOString(),
    daily_breakdown: [],
    ...overrides,
  };
}

/**
 * Mock support ticket factory
 */
export function createMockTicket(overrides = {}) {
  return {
    id: "ticket-123",
    subject: "Connection Issue",
    status: "open",
    priority: "medium",
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
