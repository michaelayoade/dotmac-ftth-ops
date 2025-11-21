"use client";

import type { ReactNode } from "react";

import { RuntimeConfigProvider } from "@shared/runtime/RuntimeConfigContext";

import { applyPlatformRuntimeConfig } from "@/lib/config";

type RuntimeConfigBoundaryProps = {
  children: ReactNode;
};

export function RuntimeConfigBoundary({ children }: RuntimeConfigBoundaryProps) {
  return (
    <RuntimeConfigProvider onConfig={applyPlatformRuntimeConfig}>
      {children}
    </RuntimeConfigProvider>
  );
}
