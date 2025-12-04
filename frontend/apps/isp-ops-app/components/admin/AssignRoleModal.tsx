/**
 * Assign Role Modal - ISP Ops App Wrapper
 *
 * Wrapper that connects the shared AssignRoleModal to app-specific dependencies.
 */

"use client";

import { AssignRoleModal, type Role } from "@dotmac/features/rbac";
import { toast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { useConfirmDialog } from "@dotmac/ui";

interface AssignRoleModalProps {
  role: Role;
  onClose: () => void;
  onAssign: () => void;
}

export default function AssignRoleModalWrapper(props: AssignRoleModalProps) {
  return (
    <AssignRoleModal
      {...props}
      apiClient={apiClient}
      toast={toast}
      logger={logger}
      useConfirmDialog={useConfirmDialog}
    />
  );
}
