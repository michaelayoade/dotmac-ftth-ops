"use client";

import React from "react";
import type { PortalType } from "../UniversalProviders";

interface Props {
  children: React.ReactNode;
  variant?: "single" | "multi" | "isp";
  portal: PortalType;
}

export function TenantProvider({ children }: Props) {
  // Stub implementation - tenant context would be provided here
  return <>{children}</>;
}
