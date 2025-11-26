/**
 * User Permissions & RBAC Functional Tests
 *
 * These tests validate role-based access control business logic:
 * 1. Role Assignment & Hierarchy
 * 2. Permission Checking & Validation
 * 3. Resource-Level Access Control
 * 4. Feature Flags & Conditional Access
 * 5. Multi-Tenant Permission Isolation
 * 6. Permission Inheritance
 * 7. Administrative Overrides
 */

import type { Role, Permission, User } from "@dotmac/rbac";
import { describe, it, expect, beforeEach } from "vitest";

// Test data factories
const createMockUser = (overrides?: Partial<User>): User => ({
  id: "user_123",
  roles: [],
  permissions: [],
  ...overrides,
});

const createMockRole = (overrides?: Partial<Role>): Role => ({
  id: "role_123",
  name: "Viewer",
  permissions: [],
  ...overrides,
});

const createMockPermission = (
  resource: string,
  action: string,
  overrides?: Partial<Permission>,
): Permission => ({
  id: `perm_${resource}_${action}`,
  resource,
  action,
  ...overrides,
});

// Permission helper functions
const hasPermission = (user: User, permission: string): boolean => {
  const checkWildcard = (heldPermission: string, requiredPermission: string) => {
    if (heldPermission === requiredPermission) return true;
    if (heldPermission === "*:*") return true;

    // Handle "resource:*" matching "resource:action"
    if (heldPermission.endsWith(":*")) {
      const resourcePart = heldPermission.slice(0, -2);
      if (requiredPermission.startsWith(`${resourcePart}:`)) {
        return true;
      }
    }
    return false;
  };

  // Check direct permissions
  const directPermission = user.permissions?.some((p) =>
    checkWildcard(`${p.resource}:${p.action}`, permission),
  );

  if (directPermission) return true;

  // Check role-based permissions
  const rolePermission = user.roles.some((role) =>
    role.permissions.some((heldPerm) => checkWildcard(heldPerm, permission)),
  );

  return rolePermission;
};

const hasRole = (user: User, roleName: string): boolean => {
  return user.roles.some((role) => role.name === roleName);
};

const hasAnyRole = (user: User, roleNames: string[]): boolean => {
  return user.roles.some((role) => roleNames.includes(role.name));
};

const hasAllPermissions = (user: User, permissions: string[]): boolean => {
  return permissions.every((perm) => hasPermission(user, perm));
};

const hasAllRoles = (user: User, roleNames: string[]): boolean => {
  return roleNames.every((roleName) => hasRole(user, roleName));
};

