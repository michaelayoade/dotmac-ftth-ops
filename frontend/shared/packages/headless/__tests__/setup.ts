/**
 * Test setup for @dotmac/headless package
 * Configures testing environment for headless hooks and utilities
 */

import "@testing-library/jest-dom";

// Mock React Query for data fetching hooks
jest.mock("@tanstack/react-query", () => ({
  QueryClient: jest.fn().mockImplementation(() => ({
    setDefaultOptions: jest.fn(),
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
    mount: jest.fn(),
    unmount: jest.fn(),
  })),
  QueryClientProvider: ({ children }: any) => children,
  useQueryClient: jest.fn(() => ({
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
  })),
  useQuery: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    remove: jest.fn(),
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    isError: false,
    error: null,
    reset: jest.fn(),
  })),
  useInfiniteQuery: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
  })),
}));

// Mock fetch for API calls with a safe default response
const defaultFetch = jest.fn().mockResolvedValue({
  ok: true,
  status: 200,
  statusText: "OK",
  json: jest.fn().mockResolvedValue({}),
  text: jest.fn().mockResolvedValue("{}"),
  headers: new Headers({
    "content-type": "application/json",
  }),
});
global.fetch = defaultFetch as unknown as typeof fetch;

// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });

// Mock WebSocket for real-time features
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1,
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock performance API
global.performance = global.performance || {};
global.performance.now = global.performance.now || (() => Date.now());
global.performance.mark = global.performance.mark || jest.fn();
global.performance.measure = global.performance.measure || jest.fn();

// Mock crypto for secure operations
Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn(() => "mock-uuid-" + Math.random().toString(36).substr(2, 9)),
    subtle: {
      digest: jest.fn(),
      encrypt: jest.fn(),
      decrypt: jest.fn(),
    },
  },
});

// Mock console methods to reduce noise
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();

  // Reset storage mocks
  localStorageMock.clear.mockClear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();

  sessionStorageMock.clear.mockClear();
  sessionStorageMock.getItem.mockClear();
  sessionStorageMock.setItem.mockClear();
  sessionStorageMock.removeItem.mockClear();

  // Reset fetch mock
  const impl = (defaultFetch as jest.Mock).getMockImplementation();
  (global.fetch as jest.Mock).mockReset?.();
  (global.fetch as jest.Mock).mockImplementation(impl || defaultFetch);

  // Mock console methods (can be overridden in individual tests)
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterEach(() => {
  // Restore console methods
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;

  // Clear timers if any
  jest.clearAllTimers();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// Helper functions for testing
export const mockLocalStorage = localStorageMock;
export const mockSessionStorage = sessionStorageMock;

export const mockFetchResponse = (data: any, status = 200, ok = true) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: jest.fn().mockResolvedValueOnce(data),
    text: jest.fn().mockResolvedValueOnce(JSON.stringify(data)),
    headers: new Headers({
      "content-type": "application/json",
    }),
  });
};

export const mockFetchError = (error: Error) => {
  (global.fetch as jest.Mock).mockRejectedValueOnce(error);
};

// Mock user objects for auth testing
export const createMockUser = (overrides = {}) => ({
  id: "user-123",
  email: "test@example.com",
  name: "Test User",
  role: "tenant_admin",
  permissions: ["users:read", "customers:read"],
  tenantId: "tenant-123",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
  ...overrides,
});

export const createMockTokens = (overrides = {}) => ({
  accessToken: "mock-access-token",
  refreshToken: "mock-refresh-token",
  expiresAt: Date.now() + 3600000, // 1 hour
  tokenType: "Bearer",
  ...overrides,
});

// Mock feature flags
export const createMockFeatureFlags = (overrides = {}) => ({
  notifications: true,
  realtime: false,
  analytics: false,
  offline: false,
  websocket: false,
  tenantManagement: false,
  errorHandling: true,
  pwa: false,
  toasts: true,
  devtools: false,
  ...overrides,
});

// Mock portal configurations
export const createMockPortalConfig = (portal: string, overrides = {}) => ({
  portal,
  theme:
    portal === "admin"
      ? "professional"
      : portal === "customer"
        ? "friendly"
        : portal === "technician"
          ? "mobile"
          : portal === "reseller"
            ? "business"
            : portal === "management-admin"
              ? "enterprise"
              : portal === "management-reseller"
                ? "corporate"
                : portal === "tenant-portal"
                  ? "minimal"
                  : "default",
  features: {
    notifications: true,
    realtime: portal !== "customer",
    analytics:
      portal === "admin" || portal === "management-admin" || portal === "management-reseller",
    offline: portal === "technician",
    websocket: portal !== "customer" && portal !== "tenant-portal",
    tenantManagement: portal === "management-admin" || portal === "tenant-portal",
    errorHandling: true,
    pwa: portal === "technician",
    toasts: true,
    devtools: portal === "management-admin" || portal === "management-reseller",
  },
  auth: {
    sessionTimeout: 30 * 60 * 1000,
    enableMFA: portal !== "customer" && portal !== "tenant-portal",
    enablePermissions: portal !== "customer" && portal !== "tenant-portal",
    requirePasswordComplexity: true,
  },
  api: {
    baseURL: `/api/${portal === "admin" ? "admin" : portal}`,
    timeout: 10000,
    retries: 3,
  },
  ...overrides,
});

