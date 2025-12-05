/**
 * Jest setup for utils package tests
 */

// Mock console methods to test warning functions
const originalConsole = { ...console };

beforeEach(() => {
  // Reset console mocks before each test
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "groupCollapsed").mockImplementation(() => {});
  jest.spyOn(console, "groupEnd").mockImplementation(() => {});
  jest.spyOn(console, "table").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: jest.fn().mockResolvedValue({}),
});

// Mock crypto.randomUUID
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: jest.fn().mockReturnValue("test-uuid-1234"),
  },
});

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, "sessionStorage", {
  value: sessionStorageMock,
});

// Mock navigator
Object.defineProperty(window, "navigator", {
  value: {
    userAgent: "test-user-agent",
  },
  writable: true,
});

// Mock location
Object.defineProperty(window, "location", {
  value: {
    href: "http://localhost:3000/test",
  },
  writable: true,
});

export {};
