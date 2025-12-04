"use client";

/**
 * MSW Provider - Disabled
 *
 * Mock Service Worker support has been temporarily disabled due to module resolution issues.
 * MSW should only be used in test environments, not in the main application.
 *
 * To re-enable: Set up MSW properly with conditional imports that don't break Next.js module resolution.
 */
export function MSWProvider({ children }: { children: React.ReactNode }) {
  // MSW disabled - passthrough only
  return <>{children}</>;
}
