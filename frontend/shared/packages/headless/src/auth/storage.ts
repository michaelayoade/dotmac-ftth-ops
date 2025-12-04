type StorageBackend = "localStorage" | "sessionStorage";

export interface SecureStorageOptions {
  backend?: StorageBackend;
  prefix?: string;
}

/**
 * Minimal storage wrapper that gracefully falls back to an in-memory map on the server.
 * It intentionally avoids storing sensitive credentials; callers should only persist UI state.
 */
export class SecureStorage {
  private backend: StorageBackend;
  private prefix: string;
  private memoryStore = new Map<string, string>();

  constructor(options: SecureStorageOptions = {}) {
    this.backend = options.backend ?? "localStorage";
    this.prefix = options.prefix ?? "dotmac:";
  }

  private get storage(): Storage | null {
    if (typeof window === "undefined") {
      return null;
    }

    if (this.backend === "sessionStorage") {
      return window.sessionStorage;
    }

    return window.localStorage;
  }

  private withPrefix(key: string): string {
    return `${this.prefix}${key}`;
  }

  getItem(key: string): string | null {
    const storage = this.storage;
    const namespacedKey = this.withPrefix(key);

    if (!storage) {
      return this.memoryStore.get(namespacedKey) ?? null;
    }

    return storage.getItem(namespacedKey);
  }

  setItem(key: string, value: string): void {
    const storage = this.storage;
    const namespacedKey = this.withPrefix(key);

    if (!storage) {
      this.memoryStore.set(namespacedKey, value);
      return;
    }

    storage.setItem(namespacedKey, value);
  }

  removeItem(key: string): void {
    const storage = this.storage;
    const namespacedKey = this.withPrefix(key);

    if (!storage) {
      this.memoryStore.delete(namespacedKey);
      return;
    }

    storage.removeItem(namespacedKey);
  }
}
