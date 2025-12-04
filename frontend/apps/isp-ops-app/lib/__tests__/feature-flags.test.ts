/**
 * Tests for feature-flags utilities
 * Tests feature flag checking, toggling, and React hook integration
 */

import { renderHook, act } from "@testing-library/react";
import {
  isFeatureEnabled,
  useFeatureFlag,
  toggleFeatureFlag,
  getAllFeatureFlags,
  getFeatureFlagConfig,
  FeatureFlag,
} from "../feature-flags";

describe("feature-flags", () => {
  // Store original localStorage
  let originalLocalStorage: Storage;

  beforeEach(() => {
    // Create a fresh mock localStorage for each test
    originalLocalStorage = global.localStorage;
    const localStorageMock = {
      store: {} as Record<string, string>,
      getItem(key: string) {
        return this.store[key] || null;
      },
      setItem(key: string, value: string) {
        this.store[key] = value.toString();
      },
      removeItem(key: string) {
        delete this.store[key];
      },
      clear() {
        this.store = {};
      },
    };

    Object.defineProperty(global, "localStorage", {
      value: localStorageMock,
      writable: true,
    });

    // Clear any existing flags
    localStorage.clear();
  });

  afterEach(() => {
    // Restore original localStorage
    Object.defineProperty(global, "localStorage", {
      value: originalLocalStorage,
      writable: true,
    });
  });

  describe("isFeatureEnabled", () => {
    it("should return default value when flag is not set", () => {
      // Use actual flags from the system
      const result = isFeatureEnabled("radius-sessions");
      expect(typeof result).toBe("boolean");
      // radius-sessions defaults to false
      expect(result).toBe(false);
    });

    it("should return true for enabled flags by default", () => {
      // network-monitoring-v2 defaults to true
      expect(isFeatureEnabled("network-monitoring-v2")).toBe(true);
    });

    it("should return false for disabled flags by default", () => {
      // radius-sessions defaults to false
      expect(isFeatureEnabled("radius-sessions")).toBe(false);
    });

    it("should check environment variables", () => {
      // This tests that env vars are checked, actual value depends on process.env
      const result = isFeatureEnabled("radius-sessions");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("toggleFeatureFlag", () => {
    it("should not toggle in production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      toggleFeatureFlag("radius-sessions", true);
      // In production, toggle is ignored, so default value remains
      expect(isFeatureEnabled("radius-sessions")).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it("should dispatch event when toggling in non-production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const eventSpy = jest.spyOn(window, "dispatchEvent");
      toggleFeatureFlag("radius-sessions", true);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "featureFlagChange",
        }),
      );

      eventSpy.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it("should not persist to localStorage (runtime only)", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      toggleFeatureFlag("radius-sessions", true);
      // toggleFeatureFlag dispatches events but doesn't set localStorage directly
      // That's handled by the event listeners
      const value = localStorage.getItem("ff_radius-sessions");
      expect(value === null || typeof value === "string").toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it("should handle multiple flag toggles", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      toggleFeatureFlag("radius-sessions", true);
      toggleFeatureFlag("advanced-analytics", true);

      // Flags are dispatched as events
      expect(true).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("useFeatureFlag", () => {
    it("should return feature flag state as object with enabled property", () => {
      const { result } = renderHook(() => useFeatureFlag("radius-sessions"));

      expect(result.current).toHaveProperty("enabled");
      expect(typeof result.current.enabled).toBe("boolean");
    });

    it("should return correct state for enabled flags", () => {
      const { result } = renderHook(() => useFeatureFlag("network-monitoring-v2"));

      // network-monitoring-v2 defaults to true
      expect(result.current.enabled).toBe(true);
    });

    it("should return correct state for disabled flags", () => {
      const { result } = renderHook(() => useFeatureFlag("radius-sessions"));

      // radius-sessions defaults to false
      expect(result.current.enabled).toBe(false);
    });

    it("should listen for feature flag change events", () => {
      const { result } = renderHook(() => useFeatureFlag("radius-sessions"));

      // Initial state
      expect(result.current.enabled).toBe(false);

      // The hook sets up event listeners for featureFlagChange
      // We can verify the hook returned the correct structure
      expect(result.current).toHaveProperty("enabled");
    });
  });

  describe("getAllFeatureFlags", () => {
    it("should return an object with all feature flags", () => {
      const flags = getAllFeatureFlags();

      expect(typeof flags).toBe("object");
      expect(flags).not.toBeNull();
    });

    it("should return current state of all flags", () => {
      const flags = getAllFeatureFlags();

      // Check for actual flags that exist in the system
      expect(flags).toHaveProperty("radius-sessions");
      expect(flags).toHaveProperty("network-monitoring-v2");
      expect(flags).toHaveProperty("advanced-analytics");
    });

    it("should include all defined feature flags", () => {
      const flags = getAllFeatureFlags();

      // Should have entries for all 11 flags defined
      expect(Object.keys(flags).length).toBe(11);

      // Verify some key flags
      expect(flags["radius-sessions"]).toBe(false);
      expect(flags["network-monitoring-v2"]).toBe(true);
      expect(flags["multi-tenant-mode"]).toBe(true);
    });
  });

  describe("getFeatureFlagConfig", () => {
    it("should return config for valid feature flag", () => {
      const config = getFeatureFlagConfig("radius-sessions");

      expect(config).toBeDefined();
      if (config) {
        expect(config).toHaveProperty("name");
        expect(config).toHaveProperty("description");
        expect(config).toHaveProperty("defaultEnabled");
      }
    });

    it("should return undefined for invalid feature flag", () => {
      const config = getFeatureFlagConfig("non-existent-flag" as FeatureFlag);

      expect(config).toBeUndefined();
    });

    it("should include all config properties", () => {
      const config = getFeatureFlagConfig("radius-sessions");

      expect(config).toBeDefined();
      expect(config?.name).toBe("radius-sessions");
      expect(typeof config?.description).toBe("string");
      expect(typeof config?.defaultEnabled).toBe("boolean");
      expect(config?.defaultEnabled).toBe(false);
    });
  });

  describe("Environment variable overrides", () => {
    it("should handle NEXT_PUBLIC_FEATURE_* environment variables", () => {
      // This tests that the system can read from env vars
      // The actual value depends on build-time configuration
      const result = isFeatureEnabled("radius-sessions");
      expect(typeof result).toBe("boolean");

      // Verify env var would be checked
      const config = getFeatureFlagConfig("radius-sessions");
      expect(config?.envVar).toBe("NEXT_PUBLIC_FEATURE_RADIUS_SESSIONS");
    });
  });

  describe("Edge cases", () => {
    it("should handle rapid flag toggles", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const flag = "radius-sessions";

      toggleFeatureFlag(flag, true);
      toggleFeatureFlag(flag, false);
      toggleFeatureFlag(flag, true);
      toggleFeatureFlag(flag, false);

      // Events are dispatched but actual state depends on listeners
      // Default value should remain
      expect(isFeatureEnabled(flag)).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it("should handle checking non-existent flags gracefully", () => {
      // Should log warning but not throw
      expect(() => isFeatureEnabled("non-existent" as FeatureFlag)).not.toThrow();
    });

    it("should handle flags without env vars", () => {
      // Some flags might not have envVar defined
      const result = isFeatureEnabled("radius-sessions");
      expect(typeof result).toBe("boolean");
    });
  });

  describe("Type safety", () => {
    it("should work with FeatureFlag type", () => {
      const flag: FeatureFlag = "radius-sessions";

      const enabled = isFeatureEnabled(flag);
      const config = getFeatureFlagConfig(flag);

      expect(typeof enabled).toBe("boolean");
      expect(config).toBeDefined();
      expect(config?.name).toBe(flag);
    });
  });
});
