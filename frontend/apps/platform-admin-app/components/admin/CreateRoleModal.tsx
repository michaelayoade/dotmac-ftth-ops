/**
 * Create Role Modal Component
 *
 * Wrapper that connects the shared CreateRoleModal to app-specific dependencies.
 */

"use client";

import { CreateRoleModal as CreateRoleModalShared } from "@dotmac/features/rbac";
import type {
  CreateRoleModalProps as SharedCreateRoleModalProps,
  Permission as SharedPermission,
  Role as SharedRole,
} from "@dotmac/features/rbac";
import type { Permission as AppPermission, Role as AppRole } from "@/contexts/RBACContext";
import { toast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

interface CreateRoleModalProps {
  permissions: AppPermission[];
  roles: AppRole[];
  onClose: () => void;
  onCreate: () => void;
}

export default function CreateRoleModal(props: CreateRoleModalProps) {
  const sharedPermissions: SharedPermission[] = props.permissions.map((permission) => ({
    id: permission.name,
    name: permission.name,
    display_name: permission.display_name,
    description: permission.description ?? "",
    category: permission.category,
  }));

  const sharedRoles: SharedRole[] = props.roles.map((role) => ({
    id: role.name,
    name: role.name,
    display_name: role.display_name,
    description: role.description ?? "",
    priority: (role as Partial<SharedRole>).priority ?? 0,
    is_system: role.is_system,
  }));

  const toastAdapter = {
    error: (message: string) => toast.error(message),
    success: (message: string) => toast.success(message),
  };

  const sharedProps: SharedCreateRoleModalProps = {
    permissions: sharedPermissions,
    roles: sharedRoles,
    onClose: props.onClose,
    onCreate: props.onCreate,
    apiClient,
    toast: toastAdapter,
    logger,
  };

  return <CreateRoleModalShared {...sharedProps} />;
}
