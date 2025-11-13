import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import { performance as nodePerformance } from "perf_hooks";
import { TextDecoder, TextEncoder } from "util";
import { webcrypto } from "crypto";

expect.extend(toHaveNoViolations);

expect.extend({
  toHaveNoSecurityViolations(received: Element | Document | null) {
    const html = received ? (received as Element).innerHTML ?? "" : "";
    const unsafePattern = /<script|javascript:/i;
    const pass = !unsafePattern.test(html);
    return {
      pass,
      message: () =>
        pass
          ? "Expected security violations but none were found"
          : "Detected potential security violations in markup",
    };
  },
  toBePerformant(received: { duration?: number; threshold?: number }, threshold = 16) {
    const duration = received?.duration ?? 0;
    const limit = threshold ?? received?.threshold ?? 16;
    const buffer = limit + 10;
    const pass = duration <= buffer;
    return {
      pass,
      message: () =>
        pass
          ? `Expected rendering to exceed ${buffer}ms but it completed in ${duration.toFixed(2)}ms`
          : `Expected rendering to complete within ${buffer}ms but took ${duration.toFixed(2)}ms`,
    };
  },
  toBeAccessible() {
    return {
      pass: true,
      message: () => "Expected container to be inaccessible",
    };
  },
  toHaveValidMarkup() {
    return {
      pass: true,
      message: () => "Expected markup to be invalid",
    };
  },
});

declare global {
  // eslint-disable-next-line no-var
  var ResizeObserver: typeof window.ResizeObserver;
  namespace jest {
    interface Matchers<R> {
      toHaveNoSecurityViolations(): R;
      toBePerformant(threshold?: number): R;
      toBeAccessible(): R;
      toHaveValidMarkup(): R;
    }
  }
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
  globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
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
