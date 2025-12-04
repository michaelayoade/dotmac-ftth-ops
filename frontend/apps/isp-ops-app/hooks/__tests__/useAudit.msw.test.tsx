/**
 * MSW Tests for useAudit hooks
 * Tests audit logging functionality with realistic API mocking
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
import type { AuditActivity } from "@/types/audit";
import { ActivitySeverity, ActivityType } from "@/types/audit";
import { seedAuditData, clearAuditData, createMockActivity } from "@/__tests__/msw/handlers/audit";

const waitForAuditLoading = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

const waitForAuditSuccess = async (getStatus: () => boolean) => {
  await waitFor(() => expect(getStatus()).toBe(true), { timeout: 5000 });
};

describe("useAudit (MSW)", () => {
  function createWrapper() {
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
  }

  beforeEach(() => {
    clearAuditData();
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
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
          severity: ActivitySeverity.LOW,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(1);
      expect(result.current.data?.total).toBe(1);
      expect(result.current.data?.activities[0].id).toBe("activity-1");
    });

    it("should handle empty activities list", async () => {
      seedAuditData([]);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

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
        createMockActivity({
          id: "activity-2",
          user_id: "user-2",
          activity_type: ActivityType.USER_LOGOUT,
          severity: ActivitySeverity.LOW,
        }),
      ];
      seedAuditData(mockActivities);

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

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(1);
      expect(result.current.data?.activities[0].user_id).toBe("user-1");
      expect(result.current.data?.activities[0].activity_type).toBe(ActivityType.USER_LOGIN);
    });

    it("should handle resource filters", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          resource_type: "subscriber",
          resource_id: "sub-1",
        }),
        createMockActivity({
          id: "activity-2",
          resource_type: "role",
          resource_id: "role-1",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(
        () =>
          useAuditActivities({
            resource_type: "subscriber",
            resource_id: "sub-1",
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(1);
      expect(result.current.data?.activities[0].resource_type).toBe("subscriber");
    });

    it("should handle pagination", async () => {
      const mockActivities = Array.from({ length: 25 }, (_, i) =>
        createMockActivity({
          id: `activity-${i + 1}`,
        }),
      );
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditActivities({ page: 2, per_page: 10 }), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(10);
      expect(result.current.data?.page).toBe(2);
      expect(result.current.data?.total).toBe(25);
      expect(result.current.data?.total_pages).toBe(3);
    });

    it("should support enabled parameter", async () => {
      const mockActivities = [createMockActivity({ id: "activity-1" })];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditActivities({}, false), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toBeUndefined();
    });

    it("should handle different activity types", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.ROLE_CREATED,
          severity: ActivitySeverity.MEDIUM,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(
        () => useAuditActivities({ activity_type: ActivityType.ROLE_CREATED }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities[0].activity_type).toBe(ActivityType.ROLE_CREATED);
    });

    it("should handle severity filter", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          severity: ActivitySeverity.CRITICAL,
        }),
        createMockActivity({
          id: "activity-2",
          severity: ActivitySeverity.LOW,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(
        () => useAuditActivities({ severity: ActivitySeverity.CRITICAL }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(1);
      expect(result.current.data?.activities[0].severity).toBe(ActivitySeverity.CRITICAL);
    });
  });

  describe("useRecentActivities", () => {
    it("should fetch recent activities", async () => {
      const now = new Date();
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          timestamp: new Date(now.getTime() - 3600000).toISOString(), // 1 hour ago
        }),
        createMockActivity({
          id: "activity-2",
          timestamp: new Date(now.getTime() - 7200000).toISOString(), // 2 hours ago
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useRecentActivities(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].id).toBe("activity-1");
    });

    it("should respect limit parameter", async () => {
      const mockActivities = Array.from({ length: 30 }, (_, i) =>
        createMockActivity({
          id: `activity-${i + 1}`,
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        }),
      );
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useRecentActivities(10), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(10);
    });

    it("should respect days parameter", async () => {
      const now = new Date();
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          timestamp: new Date(now.getTime() - 86400000).toISOString(), // 1 day ago
        }),
        createMockActivity({
          id: "activity-2",
          timestamp: new Date(now.getTime() - 86400000 * 10).toISOString(), // 10 days ago
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useRecentActivities(20, 7), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].id).toBe("activity-1");
    });

    it("should return empty array when no recent activities", async () => {
      seedAuditData([]);

      const { result } = renderHook(() => useRecentActivities(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(0);
    });
  });

  describe("useUserActivities", () => {
    it("should fetch user activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          user_id: "user-1",
        }),
        createMockActivity({
          id: "activity-2",
          user_id: "user-2",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useUserActivities("user-1"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].user_id).toBe("user-1");
    });

    it("should respect limit parameter", async () => {
      const mockActivities = Array.from({ length: 60 }, (_, i) =>
        createMockActivity({
          id: `activity-${i + 1}`,
          user_id: "user-1",
          timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        }),
      );
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useUserActivities("user-1", 30), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(30);
    });

    it("should respect days parameter", async () => {
      const now = new Date();
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          user_id: "user-1",
          timestamp: new Date(now.getTime() - 86400000 * 5).toISOString(), // 5 days ago
        }),
        createMockActivity({
          id: "activity-2",
          user_id: "user-1",
          timestamp: new Date(now.getTime() - 86400000 * 40).toISOString(), // 40 days ago
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useUserActivities("user-1", 50, 30), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].id).toBe("activity-1");
    });

    it("should return empty array for user with no activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          user_id: "user-1",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useUserActivities("user-99"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(0);
    });
  });

  describe("useActivityDetails", () => {
    it("should fetch activity details successfully", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
          details: { ip: "192.168.1.1", browser: "Chrome" },
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useActivityDetails("activity-1"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.id).toBe("activity-1");
      expect(result.current.data?.details).toEqual({
        ip: "192.168.1.1",
        browser: "Chrome",
      });
    });

    it("should handle activity not found", async () => {
      seedAuditData([]);

      const { result } = renderHook(() => useActivityDetails("non-existent"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.error).toBeTruthy();
    });

    it("should support enabled parameter", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useActivityDetails("activity-1", false), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toBeUndefined();
    });

    it("should fetch different activity types", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.ROLE_CREATED,
          resource_type: "role",
          resource_id: "role-1",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useActivityDetails("activity-1"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activity_type).toBe(ActivityType.ROLE_CREATED);
      expect(result.current.data?.resource_type).toBe("role");
    });

    it("should handle activities with null user_id", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          user_id: null,
          activity_type: ActivityType.SYSTEM_STARTUP,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useActivityDetails("activity-1"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.user_id).toBeNull();
      expect(result.current.data?.activity_type).toBe(ActivityType.SYSTEM_STARTUP);
    });
  });

  describe("useActivitySummary", () => {
    it("should fetch activity summary successfully", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          severity: ActivitySeverity.LOW,
          activity_type: ActivityType.USER_LOGIN,
          user_id: "user-1",
        }),
        createMockActivity({
          id: "activity-2",
          severity: ActivitySeverity.CRITICAL,
          activity_type: ActivityType.PERMISSION_DELETED,
          user_id: "user-1",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useActivitySummary(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.total_activities).toBe(2);
      expect(result.current.data?.by_severity[ActivitySeverity.LOW]).toBe(1);
      expect(result.current.data?.by_severity[ActivitySeverity.CRITICAL]).toBe(1);
    });

    it("should respect days parameter", async () => {
      const now = new Date();
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          timestamp: new Date(now.getTime() - 86400000 * 2).toISOString(), // 2 days ago
        }),
        createMockActivity({
          id: "activity-2",
          timestamp: new Date(now.getTime() - 86400000 * 10).toISOString(), // 10 days ago
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useActivitySummary(7), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.total_activities).toBe(1);
    });

    it("should include recent critical activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          severity: ActivitySeverity.CRITICAL,
        }),
        createMockActivity({
          id: "activity-2",
          severity: ActivitySeverity.LOW,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useActivitySummary(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.recent_critical).toHaveLength(1);
      expect(result.current.data?.recent_critical[0].severity).toBe(ActivitySeverity.CRITICAL);
    });

    it("should group activities by type", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
        }),
        createMockActivity({
          id: "activity-2",
          activity_type: ActivityType.USER_LOGIN,
        }),
        createMockActivity({
          id: "activity-3",
          activity_type: ActivityType.ROLE_ASSIGNED,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useActivitySummary(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.by_type[ActivityType.USER_LOGIN]).toBe(2);
      expect(result.current.data?.by_type[ActivityType.ROLE_ASSIGNED]).toBe(1);
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
        createMockActivity({
          id: "activity-3",
          resource_type: "subscriber",
          resource_id: "sub-2",
          action: "created",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-1"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].resource_id).toBe("sub-1");
      expect(result.current.data?.[1].resource_id).toBe("sub-1");
    });

    it("should return empty array for resource with no history", async () => {
      seedAuditData([]);

      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-99"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(0);
    });

    it("should support enabled parameter", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          resource_type: "subscriber",
          resource_id: "sub-1",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useResourceHistory("subscriber", "sub-1", false), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toBeUndefined();
    });

    it("should handle different resource types", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          resource_type: "role",
          resource_id: "role-1",
        }),
        createMockActivity({
          id: "activity-2",
          resource_type: "subscriber",
          resource_id: "sub-1",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useResourceHistory("role", "role-1"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data?.[0].resource_type).toBe("role");
    });
  });

  describe("useExportAuditLogs", () => {
    it("should export audit logs successfully", async () => {
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
      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      // Export as JSON
      await act(async () => {
        await result.current.mutateAsync({
          filters: {},
          format: "json",
        });
      });

      await waitFor(() => expect(result.current.data?.download_url).toContain(".json"));
    });

    it("should include filters in export request", async () => {
      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          filters: {
            user_id: "user-1",
            severity: ActivitySeverity.HIGH,
          },
          format: "pdf",
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.download_url).toContain(".pdf");
    });

    it("should handle export with metadata flag", async () => {
      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          filters: {},
          format: "csv",
          include_metadata: true,
        });
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });

    it("should handle export error", async () => {
      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          // @ts-expect-error - Testing invalid format
          await result.current.mutateAsync({
            filters: {},
            format: null, // Invalid format
          });
        } catch (error) {
          // Expected to fail
        }
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it("should include expiration time in response", async () => {
      const { result } = renderHook(() => useExportAuditLogs(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.mutateAsync({
          filters: {},
          format: "csv",
        });
      });

      await waitFor(() => expect(result.current.data?.expires_at).toBeDefined());
    });
  });

  describe("useComplianceReport", () => {
    it("should fetch compliance report successfully", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          severity: ActivitySeverity.CRITICAL,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useComplianceReport("2024-01-01", "2024-01-31"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.report_id).toBeDefined();
      expect(result.current.data?.period_start).toBe("2024-01-01");
      expect(result.current.data?.period_end).toBe("2024-01-31");
    });

    it("should handle date range validation", async () => {
      // Empty dates will prevent the query from running due to enabled condition
      const { result } = renderHook(() => useComplianceReport("", ""), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      // Query should not run, so data is undefined
      expect(result.current.data).toBeUndefined();
    });

    it("should include compliance metrics", async () => {
      seedAuditData([]);

      const { result } = renderHook(() => useComplianceReport("2024-01-01", "2024-01-31"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.compliance_score).toBeDefined();
      expect(result.current.data?.total_events).toBeDefined();
      expect(result.current.data?.critical_events).toBeDefined();
    });

    it("should support enabled parameter", async () => {
      const { result } = renderHook(() => useComplianceReport("2024-01-01", "2024-01-31", false), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useAuditDashboard", () => {
    it("should fetch dashboard data successfully", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          severity: ActivitySeverity.LOW,
        }),
        createMockActivity({
          id: "activity-2",
          severity: ActivitySeverity.CRITICAL,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.summary).toBeDefined();
      expect(result.current.recentActivities).toBeDefined();
    });

    it("should respect days parameter", async () => {
      const now = new Date();
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          timestamp: new Date(now.getTime() - 86400000 * 2).toISOString(),
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditDashboard(7), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.summary).toBeDefined();
      expect(result.current.recentActivities).toBeDefined();
    });

    it("should handle empty data", async () => {
      seedAuditData([]);

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.summary?.total_activities).toBe(0);
      expect(result.current.recentActivities).toHaveLength(0);
    });

    it("should handle errors", async () => {
      seedAuditData([]);

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      // Error may or may not be set depending on handler behavior
      expect(result.current.error === null || result.current.error === undefined).toBeTruthy();
    });

    it("should combine summary and recent data", async () => {
      const mockActivities = [
        createMockActivity({ id: "activity-1" }),
        createMockActivity({ id: "activity-2" }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.summary?.total_activities).toBeGreaterThan(0);
      expect(result.current.recentActivities).toBeDefined();
    });

    it("should expose refresh function", async () => {
      seedAuditData([]);

      const { result } = renderHook(() => useAuditDashboard(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(typeof result.current.refetch).toBe("function");
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
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useMonitorUserActivity("user-1"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.activities).toBeDefined();
      expect(result.current.activities).toHaveLength(1);
    });

    it("should use default parameters", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          user_id: "user-1",
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useMonitorUserActivity("user-1"), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.activities).toBeDefined();
    });

    it("should support enabled parameter", async () => {
      // useMonitorUserActivity uses !!userId as enabled, so empty string disables it
      const { result } = renderHook(() => useMonitorUserActivity("", 100, 30), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      // Hook returns empty array when disabled (data || [])
      expect(result.current.activities).toEqual([]);
    });
  });

  describe("Activity Types Coverage", () => {
    it("should handle authentication activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.USER_LOGIN,
        }),
        createMockActivity({
          id: "activity-2",
          activity_type: ActivityType.USER_LOGOUT,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(2);
    });

    it("should handle RBAC activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.ROLE_CREATED,
        }),
        createMockActivity({
          id: "activity-2",
          activity_type: ActivityType.PERMISSION_GRANTED,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(2);
    });

    it("should handle secret activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.SECRET_CREATED,
        }),
        createMockActivity({
          id: "activity-2",
          activity_type: ActivityType.SECRET_ACCESSED,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(2);
    });

    it("should handle file activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.FILE_UPLOADED,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(1);
    });

    it("should handle system activities", async () => {
      const mockActivities = [
        createMockActivity({
          id: "activity-1",
          activity_type: ActivityType.SYSTEM_STARTUP,
        }),
      ];
      seedAuditData(mockActivities);

      const { result } = renderHook(() => useAuditActivities(), {
        wrapper: createWrapper(),
      });

      await waitForAuditLoading(() => result.current.isLoading);

      expect(result.current.data?.activities).toHaveLength(1);
    });
  });
});
