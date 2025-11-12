/**
 * RBAC Components
 */

export { default as CreateRoleModal } from "./CreateRoleModal";
export type { Permission, Role, CreateRoleModalProps } from "./CreateRoleModal";

export { default as RoleDetailsModal } from "./RoleDetailsModal";
export type { RoleDetailsModalProps } from "./RoleDetailsModal";

export { default as AssignRoleModal } from "./AssignRoleModal";
export type { AssignRoleModalProps, User, UserRoleAssignment } from "./AssignRoleModal";

export {
  createPermissionGuard,
  type PermissionCategory,
  type PermissionAction,
  type RBACContext,
  type PermissionGuardDependencies,
} from "./PermissionGuard";
