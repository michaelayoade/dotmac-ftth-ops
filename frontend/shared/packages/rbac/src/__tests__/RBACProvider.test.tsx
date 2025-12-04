/**
 * @fileoverview Tests for RBACProvider component
 * Tests API integration, state management, and provider functionality
 */

import React from "react";
import { renderHook, waitFor, act } from "@testing-library/react";
import { RBACProvider, usePermissions, useRBAC } from "../index";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("RBACProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe("initialization", () => {
    it("uses initial permissions when provided (no fetch)", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider
          initialPermissions={["users:read", "users:write"]}
          initialRoles={["admin"]}
        >
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Should not be loading when initial permissions provided
      expect(result.current.loading).toBe(false);
      expect(result.current.permissions).toEqual(["users:read", "users:write"]);
      expect(result.current.roles).toEqual(["admin"]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("fetches permissions from endpoint when no initial permissions", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          effective_permissions: ["users:read", "users:write"],
          roles: [{ name: "admin" }, { name: "viewer" }],
          is_superuser: false,
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      // Initially loading
      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissions).toEqual(["users:read", "users:write"]);
      expect(result.current.roles).toEqual(["admin", "viewer"]);
      expect(mockFetch).toHaveBeenCalledWith("/api/test/permissions", { credentials: "include" });
    });

    it("handles permissions key in response (legacy format)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          permissions: ["legacy:read"],
          roles: [],
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissions).toEqual(["legacy:read"]);
    });

    it("handles string roles in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          permissions: ["read:all"],
          roles: ["admin", "operator"],
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.roles).toEqual(["admin", "operator"]);
    });

    it("sets superuser flag correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          permissions: [],
          roles: [],
          is_superuser: true,
        }),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isSuperuser).toBe(true);
    });

    it("accepts initial superuser flag", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider
          initialPermissions={[]}
          isSuperuser={true}
        >
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.isSuperuser).toBe(true);
      // Superuser should have all permissions
      expect(result.current.hasPermission("any:permission")).toBe(true);
    });
  });

  describe("error handling", () => {
    it("sets error on fetch failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("RBAC fetch failed: 403");
      expect(result.current.permissions).toEqual([]);
    });

    it("sets error on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Network error");
    });

    it("handles missing data gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissions).toEqual([]);
      expect(result.current.roles).toEqual([]);
      expect(result.current.isSuperuser).toBe(false);
    });
  });

  describe("refresh functionality", () => {
    it("can refresh permissions", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            permissions: ["initial:read"],
            roles: [],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            permissions: ["initial:read", "new:write"],
            roles: ["new-role"],
          }),
        });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.permissions).toEqual(["initial:read"]);

      // Trigger refresh
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.permissions).toEqual(["initial:read", "new:write"]);
      });

      expect(result.current.roles).toEqual(["new-role"]);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("clears error on successful refresh", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            permissions: ["recovered:read"],
            roles: [],
          }),
        });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider endpoint="/api/test/permissions">
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      await waitFor(() => {
        expect(result.current.error).toBe("RBAC fetch failed: 500");
      });

      // Trigger refresh
      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.permissions).toEqual(["recovered:read"]);
    });
  });

  describe("context error", () => {
    it("throws when usePermissions is used outside provider", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => usePermissions());
      }).toThrow("useRBAC must be used within an RBACProvider");

      consoleSpy.mockRestore();
    });

    it("throws when useRBAC is used outside provider", () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      expect(() => {
        renderHook(() => useRBAC());
      }).toThrow("useRBAC must be used within an RBACProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("useRBAC integration", () => {
    it("provides canAccess method that checks resource:action permissions", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider
          initialPermissions={["users:read", "users:write", "posts:read"]}
        >
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => useRBAC(), { wrapper });

      expect(result.current.canAccess("users", "read")).toBe(true);
      expect(result.current.canAccess("users", "write")).toBe(true);
      expect(result.current.canAccess("users", "delete")).toBe(false);
      expect(result.current.canAccess("posts", "read")).toBe(true);
      expect(result.current.canAccess("posts", "write")).toBe(false);
    });

    it("canAccess returns true for superuser", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider
          initialPermissions={[]}
          isSuperuser={true}
        >
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => useRBAC(), { wrapper });

      expect(result.current.canAccess("any", "permission")).toBe(true);
      expect(result.current.canAccess("nonexistent", "resource")).toBe(true);
    });
  });

  describe("permission checking with wildcards", () => {
    it("supports global wildcard *", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider initialPermissions={["*"]}>
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasPermission("any:permission")).toBe(true);
      expect(result.current.hasPermission("anything")).toBe(true);
    });

    it("supports resource wildcard (resource:*)", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider initialPermissions={["users:*"]}>
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasPermission("users:read")).toBe(true);
      expect(result.current.hasPermission("users:write")).toBe(true);
      expect(result.current.hasPermission("users:delete")).toBe(true);
      expect(result.current.hasPermission("posts:read")).toBe(false);
    });

    it("supports dot notation wildcard (resource.*)", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider initialPermissions={["users.*"]}>
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasPermission("users.read")).toBe(true);
      expect(result.current.hasPermission("users.write")).toBe(true);
      expect(result.current.hasPermission("posts.read")).toBe(false);
    });

    it("supports *:* global wildcard", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider initialPermissions={["*:*"]}>
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasPermission("any:permission")).toBe(true);
    });
  });

  describe("hasAnyPermission and hasAllPermissions", () => {
    it("hasAnyPermission returns true if any permission matches", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider initialPermissions={["users:read"]}>
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasAnyPermission(["users:read", "users:write"])).toBe(true);
      expect(result.current.hasAnyPermission(["posts:read", "posts:write"])).toBe(false);
    });

    it("hasAllPermissions returns true only if all permissions match", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider initialPermissions={["users:read", "users:write"]}>
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasAllPermissions(["users:read", "users:write"])).toBe(true);
      expect(result.current.hasAllPermissions(["users:read", "users:delete"])).toBe(false);
    });
  });

  describe("hasRole", () => {
    it("checks if user has specific role", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider
          initialPermissions={[]}
          initialRoles={["admin", "viewer"]}
        >
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasRole("admin")).toBe(true);
      expect(result.current.hasRole("viewer")).toBe(true);
      expect(result.current.hasRole("editor")).toBe(false);
    });

    it("superuser has all roles", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider
          initialPermissions={[]}
          initialRoles={[]}
          isSuperuser={true}
        >
          {children}
        </RBACProvider>
      );

      const { result } = renderHook(() => usePermissions(), { wrapper });

      expect(result.current.hasRole("any-role")).toBe(true);
    });
  });

  describe("hook stability", () => {
    it("returns stable function references", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider initialPermissions={["users:read"]}>
          {children}
        </RBACProvider>
      );

      const { result, rerender } = renderHook(() => usePermissions(), { wrapper });

      const firstHasPermission = result.current.hasPermission;
      const firstHasAnyPermission = result.current.hasAnyPermission;
      const firstHasAllPermissions = result.current.hasAllPermissions;
      const firstHasRole = result.current.hasRole;
      const firstRefresh = result.current.refresh;

      rerender();

      expect(result.current.hasPermission).toBe(firstHasPermission);
      expect(result.current.hasAnyPermission).toBe(firstHasAnyPermission);
      expect(result.current.hasAllPermissions).toBe(firstHasAllPermissions);
      expect(result.current.hasRole).toBe(firstHasRole);
      expect(result.current.refresh).toBe(firstRefresh);
    });

    it("useRBAC returns stable canAccess function", async () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <RBACProvider initialPermissions={["users:read"]}>
          {children}
        </RBACProvider>
      );

      const { result, rerender } = renderHook(() => useRBAC(), { wrapper });

      const firstCanAccess = result.current.canAccess;

      rerender();

      expect(result.current.canAccess).toBe(firstCanAccess);
    });
  });
});