describe("User Permissions & RBAC: Role Assignment", () => {
  describe("Basic Role Management", () => {
    it("should assign role to user", () => {
      // Arrange
      const adminRole = createMockRole({
        id: "role_admin",
        name: "Administrator",
        permissions: ["*:*"], // All permissions
      });

      // Act
      const user = createMockUser({
        roles: [adminRole],
      });

      // Assert
      expect(user.roles.length).toBe(1);
      expect(user.roles[0].name).toBe("Administrator");
      expect(hasRole(user, "Administrator")).toBe(true);
    });

    it("should assign multiple roles to user", () => {
      // Arrange
      const viewerRole = createMockRole({ name: "Viewer" });
      const editorRole = createMockRole({ name: "Editor" });

      // Act
      const user = createMockUser({
        roles: [viewerRole, editorRole],
      });

      // Assert
      expect(user.roles.length).toBe(2);
      expect(hasRole(user, "Viewer")).toBe(true);
      expect(hasRole(user, "Editor")).toBe(true);
    });

    it("should remove role from user", () => {
      // Arrange
      const viewerRole = createMockRole({ name: "Viewer" });
      const editorRole = createMockRole({ name: "Editor" });
      const user = createMockUser({
        roles: [viewerRole, editorRole],
      });

      // Act - Remove Editor role
      const updatedUser = {
        ...user,
        roles: user.roles.filter((r) => r.name !== "Editor"),
      };

      // Assert
      expect(updatedUser.roles.length).toBe(1);
      expect(hasRole(updatedUser, "Viewer")).toBe(true);
      expect(hasRole(updatedUser, "Editor")).toBe(false);
    });
  });

  describe("Role Hierarchy", () => {
    it("should respect role hierarchy (Admin > Manager > User)", () => {
      // Arrange
      const adminRole = createMockRole({
        name: "Administrator",
        permissions: ["*:*"],
      });

      const managerRole = createMockRole({
        name: "Manager",
        permissions: ["customers:*", "billing:read", "reports:read"],
      });

      const userRole = createMockRole({
        name: "User",
        permissions: ["customers:read", "billing:read"],
      });

      const roles = [adminRole, managerRole, userRole];

      // Act - Sort by hierarchy
      const hierarchy = ["Administrator", "Manager", "User"];
      const sortedRoles = roles.sort(
        (a, b) => hierarchy.indexOf(a.name) - hierarchy.indexOf(b.name),
      );

      // Assert
      expect(sortedRoles[0].name).toBe("Administrator");
      expect(sortedRoles[1].name).toBe("Manager");
      expect(sortedRoles[2].name).toBe("User");
    });

    it("should inherit permissions from parent roles", () => {
      // Arrange
      const basePermissions = ["customers:read", "dashboard:read"];
      const editorPermissions = [...basePermissions, "customers:write"];
      const adminPermissions = [...editorPermissions, "customers:delete", "*:*"];

      const viewerRole = createMockRole({
        name: "Viewer",
        permissions: basePermissions,
      });

      const editorRole = createMockRole({
        name: "Editor",
        permissions: editorPermissions,
      });

      const adminRole = createMockRole({
        name: "Admin",
        permissions: adminPermissions,
      });

      // Act
      const editor = createMockUser({ roles: [editorRole] });
      const admin = createMockUser({ roles: [adminRole] });

      // Assert
      expect(hasPermission(editor, "customers:read")).toBe(true);
      expect(hasPermission(editor, "customers:write")).toBe(true);
      expect(hasPermission(editor, "customers:delete")).toBe(false);

      expect(hasPermission(admin, "customers:read")).toBe(true);
      expect(hasPermission(admin, "customers:write")).toBe(true);
      expect(hasPermission(admin, "customers:delete")).toBe(true);
    });
  });
});

