/**
 * Assign Role Modal - Platform Admin App Wrapper
 *
 * Wrapper that connects the shared AssignRoleModal to app-specific dependencies.
 */

"use client";

import { AssignRoleModal } from "@dotmac/features/rbac";
import type { Role as AppRole } from "@/contexts/RBACContext";
import { toast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { useConfirmDialog } from "@dotmac/ui";
import { mapRoleToShared } from "./rbacMapping";

interface AssignRoleModalProps {
  role: AppRole;
  onClose: () => void;
  onAssign: () => void;
}

export default function AssignRoleModalWrapper({ role, ...rest }: AssignRoleModalProps) {
  const sharedRole = mapRoleToShared(role);
  return (
    <AssignRoleModal
      {...rest}
      role={sharedRole}
      apiClient={apiClient}
      toast={toast}
      logger={logger}
      useConfirmDialog={useConfirmDialog}
    />
  );
}
