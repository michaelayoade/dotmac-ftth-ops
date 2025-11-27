"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
  useCallback,
} from "react";

import type { RuntimeConfig } from "./runtime-config";
import {
  getRuntimeConfigSnapshot,
  isRuntimeConfigDisabled,
  loadRuntimeConfig,
} from "./runtime-config";

type RuntimeConfigState = {
  runtimeConfig: RuntimeConfig | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const RuntimeConfigContext = createContext<RuntimeConfigState>({
  runtimeConfig: null,
  loading: false,
  error: null,
  refresh: async () => {},
});

type RuntimeConfigProviderProps = {
  children: ReactNode;
};

export function RuntimeConfigProvider({ children }: RuntimeConfigProviderProps) {
  const [runtimeConfig, setRuntimeConfig] = useState<RuntimeConfig | null>(() =>
    getRuntimeConfigSnapshot(),
  );
  const runtimeConfigDisabled = isRuntimeConfigDisabled();
  const [loading, setLoading] = useState<boolean>(() => !runtimeConfig && !runtimeConfigDisabled);
  const [error, setError] = useState<string | null>(null);

  const resolveRuntimeConfig = useCallback(async (force = false) => {
    if (runtimeConfigDisabled) {
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const payload = await loadRuntimeConfig(force ? { force: true } : undefined);
      setRuntimeConfig(payload);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load runtime config";
      setError(message);
      if (process.env.NODE_ENV !== "production") {
        console.error("[runtime-config]", err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!runtimeConfig && !runtimeConfigDisabled) {
      resolveRuntimeConfig().catch(() => {
        /* handled above */
      });
    } else if (runtimeConfigDisabled) {
      setLoading(false);
    }
  }, [runtimeConfig, runtimeConfigDisabled, resolveRuntimeConfig]);

  // onConfig callback removed - not used anywhere in the codebase
  // Components that need to react to runtime config changes should use useRuntimeConfigState() hook

  const refresh = useCallback(async () => {
    await resolveRuntimeConfig(true);
  }, [resolveRuntimeConfig]);

  const value = useMemo<RuntimeConfigState>(
    () => ({
      runtimeConfig,
      loading,
      error,
      refresh,
    }),
    [runtimeConfig, loading, error, refresh],
  );

  return <RuntimeConfigContext.Provider value={value}>{children}</RuntimeConfigContext.Provider>;
}

export function useRuntimeConfigState(): RuntimeConfigState {
  return useContext(RuntimeConfigContext);
}
