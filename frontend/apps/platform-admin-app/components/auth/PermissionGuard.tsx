/**
 * Permission Guard Components
 * Provides permission-based visibility and access control
 */

"use client";

import {
  createPermissionGuard,
  type PermissionCategory,
  type PermissionAction,
} from "@dotmac/features/rbac";
import {
  useRBAC,
  type PermissionCategory as AppPermissionCategory,
  type PermissionAction as AppPermissionAction,
} from "@/contexts/RBACContext";
import { useRouter } from "next/navigation";

const guards = createPermissionGuard({
  useRBAC: () => {
    const context = useRBAC();
    return {
      ...context,
      canAccess: (category?: PermissionCategory, action?: PermissionAction) => {
        if (!category) {
          return true;
        }
        return context.canAccess(
          category as AppPermissionCategory,
          action as AppPermissionAction | undefined,
        );
      },
    };
  },
  useRouter,
});

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
