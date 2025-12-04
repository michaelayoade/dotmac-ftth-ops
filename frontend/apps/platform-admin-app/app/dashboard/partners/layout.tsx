"use client";

import { type ReactNode } from "react";
import { RouteGuard } from "@/components/auth/PermissionGuard";

interface PartnersLayoutProps {
  children: ReactNode;
}

export default function PartnersLayout({ children }: PartnersLayoutProps) {
  return (
    <RouteGuard permission={["partners.read", "platform:partners:read"]}>{children}</RouteGuard>
  );
}
