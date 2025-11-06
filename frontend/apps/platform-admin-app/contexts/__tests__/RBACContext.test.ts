import { permissionMatches, PermissionCategory, type Permission } from "../RBACContext";

const makePermission = (name: string, overrides: Partial<Permission> = {}): Permission => ({
  name,
  display_name: name,
  category: PermissionCategory.SYSTEM,
  is_system: false,
  ...overrides,
});

describe("permissionMatches", () => {
  it("returns true for exact permission matches", () => {
    expect(permissionMatches("billing.read", [makePermission("billing.read")], false)).toBe(true);
  });

  it("allows permissions covered by a matching wildcard", () => {
    expect(permissionMatches("billing.read", [makePermission("billing.*")], false)).toBe(true);
    expect(
      permissionMatches("billing.payments.execute", [makePermission("billing.*")], false),
    ).toBe(true);
  });

  it("does not allow permissions outside the wildcard prefix", () => {
    expect(permissionMatches("secrets.delete", [makePermission("billing.*")], false)).toBe(false);
  });

  it("grants access for global wildcard", () => {
    expect(permissionMatches("any.permission", [makePermission("*")], false)).toBe(true);
  });

  it("grants access when user is superuser regardless of effective permissions", () => {
    expect(permissionMatches("anything", [], true)).toBe(true);
    expect(permissionMatches("anything", [makePermission("billing.*")], true)).toBe(true);
  });
});
