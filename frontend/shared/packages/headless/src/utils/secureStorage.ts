/**
 * Secure storage utilities for handling sensitive data
 *
 * SECURITY NOTES:
 * - Auth tokens should ONLY be stored in httpOnly cookies set by the server
 * - This utility is for non-sensitive client data only
 * - Never store tokens, passwords, or sensitive data in localStorage/sessionStorage
 */

import * as crypto from "crypto";

export interface SecureStorageOptions {
  encrypt?: boolean;
  ttl?: number; // Time to live in milliseconds
}

interface StoredItem {
  value: string;
  timestamp: number;
  encrypted: boolean;
  expires?: number;
}

class SecureStorage {
  private readonly prefix = "__dotmac_";
  private readonly ENCRYPTION_KEY = "__dotmac_encryption_key__";
  private encryptionKey: CryptoKey | null = null;

  constructor() {
    // Initialize encryption key if in browser with crypto support
    if (typeof window !== "undefined" && this.isCryptoSupported()) {
      this.initializeEncryption();
    }
  }

  /**
   * Check if browser supports SubtleCrypto for AES-GCM
   * Safari < 13 and some older browsers lack support
   */
  private isCryptoSupported(): boolean {
    try {
      return !!(
        window.crypto &&
        window.crypto.subtle &&
        typeof window.crypto.subtle.generateKey === "function" &&
        typeof window.crypto.subtle.encrypt === "function" &&
        typeof window.crypto.subtle.decrypt === "function"
      );
    } catch {
      return false;
    }
  }

  /**
   * Initialize encryption key for the session
   */
  private async initializeEncryption(): Promise<void> {
    if (typeof window === "undefined" || !window.crypto?.subtle) {
      return;
    }

    try {
      // Generate or retrieve session encryption key
      const existingKey = sessionStorage.getItem(this.ENCRYPTION_KEY);

      if (existingKey) {
        const keyData = JSON.parse(existingKey);
        this.encryptionKey = await window.crypto.subtle.importKey(
          "jwk",
          keyData,
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );
      } else {
        // Generate new key for this session
        this.encryptionKey = await window.crypto.subtle.generateKey(
          { name: "AES-GCM", length: 256 },
          true,
          ["encrypt", "decrypt"],
        );

        const exportedKey = await window.crypto.subtle.exportKey("jwk", this.encryptionKey);
        sessionStorage.setItem(this.ENCRYPTION_KEY, JSON.stringify(exportedKey));
      }
    } catch (error) {
      console.warn("Encryption initialization failed:", error);
      this.encryptionKey = null;
    }
  }

  /**
   * Encrypt a value using AES-GCM
   * Falls back to base64 encoding if crypto not supported
   */
  private async encrypt(value: string): Promise<string> {
    if (!this.encryptionKey || typeof window === "undefined" || !this.isCryptoSupported()) {
      // Fallback to base64 for older browsers (not secure, but better than plaintext)
      if (typeof window !== "undefined") {
        console.warn("Crypto API not supported, falling back to base64 encoding");
        return btoa(value);
      }
      return value;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(value);

      // Generate random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Encrypt
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        this.encryptionKey,
        data,
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.warn("Encryption failed:", error);
      return value;
    }
  }

  /**
   * Decrypt a value using AES-GCM
   * Handles base64 fallback for older browsers
   */
  private async decrypt(encryptedValue: string): Promise<string> {
    if (!this.encryptionKey || typeof window === "undefined" || !this.isCryptoSupported()) {
      // Try base64 decode for fallback
      if (typeof window !== "undefined") {
        try {
          return atob(encryptedValue);
        } catch {
          return encryptedValue;
        }
      }
      return encryptedValue;
    }

    try {
      // Convert from base64
      const combined = Uint8Array.from(atob(encryptedValue), (c) => c.charCodeAt(0));

      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      // Decrypt
      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        this.encryptionKey,
        encrypted,
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.warn("Decryption failed:", error);
      return encryptedValue;
    }
  }

  /**
   * Set data in storage (NEVER use for auth tokens!)
   */
  async setItem(key: string, value: any, options: SecureStorageOptions = {}): Promise<void> {
    // Security check: prevent storing sensitive data
    if (
      key.toLowerCase().includes("token") ||
      key.toLowerCase().includes("password") ||
      key.toLowerCase().includes("secret") ||
      key.toLowerCase().includes("auth")
    ) {
      console.error(
        "Security Error: Sensitive data should not be stored in client storage. Use server-side httpOnly cookies.",
      );
      throw new Error("Attempted to store sensitive data in insecure storage");
    }

    if (typeof window === "undefined") {
      return;
    }

    const { encrypt = false, ttl } = options;
    const fullKey = this.prefix + key;

    // Serialize value
    const serialized = JSON.stringify(value);

    // Optionally encrypt
    const finalValue = encrypt ? await this.encrypt(serialized) : serialized;

    // Create storage item
    const item: StoredItem = {
      value: finalValue,
      timestamp: Date.now(),
      encrypted: encrypt,
    };
    if (ttl) {
      (item as any).expires = Date.now() + ttl;
    }

    // Store in sessionStorage (more secure than localStorage)
    try {
      sessionStorage.setItem(fullKey, JSON.stringify(item));
    } catch (error) {
      console.error("Storage error:", error);
      // Do not fall back to localStorage for security
    }
  }

  /**
   * Get data from storage
   */
  async getItem<T = any>(key: string): Promise<T | null> {
    if (typeof window === "undefined") {
      return null;
    }

    const fullKey = this.prefix + key;

    try {
      const stored = sessionStorage.getItem(fullKey);
      if (!stored) return null;

      const item: StoredItem = JSON.parse(stored);

      // Check expiration
      if (item.expires && Date.now() > item.expires) {
        this.removeItem(key);
        return null;
      }

      // Decrypt if needed
      const value = item.encrypted ? await this.decrypt(item.value) : item.value;

      // Parse and return
      return JSON.parse(value);
    } catch (error) {
      console.error("Storage retrieval error:", error);
      return null;
    }
  }

  /**
   * Remove data from storage
   */
  removeItem(key: string): void {
    if (typeof window === "undefined") {
      return;
    }

    const fullKey = this.prefix + key;

    try {
      sessionStorage.removeItem(fullKey);
    } catch (error) {
      console.error("Storage removal error:", error);
    }
  }

  /**
   * Clear all storage data with our prefix
   */
  clear(): void {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(this.prefix));
      keys.forEach((key) => sessionStorage.removeItem(key));
    } catch (error) {
      console.error("Storage clear error:", error);
    }
  }

  /**
   * Check if storage is available
   */
  isStorageAvailable(): boolean {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      const test = "__storage_test__";
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get storage usage info
   */
  getStorageInfo(): { used: number; keys: string[] } {
    if (typeof window === "undefined") {
      return { used: 0, keys: [] };
    }

    try {
      const keys = Object.keys(sessionStorage).filter((k) => k.startsWith(this.prefix));
      const used = keys.reduce((total, key) => {
        const value = sessionStorage.getItem(key) || "";
        return total + value.length + key.length;
      }, 0);

      return { used, keys: keys.map((k) => k.replace(this.prefix, "")) };
    } catch {
      return { used: 0, keys: [] };
    }
  }
}

// Export singleton instance
export const secureStorage = new SecureStorage();

/**
 * WARNING: Auth tokens should be handled server-side only!
 * This storage utility is for non-sensitive client data.
 *
 * For authentication:
 * - Use server-set httpOnly cookies
 * - Never store tokens in localStorage/sessionStorage
 * - Use the server actions for auth operations
 */
