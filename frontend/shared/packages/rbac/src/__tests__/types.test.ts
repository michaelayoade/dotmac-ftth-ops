/**
 * @fileoverview Type tests for RBAC package
 */

import type { Role, Permission, User } from "../index";

describe("RBAC Types", () => {
  describe("Role", () => {
    it("should accept valid role", () => {
      const role: Role = {
        id: "role-1",
        name: "admin",
        permissions: ["users:read", "users:write"],
      };

      expect(role.id).toBe("role-1");
      expect(role.name).toBe("admin");
      expect(role.permissions).toHaveLength(2);
    });

    it("should accept role with empty permissions", () => {
      const role: Role = {
        id: "role-2",
        name: "guest",
        permissions: [],
      };

      expect(role.permissions).toEqual([]);
    });

    it("should accept role with wildcard permissions", () => {
      const role: Role = {
        id: "role-3",
        name: "super-admin",
        permissions: ["*"],
      };

      expect(role.permissions).toContain("*");
    });

    it("should accept role with various permission formats", () => {
      const role: Role = {
        id: "role-4",
        name: "moderator",
        permissions: [
          "posts:read",
          "posts:create",
          "posts:update",
          "comments:moderate",
          "users:ban",
        ],
      };

      expect(role.permissions).toHaveLength(5);
    });
  });

  describe("Permission", () => {
    it("should accept valid permission", () => {
      const permission: Permission = {
        id: "perm-1",
        resource: "users",
        action: "read",
      };

      expect(permission.id).toBe("perm-1");
      expect(permission.resource).toBe("users");
      expect(permission.action).toBe("read");
    });

    it("should accept different resource types", () => {
      const permissions: Permission[] = [
        { id: "perm-1", resource: "users", action: "read" },
        { id: "perm-2", resource: "posts", action: "create" },
        { id: "perm-3", resource: "comments", action: "delete" },
        { id: "perm-4", resource: "settings", action: "update" },
      ];

      expect(permissions).toHaveLength(4);
    });

    it("should accept different action types", () => {
      const actions = ["read", "write", "create", "update", "delete", "admin"];

      actions.forEach((action, index) => {
        const permission: Permission = {
          id: `perm-${index}`,
          resource: "resource",
          action,
        };

        expect(permission.action).toBe(action);
      });
    });

    it("should accept wildcard resource or action", () => {
      const permissions: Permission[] = [
        { id: "perm-1", resource: "*", action: "read" },
        { id: "perm-2", resource: "users", action: "*" },
        { id: "perm-3", resource: "*", action: "*" },
      ];

      expect(permissions).toHaveLength(3);
    });
  });

  describe("User", () => {
    it("should accept user with roles only", () => {
      const user: User = {
        id: "user-1",
        roles: [{ id: "role-1", name: "admin", permissions: ["*"] }],
      };

      expect(user.id).toBe("user-1");
      expect(user.roles).toHaveLength(1);
      expect(user.permissions).toBeUndefined();
    });

    it("should accept user with roles and permissions", () => {
      const user: User = {
        id: "user-2",
        roles: [{ id: "role-1", name: "user", permissions: ["profile:read"] }],
        permissions: [{ id: "perm-1", resource: "settings", action: "update" }],
      };

      expect(user.roles).toHaveLength(1);
      expect(user.permissions).toHaveLength(1);
    });

    it("should accept user with multiple roles", () => {
      const user: User = {
        id: "user-3",
        roles: [
          { id: "role-1", name: "admin", permissions: ["admin:*"] },
          { id: "role-2", name: "moderator", permissions: ["posts:moderate"] },
          { id: "role-3", name: "user", permissions: ["profile:read"] },
        ],
      };

      expect(user.roles).toHaveLength(3);
    });

    it("should accept user with empty roles", () => {
      const user: User = {
        id: "user-4",
        roles: [],
      };

      expect(user.roles).toEqual([]);
    });

    it("should accept user with multiple permissions", () => {
      const user: User = {
        id: "user-5",
        roles: [],
        permissions: [
          { id: "perm-1", resource: "users", action: "read" },
          { id: "perm-2", resource: "posts", action: "read" },
          { id: "perm-3", resource: "settings", action: "update" },
        ],
      };

      expect(user.permissions).toHaveLength(3);
    });

    it("should accept user with undefined permissions", () => {
      const user: User = {
        id: "user-6",
        roles: [],
        permissions: undefined,
      };

      expect(user.permissions).toBeUndefined();
    });
  });

  describe("Type relationships", () => {
    it("should allow complex role-permission relationships", () => {
      const adminRole: Role = {
        id: "admin-role",
        name: "administrator",
        permissions: ["users:*", "posts:*", "settings:*", "analytics:read"],
      };

      const user: User = {
        id: "admin-user",
        roles: [adminRole],
        permissions: [{ id: "special-perm", resource: "billing", action: "admin" }],
      };

      expect(user.roles[0].permissions).toHaveLength(4);
      expect(user.permissions).toHaveLength(1);
    });

    it("should allow hierarchical permission structures", () => {
      const superAdminRole: Role = {
        id: "super-admin",
        name: "Super Administrator",
        permissions: ["*"],
      };

      const adminRole: Role = {
        id: "admin",
        name: "Administrator",
        permissions: ["users:*", "posts:*"],
      };

      const moderatorRole: Role = {
        id: "moderator",
        name: "Moderator",
        permissions: ["posts:read", "posts:update", "comments:moderate"],
      };

      const user: User = {
        id: "multi-role-user",
        roles: [superAdminRole, adminRole, moderatorRole],
      };

      expect(user.roles).toHaveLength(3);
    });
  });
});
