/**
 * Jest Polyfills
 *
 * This file provides polyfills for Node.js APIs that are required by MSW
 * but not available in the Jest/JSDOM environment.
 *
 * Must be loaded via setupFiles (not setupFilesAfterEnv) to run before
 * any modules are loaded.
 */

const { TextDecoder, TextEncoder } = require("util");

// Polyfill TextEncoder/TextDecoder for MSW
Object.assign(global, { TextDecoder, TextEncoder });

// Polyfill BroadcastChannel for MSW
if (typeof global.BroadcastChannel === "undefined") {
  global.BroadcastChannel = class BroadcastChannel {
    constructor(name) {
      this.name = name;
    }
    postMessage() {}
    close() {}
    addEventListener() {}
    removeEventListener() {}
  };
}

// Polyfill fetch and related APIs for MSW (in case they're not provided by JSDOM)
if (typeof global.fetch === "undefined") {
  global.fetch = jest.fn();
}

if (typeof global.Request === "undefined") {
  global.Request = class Request {};
}

if (typeof global.Response === "undefined") {
  global.Response = class Response {};
}

if (typeof global.Headers === "undefined") {
  global.Headers = class Headers {
    constructor() {
      this.map = new Map();
    }
    get(name) {
      return this.map.get(name);
    }
    set(name, value) {
      this.map.set(name, value);
    }
    has(name) {
      return this.map.has(name);
    }
  };
}