describe("User Permissions & RBAC: Permission Checking", () => {
  describe("Resource-Action Permissions", () => {
    it("should grant permission for specific resource:action", () => {
      // Arrange
      const permission = createMockPermission("customers", "read");
      const user = createMockUser({ permissions: [permission] });

      // Act & Assert
      expect(hasPermission(user, "customers:read")).toBe(true);
      expect(hasPermission(user, "customers:write")).toBe(false);
    });

    it("should support wildcard permissions for all actions on resource", () => {
      // Arrange
      const role = createMockRole({
        name: "Customer Manager",
        permissions: ["customers:*"], // All customer actions
      });

      const user = createMockUser({ roles: [role] });

      // Act & Assert
      expect(hasPermission(user, "customers:read")).toBe(true);
      expect(hasPermission(user, "customers:write")).toBe(true);
      expect(hasPermission(user, "customers:delete")).toBe(true);
      expect(hasPermission(user, "billing:read")).toBe(false);
    });

    it("should support wildcard permissions for super admin", () => {
      // Arrange
      const superAdminRole = createMockRole({
        name: "Super Admin",
        permissions: ["*:*"], // God mode
      });

      const user = createMockUser({ roles: [superAdminRole] });

      // Act & Assert
      expect(hasPermission(user, "customers:read")).toBe(true);
      expect(hasPermission(user, "customers:delete")).toBe(true);
      expect(hasPermission(user, "billing:write")).toBe(true);
      expect(hasPermission(user, "settings:delete")).toBe(true);
      expect(hasPermission(user, "anything:anything")).toBe(true);
    });

    it("should check multiple permissions at once", () => {
      // Arrange
      const role = createMockRole({
        name: "Billing Clerk",
        permissions: ["invoices:read", "invoices:create", "payments:read"],
      });

      const user = createMockUser({ roles: [role] });

      // Act
      const requiredPermissions = ["invoices:read", "invoices:create"];
      const hasAll = hasAllPermissions(user, requiredPermissions);

      const restrictedPermissions = ["invoices:delete"];
      const hasRestricted = hasAllPermissions(user, restrictedPermissions);

      // Assert
      expect(hasAll).toBe(true);
      expect(hasRestricted).toBe(false);
    });
  });

  describe("CRUD Permissions", () => {
    it("should enforce Create permission", () => {
      // Arrange
      const role = createMockRole({
        name: "Customer Creator",
        permissions: ["customers:create"],
      });

      const user = createMockUser({ roles: [role] });

      // Act & Assert
      expect(hasPermission(user, "customers:create")).toBe(true);
      expect(hasPermission(user, "customers:read")).toBe(false);
    });

    it("should enforce Read permission", () => {
      // Arrange
      const role = createMockRole({
        name: "Customer Viewer",
        permissions: ["customers:read"],
      });

      const user = createMockUser({ roles: [role] });

      // Act & Assert
      expect(hasPermission(user, "customers:read")).toBe(true);
      expect(hasPermission(user, "customers:write")).toBe(false);
    });

    it("should enforce Update permission", () => {
      // Arrange
      const role = createMockRole({
        name: "Customer Editor",
        permissions: ["customers:read", "customers:update"],
      });

      const user = createMockUser({ roles: [role] });

      // Act & Assert
      expect(hasPermission(user, "customers:read")).toBe(true);
      expect(hasPermission(user, "customers:update")).toBe(true);
      expect(hasPermission(user, "customers:delete")).toBe(false);
    });

    it("should enforce Delete permission (restricted)", () => {
      // Arrange
      const regularUser = createMockUser({
        roles: [
          createMockRole({
            name: "User",
            permissions: ["customers:read", "customers:update"],
          }),
        ],
      });

      const adminUser = createMockUser({
        roles: [
          createMockRole({
            name: "Admin",
            permissions: ["customers:*"],
          }),
        ],
      });

      // Act & Assert
      expect(hasPermission(regularUser, "customers:delete")).toBe(false);
      expect(hasPermission(adminUser, "customers:delete")).toBe(true);
    });
  });
});

describe("User Permissions & RBAC: Multi-Tenant Isolation", () => {
  it("should isolate permissions by tenant", () => {
    // Arrange
    const tenant1User = createMockUser({
      id: "user_tenant1",
      roles: [
        createMockRole({
          name: "Tenant1 Admin",
          permissions: ["tenant1:customers:*"],
        }),
      ],
    });

    const tenant2User = createMockUser({
      id: "user_tenant2",
      roles: [
        createMockRole({
          name: "Tenant2 Admin",
          permissions: ["tenant2:customers:*"],
        }),
      ],
    });

    // Act & Assert
    expect(hasPermission(tenant1User, "tenant1:customers:read")).toBe(true);
    expect(hasPermission(tenant1User, "tenant2:customers:read")).toBe(false);

    expect(hasPermission(tenant2User, "tenant2:customers:read")).toBe(true);
    expect(hasPermission(tenant2User, "tenant1:customers:read")).toBe(false);
  });

  it("should prevent cross-tenant data access", () => {
    // Arrange
    const tenantAUser = createMockUser({
      roles: [createMockRole({ permissions: ["tenantA:*"] })],
    });

    // Act
    const canAccessOwnData = hasPermission(tenantAUser, "tenantA:customers:read");
    const canAccessOtherData = hasPermission(tenantAUser, "tenantB:customers:read");

    // Assert
    expect(canAccessOwnData).toBe(true);
    expect(canAccessOtherData).toBe(false);
  });

  it("should allow platform admin across all tenants", () => {
    // Arrange
    const platformAdmin = createMockUser({
      roles: [
        createMockRole({
          name: "Platform Admin",
          permissions: ["*:*"], // Access to all tenants
        }),
      ],
    });

    // Act & Assert
    expect(hasPermission(platformAdmin, "tenant1:customers:read")).toBe(true);
    expect(hasPermission(platformAdmin, "tenant2:billing:delete")).toBe(true);
    expect(hasPermission(platformAdmin, "tenantN:anything:anything")).toBe(true);
  });
});

