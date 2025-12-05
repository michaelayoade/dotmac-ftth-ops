import {
  render as rtlRender,
  fireEvent,
  screen,
  waitFor,
  act,
  type RenderOptions,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import type React from "react";

import { detectSecurityViolations, ensureTestingMatchers } from "./matchers";

ensureTestingMatchers();

type RenderResult = ReturnType<typeof rtlRender> & { user: ReturnType<typeof userEvent.setup> };
type PerformanceMetrics = { duration: number; domNodes: number; threshold: number };
type PerformanceRenderResult = RenderResult & {
  measurePerformance: (threshold?: number) => PerformanceMetrics;
};

type RenderWithTimersResult = RenderResult & {
  advanceTimers: (ms: number) => void;
  runAllTimers: () => void;
  cleanup: () => void;
};

const render = (ui: React.ReactElement, options?: RenderOptions): RenderResult => {
  const user = userEvent.setup();
  const result = rtlRender(ui, options);
  return { user, ...result };
};

const renderA11y = async (ui: React.ReactElement, options?: RenderOptions) => {
  const result = render(ui, options);
  const accessibility = await axe(result.container);
  expect(accessibility).toHaveNoViolations();
  return result;
};

const renderSecurity = (ui: React.ReactElement, options?: RenderOptions) => {
  const result = render(ui, options);
  const issues = detectSecurityViolations(result.container);
  if (issues.length > 0) {
    throw new Error(`Security violations detected:\n- ${issues.join("\n- ")}`);
  }
  return result;
};

const renderPerformance = (
  ui: React.ReactElement,
  options?: RenderOptions,
): PerformanceRenderResult => {
  const start = performance.now();
  const result = render(ui, options);
  const duration = performance.now() - start;

  return {
    ...result,
    measurePerformance: (threshold = 16) => {
      const domNodes = result.container.querySelectorAll("*").length;
      return { duration, domNodes, threshold };
    },
  };
};

const renderComprehensive = async (
  ui: React.ReactElement,
  options?: RenderOptions,
): Promise<{ result: PerformanceRenderResult; metrics: PerformanceMetrics }> => {
  const perfResult = renderPerformance(ui, options);
  const accessibility = await axe(perfResult.container, {
    rules: {
      "nested-interactive": { enabled: false },
    },
  });
  expect(accessibility).toHaveNoViolations();

  return {
    result: perfResult,
    metrics: perfResult.measurePerformance(),
  };
};

// ✅ NEW: Lightweight render for fast iteration and wrapper tests
const renderQuick = (ui: React.ReactElement, options?: RenderOptions): RenderResult => {
  // Skip axe, skip performance - just render for fast TDD cycles
  return render(ui, options);
};

// ✅ NEW: Render with fake timers for components with auto-refresh, animations, throttling
interface RenderWithTimersOptions extends RenderOptions {
  useRealTimers?: boolean;
}

const renderWithTimers = (
  ui: React.ReactElement,
  options?: RenderWithTimersOptions,
): RenderWithTimersResult => {
  const { useRealTimers = false, ...renderOptions } = options || {};

  if (!useRealTimers) {
    jest.useFakeTimers();
  }

  const result = render(ui, renderOptions);

  return {
    ...result,
    advanceTimers: (ms: number) => jest.advanceTimersByTime(ms),
    runAllTimers: () => jest.runAllTimers(),
    cleanup: () => {
      if (!useRealTimers) {
        jest.useRealTimers();
      }
    },
  };
};

// Mock data factories for headless hook testing
const mockInvoice = (overrides: Record<string, unknown> = {}) => ({
  id: "inv-123",
  customerId: "cust-123",
  amount: 10000,
  currency: "NGN",
  status: "pending",
  dueDate: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  ...overrides,
});

const mockPayment = (overrides: Record<string, unknown> = {}) => ({
  id: "pay-123",
  invoiceId: "inv-123",
  amount: 10000,
  currency: "NGN",
  status: "completed",
  method: "card",
  createdAt: new Date().toISOString(),
  ...overrides,
});

// Mock WebSocket for real-time testing
interface MockWebSocketInstance {
  addEventListener: jest.Mock;
  removeEventListener: jest.Mock;
  send: jest.Mock;
  close: jest.Mock;
  readyState: number;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
}

const createMockWebSocket = () => {
  const mockWS: MockWebSocketInstance = {
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    readyState: 1,
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  };

  return {
    mockWS,
    simulateMessage: (data: unknown) => {
      const event = new MessageEvent("message", { data: JSON.stringify(data) });
      mockWS.onmessage?.(event);
    },
    simulateOpen: () => {
      mockWS.onopen?.(new Event("open"));
    },
    simulateClose: () => {
      mockWS.onclose?.(new CloseEvent("close"));
    },
    simulateError: () => {
      mockWS.onerror?.(new Event("error"));
    },
  };
};

// Hook wrapper factory for testing hooks with providers
const createHookWrapper = (options: { queryClient?: unknown } = {}) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
  const queryClient = options.queryClient || new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// MSW server stub for tests that don't need real MSW
const server = {
  listen: jest.fn(),
  close: jest.fn(),
  resetHandlers: jest.fn(),
  use: jest.fn(),
};

// API simulation utilities
const simulateAPIError = (status = 500, message = "Internal Server Error") => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: false,
    status,
    statusText: message,
    json: async () => ({ error: message }),
  });
};

const simulateNetworkDelay = (ms: number) => {
  const originalFetch = global.fetch;
  (global.fetch as jest.Mock).mockImplementationOnce(async (...args: unknown[]) => {
    await new Promise((resolve) => setTimeout(resolve, ms));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    return (originalFetch as Function)(...args);
  });
};

export {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  renderQuick,
  renderWithTimers,
  screen,
  fireEvent,
  waitFor,
  userEvent,
  act,
  // Mock data factories
  mockInvoice,
  mockPayment,
  // WebSocket mocking
  createMockWebSocket,
  // Hook testing utilities
  createHookWrapper,
  // MSW server stub
  server,
  // API simulation
  simulateAPIError,
  simulateNetworkDelay,
};
