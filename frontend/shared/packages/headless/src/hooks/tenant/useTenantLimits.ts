/**
 * Tenant Limits and Usage Management Hook
 * Handles subscription limits and usage tracking
 */

import { useMemo, useCallback } from "react";
import type { TenantLimitsUsage, TenantSession } from "../../types/tenant";

export interface UseTenantLimitsReturn {
  getLimitsUsage: () => TenantLimitsUsage;
  isLimitReached: (limit: string) => boolean;
  getUsagePercentage: (limit: string) => number;
  isTrialExpiring: () => boolean;
  getTrialDaysLeft: () => number;
  isTenantActive: () => boolean;
}

export function useTenantLimits(session: TenantSession | null): UseTenantLimitsReturn {
  const limitsUsage = useMemo((): TenantLimitsUsage => {
    if (!session?.tenant) {
      return {
        customers: { limit: 0, used: 0, percentage: 0 },
        services: { limit: 0, used: 0, percentage: 0 },
        users: { limit: 0, used: 0, percentage: 0 },
        storage: { limit: 0, used: 0, percentage: 0 },
        bandwidth: { limit: 0, used: 0, percentage: 0 },
        api_requests: { limit: 0, used: 0, percentage: 0 },
      };
    }

    const limits = session.tenant.limits || {};
    const usage = session.tenant.usage || {};

    const calculatePercentage = (used: number, limit: number): number => {
      return limit > 0 ? Math.round((used / limit) * 100) : 0;
    };

    return {
      customers: {
        limit: limits.customers || 0,
        used: usage.customers || 0,
        percentage: calculatePercentage(usage.customers || 0, limits.customers || 0),
      },
      services: {
        limit: limits.services || 0,
        used: usage.services || 0,
        percentage: calculatePercentage(usage.services || 0, limits.services || 0),
      },
      users: {
        limit: limits.users || 0,
        used: usage.users || 0,
        percentage: calculatePercentage(usage.users || 0, limits.users || 0),
      },
      storage: {
        limit: limits.storage_gb || 0,
        used: usage.storage_used_gb || 0,
        percentage: calculatePercentage(usage.storage_used_gb || 0, limits.storage_gb || 0),
      },
      bandwidth: {
        limit: limits.bandwidth_gb || 0,
        used: usage.bandwidth_used_gb || 0,
        percentage: calculatePercentage(usage.bandwidth_used_gb || 0, limits.bandwidth_gb || 0),
      },
      api_requests: {
        limit: limits.api_requests_per_hour || 0,
        used: usage.api_requests_this_hour || 0,
        percentage: calculatePercentage(
          usage.api_requests_this_hour || 0,
          limits.api_requests_per_hour || 0,
        ),
      },
    };
  }, [session?.tenant]);

  const getLimitsUsage = useCallback((): TenantLimitsUsage => {
    return limitsUsage;
  }, [limitsUsage]);

  const isLimitReached = useCallback(
    (limit: string): boolean => {
      const usage = limitsUsage[limit as keyof TenantLimitsUsage];
      return usage ? usage.percentage >= 100 : false;
    },
    [limitsUsage],
  );

  const getUsagePercentage = useCallback(
    (limit: string): number => {
      const usage = limitsUsage[limit as keyof TenantLimitsUsage];
      return usage ? usage.percentage : 0;
    },
    [limitsUsage],
  );

  const isTrialExpiring = useCallback((): boolean => {
    const subscription = session?.tenant?.subscription;
    if (!subscription || subscription.status !== "TRIAL" || !subscription.trial_ends_at) {
      return false;
    }

    const trialEndDate = new Date(subscription.trial_ends_at);
    const now = new Date();
    const daysLeft = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysLeft <= 7; // Expiring within 7 days
  }, [session?.tenant?.subscription]);

  const getTrialDaysLeft = useCallback((): number => {
    const trialEnd = session?.tenant?.subscription?.trial_ends_at;
    if (!trialEnd) return 0;

    const trialEndDate = new Date(trialEnd);
    const now = new Date();
    const daysLeft = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return Math.max(0, daysLeft);
  }, [session?.tenant?.subscription?.trial_ends_at]);

  const isTenantActive = useCallback((): boolean => {
    return session?.tenant?.status === "ACTIVE";
  }, [session?.tenant?.status]);

  return {
    getLimitsUsage,
    isLimitReached,
    getUsagePercentage,
    isTrialExpiring,
    getTrialDaysLeft,
    isTenantActive,
  };
}
