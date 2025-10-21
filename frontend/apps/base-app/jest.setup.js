// Learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import { TextEncoder, TextDecoder } from "util";

// Suppress React act() warnings in tests
// These warnings occur due to async state updates after promise resolution in React 18
// The tests are correctly structured - this is a known limitation with Jest + React 18
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: An update to") &&
      args[0].includes("was not wrapped in act")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

// Add TextEncoder/TextDecoder polyfills for Node.js environment
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Add BroadcastChannel polyfill for MSW tests
global.BroadcastChannel = class BroadcastChannel {
  constructor(name) {
    this.name = name;
  }
  postMessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};

// MSW Server for API mocking
// Note: MSW v2 has ESM issues with Jest - using fetch mock instead
// import { server } from './__tests__/mocks/server'

// Extend Jest matchers with jest-axe
expect.extend(toHaveNoViolations);

// Establish API mocking before all tests
// beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))

// Reset any request handlers that are declared in a test
// afterEach(() => server.resetHandlers())

// Clean up after all tests are done
// afterAll(() => server.close())

// Mock next/router
jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: "/",
    query: {},
    asPath: "/",
  }),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock useToast hook (migration from sonner)
jest.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({
    toast: jest.fn(),
    dismiss: jest.fn(),
    toasts: [],
  }),
}));

// Mock React Query hooks
jest.mock("@tanstack/react-query", () => ({
  useQuery: jest.fn((options) => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    isSuccess: true,
    ...options,
  })),
  useMutation: jest.fn(() => ({
    mutate: jest.fn(),
    mutateAsync: jest.fn(),
    isLoading: false,
    isError: false,
    error: null,
    reset: jest.fn(),
    isSuccess: false,
  })),
  useQueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
    refetchQueries: jest.fn(),
  })),
  QueryClient: jest.fn(() => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
    getQueryData: jest.fn(),
    refetchQueries: jest.fn(),
  })),
  QueryClientProvider: ({ children }) => children,
}));

// Set up global test environment with smart fetch mock
global.fetch = jest.fn((url, options = {}) => {
  const urlStr = typeof url === "string" ? url : url.toString();
  const method = options.method || "GET";

  // Plugin available plugins list (GET)
  if (urlStr.includes("/api/v1/plugins/") && !urlStr.includes("/instances") && method === "GET") {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            name: "WhatsApp Business",
            type: "notification",
            version: "1.0.0",
            description: "Send WhatsApp messages",
            supports_health_check: true,
            supports_test_connection: true,
            fields: [
              {
                key: "api_token",
                label: "API Token",
                type: "secret",
                required: true,
              },
            ],
          },
          {
            name: "Slack Integration",
            type: "notification",
            version: "2.0.0",
            description: "Send notifications to Slack",
            supports_health_check: true,
            supports_test_connection: false,
            fields: [],
          },
        ]),
    });
  }

  // Plugin instances (GET)
  if (urlStr.includes("/api/v1/plugins/instances") && method === "GET") {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          plugins: [
            {
              id: "550e8400-e29b-41d4-a716-446655440000",
              plugin_name: "WhatsApp Business",
              instance_name: "Production WhatsApp",
              status: "active",
              has_configuration: true,
              config_schema: {
                name: "WhatsApp Business",
                type: "notification",
                version: "1.0.0",
                description: "Send WhatsApp messages",
                supports_health_check: true,
                supports_test_connection: true,
                fields: [],
              },
            },
            {
              id: "550e8400-e29b-41d4-a716-446655440001",
              plugin_name: "Slack Integration",
              instance_name: "Team Notifications",
              status: "error",
              has_configuration: true,
              last_error: "Authentication failed",
              config_schema: {
                name: "Slack Integration",
                type: "notification",
                version: "2.0.0",
                description: "Send notifications to Slack",
                supports_health_check: true,
                supports_test_connection: false,
                fields: [],
              },
            },
          ],
        }),
    });
  }

  // Plugin health check (POST)
  if (urlStr.includes("/api/v1/plugins/instances/health-check") && method === "POST") {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve([
          {
            plugin_instance_id: "550e8400-e29b-41d4-a716-446655440000",
            status: "healthy",
            message: "All systems operational",
            details: {},
            response_time_ms: 200,
            timestamp: new Date().toISOString(),
          },
          {
            plugin_instance_id: "550e8400-e29b-41d4-a716-446655440001",
            status: "error",
            message: "Authentication failed",
            details: { error_code: 401 },
            response_time_ms: 1000,
            timestamp: new Date().toISOString(),
          },
        ]),
    });
  }

  // Plugin refresh (POST)
  if (urlStr.includes("/api/v1/plugins/refresh") && method === "POST") {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ message: "Plugins refreshed" }),
    });
  }

  // Create plugin instance (POST)
  if (urlStr.includes("/api/v1/plugins/instances") && method === "POST") {
    return Promise.resolve({
      ok: true,
      status: 201,
      json: () =>
        Promise.resolve({
          id: "new-instance-id",
          plugin_name: "Test Plugin",
          instance_name: "New Instance",
          status: "active",
          has_configuration: true,
          config_schema: {
            name: "Test Plugin",
            type: "notification",
            version: "1.0.0",
            description: "Test",
            supports_health_check: false,
            supports_test_connection: false,
            fields: [],
          },
        }),
    });
  }

  // Delete plugin instance (DELETE)
  if (urlStr.includes("/api/v1/plugins/instances/") && method === "DELETE") {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true }),
    });
  }

  // Test connection (POST)
  if (
    urlStr.includes("/api/v1/plugins/instances/") &&
    urlStr.includes("/test") &&
    method === "POST"
  ) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ success: true, message: "Connection successful" }),
    });
  }

  // Auth endpoints
  if (urlStr.includes("/api/v1/auth/login")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          success: true,
          user: { id: "1", email: "admin@example.com" },
        }),
    });
  }

  if (urlStr.includes("/api/v1/auth/me")) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "1",
          email: "admin@example.com",
          full_name: "System Administrator",
        }),
    });
  }

  // Default response
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  });
});

// Add Request and Response polyfills for Next.js API routes
global.Request = class Request {
  constructor(input, init) {
    this.url = input;
    this.method = (init && init.method) || "GET";
    this.headers = new Map(Object.entries((init && init.headers) || {}));
    this.cookies = {
      get: jest.fn(),
      getAll: jest.fn(() => []),
    };
  }
};

global.Response = class Response {
  constructor(body, init) {
    this.body = body;
    this.status = (init && init.status) || 200;
    this.headers = new Map(Object.entries((init && init.headers) || {}));
  }

  json() {
    return Promise.resolve(JSON.parse(this.body));
  }

  static json(data, init) {
    return new Response(JSON.stringify(data), {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(init && init.headers),
      },
    });
  }
};
