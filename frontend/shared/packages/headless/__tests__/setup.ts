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

const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};

// Only set window properties if window exists (jsdom environment)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "localStorage", { value: localStorageMock });
  Object.defineProperty(window, "sessionStorage", { value: sessionStorageMock });
}

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
if (typeof window !== "undefined") {
  Object.defineProperty(window, "crypto", {
    value: {
      getRandomValues: jest.fn((arr) => {
        for (let i = 0; i < arr.length; i++) {
          arr[i] = Math.floor(Math.random() * 256);
        }
        return arr;
      }),
      randomUUID: jest.fn(() => `mock-uuid-${  Math.random().toString(36).substr(2, 9)}`),
      subtle: {
        digest: jest.fn(),
        encrypt: jest.fn(),
        decrypt: jest.fn(),
      },
    },
  });
}

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
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
if (typeof window !== "undefined") {
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
}

// Export mock implementations for direct use in tests
export const mockWebSocket = global.WebSocket;
export const mockFetch = global.fetch as jest.Mock;

// Factory function for creating mock WebSocket instances
export const createMockWebSocket = (url?: string) => {
  const mockWs = {
    url: url || "ws://localhost:8080",
    readyState: 1, // OPEN
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    bufferedAmount: 0,
    extensions: "",
    protocol: "",
    binaryType: "blob" as BinaryType,
    onopen: null as ((event: Event) => void) | null,
    onclose: null as ((event: CloseEvent) => void) | null,
    onerror: null as ((event: Event) => void) | null,
    onmessage: null as ((event: MessageEvent) => void) | null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    send: jest.fn(),
    close: jest.fn(),
    dispatchEvent: jest.fn(() => true),
    // Helper to simulate receiving a message
    simulateMessage: (data: any) => {
      const event = new MessageEvent("message", { data: JSON.stringify(data) });
      if (mockWs.onmessage) mockWs.onmessage(event);
    },
    // Helper to simulate connection open
    simulateOpen: () => {
      mockWs.readyState = 1;
      const event = new Event("open");
      if (mockWs.onopen) mockWs.onopen(event);
    },
    // Helper to simulate connection close
    simulateClose: (code = 1000, reason = "") => {
      mockWs.readyState = 3;
      const event = new CloseEvent("close", { code, reason });
      if (mockWs.onclose) mockWs.onclose(event);
    },
    // Helper to simulate error
    simulateError: () => {
      const event = new Event("error");
      if (mockWs.onerror) mockWs.onerror(event);
    },
  };
  return mockWs;
};

// Hook testing utilities
export const createMockHookContext = (overrides = {}) => ({
  user: createMockUser(),
  tokens: createMockTokens(),
  features: createMockFeatureFlags(),
  portalConfig: createMockPortalConfig("admin"),
  ...overrides,
});

// Mock audit log for compliance testing
export const createMockAuditLog = (overrides = {}) => ({
  id: "audit_123",
  event_type: "DATA_ACCESS",
  action: "READ",
  user_id: "user_456",
  user_email: "user@example.com",
  resource_type: "CUSTOMER_DATA",
  resource_id: "cust_789",
  risk_level: "LOW",
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0",
  timestamp: new Date().toISOString(),
  details: {
    fields_accessed: ["name", "email"],
    purpose: "Customer support inquiry",
  },
  ...overrides,
});

// Mock compliance assessment
export const createMockAssessment = (overrides = {}) => ({
  id: "assessment_123",
  name: "Q4 SOC2 Compliance Assessment",
  framework: "SOC2",
  status: "IN_PROGRESS",
  assessor_id: "user_assessor",
  assessor_name: "Compliance Auditor",
  start_date: new Date().toISOString(),
  due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  compliance_percentage: 85,
  findings: [],
  action_plan: [],
  recommendations: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Mock compliance finding
export const createMockFinding = (overrides = {}) => ({
  id: "finding_123",
  assessment_id: "assessment_123",
  title: "Access Control Gap",
  description: "Missing MFA for admin access",
  severity: "HIGH",
  status: "OPEN",
  control_id: "AC-1",
  evidence: [],
  remediation_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  assigned_to: "user_456",
  created_at: new Date().toISOString(),
  ...overrides,
});

// Mock action item
export const createMockActionItem = (overrides = {}) => ({
  id: "action_123",
  finding_id: "finding_123",
  title: "Implement MFA for admin portal",
  description: "Enable multi-factor authentication for all admin users",
  priority: "HIGH",
  status: "PENDING",
  due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  assigned_to: "user_789",
  evidence_required: true,
  created_at: new Date().toISOString(),
  ...overrides,
});

// Mock privacy request
export const createMockPrivacyRequest = (overrides = {}) => ({
  id: "privacy_123",
  customer_id: "cust_456",
  customer_email: "customer@example.com",
  request_type: "DATA_ACCESS",
  status: "PENDING",
  verification_status: "VERIFIED",
  data_categories: ["personal_info", "usage_data", "billing"],
  request_details: "Request for full data export under GDPR Article 15",
  submission_date: new Date().toISOString(),
  completion_deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  processing_notes: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Mock inventory item
export const createMockInventoryItem = (overrides = {}) => ({
  id: "item_123",
  sku: "ONT-GPON-001",
  name: "GPON ONT Device",
  description: "Gigabit-capable Passive Optical Network terminal",
  category: "NETWORK_EQUIPMENT",
  type: "ONT",
  status: "IN_STOCK",
  condition: "NEW",
  serial_number: "SN123456789",
  quantity: 1,
  unit_cost: 150.0,
  location: {
    warehouse_id: "wh_main",
    zone: "A",
    shelf: "3",
    bin: "12",
  },
  purchase_info: {
    vendor_id: "vendor_123",
    vendor_name: "Network Equipment Co",
    purchase_order: "PO-2024-001",
    purchase_date: new Date().toISOString(),
    purchase_price: 150.0,
  },
  warranty_info: {
    warranty_period_months: 24,
    warranty_start: new Date().toISOString(),
    warranty_end: new Date(Date.now() + 24 * 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  specifications: {
    ports: 4,
    speed: "1Gbps",
    wifi: true,
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Mock work order
export const createMockWorkOrder = (overrides = {}) => ({
  id: "wo_123",
  type: "INSTALLATION",
  status: "SCHEDULED",
  priority: "NORMAL",
  customer_id: "cust_456",
  customer_name: "John Doe",
  customer_address: "123 Main St, City, ST 12345",
  scheduled_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  estimated_duration_hours: 2,
  technician_id: "tech_789",
  technician_name: "Jane Technician",
  service_type: "FIBER_INSTALLATION",
  required_equipment: [
    { item_id: "item_123", quantity: 1, name: "GPON ONT Device" },
    { item_id: "item_456", quantity: 50, name: "Fiber Cable (meters)" },
  ],
  assigned_equipment: [],
  notes: "Customer requested morning installation",
  completion_notes: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Mock metrics for analytics
export const createMockMetrics = (overrides = {}) => ({
  period: "daily",
  start_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  end_date: new Date().toISOString(),
  metrics: {
    active_users: 1500,
    new_signups: 25,
    revenue: 45000,
    churn_rate: 0.02,
    avg_response_time_ms: 150,
    uptime_percentage: 99.95,
  },
  trends: {
    users: { current: 1500, previous: 1450, change: 3.45 },
    revenue: { current: 45000, previous: 42000, change: 7.14 },
  },
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
