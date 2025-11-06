/**
 * React Query hooks for partner revenue management
 */

import { useQuery } from "@tanstack/react-query";
import {
  partnerRevenueService,
  type PartnerRevenueMetrics,
  type PartnerCommissionEvent,
  type PartnerPayout,
  type RevenueMetricsFilters,
  type CommissionFilters,
  type PayoutFilters,
} from "@/lib/services/partner-revenue-service";

// ============================================
// Revenue Metrics Hooks
// ============================================

/**
 * Hook to fetch partner revenue metrics
 *
 * @param filters - Optional period filters
 * @returns Revenue metrics with loading and error states
 */
export function useRevenueMetrics(filters: RevenueMetricsFilters = {}) {
  return useQuery<PartnerRevenueMetrics, Error, PartnerRevenueMetrics, any>({
    queryKey: ["partner-revenue-metrics", filters],
    queryFn: () => partnerRevenueService.getRevenueMetrics(filters),
    staleTime: 60000, // 1 minute
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ============================================
// Commission Events Hooks
// ============================================

/**
 * Hook to fetch partner commission events
 *
 * @param filters - Optional filters (status, pagination)
 * @returns Commission events list with loading and error states
 */
export function useCommissionEvents(filters: CommissionFilters = {}) {
  return useQuery<PartnerCommissionEvent[], Error, PartnerCommissionEvent[], any>({
    queryKey: ["partner-commissions", filters],
    queryFn: () => partnerRevenueService.listCommissionEvents(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single commission event
 *
 * @param commissionId - Commission event UUID
 * @returns Commission event details with loading and error states
 */
export function useCommissionEvent(commissionId: string | null) {
  return useQuery<PartnerCommissionEvent, Error, PartnerCommissionEvent, any>({
    queryKey: ["partner-commission", commissionId],
    queryFn: () => partnerRevenueService.getCommissionEvent(commissionId!),
    enabled: !!commissionId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Payout Hooks
// ============================================

/**
 * Hook to fetch partner payouts
 *
 * @param filters - Optional filters (status, pagination)
 * @returns Payouts list with loading and error states
 */
export function usePayouts(filters: PayoutFilters = {}) {
  return useQuery<PartnerPayout[], Error, PartnerPayout[], any>({
    queryKey: ["partner-payouts", filters],
    queryFn: () => partnerRevenueService.listPayouts(filters),
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single payout
 *
 * @param payoutId - Payout UUID
 * @returns Payout details with loading and error states
 */
export function usePayout(payoutId: string | null) {
  return useQuery<PartnerPayout, Error, PartnerPayout, any>({
    queryKey: ["partner-payout", payoutId],
    queryFn: () => partnerRevenueService.getPayout(payoutId!),
    enabled: !!payoutId,
    staleTime: 30000,
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Hook for calculating commission amounts
 *
 * @returns Commission calculation utilities
 */
export function useCommissionCalculator() {
  const calculateCommission = (baseAmount: number, rate: number) => {
    return partnerRevenueService.calculateCommission(baseAmount, rate);
  };

  const formatCurrency = (amount: number, currency: string = "USD") => {
    return partnerRevenueService.formatCurrency(amount, currency);
  };

  const calculateConversionRate = (earned: number, potential: number) => {
    return partnerRevenueService.calculateConversionRate(earned, potential);
  };

  return {
    calculateCommission,
    formatCurrency,
    calculateConversionRate,
  };
}

/**
 * Hook to get aggregated revenue statistics
 *
 * @param filters - Period filters
 * @returns Aggregated revenue statistics
 */
export function useRevenueStatistics(filters: RevenueMetricsFilters = {}) {
  const { data: metrics, isLoading, error } = useRevenueMetrics(filters);
  const { data: commissions = [] } = useCommissionEvents({});
  const { data: payouts = [] } = usePayouts({});

  // Calculate aggregated statistics
  const statistics = {
    // From metrics
    totalCommissions: metrics?.total_commissions || 0,
    totalPayouts: metrics?.total_payouts || 0,
    pendingAmount: metrics?.pending_amount || 0,
    commissionCount: metrics?.total_commission_count || 0,

    // From commission events
    approvedCommissions: commissions
      .filter((c) => c.status === "approved")
      .reduce((sum, c) => sum + c.commission_amount, 0),
    pendingCommissions: commissions
      .filter((c) => c.status === "pending")
      .reduce((sum, c) => sum + c.commission_amount, 0),
    paidCommissions: commissions
      .filter((c) => c.status === "paid")
      .reduce((sum, c) => sum + c.commission_amount, 0),

    // From payouts
    completedPayouts: payouts
      .filter((p) => p.status === "completed")
      .reduce((sum, p) => sum + p.total_amount, 0),
    pendingPayouts: payouts
      .filter((p) => p.status === "pending" || p.status === "ready")
      .reduce((sum, p) => sum + p.total_amount, 0),
    processingPayouts: payouts
      .filter((p) => p.status === "processing")
      .reduce((sum, p) => sum + p.total_amount, 0),

    // Counts
    totalPayoutsCount: payouts.length,
    completedPayoutsCount: payouts.filter((p) => p.status === "completed").length,
    failedPayoutsCount: payouts.filter((p) => p.status === "failed").length,
  };

  return {
    statistics,
    isLoading,
    error,
  };
}
