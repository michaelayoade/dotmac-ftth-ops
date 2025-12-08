export * from "./react/simpleSelectMocks";

// Re-export test fixtures from headless package setup
// These are commonly needed test utilities across packages

// Mock invoice factory
export const mockInvoice = (overrides = {}) => ({
  id: `inv_${Math.random().toString(36).substr(2, 9)}`,
  customerId: "customer_123",
  status: "pending",
  amount: 100,
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  lineItems: [{ description: "Service", quantity: 1, unitPrice: 100 }],
  createdAt: new Date().toISOString(),
  ...overrides,
});

// Mock payment factory
export const mockPayment = (overrides = {}) => ({
  id: `pay_${Math.random().toString(36).substr(2, 9)}`,
  invoiceId: "inv_123",
  amount: 100,
  status: "completed",
  method: "credit_card",
  processedAt: new Date().toISOString(),
  ...overrides,
});

// Hook wrapper for testing
export const createHookWrapper = (config = {}) => {
  return ({ children }: { children: React.ReactNode }) => children;
};

// Mock server for MSW
export const server = {
  listen: jest.fn(),
  resetHandlers: jest.fn(),
  close: jest.fn(),
  use: jest.fn(),
};

// API error simulation
export const simulateAPIError = (status = 500, message = "Internal Server Error") => ({
  ok: false,
  status,
  statusText: message,
  json: async () => ({ error: { message, code: "ERROR" } }),
});

// Network delay simulation
export const simulateNetworkDelay = (ms = 1000) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// WebSocket mock factory
export const createMockWebSocket = (url?: string) => {
  const mockWS = {
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
      if (mockWS.onmessage) mockWS.onmessage(event);
    },
    // Helper to simulate connection open
    simulateOpen: () => {
      mockWS.readyState = 1;
      const event = new Event("open");
      if (mockWS.onopen) mockWS.onopen(event);
    },
    // Helper to simulate connection close
    simulateClose: (code = 1000, reason = "") => {
      mockWS.readyState = 3;
      const event = new CloseEvent("close", { code, reason });
      if (mockWS.onclose) mockWS.onclose(event);
    },
    // Helper to simulate error
    simulateError: () => {
      const event = new Event("error");
      if (mockWS.onerror) mockWS.onerror(event);
    },
  };
  return { mockWS };
};
