/**
 * Create Role Modal Component
 *
 * Wrapper that connects the shared CreateRoleModal to app-specific dependencies.
 */

"use client";

import { CreateRoleModal as CreateRoleModalShared } from "@dotmac/features/rbac";
import type { CreateRoleModalProps as SharedCreateRoleModalProps } from "@dotmac/features/rbac";
import { toast } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

type CreateRoleModalProps = Omit<SharedCreateRoleModalProps, "apiClient" | "toast" | "logger">;

export default function CreateRoleModal(props: CreateRoleModalProps) {
  return <CreateRoleModalShared {...props} apiClient={apiClient} toast={toast} logger={logger} />;
}
