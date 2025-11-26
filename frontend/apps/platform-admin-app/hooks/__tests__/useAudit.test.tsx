/**
 * Tests for useAudit hooks
 * Tests audit logging functionality with TanStack Query
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
import { auditService } from "@/lib/services/audit-service";
import type { AuditActivity, AuditActivityList, ActivitySummary } from "@/types/audit";
import type { AuditExportResponse, ComplianceReport } from "@/lib/services/audit-service";
import { ActivitySeverity, ActivityType } from "@/types/audit";

// Mock dependencies
jest.mock("@/lib/services/audit-service");
jest.mock("@/lib/logger");

describe("useAudit", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

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

  // ==================== Activity Operations ====================

  describe("useAuditActivities", () => {
    it("should fetch audit activities successfully", async () => {
      const mockActivities: AuditActivityList = {
        activities: [
          {
            id: "activity-1",
            activity_type: ActivityType.USER_LOGIN,
            severity: ActivitySeverity.LOW,
            user_id: "user-1",
            tenant_id: "tenant-1",
            timestamp: "2024-01-01T00:00:00Z",
            resource_type: null,
            resource_id: null,
            action: "login",
            description: "User logged in",
            details: { ip: "192.168.1.1" },
            ip_address: "192.168.1.1",
            user_agent: "Mozilla/5.0",
            request_id: "req-1",
          },
        ],
        total: 1,
        page: 1,
        per_page: 20,
        total_pages: 1,
      };

      (auditService.listActivities as jest.Mock).mockResolvedValue(mockActivities);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockActivities);
      expect(result.current.data?.activities).toHaveLength(1);
      expect(auditService.listActivities).toHaveBeenCalledWith({});
    });

    it("should handle filter parameters", async () => {
      const mockActivities: AuditActivityList = {
        activities: [],
        total: 0,
        page: 1,
        per_page: 20,
        total_pages: 0,
      };

      (auditService.listActivities as jest.Mock).mockResolvedValue(mockActivities);

      renderHook(
        () =>
          useAuditActivities({
            user_id: "user-1",
            activity_type: ActivityType.USER_LOGIN,
            severity: ActivitySeverity.HIGH,
            resource_type: "subscriber",
            resource_id: "sub-1",
            days: 30,
            page: 2,
            per_page: 50,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => {
        expect(auditService.listActivities).toHaveBeenCalledWith({
          user_id: "user-1",
          activity_type: ActivityType.USER_LOGIN,
          severity: ActivitySeverity.HIGH,
          resource_type: "subscriber",
          resource_id: "sub-1",
          days: 30,
          page: 2,
          per_page: 50,
        });
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch activities");
      (auditService.listActivities as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useAuditActivities({}, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(auditService.listActivities).not.toHaveBeenCalled();
    });

    it("should handle different activity types", async () => {
      const mockActivities: AuditActivityList = {
        activities: [
          {
            id: "activity-1",
            activity_type: ActivityType.ROLE_CREATED,
            severity: ActivitySeverity.MEDIUM,
            user_id: "user-1",
            tenant_id: "tenant-1",
            timestamp: "2024-01-01T00:00:00Z",
            resource_type: "role",
            resource_id: "role-1",
            action: "created",
            description: "Role created",
            details: { role_name: "Admin" },
            ip_address: "192.168.1.1",
            user_agent: "Mozilla/5.0",
            request_id: "req-1",
          },
        ],
        total: 1,
        page: 1,
        per_page: 20,
        total_pages: 1,
      };

      (auditService.listActivities as jest.Mock).mockResolvedValue(mockActivities);

      const { result } = renderHook(
        () => useAuditActivities({ activity_type: ActivityType.ROLE_CREATED }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.activities[0].activity_type).toBe(ActivityType.ROLE_CREATED);
    });
  });

  describe("useRecentActivities", () => {
    it("should fetch recent activities successfully", async () => {
      const mockActivities: AuditActivity[] = [
        {
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
          severity: ActivitySeverity.LOW,
          user_id: "user-1",
          tenant_id: "tenant-1",
          timestamp: "2024-01-01T00:00:00Z",
          resource_type: null,
          resource_id: null,
          action: "login",
          description: "User logged in",
          details: null,
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0",
          request_id: "req-1",
        },
      ];

      (auditService.getRecentActivities as jest.Mock).mockResolvedValue(mockActivities);

      const { result } = renderHook(() => useRecentActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockActivities);
      expect(auditService.getRecentActivities).toHaveBeenCalledWith(20, 7);
    });

    it("should handle custom limit and days", async () => {
      (auditService.getRecentActivities as jest.Mock).mockResolvedValue([]);

      renderHook(() => useRecentActivities(50, 30), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(auditService.getRecentActivities).toHaveBeenCalledWith(50, 30);
      });
    });

    it("should auto-refresh with refetchInterval", async () => {
      const mockActivities: AuditActivity[] = [];
      (auditService.getRecentActivities as jest.Mock).mockResolvedValue(mockActivities);

      const { result } = renderHook(() => useRecentActivities(20, 7, true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockActivities);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch recent activities");
      (auditService.getRecentActivities as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useRecentActivities(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useRecentActivities(20, 7, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(auditService.getRecentActivities).not.toHaveBeenCalled();
    });
  });

  describe("useUserActivities", () => {
    it("should fetch user activities successfully", async () => {
      const mockActivities: AuditActivity[] = [
        {
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
          severity: ActivitySeverity.LOW,
          user_id: "user-1",
          tenant_id: "tenant-1",
          timestamp: "2024-01-01T00:00:00Z",
          resource_type: null,
          resource_id: null,
          action: "login",
          description: "User logged in",
          details: null,
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0",
          request_id: "req-1",
        },
      ];

      (auditService.getUserActivities as jest.Mock).mockResolvedValue(mockActivities);

      const { result } = renderHook(() => useUserActivities("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockActivities);
      expect(auditService.getUserActivities).toHaveBeenCalledWith("user-1", 50, 30);
    });

    it("should not fetch when userId is empty", async () => {
      const { result } = renderHook(() => useUserActivities(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(auditService.getUserActivities).not.toHaveBeenCalled();
    });

    it("should handle custom limit and days", async () => {
      (auditService.getUserActivities as jest.Mock).mockResolvedValue([]);

      renderHook(() => useUserActivities("user-1", 100, 60), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(auditService.getUserActivities).toHaveBeenCalledWith("user-1", 100, 60);
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch user activities");
      (auditService.getUserActivities as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useUserActivities("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useUserActivities("user-1", 50, 30, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(auditService.getUserActivities).not.toHaveBeenCalled();
    });
  });

  describe("useActivityDetails", () => {
    it("should fetch activity details successfully", async () => {
      const mockActivity: AuditActivity = {
        id: "activity-1",
        activity_type: ActivityType.USER_LOGIN,
        severity: ActivitySeverity.LOW,
        user_id: "user-1",
        tenant_id: "tenant-1",
        timestamp: "2024-01-01T00:00:00Z",
        resource_type: null,
        resource_id: null,
        action: "login",
        description: "User logged in",
        details: { ip: "192.168.1.1" },
        ip_address: "192.168.1.1",
        user_agent: "Mozilla/5.0",
        request_id: "req-1",
      };

      (auditService.getActivity as jest.Mock).mockResolvedValue(mockActivity);

      const { result } = renderHook(() => useActivityDetails("activity-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockActivity);
      expect(auditService.getActivity).toHaveBeenCalledWith("activity-1");
    });

    it("should not fetch when activityId is empty", async () => {
      const { result } = renderHook(() => useActivityDetails(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(auditService.getActivity).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Activity not found");
      (auditService.getActivity as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useActivityDetails("activity-1"), {
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

      expect(auditService.getActivity).not.toHaveBeenCalled();
    });

    it("should handle activity with all severity levels", async () => {
      const severities: ActivitySeverity[] = [
        ActivitySeverity.LOW,
        ActivitySeverity.MEDIUM,
        ActivitySeverity.HIGH,
        ActivitySeverity.CRITICAL,
      ];

      for (const severity of severities) {
        const mockActivity: AuditActivity = {
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
          severity,
          user_id: "user-1",
          tenant_id: "tenant-1",
          timestamp: "2024-01-01T00:00:00Z",
          resource_type: null,
          resource_id: null,
          action: "login",
          description: "User logged in",
          details: null,
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0",
          request_id: "req-1",
        };

        (auditService.getActivity as jest.Mock).mockResolvedValue(mockActivity);

        const { result } = renderHook(() => useActivityDetails("activity-1"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.severity).toBe(severity);

        jest.clearAllMocks();
      }
    });
  });

  // ==================== Statistics & Summaries ====================

  describe("useActivitySummary", () => {
    it("should fetch activity summary successfully", async () => {
      const mockSummary: ActivitySummary = {
        total_activities: 100,
        by_severity: {
          [ActivitySeverity.LOW]: 50,
          [ActivitySeverity.MEDIUM]: 30,
          [ActivitySeverity.HIGH]: 15,
          [ActivitySeverity.CRITICAL]: 5,
        },
        by_type: {
          [ActivityType.USER_LOGIN]: 40,
          [ActivityType.USER_LOGOUT]: 30,
          [ActivityType.ROLE_CREATED]: 10,
        },
        by_user: [
          { user_id: "user-1", count: 50 },
          { user_id: "user-2", count: 30 },
        ],
        recent_critical: [],
        timeline: [
          { date: "2024-01-01", count: 20 },
          { date: "2024-01-02", count: 30 },
        ],
      };

      (auditService.getActivitySummary as jest.Mock).mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useActivitySummary(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockSummary);
      expect(auditService.getActivitySummary).toHaveBeenCalledWith(7);
    });

    it("should handle custom days parameter", async () => {
      const mockSummary: ActivitySummary = {
        total_activities: 200,
        by_severity: {
          [ActivitySeverity.LOW]: 100,
          [ActivitySeverity.MEDIUM]: 60,
          [ActivitySeverity.HIGH]: 30,
          [ActivitySeverity.CRITICAL]: 10,
        },
        by_type: {},
        by_user: [],
        recent_critical: [],
        timeline: [],
      };

      (auditService.getActivitySummary as jest.Mock).mockResolvedValue(mockSummary);

      renderHook(() => useActivitySummary(30), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(auditService.getActivitySummary).toHaveBeenCalledWith(30);
      });
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch summary");
      (auditService.getActivitySummary as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useActivitySummary(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useActivitySummary(7, false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(auditService.getActivitySummary).not.toHaveBeenCalled();
    });
  });

  describe("useResourceHistory", () => {
    it("should fetch resource history successfully", async () => {
      const mockActivities: AuditActivity[] = [
        {
          id: "activity-1",
          activity_type: ActivityType.CUSTOMER_STATUS_CHANGE,
          severity: ActivitySeverity.MEDIUM,
          user_id: "user-1",
          tenant_id: "tenant-1",
          timestamp: "2024-01-01T00:00:00Z",
          resource_type: "subscriber",
          resource_id: "sub-1",
          action: "status_change",
          description: "Subscriber status changed",
          details: { old_status: "active", new_status: "suspended" },
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0",
          request_id: "req-1",
        },
      ];

      (auditService.getResourceHistory as jest.Mock).mockResolvedValue(mockActivities);

      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockActivities);
      expect(auditService.getResourceHistory).toHaveBeenCalledWith("subscriber", "sub-1");
    });

    it("should not fetch when resourceType or resourceId is empty", async () => {
      const { result: result1 } = renderHook(() => useResourceHistory("", "sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result1.current.isLoading).toBe(false));
      expect(result1.current.data).toBeUndefined();

      const { result: result2 } = renderHook(() => useResourceHistory("subscriber", ""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result2.current.isLoading).toBe(false));
      expect(result2.current.data).toBeUndefined();

      expect(auditService.getResourceHistory).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch resource history");
      (auditService.getResourceHistory as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-1", false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(auditService.getResourceHistory).not.toHaveBeenCalled();
    });
  });

  // ==================== Compliance & Export ====================

  describe("useExportAuditLogs", () => {
    it("should export audit logs successfully", async () => {
      const mockResponse: AuditExportResponse = {
        export_id: "export-1",
        status: "pending",
        download_url: "https://example.com/download/export-1",
        expires_at: "2024-01-02T00:00:00Z",
      };

      (auditService.exportLogs as jest.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const response = await result.current.mutateAsync({
          filters: { days: 30 },
          format: "csv",
          include_metadata: true,
        });
        expect(response).toEqual(mockResponse);
      });

      expect(auditService.exportLogs).toHaveBeenCalledWith({
        filters: { days: 30 },
        format: "csv",
        include_metadata: true,
      });
    });

    it("should call onSuccess callback", async () => {
      const mockResponse: AuditExportResponse = {
        export_id: "export-1",
        status: "completed",
        download_url: "https://example.com/download/export-1",
        expires_at: "2024-01-02T00:00:00Z",
      };

      (auditService.exportLogs as jest.Mock).mockResolvedValue(mockResponse);

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useExportAuditLogs({ onSuccess }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          filters: {},
          format: "json",
        });
      });

      expect(onSuccess).toHaveBeenCalledWith(mockResponse);
    });

    it("should call onError callback", async () => {
      const error = new Error("Export failed");
      (auditService.exportLogs as jest.Mock).mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useExportAuditLogs({ onError }), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync({
            filters: {},
            format: "pdf",
          });
        } catch (err) {
          // Expected
        }
      });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should support different export formats", async () => {
      const formats: Array<"csv" | "json" | "pdf"> = ["csv", "json", "pdf"];

      for (const format of formats) {
        const mockResponse: AuditExportResponse = {
          export_id: `export-${format}`,
          status: "pending",
        };

        (auditService.exportLogs as jest.Mock).mockResolvedValue(mockResponse);

        const { result } = renderHook(() => useExportAuditLogs(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.mutateAsync({
            filters: {},
            format,
          });
        });

        expect(auditService.exportLogs).toHaveBeenCalledWith({
          filters: {},
          format,
        });

        jest.clearAllMocks();
      }
    });
  });

  describe("useComplianceReport", () => {
    it("should fetch compliance report successfully", async () => {
      const mockReport: ComplianceReport = {
        report_id: "report-1",
        period_start: "2024-01-01T00:00:00Z",
        period_end: "2024-01-31T23:59:59Z",
        total_events: 1000,
        critical_events: 10,
        failed_access_attempts: 5,
        permission_changes: 20,
        data_exports: 3,
        compliance_score: 95,
        issues: [
          {
            severity: ActivitySeverity.HIGH,
            description: "Multiple failed login attempts",
            event_ids: ["event-1", "event-2"],
          },
        ],
        generated_at: "2024-02-01T00:00:00Z",
      };

      (auditService.getComplianceReport as jest.Mock).mockResolvedValue(mockReport);

      const { result } = renderHook(() => useComplianceReport("2024-01-01", "2024-01-31"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockReport);
      expect(auditService.getComplianceReport).toHaveBeenCalledWith("2024-01-01", "2024-01-31");
    });

    it("should not fetch when dates are empty", async () => {
      const { result: result1 } = renderHook(() => useComplianceReport("", "2024-01-31"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result1.current.isLoading).toBe(false));
      expect(result1.current.data).toBeUndefined();

      const { result: result2 } = renderHook(() => useComplianceReport("2024-01-01", ""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result2.current.isLoading).toBe(false));
      expect(result2.current.data).toBeUndefined();

      expect(auditService.getComplianceReport).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to generate report");
      (auditService.getComplianceReport as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useComplianceReport("2024-01-01", "2024-01-31"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useComplianceReport("2024-01-01", "2024-01-31", false), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(auditService.getComplianceReport).not.toHaveBeenCalled();
    });
  });

  // ==================== Composite Hooks ====================

  describe("useAuditDashboard", () => {
    it("should fetch dashboard data successfully", async () => {
      const mockActivities: AuditActivity[] = [
        {
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
          severity: ActivitySeverity.LOW,
          user_id: "user-1",
          tenant_id: "tenant-1",
          timestamp: "2024-01-01T00:00:00Z",
          resource_type: null,
          resource_id: null,
          action: "login",
          description: "User logged in",
          details: null,
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0",
          request_id: "req-1",
        },
      ];

      const mockSummary: ActivitySummary = {
        total_activities: 100,
        by_severity: {
          [ActivitySeverity.LOW]: 50,
          [ActivitySeverity.MEDIUM]: 30,
          [ActivitySeverity.HIGH]: 15,
          [ActivitySeverity.CRITICAL]: 5,
        },
        by_type: {},
        by_user: [],
        recent_critical: [],
        timeline: [],
      };

      (auditService.getRecentActivities as jest.Mock).mockResolvedValue(mockActivities);
      (auditService.getActivitySummary as jest.Mock).mockResolvedValue(mockSummary);

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.recentActivities).toEqual(mockActivities);
      expect(result.current.summary).toEqual(mockSummary);
      expect(auditService.getRecentActivities).toHaveBeenCalledWith(10, 7);
      expect(auditService.getActivitySummary).toHaveBeenCalledWith(7);
    });

    it("should handle custom days parameter", async () => {
      (auditService.getRecentActivities as jest.Mock).mockResolvedValue([]);
      (auditService.getActivitySummary as jest.Mock).mockResolvedValue({
        total_activities: 0,
        by_severity: {
          [ActivitySeverity.LOW]: 0,
          [ActivitySeverity.MEDIUM]: 0,
          [ActivitySeverity.HIGH]: 0,
          [ActivitySeverity.CRITICAL]: 0,
        },
        by_type: {},
        by_user: [],
        recent_critical: [],
        timeline: [],
      });

      renderHook(() => useAuditDashboard(30), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(auditService.getRecentActivities).toHaveBeenCalledWith(10, 30);
        expect(auditService.getActivitySummary).toHaveBeenCalledWith(30);
      });
    });

    it("should handle loading state", async () => {
      (auditService.getRecentActivities as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
      );
      (auditService.getActivitySummary as jest.Mock).mockResolvedValue({
        total_activities: 0,
        by_severity: {
          [ActivitySeverity.LOW]: 0,
          [ActivitySeverity.MEDIUM]: 0,
          [ActivitySeverity.HIGH]: 0,
          [ActivitySeverity.CRITICAL]: 0,
        },
        by_type: {},
        by_user: [],
        recent_critical: [],
        timeline: [],
      });

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });

    it("should handle errors", async () => {
      const error = new Error("Activities failed");
      (auditService.getRecentActivities as jest.Mock).mockRejectedValue(error);
      (auditService.getActivitySummary as jest.Mock).mockResolvedValue({
        total_activities: 0,
        by_severity: {
          [ActivitySeverity.LOW]: 0,
          [ActivitySeverity.MEDIUM]: 0,
          [ActivitySeverity.HIGH]: 0,
          [ActivitySeverity.CRITICAL]: 0,
        },
        by_type: {},
        by_user: [],
        recent_critical: [],
        timeline: [],
      });

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should expose refetch function", async () => {
      (auditService.getRecentActivities as jest.Mock).mockResolvedValue([]);
      (auditService.getActivitySummary as jest.Mock).mockResolvedValue({
        total_activities: 0,
        by_severity: {
          [ActivitySeverity.LOW]: 0,
          [ActivitySeverity.MEDIUM]: 0,
          [ActivitySeverity.HIGH]: 0,
          [ActivitySeverity.CRITICAL]: 0,
        },
        by_type: {},
        by_user: [],
        recent_critical: [],
        timeline: [],
      });

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Clear previous calls
      (auditService.getRecentActivities as jest.Mock).mockClear();
      (auditService.getActivitySummary as jest.Mock).mockClear();

      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(auditService.getRecentActivities).toHaveBeenCalled();
        expect(auditService.getActivitySummary).toHaveBeenCalled();
      });
    });
  });

  describe("useMonitorUserActivity", () => {
    it("should monitor user activity successfully", async () => {
      const mockActivities: AuditActivity[] = [
        {
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
          severity: ActivitySeverity.LOW,
          user_id: "user-1",
          tenant_id: "tenant-1",
          timestamp: "2024-01-01T00:00:00Z",
          resource_type: null,
          resource_id: null,
          action: "login",
          description: "User logged in",
          details: null,
          ip_address: "192.168.1.1",
          user_agent: "Mozilla/5.0",
          request_id: "req-1",
        },
      ];

      (auditService.getUserActivities as jest.Mock).mockResolvedValue(mockActivities);

      const { result } = renderHook(() => useMonitorUserActivity("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.activities).toEqual(mockActivities);
      expect(auditService.getUserActivities).toHaveBeenCalledWith("user-1", 50, 1);
    });

    it("should handle custom days parameter", async () => {
      (auditService.getUserActivities as jest.Mock).mockResolvedValue([]);

      renderHook(() => useMonitorUserActivity("user-1", 7), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(auditService.getUserActivities).toHaveBeenCalledWith("user-1", 50, 7);
      });
    });

    it("should not fetch when userId is empty", async () => {
      const { result } = renderHook(() => useMonitorUserActivity(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.activities).toEqual([]);
      expect(auditService.getUserActivities).not.toHaveBeenCalled();
    });

    it("should handle errors", async () => {
      const error = new Error("Monitoring failed");
      (auditService.getUserActivities as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useMonitorUserActivity("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });

    it("should expose refetch function", async () => {
      (auditService.getUserActivities as jest.Mock).mockResolvedValue([]);

      const { result } = renderHook(() => useMonitorUserActivity("user-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Clear previous calls
      (auditService.getUserActivities as jest.Mock).mockClear();

      await act(async () => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(auditService.getUserActivities).toHaveBeenCalled();
      });
    });
  });

  // ==================== All Activity Types Coverage ====================

  describe("Activity Types Coverage", () => {
    it("should handle all activity types", async () => {
      const activityTypes = [
        ActivityType.USER_LOGIN,
        ActivityType.USER_LOGOUT,
        ActivityType.USER_CREATED,
        ActivityType.USER_UPDATED,
        ActivityType.USER_DELETED,
        ActivityType.USER_IMPERSONATION,
        ActivityType.PASSWORD_RESET_ADMIN,
        ActivityType.ROLE_CREATED,
        ActivityType.ROLE_UPDATED,
        ActivityType.ROLE_DELETED,
        ActivityType.ROLE_ASSIGNED,
        ActivityType.ROLE_REVOKED,
        ActivityType.PERMISSION_GRANTED,
        ActivityType.PERMISSION_REVOKED,
        ActivityType.PERMISSION_CREATED,
        ActivityType.PERMISSION_UPDATED,
        ActivityType.PERMISSION_DELETED,
        ActivityType.SECRET_CREATED,
        ActivityType.SECRET_ACCESSED,
        ActivityType.SECRET_UPDATED,
        ActivityType.SECRET_DELETED,
        ActivityType.FILE_UPLOADED,
        ActivityType.FILE_DOWNLOADED,
        ActivityType.FILE_DELETED,
        ActivityType.CUSTOMER_STATUS_CHANGE,
        ActivityType.API_REQUEST,
        ActivityType.API_ERROR,
        ActivityType.SYSTEM_STARTUP,
        ActivityType.SYSTEM_SHUTDOWN,
        ActivityType.FRONTEND_LOG,
      ];

      for (const activityType of activityTypes) {
        const mockActivities: AuditActivityList = {
          activities: [
            {
              id: "activity-1",
              activity_type: activityType,
              severity: ActivitySeverity.LOW,
              user_id: "user-1",
              tenant_id: "tenant-1",
              timestamp: "2024-01-01T00:00:00Z",
              resource_type: null,
              resource_id: null,
              action: "test",
              description: "Test activity",
              details: null,
              ip_address: "192.168.1.1",
              user_agent: "Mozilla/5.0",
              request_id: "req-1",
            },
          ],
          total: 1,
          page: 1,
          per_page: 20,
          total_pages: 1,
        };

        (auditService.listActivities as jest.Mock).mockResolvedValue(mockActivities);

        const { result } = renderHook(() => useAuditActivities({ activity_type: activityType }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.activities[0].activity_type).toBe(activityType);

        jest.clearAllMocks();
      }
    });
  });
});
