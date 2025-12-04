/**
 * Test setup for @dotmac/providers package
 * Configures testing environment for provider components and utilities
 */

import React from "react";
import "@testing-library/jest-dom";

// Mock React Query for provider testing
jest.mock("@tanstack/react-query", () => ({
  QueryClient: jest.fn().mockImplementation(() => ({
    setDefaultOptions: jest.fn(),
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
  })),
  QueryClientProvider: ({ children }: any) => children,
  useQueryClient: jest.fn(() => ({
    getQueryData: jest.fn(),
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
  })),
  useQuery: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    error: null,
  })),
}));

// Mock Zustand for state management testing
jest.mock("zustand", () => ({
  create: jest.fn((fn) => fn),
  subscribeWithSelector: jest.fn((fn) => fn),
}));

// Mock environment variables
Object.defineProperty(process.env, "NODE_ENV", {
  value: "test",
  writable: true,
});

// Mock performance for timing tests
global.performance = global.performance || {};
global.performance.now = global.performance.now || (() => Date.now());

// Mock requestAnimationFrame for animations
global.requestAnimationFrame = jest.fn((callback) => setTimeout(callback, 16));
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock IntersectionObserver for component visibility
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock ResizeObserver for responsive components
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.matchMedia for responsive providers
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

// Mock localStorage for persistence
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock sessionStorage
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

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock crypto for security operations
Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }),
    randomUUID: jest.fn(() => "test-uuid-" + Math.random().toString(36).substr(2, 9)),
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
  (global.fetch as jest.Mock).mockClear();

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

// Helper functions for provider testing
export const mockLocalStorage = localStorageMock;
export const mockSessionStorage = sessionStorageMock;

export const mockFetchResponse = (data: any, status = 200) => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : "Error",
    json: jest.fn().mockResolvedValueOnce(data),
    text: jest.fn().mockResolvedValueOnce(JSON.stringify(data)),
    headers: new Map([["content-type", "application/json"]]),
  });
};

export const mockFetchError = (error: Error) => {
  (global.fetch as jest.Mock).mockRejectedValueOnce(error);
};

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
          : portal === "management-admin"
            ? "enterprise"
            : portal === "management-reseller"
              ? "corporate"
              : portal === "tenant-portal"
                ? "minimal"
                : "business",
  features: {
    notifications: true,
    realtime: false,
    analytics: false,
    offline: false,
  },
  auth: {
    sessionTimeout: 30 * 60 * 1000,
    enableMFA: portal !== "customer" && portal !== "tenant-portal",
    enablePermissions: portal !== "customer" && portal !== "tenant-portal",
  },
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

// Mock query client options
export const createMockQueryClient = () => ({
  setDefaultOptions: jest.fn(),
  getQueryData: jest.fn(),
  setQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
  clear: jest.fn(),
  mount: jest.fn(),
  unmount: jest.fn(),
});

// Custom Jest matchers for provider testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveProviderContext(providerName: string): R;
      toBeWrappedByProvider(providerTestId: string): R;
      toHaveFeatureEnabled(featureName: string): R;
    }
  }
}

expect.extend({
  toHaveProviderContext(received: Element, providerName: string) {
    const hasProvider = received.closest(`[data-testid*="${providerName}"]`) !== null;

    return {
      message: () =>
        hasProvider
          ? `Expected element not to be wrapped by ${providerName} provider`
          : `Expected element to be wrapped by ${providerName} provider`,
      pass: hasProvider,
    };
  },

  toBeWrappedByProvider(received: Element, providerTestId: string) {
    const provider = received.closest(`[data-testid="${providerTestId}"]`);
    const isWrapped = provider !== null;

    return {
      message: () =>
        isWrapped
          ? `Expected element not to be wrapped by provider with testid "${providerTestId}"`
          : `Expected element to be wrapped by provider with testid "${providerTestId}"`,
      pass: isWrapped,
    };
  },

  toHaveFeatureEnabled(received: any, featureName: string) {
    const features = received?.features || received;
    const isEnabled = features && features[featureName] === true;

    return {
      message: () =>
        isEnabled
          ? `Expected feature "${featureName}" not to be enabled`
          : `Expected feature "${featureName}" to be enabled`,
      pass: isEnabled,
    };
  },
});

// Provider testing utilities
export const renderWithProviders = (ui: React.ReactElement, options: any = {}) => {
  const { portal = "admin", features = createMockFeatureFlags(), ...renderOptions } = options;

  // This would normally use the actual UniversalProviders,
  // but since we're testing the providers themselves, we mock them
  return {
    portal,
    features,
    ...renderOptions,
  };
};

// Mock error boundary for testing error handling
export class MockErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-fallback">Something went wrong</div>;
    }

    return this.props.children;
  }
}
