import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import { performance as nodePerformance } from "perf_hooks";
import { TextDecoder, TextEncoder } from "util";
import { webcrypto } from "crypto";
import React from "react";
import { ensureTestingMatchers } from "../src/testing/matchers";

// Ensure React is available globally
if (typeof globalThis.React === "undefined") {
  (globalThis as any).React = React;
}

expect.extend(toHaveNoViolations);
ensureTestingMatchers();

declare global {
  // eslint-disable-next-line no-var
  var ResizeObserver: typeof window.ResizeObserver;
}

if (typeof globalThis.TextEncoder === "undefined") {
  globalThis.TextEncoder = TextEncoder as typeof globalThis.TextEncoder;
}

if (typeof globalThis.TextDecoder === "undefined") {
  globalThis.TextDecoder = TextDecoder as typeof globalThis.TextDecoder;
}

if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = webcrypto as Crypto;
}

if (typeof globalThis.performance === "undefined") {
  globalThis.performance = nodePerformance as unknown as Performance;
} else if (!globalThis.performance.now) {
  globalThis.performance.now = nodePerformance.now.bind(nodePerformance);
}

class MockResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
}

globalThis.ResizeObserver = globalThis.ResizeObserver || (MockResizeObserver as any);

class MockIntersectionObserver {
  constructor(public readonly callback: IntersectionObserverCallback) {}
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
}

if (typeof globalThis.IntersectionObserver === "undefined") {
  globalThis.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver;
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }),
});

if (!window.scrollTo) {
  window.scrollTo = jest.fn();
}

if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(globalThis.performance.now()), 16) as unknown as number;
  };
}

if (!globalThis.cancelAnimationFrame) {
  globalThis.cancelAnimationFrame = (handle: number) => {
    clearTimeout(handle);
  };
}

if (!globalThis.URL.createObjectURL) {
  globalThis.URL.createObjectURL = jest.fn(() => "blob:mock-url");
}

if (!globalThis.URL.revokeObjectURL) {
  globalThis.URL.revokeObjectURL = jest.fn();
}

const mockFetchResponse = {
  ok: true,
  status: 200,
  json: async () => ({}),
  text: async () => "",
};

if (typeof globalThis.fetch === "undefined") {
  globalThis.fetch = jest.fn(() => Promise.resolve(mockFetchResponse)) as typeof fetch;
}

const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
  console.error = originalError;
  jest.clearAllMocks();
});
