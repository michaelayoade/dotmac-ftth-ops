/**
 * Permission Guard Components
 * Provides permission-based visibility and access control
 */

"use client";

import { createPermissionGuard } from "@dotmac/features/rbac";
import { useRBAC } from "@/contexts/RBACContext";
import { useRouter } from "next/navigation";

const guards = createPermissionGuard({ useRBAC, useRouter });

export const {
  PermissionGuard,
  RouteGuard,
  Can,
  Cannot,
  withPermission,
  usePermissionVisibility,
  PermissionButton,
  PermissionMenuItem,
} = guards;
