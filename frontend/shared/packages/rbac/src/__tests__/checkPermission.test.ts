/**
 * @fileoverview Tests for checkPermission utility
 */

import { checkPermission, type User } from "../index";

describe("checkPermission", () => {
  describe("basic functionality", () => {
    it("should return true when user has permission", () => {
      const user: User = {
        id: "user-123",
        roles: [],
        permissions: ["users:read"],
      };

      expect(checkPermission(user, "users:read")).toBe(true);
    });

    it("should return false when user lacks permission", () => {
      const user: User = { id: "user-123", roles: [], permissions: ["posts:create"] };
      expect(checkPermission(user, "users:read")).toBe(false);
    });
  });

  describe("wildcards", () => {
    it("should allow global wildcard", () => {
      const user: User = { id: "user-123", roles: [], permissions: ["*"] };
      expect(checkPermission(user, "any:permission")).toBe(true);
    });

    it("should allow namespace wildcard", () => {
      const user: User = { id: "user-123", roles: [], permissions: ["users:*"] };
      expect(checkPermission(user, "users:delete")).toBe(true);
      expect(checkPermission(user, "billing:read")).toBe(false);
    });
  });

  describe("formats and edge cases", () => {
    it("should handle permissions with special characters", () => {
      const user: User = {
        id: "user-123",
        roles: [],
        permissions: [
          "resource-name:action",
          "resource_name:action",
          "resource.name:action",
          "namespace/resource:action",
        ],
      };

      user.permissions.forEach((perm) => expect(checkPermission(user, perm)).toBe(true));
    });

    it("should handle empty permission string", () => {
      const user: User = { id: "user-123", roles: [], permissions: [""] };
      expect(checkPermission(user, "")).toBe(true);
    });

    it("should handle user with undefined permissions", () => {
      const user: User = { id: "user-123", roles: [], permissions: undefined };
      expect(checkPermission(user, "users:read")).toBe(false);
    });
  });

  describe("return type", () => {
    it("should always return boolean", () => {
      const user: User = { id: "user-123", roles: [], permissions: ["*"] };
      expect(typeof checkPermission(user, "users:read")).toBe("boolean");
    });
  });
});
