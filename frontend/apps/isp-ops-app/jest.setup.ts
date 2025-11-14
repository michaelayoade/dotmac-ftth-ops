import "@testing-library/jest-dom";
import "whatwg-fetch"; // Polyfill fetch for jsdom
import { server } from "./__tests__/msw/server";

// Start MSW server before all tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
});

// Close MSW server after all tests
afterAll(() => {
  server.close();
});

// Mock Next.js router
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: "/",
      query: {},
      asPath: "/",
    };
  },
  usePathname() {
    return "/";
  },
  useSearchParams() {
    return new URLSearchParams();
  },
}));

// Mock window.matchMedia
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

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;

// Mock navigator.geolocation
Object.defineProperty(global.navigator, "geolocation", {
  writable: true,
  value: {
    getCurrentPosition: jest.fn().mockImplementation((success) => {
      Promise.resolve().then(() => {
        success({
          coords: {
            latitude: 6.5244,
            longitude: 3.3792,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        });
      });
    }),
    watchPosition: jest.fn(),
    clearWatch: jest.fn(),
  },
});

// Mock Notification API
Object.defineProperty(global, "Notification", {
  writable: true,
  value: {
    permission: "default",
    requestPermission: jest.fn().mockResolvedValue("granted"),
  },
});

// Mock Service Worker
Object.defineProperty(global.navigator, "serviceWorker", {
  writable: true,
  value: {
    register: jest.fn().mockResolvedValue({
      scope: "/",
      update: jest.fn(),
    }),
    ready: Promise.resolve({
      sync: {
        register: jest.fn(),
      },
      periodicSync: {
        register: jest.fn(),
      },
      pushManager: {
        subscribe: jest.fn(),
        getSubscription: jest.fn(),
      },
    }),
  },
});

// Note: Console warnings are NOT suppressed in tests
// This allows us to catch real issues like:
// - useLayoutEffect warnings (should use useEffect in tests or fix server-side issues)
// - ReactDOM.render deprecation warnings (should migrate to createRoot)
// - Async state update warnings (should be wrapped in act())
// If a warning appears, fix the root cause instead of suppressing it here