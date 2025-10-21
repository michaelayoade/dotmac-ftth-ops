"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

export function MSWProvider({ children }: { children: React.ReactNode }) {
  const [mswReady, setMswReady] = useState(false);

  useEffect(() => {
    // Only start MSW when explicitly requested
    if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_MOCK_API === "true") {
      import("../lib/mocks/browser").then(({ worker }) => {
        worker
          .start({
            onUnhandledRequest: "bypass",
            serviceWorker: {
              url: "/mockServiceWorker.js",
            },
          })
          .then(() => {
            logger.info("[MSW] Mock Service Worker started");
            setMswReady(true);
          })
          .catch((error) => {
            logger.error("[MSW] Failed to start", error);
            setMswReady(true); // Continue anyway
          });
      });
    } else {
      setMswReady(true); // Without mocks or in production, just continue
    }
  }, []);

  // Only show loading when actually starting MSW
  if (
    !mswReady &&
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_MOCK_API === "true"
  ) {
    return <div>Loading mocks...</div>;
  }

  return <>{children}</>;
}
