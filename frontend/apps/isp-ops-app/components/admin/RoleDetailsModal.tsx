/**
 * Role Details Modal Component
 *
 * Wrapper that connects the shared RoleDetailsModal to app-specific dependencies.
 */

"use client";

import { RoleDetailsModal as RoleDetailsModalShared } from "@dotmac/features/rbac";
import type {
  Role as SharedRole,
  Permission as SharedPermission,
  RoleDetailsModalProps as SharedRoleDetailsModalProps,
} from "@dotmac/features/rbac";
import { apiClient } from "@/lib/api/client";
import { toast } from "@dotmac/ui";

type RoleDetailsModalProps = Omit<SharedRoleDetailsModalProps, "apiClient" | "toast">;

export default function RoleDetailsModal(props: RoleDetailsModalProps) {
  return <RoleDetailsModalShared {...props} apiClient={apiClient} toast={toast} />;
}

// Re-export types for convenience
export type { SharedRole as Role, SharedPermission as Permission };
