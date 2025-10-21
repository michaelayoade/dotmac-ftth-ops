/**
 * @fileoverview Tests for useRBAC hook
 */

import { renderHook, act } from "@testing-library/react";
import { useRBAC } from "../index";

describe("useRBAC", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("inherited permission methods", () => {
    it("should have hasPermission method", () => {
      const { result } = renderHook(() => useRBAC());

      expect(result.current.hasPermission).toBeDefined();
      expect(typeof result.current.hasPermission).toBe("function");
    });

    it("should have hasRole method", () => {
      const { result } = renderHook(() => useRBAC());

      expect(result.current.hasRole).toBeDefined();
      expect(typeof result.current.hasRole).toBe("function");
    });

    it("should delegate to hasPermission correctly", () => {
      const { result } = renderHook(() => useRBAC());

      act(() => {
        result.current.hasPermission("users:read");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "users:read");
    });

    it("should delegate to hasRole correctly", () => {
      const { result } = renderHook(() => useRBAC());

      act(() => {
        result.current.hasRole("admin");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking role:", "admin");
    });
  });

  describe("canAccess method", () => {
    it("should check resource and action access", () => {
      const { result } = renderHook(() => useRBAC());

      let canAccess: boolean = false;

      act(() => {
        canAccess = result.current.canAccess("users", "read");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "users:read");
      expect(canAccess).toBe(true);
    });

    it("should handle different resource and action combinations", () => {
      const { result } = renderHook(() => useRBAC());

      const testCases = [
        { resource: "users", action: "read" },
        { resource: "users", action: "write" },
        { resource: "posts", action: "create" },
        { resource: "posts", action: "delete" },
        { resource: "settings", action: "update" },
      ];

      testCases.forEach(({ resource, action }) => {
        act(() => {
          result.current.canAccess(resource, action);
        });

        expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", `${resource}:${action}`);
      });
    });

    it("should format permission string correctly", () => {
      const { result } = renderHook(() => useRBAC());

      act(() => {
        result.current.canAccess("resource-name", "action-name");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Checking permission:",
        "resource-name:action-name",
      );
    });

    it("should handle special characters in resource names", () => {
      const { result } = renderHook(() => useRBAC());

      const resources = ["user-profile", "user_settings", "admin.panel"];

      resources.forEach((resource) => {
        act(() => {
          result.current.canAccess(resource, "read");
        });

        expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", `${resource}:read`);
      });
    });
  });

  describe("hook stability", () => {
    it("should return stable functions across re-renders", () => {
      const { result, rerender } = renderHook(() => useRBAC());

      const firstCanAccess = result.current.canAccess;
      const firstHasPermission = result.current.hasPermission;
      const firstHasRole = result.current.hasRole;

      rerender();

      expect(result.current.canAccess).toBe(firstCanAccess);
      expect(result.current.hasPermission).toBe(firstHasPermission);
      expect(result.current.hasRole).toBe(firstHasRole);
    });
  });

  describe("edge cases", () => {
    it("should handle empty resource name", () => {
      const { result } = renderHook(() => useRBAC());

      expect(() => {
        act(() => {
          result.current.canAccess("", "read");
        });
      }).not.toThrow();
    });

    it("should handle empty action name", () => {
      const { result } = renderHook(() => useRBAC());

      expect(() => {
        act(() => {
          result.current.canAccess("users", "");
        });
      }).not.toThrow();
    });

    it("should handle both empty resource and action", () => {
      const { result } = renderHook(() => useRBAC());

      expect(() => {
        act(() => {
          result.current.canAccess("", "");
        });
      }).not.toThrow();
    });
  });

  describe("return values", () => {
    it("should always return boolean for canAccess", () => {
      const { result } = renderHook(() => useRBAC());

      let returnValue: boolean;

      act(() => {
        returnValue = result.current.canAccess("test", "action");
      });

      expect(typeof returnValue!).toBe("boolean");
    });
  });

  describe("integration with permissions", () => {
    it("should use underlying permission check", () => {
      const { result } = renderHook(() => useRBAC());

      // canAccess should use hasPermission internally
      act(() => {
        result.current.canAccess("articles", "publish");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "articles:publish");
    });

    it("should support wildcard resource with canAccess", () => {
      const { result } = renderHook(() => useRBAC());

      act(() => {
        result.current.canAccess("*", "read");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "*:read");
    });

    it("should support wildcard action with canAccess", () => {
      const { result } = renderHook(() => useRBAC());

      act(() => {
        result.current.canAccess("users", "*");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "users:*");
    });
  });
});
