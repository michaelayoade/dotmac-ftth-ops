/**
 * Test setup for @dotmac/auth package
 * Configures testing environment for authentication components and utilities
 */

import "@testing-library/jest-dom";

// Mock localStorage for token storage tests
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// Mock sessionStorage for session-based auth tests
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });

// Mock crypto for secure token generation
const cryptoMock = {
  getRandomValues: jest.fn((arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  }),
  randomUUID: jest.fn(() => "mock-uuid-" + Math.random().toString(36).substr(2, 9)),
};
Object.defineProperty(window, "crypto", { value: cryptoMock });

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock performance for timing measurements
global.performance = global.performance || {};
global.performance.now = global.performance.now || (() => Date.now());

// Mock timers for session timeout tests
jest.useFakeTimers();

// Mock WebSocket for real-time auth events (if needed)
global.WebSocket = jest.fn().mockImplementation(() => ({
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  send: jest.fn(),
  close: jest.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
}));

// Mock URL for OAuth redirects
global.URL = class URL {
  constructor(url: string, base?: string) {
    this.href = base ? new URL(url, base).href : url;
  }
  href: string;
  origin: string = "http://localhost:3000";
  protocol: string = "http:";
  host: string = "localhost:3000";
  hostname: string = "localhost";
  port: string = "3000";
  pathname: string = "/";
  search: string = "";
  searchParams: URLSearchParams = new URLSearchParams();
  hash: string = "";
  toString() {
    return this.href;
  }
};

// Mock location for redirect handling
const locationMock = {
  href: "http://localhost:3000",
  origin: "http://localhost:3000",
  protocol: "http:",
  host: "localhost:3000",
  hostname: "localhost",
  port: "3000",
  pathname: "/",
  search: "",
  hash: "",
  replace: jest.fn(),
  assign: jest.fn(),
  reload: jest.fn(),
};
Object.defineProperty(window, "location", {
  value: locationMock,
  writable: true,
});

// Mock navigation for programmatic redirects
const navigationMock = {
  navigate: jest.fn(),
};
Object.defineProperty(window, "navigation", {
  value: navigationMock,
  writable: true,
});

// Mock console methods to reduce noise in tests
const originalError = console.error;
const originalWarn = console.warn;

beforeEach(() => {
  // Reset all mocks
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

  // Mock console to reduce noise unless testing actual errors
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  // Restore console
  console.error = originalError;
  console.warn = originalWarn;

  // Clear all timers
  jest.clearAllTimers();

  // Reset location
  locationMock.href = "http://localhost:3000";
  locationMock.pathname = "/";
  locationMock.search = "";
  locationMock.hash = "";
});

afterAll(() => {
  jest.useRealTimers();
});

// Helper functions for auth testing
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

export const createMockAuthConfig = (overrides = {}) => ({
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  enableMFA: true,
  enablePermissions: true,
  requirePasswordComplexity: true,
  maxLoginAttempts: 3,
  lockoutDuration: 15 * 60 * 1000, // 15 minutes
  enableAuditLog: true,
  tokenRefreshThreshold: 5 * 60 * 1000, // 5 minutes
  endpoints: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    refresh: "/api/auth/refresh",
    profile: "/api/auth/profile",
  },
  ...overrides,
});

// Custom matchers for auth testing
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidJWT(): R;
      toHaveStoredToken(): R;
      toBeAuthenticatedUser(): R;
    }
  }
}

expect.extend({
  toBeValidJWT(received: string) {
    if (typeof received !== "string") {
      return {
        message: () => `Expected JWT token to be a string, received ${typeof received}`,
        pass: false,
      };
    }

    const parts = received.split(".");
    const isValid = parts.length === 3 && parts.every((part) => part.length > 0);

    return {
      message: () =>
        isValid
          ? `Expected ${received} not to be a valid JWT token`
          : `Expected ${received} to be a valid JWT token (should have 3 parts separated by dots)`,
      pass: isValid,
    };
  },

  toHaveStoredToken(received: Storage) {
    const accessToken = received.getItem("auth.accessToken");
    const refreshToken = received.getItem("auth.refreshToken");
    const hasTokens = Boolean(accessToken && refreshToken);

    return {
      message: () =>
        hasTokens
          ? `Expected storage not to have stored auth tokens`
          : `Expected storage to have stored auth tokens`,
      pass: hasTokens,
    };
  },

  toBeAuthenticatedUser(received: any) {
    const hasRequiredFields =
      received &&
      typeof received.id === "string" &&
      typeof received.email === "string" &&
      typeof received.name === "string" &&
      typeof received.role === "string" &&
      Array.isArray(received.permissions) &&
      typeof received.tenantId === "string";

    return {
      message: () =>
        hasRequiredFields
          ? `Expected object not to be a valid authenticated user`
          : `Expected object to be a valid authenticated user with id, email, name, role, permissions, and tenantId`,
      pass: hasRequiredFields,
    };
  },
});
