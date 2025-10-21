"use client";

import React from "react";
import type { PortalType } from "@dotmac/auth";

interface Props {
  children: React.ReactNode;
  variant?: "single" | "multi" | "isp";
  portal: PortalType;
}

export function TenantProvider({ children }: Props) {
  // Stub implementation - tenant context would be provided here
  return <>{children}</>;
}