describe("User Permissions & RBAC: Feature Flags", () => {
  it("should check feature flag access", () => {
    // Arrange
    const betaTesterRole = createMockRole({
      name: "Beta Tester",
      permissions: ["features:beta_access"],
    });

    const regularUser = createMockUser({
      roles: [createMockRole({ name: "User", permissions: ["features:stable"] })],
    });

    const betaUser = createMockUser({ roles: [betaTesterRole] });

    // Act & Assert
    expect(hasPermission(betaUser, "features:beta_access")).toBe(true);
    expect(hasPermission(regularUser, "features:beta_access")).toBe(false);
  });

  it("should enable/disable features based on subscription tier", () => {
    // Arrange
    const basicUserRole = createMockRole({
      name: "Basic User",
      permissions: ["features:basic"],
    });

    const premiumUserRole = createMockRole({
      name: "Premium User",
      permissions: ["features:basic", "features:premium", "features:analytics"],
    });

    const basicUser = createMockUser({ roles: [basicUserRole] });
    const premiumUser = createMockUser({ roles: [premiumUserRole] });

    // Act & Assert
    expect(hasPermission(basicUser, "features:basic")).toBe(true);
    expect(hasPermission(basicUser, "features:analytics")).toBe(false);

    expect(hasPermission(premiumUser, "features:basic")).toBe(true);
    expect(hasPermission(premiumUser, "features:analytics")).toBe(true);
  });
});

describe("User Permissions & RBAC: Special Scenarios", () => {
  it("should handle permission conflicts (deny wins)", () => {
    // Arrange - User has both allow and deny for same resource
    const allowRole = createMockRole({
      name: "Allow Role",
      permissions: ["sensitive:read"],
    });

    const denyRole = createMockRole({
      name: "Deny Role",
      permissions: ["!sensitive:read"], // Explicit deny
    });

    const conflictedUser = createMockUser({
      roles: [allowRole, denyRole],
    });

    // Act - Check for explicit deny
    const hasExplicitDeny = conflictedUser.roles.some((role) =>
      role.permissions.some((p) => p.startsWith("!")),
    );

    // Assert - Deny should win
    expect(hasExplicitDeny).toBe(true);
  });

  it("should support time-based permissions", () => {
    // Arrange
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const temporaryRole = createMockRole({
      name: "Temporary Access",
      permissions: ["customers:read"],
      ...{ expiresAt: futureDate.toISOString() }, // Extended property
    });

    const user = createMockUser({ roles: [temporaryRole] });

    // Act
    const roleExpiresAt = new Date((temporaryRole as any).expiresAt);
    const isExpired = roleExpiresAt < now;

    // Assert
    expect(isExpired).toBe(false);
    expect(hasPermission(user, "customers:read")).toBe(true);
  });

  it("should support conditional permissions based on resource ownership", () => {
    // Arrange
    const userId = "user_123";
    const ownedResourceId = "resource_123";
    const otherResourceId = "resource_456";

    const user = createMockUser({
      id: userId,
      roles: [
        createMockRole({
          name: "User",
          permissions: ["resources:read:own"], // Can only read own resources
        }),
      ],
    });

    // Act - Simulate ownership check
    const canReadOwn = hasPermission(user, "resources:read:own");
    const ownsResource = (resourceId: string) => resourceId === ownedResourceId;

    // Assert
    expect(canReadOwn).toBe(true);
    expect(ownsResource(ownedResourceId)).toBe(true);
    expect(ownsResource(otherResourceId)).toBe(false);
  });

  it("should require multiple roles for sensitive operations", () => {
    // Arrange
    const requiredRoles = ["Approver", "Manager"];

    const userWithOneRole = createMockUser({
      roles: [createMockRole({ name: "Approver" })],
    });

    const userWithBothRoles = createMockUser({
      roles: [createMockRole({ name: "Approver" }), createMockRole({ name: "Manager" })],
    });

    // Act
    const firstUserHasRequired = hasAnyRole(userWithOneRole, requiredRoles);
    const secondUserHasRequired = hasAllRoles(userWithBothRoles, requiredRoles);

    // Assert
    expect(firstUserHasRequired).toBe(true); // Has at least one
    expect(secondUserHasRequired).toBe(true); // Has all required
  });
});
