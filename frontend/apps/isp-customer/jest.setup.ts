import "@testing-library/jest-dom";
import { TextEncoder, TextDecoder } from "util";

// Fetch API polyfills for Node.js test environment
// Note: These are needed because jsdom doesn't include them
class MockResponse {
  private _body: string;
  public status: number;
  public headers: Headers;
  public ok: boolean;

  constructor(body?: BodyInit | null, init?: ResponseInit) {
    this._body = typeof body === "string" ? body : JSON.stringify(body);
    this.status = init?.status || 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.headers = new Headers(init?.headers);
  }

  async json() {
    return JSON.parse(this._body);
  }

  async text() {
    return this._body;
  }
}

if (typeof global.Response === "undefined") {
  (global as any).Response = MockResponse;
}

if (typeof global.Headers === "undefined") {
  (global as any).Headers = Map;
}

if (typeof global.Request === "undefined") {
  (global as any).Request = class Request {
    constructor(public url: string, public init?: RequestInit) {}
  };
}

// Mock customer config
jest.mock("@/lib/config", () => ({
  customerConfig: {
    api: {
      baseUrl: "http://localhost:3000",
      prefix: "/api/isp/v1",
      timeout: 30000,
      buildUrl: (path: string) => {
        const normalized = path.startsWith("/") ? path : `/${path}`;
        const prefixed = normalized.startsWith("/api/isp/v1") ? normalized : `/api/isp/v1${normalized}`;
        return `http://localhost:3000${prefixed}`;
      },
    },
    app: {
      name: "Customer Portal",
      version: "1.0.0",
      environment: "test",
    },
  },
}));

// Polyfills for Node.js environment
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
