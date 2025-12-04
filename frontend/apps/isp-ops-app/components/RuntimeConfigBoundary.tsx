"use client";

import { useEffect, type ReactNode, useMemo } from "react";

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
  const { runtimeConfig, error, loading, refresh } = useRuntimeConfigState();

  useEffect(() => {
    if (runtimeConfig) {
      applyPlatformRuntimeConfig(runtimeConfig);
    }
  }, [runtimeConfig]);

  const showFallback = useMemo(() => {
    return Boolean(error && !loading && !runtimeConfig);
  }, [error, loading, runtimeConfig]);

  return (
    <>
      {children}
      {showFallback ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/80 backdrop-blur-sm px-6">
          <div className="w-full max-w-md rounded-lg border border-border bg-card shadow-xl p-6 space-y-3">
            <div className="text-lg font-semibold text-foreground">Unable to load configuration</div>
            <p className="text-sm text-muted-foreground">
              We could not fetch the runtime settings required for this app. Please try again. If the
              issue persists, check connectivity to the platform API.
            </p>
            {typeof error === "string" ? (
              <pre className="text-xs text-muted-foreground bg-muted/60 rounded-md p-3 overflow-auto">
                {error}
              </pre>
            ) : null}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => refresh().catch(() => undefined)}
                className="px-4 py-2 rounded-md bg-[var(--brand-primary,#0ea5e9)] text-white hover:bg-[var(--brand-primary-hover,#0284c7)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary,#0ea5e9)]"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
