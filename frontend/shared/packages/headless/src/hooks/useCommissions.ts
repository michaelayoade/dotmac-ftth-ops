/**
 * Commission Tracking Hook
 *
 * Comprehensive commission management with automated calculations,
 * real-time tracking, and payout processing.
 *
 * Features:
 * - Multi-tier commission structures
 * - Real-time commission calculations
 * - Historical tracking and reporting
 * - Automated payout scheduling
 * - Tax compliance and documentation
 * - Performance-based bonuses
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types
export interface CommissionTier {
  id: string;
  name: string;
  minRevenue: number;
  maxRevenue?: number;
  rate: number;
  bonusRate?: number;
  description: string;
}

export interface CommissionRule {
  id: string;
  name: string;
  serviceType: string;
  baseRate: number;
  tiers: CommissionTier[];
  recurringRate?: number;
  oneTimeRate?: number;
  penaltyRate?: number;
  minPayoutAmount: number;
  payoutSchedule: "weekly" | "bi-weekly" | "monthly" | "quarterly";
  effectiveDate: string;
  expiryDate?: string;
  isActive: boolean;
}

export interface CommissionTransaction {
  id: string;
  resellerId: string;
  customerId: string;
  serviceId: string;
  transactionType: "sale" | "renewal" | "upgrade" | "downgrade" | "chargeback" | "refund";
  amount: number;
  commissionableAmount: number;
  commissionRate: number;
  commissionAmount: number;
  tierId?: string;
  transactionDate: string;
  payoutDate?: string;
  payoutId?: string;
  status: "pending" | "approved" | "paid" | "disputed" | "cancelled";
  metadata: Record<string, any>;
}

export interface CommissionPayout {
  id: string;
  resellerId: string;
  payoutDate: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: number;
  transactionCount: number;
  transactions: CommissionTransaction[];
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  paymentMethod: string;
  taxAmount?: number;
  fees?: number;
  netAmount: number;
  metadata: Record<string, any>;
}

export interface CommissionSummary {
  totalEarned: number;
  totalPaid: number;
  pendingAmount: number;
  currentMonth: number;
  lastMonth: number;
  averageMonthly: number;
  averageCommissionRate: number;
  topPerformingService: string;
  transactionCount: number;
  customerCount: number;
  recurringRevenue: number;
  oneTimeRevenue: number;
}

export interface CommissionFilters {
  dateRange: {
    start: string;
    end: string;
  };
  status?: string[] | undefined;
  serviceTypes?: string[] | undefined;
  transactionTypes?: string[] | undefined;
  resellerId?: string | undefined;
}

export interface UseCommissionsOptions {
  resellerId: string;
  filters?: CommissionFilters | undefined;
  autoRefresh?: boolean | undefined;
  refreshInterval?: number | undefined;
}

// API functions
const fetchCommissionRules = async (resellerId: string): Promise<CommissionRule[]> => {
  const response = await fetch(`/api/commissions/rules?resellerId=${resellerId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch commission rules: ${response.statusText}`);
  }
  return response.json();
};

const fetchCommissionTransactions = async (
  resellerId: string,
  filters?: CommissionFilters,
): Promise<CommissionTransaction[]> => {
  const params = new URLSearchParams({ resellerId });

  if (filters) {
    if (filters.dateRange) {
      params.append("startDate", filters.dateRange.start);
      params.append("endDate", filters.dateRange.end);
    }
    if (filters.status?.length) {
      params.append("status", filters.status.join(","));
    }
    if (filters.serviceTypes?.length) {
      params.append("serviceTypes", filters.serviceTypes.join(","));
    }
    if (filters.transactionTypes?.length) {
      params.append("transactionTypes", filters.transactionTypes.join(","));
    }
  }

  const response = await fetch(`/api/commissions/transactions?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch commission transactions: ${response.statusText}`);
  }
  return response.json();
};

const fetchCommissionPayouts = async (resellerId: string): Promise<CommissionPayout[]> => {
  const response = await fetch(`/api/commissions/payouts?resellerId=${resellerId}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch commission payouts: ${response.statusText}`);
  }
  return response.json();
};

const fetchCommissionSummary = async (
  resellerId: string,
  filters?: CommissionFilters,
): Promise<CommissionSummary> => {
  const params = new URLSearchParams({ resellerId });

  if (filters?.dateRange) {
    params.append("startDate", filters.dateRange.start);
    params.append("endDate", filters.dateRange.end);
  }

  const response = await fetch(`/api/commissions/summary?${params}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch commission summary: ${response.statusText}`);
  }
  return response.json();
};

const calculateCommission = async (
  resellerId: string,
  amount: number,
  serviceType: string,
  transactionType: string,
): Promise<{ commissionAmount: number; rate: number; tierId?: string }> => {
  const response = await fetch("/api/commissions/calculate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resellerId,
      amount,
      serviceType,
      transactionType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to calculate commission: ${response.statusText}`);
  }
  return response.json();
};

const requestPayout = async (
  resellerId: string,
  amount?: number,
): Promise<{ payoutId: string; status: string }> => {
  const response = await fetch("/api/commissions/request-payout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      resellerId,
      amount,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to request payout: ${response.statusText}`);
  }
  return response.json();
};

// Utility functions
const calculateCommissionTier = (
  amount: number,
  monthlyRevenue: number,
  tiers: CommissionTier[],
): CommissionTier | undefined => {
  return tiers.find(
    (tier) =>
      monthlyRevenue >= tier.minRevenue && (!tier.maxRevenue || monthlyRevenue <= tier.maxRevenue),
  );
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
};

const calculateGrowthRate = (current: number, previous: number): number => {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
};

// Main hook
export const useCommissions = (options: UseCommissionsOptions) => {
  const {
    resellerId,
    filters,
    autoRefresh = false,
    refreshInterval = 300000, // 5 minutes
  } = options;

  const queryClient = useQueryClient();

  // Query configuration
  const queryConfig: {
    staleTime: number;
    cacheTime: number;
    refetchInterval: number | false;
    retry: number;
    enabled: boolean;
  } = {
    staleTime: 60000, // 1 minute
    cacheTime: 300000, // 5 minutes
    refetchInterval: autoRefresh ? refreshInterval : false,
    retry: 3,
    enabled: !!resellerId,
  };

  // Fetch commission data
  const rulesQuery = useQuery<CommissionRule[]>({
    queryKey: ["commissions", "rules", resellerId],
    queryFn: () => fetchCommissionRules(resellerId),
    ...queryConfig,
  });

  const transactionsQuery = useQuery<CommissionTransaction[]>({
    queryKey: ["commissions", "transactions", resellerId, filters],
    queryFn: () => fetchCommissionTransactions(resellerId, filters),
    ...queryConfig,
  });

  const payoutsQuery = useQuery<CommissionPayout[]>({
    queryKey: ["commissions", "payouts", resellerId],
    queryFn: () => fetchCommissionPayouts(resellerId),
    ...queryConfig,
  });

  const summaryQuery = useQuery<CommissionSummary>({
    queryKey: ["commissions", "summary", resellerId, filters],
    queryFn: () => fetchCommissionSummary(resellerId, filters),
    ...queryConfig,
  });

  // Mutations
  const calculateCommissionMutation = useMutation({
    mutationFn: ({
      amount,
      serviceType,
      transactionType,
    }: {
      amount: number;
      serviceType: string;
      transactionType: string;
    }) => calculateCommission(resellerId, amount, serviceType, transactionType),
  });

  const requestPayoutMutation = useMutation({
    mutationFn: ({ amount }: { amount?: number }) => requestPayout(resellerId, amount),
    onSuccess: () => {
      // Refetch payouts and summary after successful payout request
      queryClient.invalidateQueries({
        queryKey: ["commissions", "payouts", resellerId],
      });
      queryClient.invalidateQueries({
        queryKey: ["commissions", "summary", resellerId],
      });
    },
  });

  // Calculated metrics
  const metrics = useMemo(() => {
    const transactions = transactionsQuery.data || [];
    const summary = summaryQuery.data;

    if (!summary) return null;

    // Calculate trends
    const currentMonthTransactions = transactions.filter((t) => {
      const transactionDate = new Date(t.transactionDate);
      const now = new Date();
      return (
        transactionDate.getMonth() === now.getMonth() &&
        transactionDate.getFullYear() === now.getFullYear()
      );
    });

    const lastMonthTransactions = transactions.filter((t) => {
      const transactionDate = new Date(t.transactionDate);
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return (
        transactionDate.getMonth() === lastMonth.getMonth() &&
        transactionDate.getFullYear() === lastMonth.getFullYear()
      );
    });

    const currentMonthAmount = currentMonthTransactions.reduce(
      (sum, t) => sum + t.commissionAmount,
      0,
    );
    const lastMonthAmount = lastMonthTransactions.reduce((sum, t) => sum + t.commissionAmount, 0);
    const growthRate = calculateGrowthRate(currentMonthAmount, lastMonthAmount);

    // Service performance
    const servicePerformance = transactions.reduce(
      (acc, t) => {
        if (!acc[t.serviceId]) {
          acc[t.serviceId] = { count: 0, amount: 0 };
        }
        const stats = acc[t.serviceId]!;
        stats.count += 1;
        stats.amount += t.commissionAmount;
        return acc;
      },
      {} as Record<string, { count: number; amount: number }>,
    );

    const topService = Object.entries(servicePerformance).sort(
      (a, b) => b[1].amount - a[1].amount,
    )[0];

    // Payout readiness
    const pendingTransactions = transactions.filter((t) => t.status === "approved");
    const pendingAmount = pendingTransactions.reduce((sum, t) => sum + t.commissionAmount, 0);
    const minPayoutRule = rulesQuery.data?.[0]?.minPayoutAmount || 100;
    const isPayoutReady = pendingAmount >= minPayoutRule;

    return {
      ...summary,
      currentMonthTransactions: currentMonthTransactions.length,
      lastMonthTransactions: lastMonthTransactions.length,
      growthRate,
      topService: topService ? { id: topService[0], ...topService[1] } : null,
      pendingAmount,
      isPayoutReady,
      minPayoutAmount: minPayoutRule,
      servicePerformance: Object.entries(servicePerformance).map(([id, data]) => ({
        serviceId: id,
        ...data,
      })),
    };
  }, [transactionsQuery.data, summaryQuery.data, rulesQuery.data]);

  // Commission calculator
  const calculateCommissionPreview = useCallback(
    async (amount: number, serviceType: string, transactionType: string = "sale") => {
      try {
        return await calculateCommissionMutation.mutateAsync({
          amount,
          serviceType,
          transactionType,
        });
      } catch (error) {
        console.error("Commission calculation failed:", error);
        throw error;
      }
    },
    [calculateCommissionMutation],
  );

  // Payout request
  const requestCommissionPayout = useCallback(
    async (amount?: number) => {
      try {
        const payload = typeof amount === "number" ? { amount } : {};
        return await requestPayoutMutation.mutateAsync(payload);
      } catch (error) {
        console.error("Payout request failed:", error);
        throw error;
      }
    },
    [requestPayoutMutation],
  );

  // Data export
  const exportCommissionData = useCallback(
    async (format: "csv" | "excel" | "pdf", dateRange?: { start: string; end: string }) => {
      try {
        const params = new URLSearchParams({
          resellerId,
          format,
        });

        if (dateRange) {
          params.append("startDate", dateRange.start);
          params.append("endDate", dateRange.end);
        }

        const response = await fetch(`/api/commissions/export?${params}`);
        if (!response.ok) {
          throw new Error(`Export failed: ${response.statusText}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `commissions-${resellerId}-${new Date().toISOString().split("T")[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (error) {
        console.error("Commission export failed:", error);
        throw error;
      }
    },
    [resellerId],
  );

  // Refresh data
  const refreshData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["commissions"] });
  }, [queryClient]);

  return {
    // Data
    rules: rulesQuery.data || [],
    transactions: transactionsQuery.data || [],
    payouts: payoutsQuery.data || [],
    summary: summaryQuery.data,
    metrics,

    // Loading states
    isLoading: rulesQuery.isLoading || transactionsQuery.isLoading || summaryQuery.isLoading,
    isLoadingRules: rulesQuery.isLoading,
    isLoadingTransactions: transactionsQuery.isLoading,
    isLoadingPayouts: payoutsQuery.isLoading,
    isLoadingSummary: summaryQuery.isLoading,

    // Error states
    isError: rulesQuery.isError || transactionsQuery.isError || summaryQuery.isError,
    error: rulesQuery.error || transactionsQuery.error || summaryQuery.error,

    // Actions
    calculateCommissionPreview,
    requestCommissionPayout,
    exportCommissionData,
    refreshData,

    // Mutation states
    isCalculating: calculateCommissionMutation.isPending,
    isRequestingPayout: requestPayoutMutation.isPending,
    payoutRequestError: requestPayoutMutation.error,

    // Query instances
    queries: {
      rules: rulesQuery,
      transactions: transactionsQuery,
      payouts: payoutsQuery,
      summary: summaryQuery,
    },
  };
};

// Specialized hooks
export const useCommissionCalculator = (resellerId: string) => {
  const { rules, calculateCommissionPreview } = useCommissions({ resellerId });

  const getApplicableRule = useCallback(
    (serviceType: string) => {
      return rules.find(
        (rule) =>
          rule.serviceType === serviceType &&
          rule.isActive &&
          new Date() >= new Date(rule.effectiveDate) &&
          (!rule.expiryDate || new Date() <= new Date(rule.expiryDate)),
      );
    },
    [rules],
  );

  const estimateCommission = useCallback(
    (amount: number, serviceType: string, monthlyRevenue: number = 0) => {
      const rule = getApplicableRule(serviceType);
      if (!rule) return { amount: 0, rate: 0, tier: null };

      const tier = calculateCommissionTier(amount, monthlyRevenue, rule.tiers);
      const rate = tier ? tier.rate : rule.baseRate;
      const commissionAmount = amount * rate;

      return {
        amount: commissionAmount,
        rate,
        tier,
        rule,
      };
    },
    [getApplicableRule],
  );

  return {
    rules,
    getApplicableRule,
    estimateCommission,
    calculateCommissionPreview,
  };
};

export const usePayoutHistory = (resellerId: string) => {
  const { payouts, isLoadingPayouts, refreshData } = useCommissions({
    resellerId,
  });

  const payoutStats = useMemo(() => {
    if (!payouts.length) return null;

    const totalPaid = payouts.reduce((sum, payout) => sum + payout.netAmount, 0);
    const averagePayout = totalPaid / payouts.length;
    const lastPayout = payouts.sort(
      (a, b) => new Date(b.payoutDate).getTime() - new Date(a.payoutDate).getTime(),
    )[0];

    const payoutsByMonth = payouts.reduce(
      (acc, payout) => {
        const month = new Date(payout.payoutDate).toISOString().slice(0, 7);
        if (!acc[month]) acc[month] = 0;
        acc[month] += payout.netAmount;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalPaid,
      averagePayout,
      lastPayout,
      payoutsByMonth,
      payoutCount: payouts.length,
    };
  }, [payouts]);

  return {
    payouts,
    payoutStats,
    isLoading: isLoadingPayouts,
    refreshData,
  };
};

export default useCommissions;
