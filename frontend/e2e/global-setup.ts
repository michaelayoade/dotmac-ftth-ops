/**
 * Playwright global setup that ensures the Node-based MSW server
 * is running before any workers execute tests.
 */

// Polyfill localStorage for Node.js environment BEFORE importing MSW
// MSW v2.12+ requires localStorage for cookie storage
if (
  typeof global !== "undefined" &&
  (!global.localStorage || typeof (global as any).localStorage?.getItem !== "function")
) {
  class LocalStoragePolyfill {
    private store: Map<string, string>;

    constructor() {
      this.store = new Map();
    }

    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
      this.store.set(key, value);
    }

    removeItem(key: string): void {
      this.store.delete(key);
    }

    clear(): void {
      this.store.clear();
    }

    get length(): number {
      return this.store.size;
    }

    key(index: number): string | null {
      const keys = Array.from(this.store.keys());
      return keys[index] ?? null;
    }
  }

  (global as any).localStorage = new LocalStoragePolyfill();
  (global as any).sessionStorage = new LocalStoragePolyfill();
}

export default async function globalSetup() {
  // Use dynamic require to ensure localStorage polyfill is set up first
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { setupMSW } = require("./msw-setup");
  setupMSW();
}
