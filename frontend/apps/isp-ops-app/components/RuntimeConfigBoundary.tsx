"use client";

import { useEffect, type ReactNode } from "react";

import {
  RuntimeConfigProvider,
  useRuntimeConfigState,
} from "@shared/runtime/RuntimeConfigContext";

import { applyPlatformRuntimeConfig } from "@/lib/config";

type RuntimeConfigBoundaryProps = {
  children: ReactNode;
};

export function RuntimeConfigBoundary({ children }: RuntimeConfigBoundaryProps) {
  return (
    <RuntimeConfigProvider>
      <RuntimeConfigApplier>{children}</RuntimeConfigApplier>
    </RuntimeConfigProvider>
  );
}

function RuntimeConfigApplier({ children }: { children: ReactNode }) {
  const { runtimeConfig } = useRuntimeConfigState();

  useEffect(() => {
    if (runtimeConfig) {
      applyPlatformRuntimeConfig(runtimeConfig);
    }
  }, [runtimeConfig]);

  return <>{children}</>;
}
