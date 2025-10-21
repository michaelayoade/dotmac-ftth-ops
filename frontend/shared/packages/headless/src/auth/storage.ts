/**
 * Unified Secure Storage
 * Handles secure storage of authentication data with configurable backends
 */

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

export interface SecureStorageOptions {
  prefix?: string;
  encrypt?: boolean;
  backend?: "localStorage" | "sessionStorage" | "cookies" | "memory";
  cookieOptions?: {
    secure?: boolean;
    sameSite?: "strict" | "lax" | "none";
    maxAge?: number;
  };
}

class CookieStorage implements StorageBackend {
  private options: SecureStorageOptions["cookieOptions"];

  constructor(options: SecureStorageOptions["cookieOptions"] = {}) {
    this.options = {
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days
      ...options,
    };
  }

  getItem(key: string): string | null {
    if (typeof document === "undefined") return null;

    try {
      const value = document.cookie
        .split("; ")
        .find((row) => row.startsWith(`${key}=`))
        ?.split("=")[1];

      return value ? decodeURIComponent(value) : null;
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (typeof document === "undefined") return;

    try {
      const cookieString = [
        `${key}=${encodeURIComponent(value)}`,
        "path=/",
        `max-age=${this.options.maxAge}`,
        `samesite=${this.options.sameSite}`,
        this.options.secure ? "secure" : "",
      ]
        .filter(Boolean)
        .join("; ");

      document.cookie = cookieString;
    } catch (error) {
      console.warn("Failed to set cookie:", error);
    }
  }

  removeItem(key: string): void {
    if (typeof document === "undefined") return;
    document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  clear(): void {
    if (typeof document === "undefined") return;
    document.cookie.split(";").forEach((c) => {
      const eqPos = c.indexOf("=");
      const name = eqPos > -1 ? c.substr(0, eqPos).trim() : c.trim();
      document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
  }
}

class MemoryStorage implements StorageBackend {
  private storage = new Map<string, string>();

  getItem(key: string): string | null {
    return this.storage.get(key) || null;
  }

  setItem(key: string, value: string): void {
    this.storage.set(key, value);
  }

  removeItem(key: string): void {
    this.storage.delete(key);
  }

  clear(): void {
    this.storage.clear();
  }
}

export class SecureStorage {
  private backend: StorageBackend;
  private prefix: string;
  private encrypt: boolean;

  constructor(options: SecureStorageOptions = {}) {
    this.prefix = options.prefix || "dotmac_";
    this.encrypt = options.encrypt || false;

    // Select storage backend
    switch (options.backend) {
      case "cookies":
        this.backend = new CookieStorage(options.cookieOptions);
        break;
      case "sessionStorage":
        this.backend =
          typeof window !== "undefined" && window.sessionStorage
            ? window.sessionStorage
            : new MemoryStorage();
        break;
      case "memory":
        this.backend = new MemoryStorage();
        break;
      case "localStorage":
      default:
        this.backend =
          typeof window !== "undefined" && window.localStorage
            ? window.localStorage
            : new MemoryStorage();
        break;
    }
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private encryptValue(value: string): string {
    if (!this.encrypt) return value;

    // Simple XOR encryption for demo - use proper encryption in production
    const key = "dotmac-auth-key";
    let encrypted = "";
    for (let i = 0; i < value.length; i++) {
      encrypted += String.fromCharCode(value.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(encrypted);
  }

  private decryptValue(value: string): string {
    if (!this.encrypt) return value;

    try {
      const decoded = atob(value);
      const key = "dotmac-auth-key";
      let decrypted = "";
      for (let i = 0; i < decoded.length; i++) {
        decrypted += String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return decrypted;
    } catch {
      return value; // Return as-is if decryption fails
    }
  }

  getItem(key: string): string | null {
    try {
      const value = this.backend.getItem(this.getKey(key));
      return value ? this.decryptValue(value) : null;
    } catch {
      return null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      const encryptedValue = this.encryptValue(value);
      this.backend.setItem(this.getKey(key), encryptedValue);
    } catch (error) {
      console.warn(`Failed to set item ${key}:`, error);
    }
  }

  getObject<T = any>(key: string): T | null {
    try {
      const value = this.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }

  setObject(key: string, value: any): void {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to set object ${key}:`, error);
    }
  }

  removeItem(key: string): void {
    try {
      this.backend.removeItem(this.getKey(key));
    } catch (error) {
      console.warn(`Failed to remove item ${key}:`, error);
    }
  }

  clear(): void {
    try {
      // Only clear items with our prefix
      if (this.backend instanceof MemoryStorage) {
        this.backend.clear();
      } else if (typeof window !== "undefined") {
        const storage = this.backend === window.localStorage ? localStorage : sessionStorage;
        const keys = Object.keys(storage).filter((key) => key.startsWith(this.prefix));
        keys.forEach((key) => storage.removeItem(key));
      }
    } catch (error) {
      console.warn("Failed to clear storage:", error);
    }
  }

  // Check if storage is available
  isAvailable(): boolean {
    try {
      const testKey = `${this.prefix}test`;
      this.backend.setItem(testKey, "test");
      const value = this.backend.getItem(testKey);
      this.backend.removeItem(testKey);
      return value === "test";
    } catch {
      return false;
    }
  }
}

// Export default instances
export const secureStorage = new SecureStorage({
  backend: "localStorage",
  encrypt: true,
});
export const sessionStorage = new SecureStorage({ backend: "sessionStorage" });
export const cookieStorage = new SecureStorage({
  backend: "cookies",
  encrypt: false,
});
export const memoryStorage = new SecureStorage({ backend: "memory" });
