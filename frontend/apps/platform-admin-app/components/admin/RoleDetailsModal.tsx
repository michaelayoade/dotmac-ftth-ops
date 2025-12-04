/**
 * Role Details Modal Component
 *
 * Wrapper that connects the shared RoleDetailsModal to app-specific dependencies.
 */

"use client";

import { RoleDetailsModal as RoleDetailsModalShared } from "@dotmac/features/rbac";
import type { RoleDetailsModalProps as SharedRoleDetailsModalProps } from "@dotmac/features/rbac";
import type { Role as AppRole, Permission as AppPermission } from "@/contexts/RBACContext";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { mapPermissionsToShared, mapRoleToShared } from "./rbacMapping";

interface RoleDetailsModalProps {
  role: AppRole;
  permissions: AppPermission[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function RoleDetailsModal(props: RoleDetailsModalProps) {
  const { toast } = useToast();
  const { role, permissions, ...rest } = props;

  const sharedRole = mapRoleToShared(role) as SharedRoleDetailsModalProps["role"];
  const sharedPermissions = mapPermissionsToShared(
    permissions,
  ) as SharedRoleDetailsModalProps["permissions"];

  const toastAdapter = {
    success: (message: string) => toast({ title: "Success", description: message }),
    error: (message: string) =>
      toast({ title: "Error", description: message, variant: "destructive" }),
  };

  const sharedProps: SharedRoleDetailsModalProps = {
    ...rest,
    role: sharedRole,
    permissions: sharedPermissions,
    apiClient,
    toast: toastAdapter,
  };

  return <RoleDetailsModalShared {...sharedProps} />;
}