// Mock API response structures
export const createMockApiResponse = (data: any, meta = {}) => ({
  data,
  meta: {
    total: Array.isArray(data) ? data.length : 1,
    page: 1,
    limit: 20,
    ...meta,
  },
  success: true,
  timestamp: new Date().toISOString(),
});

export const createMockApiError = (message: string, code = "GENERIC_ERROR", status = 400) => ({
  error: {
    message,
    code,
    status,
    details: {},
    timestamp: new Date().toISOString(),
  },
  success: false,
});

// Mock business workflow data
export const createMockWorkflow = (overrides = {}) => ({
  id: "workflow-123",
  name: "Test Workflow",
  type: "customer_onboarding",
  status: "active",
  steps: [
    { id: "step-1", name: "Initial Setup", status: "completed" },
    { id: "step-2", name: "Configuration", status: "in_progress" },
    { id: "step-3", name: "Validation", status: "pending" },
  ],
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
  ...overrides,
});

// Mock notification data
export const createMockNotification = (overrides = {}) => ({
  id: "notification-123",
  type: "info",
  title: "Test Notification",
  message: "This is a test notification",
  read: false,
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  ...overrides,
});

// Mock real-time event data
export const createMockRealtimeEvent = (type: string, data: any = {}) => ({
  type,
  data,
  timestamp: Date.now(),
  id: `event-${Math.random().toString(36).substr(2, 9)}`,
});

// Mock performance metrics
export const createMockPerformanceMetric = (name: string, value: number) => ({
  name,
  value,
  timestamp: performance.now(),
  type: "custom",
  tags: {
    portal: "admin",
    component: "test",
  },
});

// Custom Jest matchers for headless testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWithAuth(): R;
      toBeValidApiRequest(): R;
      toHaveCorrectFeatureFlags(): R;
      toBeCachedResponse(): R;
    }
  }
}

expect.extend({
  toHaveBeenCalledWithAuth(received: any) {
    const hasAuth = received.mock.calls.some((call: any[]) => {
      const options = call[1];
      return options?.headers?.Authorization?.startsWith("Bearer ");
    });

    return {
      message: () =>
        hasAuth
          ? `Expected fetch not to be called with authorization headers`
          : `Expected fetch to be called with authorization headers`,
      pass: hasAuth,
    };
  },

  toBeValidApiRequest(received: any) {
    const isValid =
      received &&
      typeof received.method === "string" &&
      typeof received.url === "string" &&
      received.headers instanceof Headers;

    return {
      message: () =>
        isValid
          ? `Expected not to be a valid API request`
          : `Expected to be a valid API request with method, url, and headers`,
      pass: isValid,
    };
  },

  toHaveCorrectFeatureFlags(received: any) {
    const hasFlags =
      received &&
      typeof received === "object" &&
      Object.values(received).every((flag) => typeof flag === "boolean");

    return {
      message: () =>
        hasFlags
          ? `Expected not to have correct feature flags structure`
          : `Expected to have correct feature flags structure (all boolean values)`,
      pass: hasFlags,
    };
  },

  toBeCachedResponse(received: any) {
    const isCached = received && received._cached === true;

    return {
      message: () =>
        isCached ? `Expected response not to be cached` : `Expected response to be cached`,
      pass: isCached,
    };
  },
});

// Mock environment variables
Object.defineProperty(process.env, "NODE_ENV", {
  value: "test",
  writable: true,
});

// Mock ResizeObserver and IntersectionObserver for component testing
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock matchMedia for responsive hooks
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Export mock implementations for direct use in tests
export const mockWebSocket = global.WebSocket;
export const mockFetch = global.fetch as jest.Mock;

// Hook testing utilities
export const createMockHookContext = (overrides = {}) => ({
  user: createMockUser(),
  tokens: createMockTokens(),
  features: createMockFeatureFlags(),
  portalConfig: createMockPortalConfig("admin"),
  ...overrides,
});

// Async testing helpers
export const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

export const waitForAsyncUpdate = async (hookResult: any, timeout = 1000) => {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (!hookResult.current.isLoading) {
        resolve(hookResult.current);
      } else if (Date.now() - start > timeout) {
        reject(new Error("Timeout waiting for async update"));
      } else {
        setTimeout(check, 10);
      }
    };
    check();
  });
};
