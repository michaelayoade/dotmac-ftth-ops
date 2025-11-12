"use client";

import React from "react";
import type { PortalType } from "../UniversalProviders";

interface Props {
  children: React.ReactNode;
  portal: PortalType;
  // Optional theme name, currently unused but kept for API compatibility
  theme?: string;
}

export function ThemeProvider({ children, portal }: Props) {
  // Map portal to theme variant; keep minimal for now
  const variant =
    portal === "admin" || portal === "management"
      ? "management"
      : portal === "reseller"
        ? "reseller"
        : portal === "technician"
          ? "technician"
          : "customer";

  // Stub implementation - theme context would be provided here
  return <>{children}</>;
}
