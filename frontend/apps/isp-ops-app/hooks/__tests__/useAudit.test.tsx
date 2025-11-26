/**
 * Jest Mock Tests for useAudit hooks
 * Tests audit logging functionality with Jest mocks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useAuditActivities,
  useRecentActivities,
  useUserActivities,
  useActivityDetails,
  useActivitySummary,
  useResourceHistory,
  useExportAuditLogs,
  useComplianceReport,
  useAuditDashboard,
  useMonitorUserActivity,
  auditKeys,
} from "../useAudit";
import type { AuditActivity, ActivitySummary } from "@/types/audit";
import { ActivitySeverity, ActivityType } from "@/types/audit";

// Mock audit service
jest.mock("@/lib/services/audit-service", () => ({
  auditService: {
    listActivities: jest.fn(),
    getRecentActivities: jest.fn(),
    getUserActivities: jest.fn(),
    getActivity: jest.fn(),
    getActivitySummary: jest.fn(),
    getResourceHistory: jest.fn(),
    exportLogs: jest.fn(),
    getComplianceReport: jest.fn(),
  },
}));

// Mock toast
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: jest.fn(),
  }),
}));

import { auditService } from "@/lib/services/audit-service";

const mockAuditService = auditService as jest.Mocked<typeof auditService>;

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        staleTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock data helpers
const createMockActivity = (overrides?: Partial<AuditActivity>): AuditActivity => ({
  id: "activity-1",
  tenant_id: "tenant-1",
  user_id: "user-1",
  activity_type: ActivityType.USER_LOGIN,
  action: "login",
  severity: ActivitySeverity.LOW,
  resource_type: "user",
  resource_id: "user-1",
  timestamp: new Date().toISOString(),
  ip_address: "192.168.1.1",
  user_agent: "Mozilla/5.0",
  details: {},
  ...overrides,
});

describe("useAudit (Jest Mocks)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("auditKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(auditKeys.all).toEqual(["audit"]);
      expect(auditKeys.activities.all).toEqual(["audit", "activities"]);
      expect(auditKeys.activities.list({ page: 1 })).toEqual([
        "audit",
        "activities",
        "list",
        { page: 1 },
      ]);
      expect(auditKeys.activities.recent(20, 7)).toEqual(["audit", "activities", "recent", 20, 7]);
      expect(auditKeys.activities.user("user-1", 50, 30)).toEqual([
        "audit",
        "activities",
        "user",
        "user-1",
        50,
        30,
      ]);
      expect(auditKeys.activities.detail("activity-1")).toEqual([
        "audit",
        "activity",
        "activity-1",
      ]);
      expect(auditKeys.summary(7)).toEqual(["audit", "summary", 7]);
      expect(auditKeys.compliance("2024-01-01", "2024-01-31")).toEqual([
        "audit",
        "compliance",
        "2024-01-01",
        "2024-01-31",
      ]);
    });
  });

  describe("useAuditActivities", () => {
    it("should fetch audit activities successfully", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
          severity: ActivitySeverity.LOW,
        }),
      ];

      mockAuditService.listActivities.mockResolvedValueOnce({
        activities: mockActivities,
        total: 1,
        page: 1,
        per_page: 20,
        total_pages: 1,
      });

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.activities).toHaveLength(1);
      expect(result.current.data?.total).toBe(1);
      expect(result.current.data?.activities[0].id).toBe("activity-1");
      expect(mockAuditService.listActivities).toHaveBeenCalledWith({});
    });

    it("should handle empty activities list", async () => {
      mockAuditService.listActivities.mockResolvedValueOnce({
        activities: [],
        total: 0,
        page: 1,
        per_page: 20,
        total_pages: 0,
      });

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.activities).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle filter parameters", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          user_id: "user-1",
          activity_type: ActivityType.USER_LOGIN,
          severity: ActivitySeverity.HIGH,
        }),
      ];

      mockAuditService.listActivities.mockResolvedValueOnce({
        activities: mockActivities,
        total: 1,
        page: 1,
        per_page: 20,
        total_pages: 1,
      });

      const { result } = renderHook(
        () =>
          useAuditActivities({
            user_id: "user-1",
            activity_type: ActivityType.USER_LOGIN,
            severity: ActivitySeverity.HIGH,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.activities).toHaveLength(1);
      expect(mockAuditService.listActivities).toHaveBeenCalledWith({
        user_id: "user-1",
        activity_type: ActivityType.USER_LOGIN,
        severity: ActivitySeverity.HIGH,
      });
    });

    it("should handle pagination", async () => {
      const mockActivities = Array.from({ length: 10 }, (_, i) =>
        createMockActivity({
          id: `activity-${i + 11}`,
        }),
      );

      mockAuditService.listActivities.mockResolvedValueOnce({
        activities: mockActivities,
        total: 25,
        page: 2,
        per_page: 10,
        total_pages: 3,
      });

      const { result } = renderHook(() => useAuditActivities({ page: 2, per_page: 10 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.activities).toHaveLength(10);
      expect(result.current.data?.page).toBe(2);
      expect(result.current.data?.total).toBe(25);
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useAuditActivities({}, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(mockAuditService.listActivities).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      mockAuditService.listActivities.mockRejectedValueOnce(new Error("Server error"));

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useRecentActivities", () => {
    it("should fetch recent activities", async () => {
      const now = new Date();
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          timestamp: new Date(now.getTime() - 3600000).toISOString(),
        }),
        createMockActivity({
          id: "activity-2",
          timestamp: new Date(now.getTime() - 7200000).toISOString(),
        }),
      ];

      mockAuditService.getRecentActivities.mockResolvedValueOnce(mockActivities);

      const { result } = renderHook(() => useRecentActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("activity-1");
      expect(mockAuditService.getRecentActivities).toHaveBeenCalledWith(20, 7);
    });

    it("should respect limit and days parameters", async () => {
      mockAuditService.getRecentActivities.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useRecentActivities(10, 30), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockAuditService.getRecentActivities).toHaveBeenCalledWith(10, 30);
    });
  });

  describe("useUserActivities", () => {
    it("should fetch user activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          user_id: "user-1",
        }),
      ];

      mockAuditService.getUserActivities.mockResolvedValueOnce(mockActivities);

      const { result } = renderHook(() => useUserActivities("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].user_id).toBe("user-1");
      expect(mockAuditService.getUserActivities).toHaveBeenCalledWith("user-1", 50, 30);
    });

    it("should return empty array for user with no activities", async () => {
      mockAuditService.getUserActivities.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useUserActivities("user-99"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });
  });

  describe("useActivityDetails", () => {
    it("should fetch activity details successfully", async () => {
      const mockActivity = createMockActivity({
        id: "activity-1",
        activity_type: ActivityType.USER_LOGIN,
        details: { ip: "192.168.1.1", browser: "Chrome" },
      });

      mockAuditService.getActivity.mockResolvedValueOnce(mockActivity);

      const { result } = renderHook(() => useActivityDetails("activity-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.id).toBe("activity-1");
      expect(result.current.data?.details).toEqual({
        ip: "192.168.1.1",
        browser: "Chrome",
      });
    });

    it("should handle activity not found", async () => {
      mockAuditService.getActivity.mockRejectedValueOnce(new Error("Activity not found"));

      const { result } = renderHook(() => useActivityDetails("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useActivityDetails("activity-1", false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(mockAuditService.getActivity).not.toHaveBeenCalled();
    });
  });

  describe("useActivitySummary", () => {
    it("should fetch activity summary successfully", async () => {
      const mockSummary: ActivitySummary = {
        total_activities: 2,
        by_severity: {
          [ActivitySeverity.LOW]: 1,
          [ActivitySeverity.MEDIUM]: 0,
          [ActivitySeverity.HIGH]: 0,
          [ActivitySeverity.CRITICAL]: 1,
        },
        by_type: {
          [ActivityType.USER_LOGIN]: 1,
          [ActivityType.PERMISSION_DELETED]: 1,
        },
        recent_critical: [
          createMockActivity({
            id: "activity-2",
            severity: ActivitySeverity.CRITICAL,
            activity_type: ActivityType.PERMISSION_DELETED,
          }),
        ],
      };

      mockAuditService.getActivitySummary.mockResolvedValueOnce(mockSummary);

      const { result } = renderHook(() => useActivitySummary(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_activities).toBe(2);
      expect(result.current.data?.by_severity[ActivitySeverity.LOW]).toBe(1);
      expect(result.current.data?.by_severity[ActivitySeverity.CRITICAL]).toBe(1);
    });

    it("should respect days parameter", async () => {
      const mockSummary: ActivitySummary = {
        total_activities: 1,
        by_severity: {},
        by_type: {},
        recent_critical: [],
      };

      mockAuditService.getActivitySummary.mockResolvedValueOnce(mockSummary);

      const { result } = renderHook(() => useActivitySummary(30), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockAuditService.getActivitySummary).toHaveBeenCalledWith(30);
    });
  });

  describe("useResourceHistory", () => {
    it("should fetch resource history", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          resource_type: "subscriber",
          resource_id: "sub-1",
          action: "created",
        }),
        createMockActivity({
          id: "activity-2",
          resource_type: "subscriber",
          resource_id: "sub-1",
          action: "updated",
        }),
      ];

      mockAuditService.getResourceHistory.mockResolvedValueOnce(mockActivities);

      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].resource_id).toBe("sub-1");
      expect(mockAuditService.getResourceHistory).toHaveBeenCalledWith("subscriber", "sub-1");
    });

    it("should return empty array for resource with no history", async () => {
      mockAuditService.getResourceHistory.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-99"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-1", false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(mockAuditService.getResourceHistory).not.toHaveBeenCalled();
    });
  });

  describe("useExportAuditLogs", () => {
    it("should export audit logs successfully", async () => {
      const mockExport = {
        export_id: "export-1",
        status: "completed" as const,
        download_url: "https://example.com/export.csv",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      mockAuditService.exportLogs.mockResolvedValueOnce(mockExport);

      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          filters: {},
          format: "csv",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.export_id).toBeDefined();
      expect(result.current.data?.status).toBe("completed");
      expect(result.current.data?.download_url).toContain(".csv");
    });

    it("should export in different formats", async () => {
      const mockExport = {
        export_id: "export-2",
        status: "completed" as const,
        download_url: "https://example.com/export.json",
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      mockAuditService.exportLogs.mockResolvedValueOnce(mockExport);

      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          filters: {},
          format: "json",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.download_url).toContain(".json");
    });

    it("should handle export error", async () => {
      mockAuditService.exportLogs.mockRejectedValueOnce(new Error("Export failed"));

      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            filters: {},
            format: "csv",
          });
        } catch (error) {
          // Expected to fail
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useComplianceReport", () => {
    it("should fetch compliance report successfully", async () => {
      const mockReport = {
        report_id: "report-1",
        period_start: "2024-01-01",
        period_end: "2024-01-31",
        compliance_score: 95,
        total_events: 1000,
        critical_events: 5,
        generated_at: new Date().toISOString(),
      };

      mockAuditService.getComplianceReport.mockResolvedValueOnce(mockReport);

      const { result } = renderHook(() => useComplianceReport("2024-01-01", "2024-01-31"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.report_id).toBeDefined();
      expect(result.current.data?.period_start).toBe("2024-01-01");
      expect(result.current.data?.period_end).toBe("2024-01-31");
    });

    it("should handle date range validation", async () => {
      const { result } = renderHook(() => useComplianceReport("", ""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(mockAuditService.getComplianceReport).not.toHaveBeenCalled();
    });
  });

  describe("useAuditDashboard", () => {
    it("should fetch dashboard data successfully", async () => {
      const mockSummary: ActivitySummary = {
        total_activities: 2,
        by_severity: {
          [ActivitySeverity.LOW]: 1,
          [ActivitySeverity.CRITICAL]: 1,
        },
        by_type: {},
        recent_critical: [],
      };

      const mockRecentActivities = [
        createMockActivity({ id: "activity-1" }),
        createMockActivity({ id: "activity-2" }),
      ];

      mockAuditService.getActivitySummary.mockResolvedValueOnce(mockSummary);
      mockAuditService.getRecentActivities.mockResolvedValueOnce(mockRecentActivities);

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.summary).toBeDefined();
      expect(result.current.recentActivities).toBeDefined();
    });

    it("should handle empty data", async () => {
      const mockSummary: ActivitySummary = {
        total_activities: 0,
        by_severity: {},
        by_type: {},
        recent_critical: [],
      };

      mockAuditService.getActivitySummary.mockResolvedValueOnce(mockSummary);
      mockAuditService.getRecentActivities.mockResolvedValueOnce([]);

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.summary?.total_activities).toBe(0);
      expect(result.current.recentActivities).toHaveLength(0);
    });
  });

  describe("useMonitorUserActivity", () => {
    it("should monitor user activity", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          user_id: "user-1",
        }),
      ];

      mockAuditService.getUserActivities.mockResolvedValueOnce(mockActivities);

      const { result } = renderHook(() => useMonitorUserActivity("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.activities).toBeDefined();
      expect(result.current.activities).toHaveLength(1);
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useMonitorUserActivity(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.activities).toEqual([]);
      expect(mockAuditService.getUserActivities).not.toHaveBeenCalled();
    });
  });
});
