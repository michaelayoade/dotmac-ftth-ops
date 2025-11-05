"use client";

import { type ReactNode } from "react";
import { RouteGuard } from "@/components/auth/PermissionGuard";

interface BillingRevenueLayoutProps {
  children: ReactNode;
}

export default function BillingRevenueLayout({ children }: BillingRevenueLayoutProps) {
  return <RouteGuard permission="billing.read">{children}</RouteGuard>;
}

