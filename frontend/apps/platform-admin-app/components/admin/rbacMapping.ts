import type { Role as AppRole, Permission as AppPermission } from "@/contexts/RBACContext";

interface SharedPermission {
  id: string;
  name: string;
  display_name: string;
  description: string;
  category: string;
}

interface SharedRole {
  id: string;
  name: string;
  display_name: string;
  description: string;
  priority: number;
  is_active: boolean;
  is_system: boolean;
  is_default: boolean;
  permissions: SharedPermission[];
  user_count?: number;
  parent_id?: string;
}

const DEFAULT_PRIORITY = 0;

const mapPermissionToShared = (permission: AppPermission): SharedPermission => ({
  id: permission.name,
  name: permission.name,
  display_name: permission.display_name,
  description: permission.description ?? "",
  category: permission.category,
});

export const mapPermissionsToShared = (permissions: AppPermission[]): SharedPermission[] =>
  permissions.map(mapPermissionToShared);

export const mapRoleToShared = (role: AppRole): SharedRole => {
  const parentId = role.parent_role ?? (role as Partial<{ parent_id: string }>).parent_id;
  const userCount = (role as Partial<{ user_count: number }>).user_count;
  const priority = (role as Partial<{ priority: number }>).priority ?? DEFAULT_PRIORITY;
  const isDefault = (role as Partial<{ is_default: boolean }>).is_default ?? false;

  return {
    id: role.name,
    name: role.name,
    display_name: role.display_name,
    description: role.description ?? "",
    priority,
    is_active: role.is_active,
    is_system: role.is_system,
    is_default: isDefault,
    permissions: role.permissions.map(mapPermissionToShared),
    ...(userCount !== undefined ? { user_count: userCount } : {}),
    ...(parentId ? { parent_id: parentId } : {}),
  };
};
