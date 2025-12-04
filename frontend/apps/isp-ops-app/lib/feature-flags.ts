"use client";

/**
 * Feature Flag System
 *
 * Centralized feature flag management for gradual rollouts and A/B testing.
 * Replaces hardcoded commented-out code with runtime-controllable features.
 *
 * @example
 * ```ts
 * import { useFeatureFlag, isFeatureEnabled } from '@/lib/feature-flags';
 *
 * // In React components
 * const { enabled } = useFeatureFlag('radius-sessions');
 * if (enabled) {
 *   return <RADIUSSessionsWidget />;
 * }
 *
 * // In utility functions
 * if (isFeatureEnabled('experimental-ui')) {
 *   // Use new UI
 * }
 * ```
 */

import { useState, useEffect } from "react";
import { logger } from "./logger";

/**
 * Available feature flags
 * Add new flags here as they are created
 */
export type FeatureFlag =
  | "radius-sessions"
  | "radius-subscribers"
  | "opentelemetry-tracing"
  | "experimental-ui"
  | "graphql-migration"
  | "network-monitoring-v2"
  | "advanced-analytics"
  | "multi-tenant-mode"
  | "webhook-retry"
  | "job-scheduling"
  | "real-time-updates";

/**
 * Feature flag configuration
 */
interface FeatureFlagConfig {
  /**
   * Flag name (must match FeatureFlag type)
   */
  name: FeatureFlag;

  /**
   * Human-readable description
   */
  description: string;

  /**
   * Default state if not configured
   */
  defaultEnabled: boolean;

  /**
   * Environment variable name to override
   * e.g., NEXT_PUBLIC_FEATURE_RADIUS_SESSIONS
   */
  envVar?: string;
}

/**
 * Feature flag definitions
 */
const FEATURE_FLAGS: Record<FeatureFlag, FeatureFlagConfig> = {
  "radius-sessions": {
    name: "radius-sessions",
    description: "Enable RADIUS sessions widget on dashboard",
    defaultEnabled: false,
    envVar: "NEXT_PUBLIC_FEATURE_RADIUS_SESSIONS",
  },
  "radius-subscribers": {
    name: "radius-subscribers",
    description: "Enable RADIUS subscribers widget on dashboard",
    defaultEnabled: false,
    envVar: "NEXT_PUBLIC_FEATURE_RADIUS_SUBSCRIBERS",
  },
  "opentelemetry-tracing": {
    name: "opentelemetry-tracing",
    description: "Enable OpenTelemetry distributed tracing",
    defaultEnabled: false,
    envVar: "NEXT_PUBLIC_FEATURE_OTEL_TRACING",
  },
  "experimental-ui": {
    name: "experimental-ui",
    description: "Enable experimental UI components",
    defaultEnabled: false,
    envVar: "NEXT_PUBLIC_FEATURE_EXPERIMENTAL_UI",
  },
  "graphql-migration": {
    name: "graphql-migration",
    description: "Use GraphQL instead of REST API where available",
    defaultEnabled: false,
    envVar: "NEXT_PUBLIC_FEATURE_GRAPHQL_MIGRATION",
  },
  "network-monitoring-v2": {
    name: "network-monitoring-v2",
    description: "Enable new network monitoring dashboard",
    defaultEnabled: true,
    envVar: "NEXT_PUBLIC_FEATURE_NETWORK_MONITORING_V2",
  },
  "advanced-analytics": {
    name: "advanced-analytics",
    description: "Enable advanced analytics features",
    defaultEnabled: false,
    envVar: "NEXT_PUBLIC_FEATURE_ADVANCED_ANALYTICS",
  },
  "multi-tenant-mode": {
    name: "multi-tenant-mode",
    description: "Enable multi-tenant features",
    defaultEnabled: true,
    envVar: "NEXT_PUBLIC_FEATURE_MULTI_TENANT",
  },
  "webhook-retry": {
    name: "webhook-retry",
    description: "Enable automatic webhook retry mechanism",
    defaultEnabled: true,
    envVar: "NEXT_PUBLIC_FEATURE_WEBHOOK_RETRY",
  },
  "job-scheduling": {
    name: "job-scheduling",
    description: "Enable job scheduling interface",
    defaultEnabled: true,
    envVar: "NEXT_PUBLIC_FEATURE_JOB_SCHEDULING",
  },
  "real-time-updates": {
    name: "real-time-updates",
    description: "Enable real-time WebSocket updates",
    defaultEnabled: false,
    envVar: "NEXT_PUBLIC_FEATURE_REALTIME_UPDATES",
  },
};

/**
 * Get feature flag state from environment or default
 */
export const isFeatureEnabled = (flag: FeatureFlag): boolean => {
  const config = FEATURE_FLAGS[flag];

  if (!config) {
    logger.warn("Unknown feature flag", { flag });
    return false;
  }

  // Check environment variable first
  if (config.envVar) {
    const envValue = process.env[config.envVar];
    if (envValue !== undefined) {
      return envValue === "true" || envValue === "1";
    }
  }

  // Fall back to default
  return config.defaultEnabled;
};

/**
 * React hook for feature flags with dynamic updates
 */
export const useFeatureFlag = (flag: FeatureFlag) => {
  const [enabled, setEnabled] = useState(() => isFeatureEnabled(flag));

  useEffect(() => {
    // Listen for feature flag changes (for runtime toggling)
    const handleFeatureFlagChange = (event: CustomEvent) => {
      if (event.detail.flag === flag) {
        setEnabled(event.detail.enabled);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(
        "featureFlagChange" as unknown as string,
        handleFeatureFlagChange as EventListener,
      );

      return () => {
        window.removeEventListener(
          "featureFlagChange" as unknown as string,
          handleFeatureFlagChange as EventListener,
        );
      };
    }

    return undefined;
  }, [flag]);

  return { enabled };
};

/**
 * Toggle feature flag at runtime (for development/testing)
 */
export const toggleFeatureFlag = (flag: FeatureFlag, enabled: boolean): void => {
  if (process.env.NODE_ENV === "production") {
    logger.warn("Cannot toggle feature flags in production");
    return;
  }

  logger.info("Feature flag toggled", { flag, enabled });

  // Dispatch event to update all hooks
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("featureFlagChange", {
        detail: { flag, enabled },
      }),
    );
  }
};

/**
 * Get all feature flags with their current state
 */
export const getAllFeatureFlags = (): Record<FeatureFlag, boolean> => {
  const flags = {} as Record<FeatureFlag, boolean>;

  Object.keys(FEATURE_FLAGS).forEach((flag) => {
    flags[flag as FeatureFlag] = isFeatureEnabled(flag as FeatureFlag);
  });

  return flags;
};

/**
 * Get feature flag configuration
 */
export const getFeatureFlagConfig = (flag: FeatureFlag): FeatureFlagConfig | undefined => {
  return FEATURE_FLAGS[flag];
};
