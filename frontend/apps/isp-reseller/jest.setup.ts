import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Mock reseller config
jest.mock("@/lib/config", () => ({
  resellerConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/isp/v1/partner",
      timeout: 30000,
      buildUrl: (path: string) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        const prefixed = normalized.startsWith("/api/isp/v1/partner") ? normalized : `/api/isp/v1/partner${normalized}`;
        return `http://localhost:3000${prefixed}`;
      },
    },
    app: {
      name: "Reseller Portal",
      version: "1.0.0",
      environment: "test",
    },
  },
}));

// Polyfills
if (!(global as any).TextEncoder) {
  (global as any).TextEncoder = TextEncoder;
}
if (!(global as any).TextDecoder) {
  (global as any).TextDecoder = TextDecoder as typeof TextDecoder;
}

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

// Mock fetch
global.fetch = jest.fn();

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock).mockReset();
});
