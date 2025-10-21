/**
 * Tenant Limits and Usage Management Hook
 * Handles subscription limits and usage tracking
 */

import { useMemo, useCallback } from "react";
import { TenantLimitsUsage, TenantSession } from "../../types/tenant";

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
        users: { limit: 0, used: 0, percentage: 0 },
        storage: { limit: 0, used: 0, percentage: 0 },
        bandwidth: { limit: 0, used: 0, percentage: 0 },
        api_calls: { limit: 0, used: 0, percentage: 0 },
      };
    }

    const limits = session.tenant.subscription?.limits || {};
    const usage = session.tenant.usage || {};

    const calculatePercentage = (used: number, limit: number): number => {
      return limit > 0 ? Math.round((used / limit) * 100) : 0;
    };

    return {
      customers: {
        limit: limits.max_customers || 0,
        used: usage.customers || 0,
        percentage: calculatePercentage(usage.customers || 0, limits.max_customers || 0),
      },
      users: {
        limit: limits.max_users || 0,
        used: usage.users || 0,
        percentage: calculatePercentage(usage.users || 0, limits.max_users || 0),
      },
      storage: {
        limit: limits.max_storage_gb || 0,
        used: usage.storage_gb || 0,
        percentage: calculatePercentage(usage.storage_gb || 0, limits.max_storage_gb || 0),
      },
      bandwidth: {
        limit: limits.max_bandwidth_gb || 0,
        used: usage.bandwidth_gb || 0,
        percentage: calculatePercentage(usage.bandwidth_gb || 0, limits.max_bandwidth_gb || 0),
      },
      api_calls: {
        limit: limits.max_api_calls || 0,
        used: usage.api_calls || 0,
        percentage: calculatePercentage(usage.api_calls || 0, limits.max_api_calls || 0),
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
    if (!session?.tenant?.subscription) return false;

    const { subscription } = session.tenant;
    if (subscription.type !== "TRIAL") return false;

    const trialEndDate = new Date(subscription.trial_end_date);
    const now = new Date();
    const daysLeft = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return daysLeft <= 7; // Expiring within 7 days
  }, [session?.tenant?.subscription]);

  const getTrialDaysLeft = useCallback((): number => {
    if (!session?.tenant?.subscription?.trial_end_date) return 0;

    const trialEndDate = new Date(session.tenant.subscription.trial_end_date);
    const now = new Date();
    const daysLeft = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return Math.max(0, daysLeft);
  }, [session?.tenant?.subscription?.trial_end_date]);

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
