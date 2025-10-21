/**
 * @fileoverview Tests for usePermissions hook
 */

import { renderHook, act } from "@testing-library/react";
import { usePermissions } from "../index";

describe("usePermissions", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("hasPermission", () => {
    it("should check permission and return true", () => {
      const { result } = renderHook(() => usePermissions());

      let hasPermission: boolean = false;

      act(() => {
        hasPermission = result.current.hasPermission("users:read");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "users:read");
      expect(hasPermission).toBe(true);
    });

    it("should handle different permission formats", () => {
      const { result } = renderHook(() => usePermissions());

      const permissions = [
        "users:read",
        "users:write",
        "users:delete",
        "posts:create",
        "posts:update",
        "admin:*",
      ];

      permissions.forEach((permission) => {
        act(() => {
          result.current.hasPermission(permission);
        });

        expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", permission);
      });
    });

    it("should handle wildcard permissions", () => {
      const { result } = renderHook(() => usePermissions());

      act(() => {
        result.current.hasPermission("*");
        result.current.hasPermission("users:*");
        result.current.hasPermission("*:read");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "*");
      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "users:*");
      expect(consoleLogSpy).toHaveBeenCalledWith("Checking permission:", "*:read");
    });
  });

  describe("hasRole", () => {
    it("should check role and return true", () => {
      const { result } = renderHook(() => usePermissions());

      let hasRole: boolean = false;

      act(() => {
        hasRole = result.current.hasRole("admin");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking role:", "admin");
      expect(hasRole).toBe(true);
    });

    it("should handle different role names", () => {
      const { result } = renderHook(() => usePermissions());

      const roles = ["admin", "user", "moderator", "guest", "super-admin"];

      roles.forEach((role) => {
        act(() => {
          result.current.hasRole(role);
        });

        expect(consoleLogSpy).toHaveBeenCalledWith("Checking role:", role);
      });
    });

    it("should handle case-sensitive roles", () => {
      const { result } = renderHook(() => usePermissions());

      act(() => {
        result.current.hasRole("Admin");
        result.current.hasRole("ADMIN");
        result.current.hasRole("admin");
      });

      expect(consoleLogSpy).toHaveBeenCalledWith("Checking role:", "Admin");
      expect(consoleLogSpy).toHaveBeenCalledWith("Checking role:", "ADMIN");
      expect(consoleLogSpy).toHaveBeenCalledWith("Checking role:", "admin");
    });
  });

  describe("hook stability", () => {
    it("should return stable functions across re-renders", () => {
      const { result, rerender } = renderHook(() => usePermissions());

      const firstHasPermission = result.current.hasPermission;
      const firstHasRole = result.current.hasRole;

      rerender();

      expect(result.current.hasPermission).toBe(firstHasPermission);
      expect(result.current.hasRole).toBe(firstHasRole);
    });
  });

  describe("edge cases", () => {
    it("should handle empty string permission", () => {
      const { result } = renderHook(() => usePermissions());

      expect(() => {
        act(() => {
          result.current.hasPermission("");
        });
      }).not.toThrow();
    });

    it("should handle empty string role", () => {
      const { result } = renderHook(() => usePermissions());

      expect(() => {
        act(() => {
          result.current.hasRole("");
        });
      }).not.toThrow();
    });

    it("should handle special characters in permissions", () => {
      const { result } = renderHook(() => usePermissions());

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
      const { result } = renderHook(() => usePermissions());

      let returnValue: boolean;

      act(() => {
        returnValue = result.current.hasPermission("test:permission");
      });

      expect(typeof returnValue!).toBe("boolean");
    });

    it("should always return boolean for hasRole", () => {
      const { result } = renderHook(() => usePermissions());

      let returnValue: boolean;

      act(() => {
        returnValue = result.current.hasRole("test-role");
      });

      expect(typeof returnValue!).toBe("boolean");
    });
  });
});
