/**
 * @jest-environment jsdom
 */

import { TextEncoder, TextDecoder } from "util";
import { secureStorage } from "../secureStorage";

// Polyfill for Node.js
global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Mock crypto.subtle for testing
const mockCrypto = {
  getRandomValues: (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  },
  subtle: {
    generateKey: jest.fn().mockResolvedValue("mock-key"),
    importKey: jest.fn().mockResolvedValue("mock-imported-key"),
    exportKey: jest.fn().mockResolvedValue({ kty: "oct", k: "mock-key-data" }),
    encrypt: jest.fn().mockImplementation((algorithm, key, data) => {
      // Simple mock encryption - just reverse the bytes
      const encrypted = new Uint8Array(data).reverse();
      return Promise.resolve(encrypted.buffer);
    }),
    decrypt: jest.fn().mockImplementation((algorithm, key, data) => {
      // Simple mock decryption - reverse back
      const decrypted = new Uint8Array(data).reverse();
      return Promise.resolve(decrypted.buffer);
    }),
  },
};

describe("secureStorage", () => {
  beforeEach(() => {
    // Clear storage before each test
    sessionStorage.clear();
    localStorage.clear();
    jest.clearAllMocks();

    // Mock window.crypto
    Object.defineProperty(window, "crypto", {
      value: mockCrypto,
      writable: true,
    });
  });

  describe("Security Controls", () => {
    it("should block storage of tokens", async () => {
      await expect(secureStorage.setItem("auth_token", "secret-token-value")).rejects.toThrow(
        "Attempted to store sensitive data in insecure storage",
      );
    });

    it("should block storage of passwords", async () => {
      await expect(secureStorage.setItem("user_password", "super-secret")).rejects.toThrow(
        "Attempted to store sensitive data in insecure storage",
      );
    });

    it("should block storage of secrets", async () => {
      await expect(secureStorage.setItem("api_secret", "confidential")).rejects.toThrow(
        "Attempted to store sensitive data in insecure storage",
      );
    });

    it("should block storage with AUTH in key name", async () => {
      await expect(secureStorage.setItem("authentication_data", "some-data")).rejects.toThrow(
        "Attempted to store sensitive data in insecure storage",
      );
    });

    it("should allow storage of non-sensitive data", async () => {
      await expect(
        secureStorage.setItem("user_preferences", { theme: "dark" }),
      ).resolves.toBeUndefined();
    });
  });

  describe("Encryption", () => {
    it("should encrypt data when encrypt option is true", async () => {
      const testData = { message: "test data" };

      await secureStorage.setItem("encrypted_data", testData, {
        encrypt: true,
      });

      // Check that data is stored
      const stored = sessionStorage.getItem("__dotmac_encrypted_data");
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.encrypted).toBe(true);
      expect(parsed.value).not.toEqual(JSON.stringify(testData)); // Should be encrypted
    });

    it("should decrypt data correctly", async () => {
      const testData = { message: "test data", count: 42 };

      await secureStorage.setItem("encrypted_data", testData, {
        encrypt: true,
      });
      const retrieved = await secureStorage.getItem("encrypted_data");

      expect(retrieved).toEqual(testData);
    });

    it("should handle encryption failures gracefully", async () => {
      // Mock encryption failure
      mockCrypto.subtle.encrypt = jest.fn().mockRejectedValue(new Error("Encryption failed"));

      const testData = "test data";
      await secureStorage.setItem("data", testData, { encrypt: true });

      // Should fall back to unencrypted storage
      const stored = sessionStorage.getItem("__dotmac_data");
      const parsed = JSON.parse(stored!);
      expect(parsed.encrypted).toBe(true); // Marked as encrypted even though it failed
    });
  });

  describe("TTL (Time To Live)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should expire data after TTL", async () => {
      const testData = "temporary data";
      const ttl = 1000; // 1 second

      await secureStorage.setItem("temp_data", testData, { ttl });

      // Data should be available immediately
      let retrieved = await secureStorage.getItem("temp_data");
      expect(retrieved).toBe(testData);

      // Advance time past TTL
      jest.advanceTimersByTime(ttl + 100);

      // Data should be expired and removed
      retrieved = await secureStorage.getItem("temp_data");
      expect(retrieved).toBeNull();

      // Verify it was removed from storage
      const stored = sessionStorage.getItem("__dotmac_temp_data");
      expect(stored).toBeNull();
    });

    it("should not expire data without TTL", async () => {
      const testData = "permanent data";

      await secureStorage.setItem("perm_data", testData);

      // Advance time significantly
      jest.advanceTimersByTime(1000000);

      // Data should still be available
      const retrieved = await secureStorage.getItem("perm_data");
      expect(retrieved).toBe(testData);
    });
  });

  describe("Browser Compatibility", () => {
    it("should handle missing crypto.subtle gracefully", async () => {
      // Remove crypto.subtle
      Object.defineProperty(window, "crypto", {
        value: { ...mockCrypto, subtle: undefined },
        writable: true,
      });

      const testData = "test without crypto";

      // Should still work but use base64 fallback
      await secureStorage.setItem("fallback_data", testData, { encrypt: true });
      const retrieved = await secureStorage.getItem("fallback_data");

      expect(retrieved).toBe(testData);
    });

    it("should handle browsers without crypto API", async () => {
      // Remove entire crypto object
      Object.defineProperty(window, "crypto", {
        value: undefined,
        writable: true,
      });

      const testData = { message: "no crypto available" };

      // Should still work without encryption
      await secureStorage.setItem("no_crypto_data", testData);
      const retrieved = await secureStorage.getItem("no_crypto_data");

      expect(retrieved).toEqual(testData);
    });
  });

  describe("Storage Management", () => {
    it("should clear all prefixed items", async () => {
      // Add multiple items
      await secureStorage.setItem("item1", "value1");
      await secureStorage.setItem("item2", "value2");
      await secureStorage.setItem("item3", "value3");

      // Add non-prefixed item (should not be cleared)
      sessionStorage.setItem("other_item", "other_value");

      // Clear storage
      secureStorage.clear();

      // Check all prefixed items are removed
      expect(await secureStorage.getItem("item1")).toBeNull();
      expect(await secureStorage.getItem("item2")).toBeNull();
      expect(await secureStorage.getItem("item3")).toBeNull();

      // Non-prefixed item should remain
      expect(sessionStorage.getItem("other_item")).toBe("other_value");
    });

    it("should remove individual items", async () => {
      await secureStorage.setItem("item_to_remove", "value");
      await secureStorage.setItem("item_to_keep", "keep");

      secureStorage.removeItem("item_to_remove");

      expect(await secureStorage.getItem("item_to_remove")).toBeNull();
      expect(await secureStorage.getItem("item_to_keep")).toBe("keep");
    });

    it("should check storage availability", () => {
      expect(secureStorage.isStorageAvailable()).toBe(true);

      // Mock storage unavailable
      const originalSessionStorage = window.sessionStorage;
      Object.defineProperty(window, "sessionStorage", {
        get: () => {
          throw new Error("Storage not available");
        },
        configurable: true,
      });

      expect(secureStorage.isStorageAvailable()).toBe(false);

      // Restore
      Object.defineProperty(window, "sessionStorage", {
        value: originalSessionStorage,
        configurable: true,
      });
    });

    it("should provide storage info", async () => {
      await secureStorage.setItem("data1", "value1");
      await secureStorage.setItem("data2", "value2");

      const info = secureStorage.getStorageInfo();

      expect(info.keys).toContain("data1");
      expect(info.keys).toContain("data2");
      expect(info.used).toBeGreaterThan(0);
    });
  });

  describe("Data Types", () => {
    it("should handle objects", async () => {
      const obj = { name: "John", age: 30, nested: { key: "value" } };
      await secureStorage.setItem("object_data", obj);
      const retrieved = await secureStorage.getItem("object_data");
      expect(retrieved).toEqual(obj);
    });

    it("should handle arrays", async () => {
      const arr = [1, 2, 3, { key: "value" }, ["nested"]];
      await secureStorage.setItem("array_data", arr);
      const retrieved = await secureStorage.getItem("array_data");
      expect(retrieved).toEqual(arr);
    });

    it("should handle strings", async () => {
      const str = "Simple string value";
      await secureStorage.setItem("string_data", str);
      const retrieved = await secureStorage.getItem("string_data");
      expect(retrieved).toBe(str);
    });

    it("should handle numbers", async () => {
      const num = 42.5;
      await secureStorage.setItem("number_data", num);
      const retrieved = await secureStorage.getItem("number_data");
      expect(retrieved).toBe(num);
    });

    it("should handle booleans", async () => {
      await secureStorage.setItem("bool_true", true);
      await secureStorage.setItem("bool_false", false);

      expect(await secureStorage.getItem("bool_true")).toBe(true);
      expect(await secureStorage.getItem("bool_false")).toBe(false);
    });

    it("should handle null", async () => {
      await secureStorage.setItem("null_data", null);
      const retrieved = await secureStorage.getItem("null_data");
      expect(retrieved).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should handle storage quota exceeded", async () => {
      // Mock storage full
      const mockSetItem = jest.fn().mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      sessionStorage.setItem = mockSetItem;

      // Should not throw, just log error
      await expect(secureStorage.setItem("large_data", "x".repeat(10000))).resolves.toBeUndefined();
    });

    it("should handle corrupted stored data", async () => {
      // Manually store corrupted data
      sessionStorage.setItem("__dotmac_corrupted", "not-valid-json");

      const retrieved = await secureStorage.getItem("corrupted");
      expect(retrieved).toBeNull();
    });

    it("should handle missing data gracefully", async () => {
      const retrieved = await secureStorage.getItem("non_existent");
      expect(retrieved).toBeNull();
    });
  });

  describe("SSR Safety", () => {
    it("should handle server-side rendering", async () => {
      // Mock server environment
      const originalWindow = global.window;
      delete (global as any).window;

      // All operations should be no-ops
      await expect(secureStorage.setItem("ssr_data", "value")).resolves.toBeUndefined();

      const retrieved = await secureStorage.getItem("ssr_data");
      expect(retrieved).toBeNull();

      // Restore window
      global.window = originalWindow;
    });
  });
});
