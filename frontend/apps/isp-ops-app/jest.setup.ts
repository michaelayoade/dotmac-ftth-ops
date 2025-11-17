import "@testing-library/jest-dom";
import "whatwg-fetch"; // Polyfill fetch for jsdom
import { TextEncoder, TextDecoder } from "util";
import { TransformStream, ReadableStream, WritableStream } from "stream/web";
import { resetAllMSWHandlerStorage } from "./__tests__/msw/resetAllHandlers";
import apiClient from "@/lib/api/client";

if (!(global as any).TextEncoder) {
  (global as any).TextEncoder = TextEncoder;
}
if (!(global as any).TextDecoder) {
  (global as any).TextDecoder = TextDecoder as typeof TextDecoder;
}
if (!(global as any).TransformStream) {
  (global as any).TransformStream = TransformStream;
}
if (!(global as any).ReadableStream) {
  (global as any).ReadableStream = ReadableStream;
}
if (!(global as any).WritableStream) {
  (global as any).WritableStream = WritableStream;
}
if (!(global as any).BroadcastChannel) {
  class MockBroadcastChannel {
    constructor() {}
    postMessage() {}
    addEventListener() {}
    removeEventListener() {}
    close() {}
    onmessage: ((this: BroadcastChannel, ev: MessageEvent) => any) | null = null;
  }
  (global as any).BroadcastChannel = MockBroadcastChannel;
}

const { server } = require("./__tests__/msw/server");
const globalAny = global as any;

if (!globalAny.navigator) {
  globalAny.navigator = {} as Navigator;
}

if (!globalAny.URL) {
  globalAny.URL = {} as URL;
}
if (typeof globalAny.URL.createObjectURL !== "function") {
  globalAny.URL.createObjectURL = jest.fn(() => "blob:mock-url");
}
if (typeof globalAny.URL.revokeObjectURL !== "function") {
  globalAny.URL.revokeObjectURL = jest.fn();
}

const shouldPatchRenderHook = process.env['DOTMAC_ENABLE_RENDER_HOOK_PATCH'] === "true";

if (shouldPatchRenderHook) {
  try {
    const testingLibraryReact = require("@testing-library/react");
    const React = require("react");
    const testingLibraryModuleId = require.resolve("@testing-library/react");

    const customRenderHook = (renderCallback: (...args: any[]) => any, options?: any) => {
      const { initialProps, wrapper: Wrapper } = options ?? {};
      const resultRef = { current: undefined as unknown };

      function HookContainer({ props }: { props: unknown }) {
        resultRef.current = renderCallback(props);
        return null;
      }

      const renderTree = (props: unknown) =>
        Wrapper
          ? React.createElement(Wrapper, null, React.createElement(HookContainer, { props }))
          : React.createElement(HookContainer, { props });

      const { rerender: baseRerender, unmount } = testingLibraryReact.render(renderTree(initialProps));

      const rerender = (newProps?: unknown) => {
        baseRerender(renderTree(newProps));
      };

      return {
        result: resultRef,
        rerender,
        unmount,
      };
    };

    const descriptor = Object.getOwnPropertyDescriptor(testingLibraryReact, "renderHook");
    const canPatchDirectly =
      !descriptor || descriptor.configurable || descriptor.writable || typeof descriptor?.set === "function";

    if (canPatchDirectly) {
      Object.defineProperty(testingLibraryReact, "renderHook", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: customRenderHook,
      });
    } else if (require.cache && require.cache[testingLibraryModuleId]) {
      const cachedModule = require.cache[testingLibraryModuleId];
      const clonedExports =
        Object.create(Object.getPrototypeOf(testingLibraryReact) ?? Object.prototype);

      for (const key of Reflect.ownKeys(testingLibraryReact)) {
        if (key === "renderHook") {
          continue;
        }
        const propertyDescriptor = Object.getOwnPropertyDescriptor(testingLibraryReact, key);
        if (propertyDescriptor) {
          Object.defineProperty(clonedExports, key, propertyDescriptor);
        }
      }

      Object.defineProperty(clonedExports, "renderHook", {
        configurable: true,
        enumerable: true,
        writable: true,
        value: customRenderHook,
      });

      cachedModule.exports = clonedExports;
    }
  } catch (error) {
    console.warn(
      "[jest.setup] Failed to patch renderHook:",
      error instanceof Error ? error.message : error,
    );
  }
}

// Start MSW server before all tests
beforeAll(() => {
server.listen({ onUnhandledRequest: "warn" });
  server.events.on("response:mocked", ({ request, response }: any) => {
    if (request.url.includes("/orchestration")) {
      console.log("[MSW response]", request.method, request.url, response.status);
    }
  });
});

apiClient.interceptors.request.use((config) => {
  if ((config.url || "").includes("orchestration")) {
    console.log("[axios request]", config.baseURL, config.url);
  }
  return config;
});
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.config?.url?.includes("orchestration")) {
      console.log("[axios error]", error.response?.status);
    }
    return Promise.reject(error);
  },
);

// Reset handlers after each test
afterEach(() => {
  server.resetHandlers();
  resetAllMSWHandlerStorage();
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
