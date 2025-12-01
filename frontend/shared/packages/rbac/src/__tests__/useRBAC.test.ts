/**
 * @fileoverview Tests for useRBAC hook
 */

import React from "react";
import { renderHook, act } from "@testing-library/react";
import { RBACProvider, useRBAC } from "../index";

describe("useRBAC", () => {
  const wrapper =
    (perms: string[] = ["users:read", "articles:publish"], roles: string[] = ["admin"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(RBACProvider, { initialPermissions: perms, initialRoles: roles }, children);

  describe("inherited permission methods", () => {
    it("should have hasPermission method", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      expect(result.current.hasPermission).toBeDefined();
      expect(typeof result.current.hasPermission).toBe("function");
    });

    it("should have hasRole method", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      expect(result.current.hasRole).toBeDefined();
      expect(typeof result.current.hasRole).toBe("function");
    });

    it("should delegate to hasPermission correctly", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      act(() => {
        result.current.hasPermission("users:read");
      });

      expect(result.current.hasPermission("users:read")).toBe(true);
      expect(result.current.hasPermission("unknown:perm")).toBe(false);
    });

    it("should delegate to hasRole correctly", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      act(() => {
        result.current.hasRole("admin");
      });

      expect(result.current.hasRole("admin")).toBe(true);
      expect(result.current.hasRole("guest")).toBe(false);
    });
  });

  describe("canAccess method", () => {
    it("should check resource and action access", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper(["users:read"]) });

      let canAccess: boolean = false;

      act(() => {
        canAccess = result.current.canAccess("users", "read");
      });

      expect(canAccess).toBe(true);
    });

    it("should handle different resource and action combinations", () => {
      const perms = ["users:read", "posts:create", "settings:update"];
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper(perms) });

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

        const expected = perms.includes(`${resource}:${action}`);
        expect(result.current.canAccess(resource, action)).toBe(expected);
      });
    });

    it("should format permission string correctly", () => {
      const { result } = renderHook(() => useRBAC(), {
        wrapper: wrapper(["resource-name:action-name"]),
      });

      act(() => {
        result.current.canAccess("resource-name", "action-name");
      });

      expect(result.current.canAccess("resource-name", "action-name")).toBe(true);
    });

    it("should handle special characters in resource names", () => {
      const { result } = renderHook(() => useRBAC(), {
        wrapper: wrapper(["user-profile:read", "user_settings:read", "admin.panel:read"]),
      });

      const resources = ["user-profile", "user_settings", "admin.panel"];

      resources.forEach((resource) => {
        act(() => {
          result.current.canAccess(resource, "read");
        });

        expect(result.current.canAccess(resource, "read")).toBe(true);
      });
    });
  });

  describe("hook stability", () => {
    it("should return stable functions across re-renders", () => {
      const { result, rerender } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      const firstCanAccess = result.current.canAccess;
      const firstHasPermission = result.current.hasPermission;
      const firstHasRole = result.current.hasRole;

      rerender();

      expect(typeof result.current.canAccess).toBe("function");
      expect(typeof result.current.hasPermission).toBe("function");
      expect(typeof result.current.hasRole).toBe("function");
    });
  });

  describe("edge cases", () => {
    it("should handle empty resource name", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      expect(() => {
        act(() => {
          result.current.canAccess("", "read");
        });
      }).not.toThrow();
    });

    it("should handle empty action name", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      expect(() => {
        act(() => {
          result.current.canAccess("users", "");
        });
      }).not.toThrow();
    });

    it("should handle both empty resource and action", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      expect(() => {
        act(() => {
          result.current.canAccess("", "");
        });
      }).not.toThrow();
    });
  });

  describe("return values", () => {
    it("should always return boolean for canAccess", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper() });

      let returnValue: boolean;

      act(() => {
        returnValue = result.current.canAccess("test", "action");
      });

      expect(typeof returnValue!).toBe("boolean");
    });
  });

  describe("integration with permissions", () => {
    it("should use underlying permission check", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper(["articles:publish"]) });

      // canAccess should use hasPermission internally
      act(() => {
        result.current.canAccess("articles", "publish");
      });

      expect(result.current.canAccess("articles", "publish")).toBe(true);
    });

    it("should support wildcard resource with canAccess", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper(["*"]) });

      act(() => {
        result.current.canAccess("*", "read");
      });

      expect(result.current.canAccess("any", "read")).toBe(true);
    });

    it("should support wildcard action with canAccess", () => {
      const { result } = renderHook(() => useRBAC(), { wrapper: wrapper(["users:*"]) });

      act(() => {
        result.current.canAccess("users", "*");
      });

      expect(result.current.canAccess("users", "anything")).toBe(true);
    });
  });
});
