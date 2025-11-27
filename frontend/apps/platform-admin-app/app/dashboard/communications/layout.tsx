"use client";

import { type ReactNode } from "react";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { PermissionCategory, PermissionAction } from "@/contexts/RBACContext";

interface CommunicationsLayoutProps {
  children: ReactNode;
}

export default function CommunicationsLayout({ children }: CommunicationsLayoutProps) {
  return (
    <RouteGuard category={PermissionCategory.COMMUNICATIONS} action={PermissionAction.READ}>
      {children}
    </RouteGuard>
  );
}
