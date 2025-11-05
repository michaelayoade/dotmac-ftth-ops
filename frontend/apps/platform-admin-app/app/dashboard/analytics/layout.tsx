"use client";

import { type ReactNode } from "react";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { PermissionCategory, PermissionAction } from "@/contexts/RBACContext";

interface AnalyticsLayoutProps {
  children: ReactNode;
}

export default function AnalyticsLayout({ children }: AnalyticsLayoutProps) {
  return (
    <RouteGuard category={PermissionCategory.ANALYTICS} action={PermissionAction.READ}>
      {children}
    </RouteGuard>
  );
}

