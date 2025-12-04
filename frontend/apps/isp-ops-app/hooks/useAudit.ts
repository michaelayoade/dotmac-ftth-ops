/**
 * Audit Logging Hooks
 *
 * React Query hooks for audit trail and activity tracking.
 * Uses the auditService for all API calls.
 *
 * Pattern:
 * - Query hooks for data fetching with caching
 * - Proper type safety with React Query v5 generics
 * - Consistent error handling across all hooks
 * - Automatic refetching and background updates
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@dotmac/ui";
import { auditService } from "@/lib/services/audit-service";
import type {
  AuditActivity,
  AuditActivityList,
  AuditFilterParams,
  ActivitySummary,
} from "@/types/audit";
import type {
  AuditExportRequest,
  AuditExportResponse,
  ComplianceReport,
} from "@/lib/services/audit-service";

// ==================== Query Keys ====================

export const auditKeys = {
  all: ["audit"] as const,
  activities: {
    all: ["audit", "activities"] as const,
    list: (filters: AuditFilterParams) => ["audit", "activities", "list", filters] as const,
    recent: (limit: number, days: number) =>
      ["audit", "activities", "recent", limit, days] as const,
    user: (userId: string, limit: number, days: number) =>
      ["audit", "activities", "user", userId, limit, days] as const,
    detail: (id: string) => ["audit", "activity", id] as const,
  },
  summary: (days: number) => ["audit", "summary", days] as const,
  compliance: (fromDate: string, toDate: string) =>
    ["audit", "compliance", fromDate, toDate] as const,
};

// ==================== Activity Operations ====================

/**
 * Get paginated list of audit activities
 * GET /api/v1/audit/activities
 */
export function useAuditActivities(filters: AuditFilterParams = {}, enabled = true) {
  return useQuery<AuditActivityList, Error, AuditActivityList, any>({
    queryKey: auditKeys.activities.list(filters),
    queryFn: () => auditService.listActivities(filters),
    enabled,
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get recent audit activities
 * GET /api/v1/audit/activities/recent
 */
export function useRecentActivities(limit = 20, days = 7, enabled = true) {
  return useQuery<AuditActivity[], Error, AuditActivity[], any>({
    queryKey: auditKeys.activities.recent(limit, days),
    queryFn: () => auditService.getRecentActivities(limit, days),
    enabled,
    staleTime: 30000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 60000, // Auto-refresh every minute
  });
}

/**
 * Get audit activities for a specific user
 * GET /api/v1/audit/activities/user/{userId}
 */
export function useUserActivities(userId: string, limit = 50, days = 30, enabled = true) {
  return useQuery<AuditActivity[], Error, AuditActivity[], any>({
    queryKey: auditKeys.activities.user(userId, limit, days),
    queryFn: () => auditService.getUserActivities(userId, limit, days),
    enabled: enabled && !!userId,
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get details for a specific audit activity
 * GET /api/v1/audit/activities/{activityId}
 */
export function useActivityDetails(activityId: string, enabled = true) {
  return useQuery<AuditActivity, Error, AuditActivity, any>({
    queryKey: auditKeys.activities.detail(activityId),
    queryFn: () => auditService.getActivity(activityId),
    enabled: enabled && !!activityId,
    staleTime: 300000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

// ==================== Statistics & Summaries ====================

/**
 * Get activity summary statistics
 * GET /api/v1/audit/activities/summary
 */
export function useActivitySummary(days = 7, enabled = true) {
  return useQuery<ActivitySummary, Error, ActivitySummary, any>({
    queryKey: auditKeys.summary(days),
    queryFn: () => auditService.getActivitySummary(days),
    enabled,
    staleTime: 300000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

/**
 * Get resource history
 * Convenience hook for getting audit logs for a specific resource
 */
export function useResourceHistory(resourceType: string, resourceId: string, enabled = true) {
  return useQuery<AuditActivity[], Error, AuditActivity[], any>({
    queryKey: ["audit", "resource", resourceType, resourceId],
    queryFn: () => auditService.getResourceHistory(resourceType, resourceId),
    enabled: enabled && !!resourceType && !!resourceId,
    staleTime: 60000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ==================== Compliance & Export ====================

/**
 * Export audit logs
 * POST /api/v1/audit/export
 */
export function useExportAuditLogs(options?: {
  onSuccess?: (data: AuditExportResponse) => void;
  onError?: (error: Error) => void;
}) {
  return useMutation<AuditExportResponse, Error, AuditExportRequest>({
    mutationFn: (request) => auditService.exportLogs(request),
    onSuccess: (data) => {
      // toast.success('Audit export initiated', {
      //   description: 'Your export will be ready shortly',
      // });
      options?.onSuccess?.(data);
    },
    onError: (error) => {
      // toast.error('Failed to export audit logs', {
      //   description: error.message,
      // });
      options?.onError?.(error);
    },
  });
}

/**
 * Get compliance report
 * GET /api/v1/audit/compliance
 */
export function useComplianceReport(fromDate: string, toDate: string, enabled = true) {
  return useQuery<ComplianceReport, Error, ComplianceReport, any>({
    queryKey: auditKeys.compliance(fromDate, toDate),
    queryFn: () => auditService.getComplianceReport(fromDate, toDate),
    enabled: enabled && !!fromDate && !!toDate,
    staleTime: 600000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}

// ==================== Composite Hooks ====================

/**
 * Get audit dashboard data
 * Combines recent activities and summary for dashboard view
 */
export function useAuditDashboard(days = 7) {
  const recentActivities = useRecentActivities(10, days);
  const summary = useActivitySummary(days);

  return {
    recentActivities: recentActivities.data || [],
    summary: summary.data,
    isLoading: recentActivities.isLoading || summary.isLoading,
    error: recentActivities.error || summary.error,
    refetch: () => {
      recentActivities.refetch();
      summary.refetch();
    },
  };
}

/**
 * Monitor user activity
 * Real-time monitoring of a specific user's activities
 */
export function useMonitorUserActivity(userId: string, days = 1) {
  const activities = useUserActivities(userId, 50, days, !!userId);

  return {
    activities: activities.data || [],
    isLoading: activities.isLoading,
    error: activities.error,
    refetch: activities.refetch,
  };
}
