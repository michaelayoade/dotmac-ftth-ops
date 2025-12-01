/**
 * @fileoverview Tests for usePermissions hook
 */

import React from "react";
import { renderHook, act } from "@testing-library/react";
import { RBACProvider, usePermissions } from "../index";

describe("usePermissions", () => {
  const wrapper =
    (initialPermissions: string[] = ["users:read", "admin.*"], roles: string[] = ["admin"]) =>
    ({ children }: { children: React.ReactNode }) =>
      React.createElement(
        RBACProvider,
        { initialPermissions, initialRoles: roles },
        children,
      );

  describe("hasPermission", () => {
    it("should check permission and return true", () => {
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper() });

      let hasPermission: boolean = false;

      act(() => {
        hasPermission = result.current.hasPermission("users:read");
      });

      expect(hasPermission).toBe(true);
    });

    it("should handle different permission formats", () => {
      const perms = ["users:read", "users:write", "users:delete", "posts:create", "posts:update"];
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper(perms) });

      perms.forEach((permission) => {
        act(() => {
          result.current.hasPermission(permission);
        });

        expect(result.current.hasPermission(permission)).toBe(true);
      });
    });

    it("should handle wildcard permissions", () => {
      const { result } = renderHook(() => usePermissions(), {
        wrapper: wrapper(["*", "users.*", "*.read"]),
      });

      act(() => {
        result.current.hasPermission("*");
        result.current.hasPermission("users:*");
        result.current.hasPermission("*:read");
      });

      expect(result.current.hasPermission("anything")).toBe(true);
      expect(result.current.hasPermission("users:delete")).toBe(true);
      expect(result.current.hasPermission("orders:read")).toBe(true);
    });

    it("should return false for missing permission", () => {
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper(["users:read"]) });
      expect(result.current.hasPermission("billing:write")).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("should check role and return true", () => {
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper() });

      let hasRole: boolean = false;

      act(() => {
        hasRole = result.current.hasRole("admin");
      });

      expect(hasRole).toBe(true);
    });

    it("should handle different role names", () => {
      const roles = ["admin", "user", "moderator", "guest", "super-admin"];
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper(["*"], roles) });

      roles.forEach((role) => expect(result.current.hasRole(role)).toBe(true));
    });

    it("should handle case-sensitive roles", () => {
      const { result } = renderHook(() => usePermissions(), {
        wrapper: wrapper(["*"], ["Admin", "ADMIN", "admin"]),
      });

      expect(result.current.hasRole("Admin")).toBe(true);
      expect(result.current.hasRole("ADMIN")).toBe(true);
      expect(result.current.hasRole("admin")).toBe(true);
    });

    it("should return false for missing role", () => {
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper(["*"], ["user"]) });
      expect(result.current.hasRole("admin")).toBe(false);
    });
  });

  describe("hook stability", () => {
    it("should return stable functions across re-renders", () => {
      const { result, rerender } = renderHook(() => usePermissions(), { wrapper: wrapper() });

      const firstHasPermission = result.current.hasPermission;
      const firstHasRole = result.current.hasRole;

      rerender();

      expect(result.current.hasPermission).toBe(firstHasPermission);
      expect(result.current.hasRole).toBe(firstHasRole);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string permission", () => {
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper() });

      expect(() => {
        act(() => {
          result.current.hasPermission("");
        });
      }).not.toThrow();
    });

    it("should handle empty string role", () => {
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper() });

      expect(() => {
        act(() => {
          result.current.hasRole("");
        });
      }).not.toThrow();
    });

    it("should handle special characters in permissions", () => {
      const { result } = renderHook(() => usePermissions(), {
        wrapper: wrapper(["resource-name:action", "resource_name:action", "resource.name:action"]),
      });

      const permissions = [
        "resource-name:action",
        "resource_name:action",
        "resource.name:action",
        "namespace/resource:action",
      ];

      permissions.forEach((permission) => {
        expect(() => {
          act(() => {
            result.current.hasPermission(permission);
          });
        }).not.toThrow();
      });
    });
  });

  describe("return values", () => {
    it("should always return boolean for hasPermission", () => {
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper() });

      let returnValue: boolean;

      act(() => {
        returnValue = result.current.hasPermission("test:permission");
      });

      expect(typeof returnValue!).toBe("boolean");
    });

    it("should always return boolean for hasRole", () => {
      const { result } = renderHook(() => usePermissions(), { wrapper: wrapper() });

      let returnValue: boolean;

      act(() => {
        returnValue = result.current.hasRole("test-role");
      });

      expect(typeof returnValue!).toBe("boolean");
    });
  });
});
