"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __DOTMAC_MSW_INITIALIZED__?: boolean;
  }
}

type ClientMSWProviderProps = {
  /**
   * Allow tests or stories to force-enable/disable MSW without
   * touching process.env mid-flight.
   */
  enabled?: boolean;
};

const shouldEnableByDefault = process.env["NEXT_PUBLIC_MSW_ENABLED"] === "true";

export function ClientMSWProvider({ enabled = shouldEnableByDefault }: ClientMSWProviderProps) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }

    if (window.__DOTMAC_MSW_INITIALIZED__) {
      return;
    }

    let cancelled = false;

    const startWorker = async () => {
      try {
        const { startMSW } = await import("./browser");
        if (cancelled) {
          return;
        }
        await startMSW();
        window.__DOTMAC_MSW_INITIALIZED__ = true;
      } catch (error) {
        window.__DOTMAC_MSW_INITIALIZED__ = false;
        console.error("[MSW] Failed to start browser worker:", error);
      }
    };

    startWorker();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return null;
}
