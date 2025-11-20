import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import { TextEncoder, TextDecoder } from "util";
import { TransformStream, ReadableStream, WritableStream } from "stream/web";
import axios from "axios";
if (typeof process !== "undefined" && process.release?.name === "node") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getAdapter } = require("axios/dist/node/axios.cjs");
    axios.defaults.adapter = getAdapter("http");
  } catch (error) {
    console.warn("[jest.setup] Failed to configure axios HTTP adapter:", error);
  }
}

try {
  const fetchModule = require("next/dist/compiled/node-fetch");
  const fetchImpl = fetchModule.default ?? fetchModule;
  if (typeof global.fetch !== "function") {
    global.fetch = fetchImpl;
  }
  if (!global.Headers) {
    global.Headers = fetchModule.Headers;
  }
  if (!global.Request) {
    global.Request = fetchModule.Request;
  }
  if (!global.Response) {
    global.Response = fetchModule.Response;
  }
  if (!global.FormData) {
    global.FormData = fetchModule.FormData;
  }
} catch {
  // ok - use native jsdom fetch
}

if (typeof global !== "undefined" && "XMLHttpRequest" in global) {
  try {
    delete global.XMLHttpRequest;
  } catch {
    global.XMLHttpRequest = undefined;
  }
}

if (typeof global.self === "undefined") {
  global.self = global;
}
require("whatwg-fetch");
if (typeof global.fetch === "function") {
  global.__JEST_NATIVE_FETCH__ = global.fetch.bind(global);
}

const originalError = console.error;

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
if (!(global.TransformStream)) {
  global.TransformStream = TransformStream;
}
if (!(global.ReadableStream)) {
  global.ReadableStream = ReadableStream;
}
if (!(global.WritableStream)) {
  global.WritableStream = WritableStream;
}

global.BroadcastChannel = class BroadcastChannel {
  constructor(name) {
    this.name = name;
  }
  postMessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
};

expect.extend(toHaveNoViolations);

beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Warning: An update to") &&
      args[0].includes("was not wrapped in act")
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});

jest.mock("next/router", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    pathname: "/",
    query: {},
    asPath: "/",
  }),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

if (typeof global.Response === "undefined" && typeof window !== "undefined" && window.Response) {
  global.Response = window.Response;
}
if (typeof global.Request === "undefined" && typeof window !== "undefined" && window.Request) {
  global.Request = window.Request;
}
if (typeof global.Headers === "undefined" && typeof window !== "undefined" && window.Headers) {
  global.Headers = window.Headers;
}
