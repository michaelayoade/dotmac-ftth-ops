/**
 * Test setup file for auth package
 * Configures testing environment and mocks
 */

import { vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom";

// Mock environment for tests
Object.defineProperty(global, "localStorage", {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(global, "sessionStorage", {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock navigator
Object.defineProperty(global, "navigator", {
  value: {
    userAgent: "Mozilla/5.0 (Test Environment) TestBrowser/1.0",
  },
  writable: true,
});

// Mock location
Object.defineProperty(global, "location", {
  value: {
    protocol: "http:",
    hostname: "localhost",
    port: "3000",
    pathname: "/",
    search: "",
    hash: "",
  },
  writable: true,
});

// Mock window
Object.defineProperty(global, "window", {
  value: {
    location: global.location,
    navigator: global.navigator,
    localStorage: global.localStorage,
    sessionStorage: global.sessionStorage,
  },
  writable: true,
});

// Mock crypto for secure random generation
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => `test-uuid-${Date.now()}-${Math.random()}`,
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
  },
  writable: true,
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock Intl for timezone detection
Object.defineProperty(global, "Intl", {
  value: {
    DateTimeFormat: vi.fn(() => ({
      resolvedOptions: () => ({ timeZone: "America/New_York" }),
    })),
  },
  writable: true,
});

// Setup before each test
beforeEach(() => {
  // Reset all mocks
  vi.clearAllMocks();

  // Clear storage
  global.localStorage.clear();
  global.sessionStorage.clear();

  // Reset fetch mock
  (global.fetch as any).mockClear?.();
});

// Cleanup after each test
afterEach(() => {
  vi.resetAllMocks();
});
