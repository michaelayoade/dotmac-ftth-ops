/**
 * Idempotent localStorage/sessionStorage polyfill for Node-based Playwright workers.
 * MSW v2.12+ touches localStorage during setup, so we need a Storage-like object
 * with string semantics.
 */
export function ensureStoragePolyfill(): void {
  if (typeof globalThis === "undefined") {
    return;
  }

  const g = globalThis as any;
  const hasStorage =
    typeof g.localStorage?.getItem === "function" &&
    typeof g.sessionStorage?.getItem === "function";

  if (hasStorage) {
    return;
  }

  class LocalStoragePolyfill {
    private store: Map<string, string>;

    constructor() {
      this.store = new Map();
    }

    getItem(key: string): string | null {
      return this.store.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
      this.store.set(key, String(value));
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

  const storage = new LocalStoragePolyfill();
  const session = new LocalStoragePolyfill();

  g.localStorage = storage;
  g.sessionStorage = session;

  // Keep Node's global in sync for libraries that reference it directly.
  if (typeof global !== "undefined") {
    (global as any).localStorage = storage;
    (global as any).sessionStorage = session;
  }
}

// Apply on import for convenience in side-effect usage.
ensureStoragePolyfill();
