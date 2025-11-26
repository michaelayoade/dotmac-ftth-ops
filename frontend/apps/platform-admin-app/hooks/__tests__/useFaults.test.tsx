/**
 * Tests for useFaults hooks
 * Tests fault management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useAlarms,
  useAlarmStatistics,
  useSLACompliance,
  useSLARollupStats,
  useAlarmDetails,
  useAlarmOperations,
  faultsKeys,
  Alarm,
  AlarmStatistics,
  SLACompliance,
  SLARollupStats,
  AlarmSeverity,
  AlarmStatus,
  AlarmSource,
  AlarmQueryParams,
} from "../useFaults";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useFaults", () => {
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

  describe("faultsKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(faultsKeys.all).toEqual(["faults"]);
      expect(faultsKeys.alarms()).toEqual(["faults", "alarms", undefined]);
      expect(faultsKeys.alarms({ severity: ["critical"] })).toEqual([
        "faults",
        "alarms",
        { severity: ["critical"] },
      ]);
      expect(faultsKeys.statistics()).toEqual(["faults", "statistics"]);
      expect(faultsKeys.slaCompliance({ days: 30 })).toEqual([
        "faults",
        "sla-compliance",
        { days: 30 },
      ]);
      expect(faultsKeys.slaRollup(30, 99.9)).toEqual(["faults", "sla-rollup", 30, 99.9]);
      expect(faultsKeys.alarmDetails("alarm-1")).toEqual(["faults", "alarm-details", "alarm-1"]);
    });
  });

  describe("useAlarms - fetch alarms", () => {
    it("should fetch alarms successfully", async () => {
      const mockAlarms: Alarm[] = [
        {
          id: "alarm-1",
          tenant_id: "tenant-1",
          alarm_id: "ALM-001",
          severity: "critical",
          status: "active",
          source: "netbox",
          alarm_type: "ont_offline",
          title: "ONT Offline",
          description: "ONT is offline",
          subscriber_count: 1,
          correlation_action: "none",
          is_root_cause: true,
          first_occurrence: "2024-01-01T00:00:00Z",
          last_occurrence: "2024-01-01T00:05:00Z",
          occurrence_count: 5,
          tags: {},
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:05:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockAlarms });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockAlarms);
      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms");
    });

    it("should build query params with severity filter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const params: AlarmQueryParams = {
        severity: ["critical", "major"],
      };

      renderHook(() => useAlarms(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("severity=critical");
        expect(callArg).toContain("severity=major");
      });
    });

    it("should build query params with status filter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const params: AlarmQueryParams = {
        status: ["active", "acknowledged"],
      };

      renderHook(() => useAlarms(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("status=active");
        expect(callArg).toContain("status=acknowledged");
      });
    });

    it("should build query params with source filter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const params: AlarmQueryParams = {
        source: ["netbox", "genieacs"],
      };

      renderHook(() => useAlarms(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("source=netbox");
        expect(callArg).toContain("source=genieacs");
      });
    });

    it("should build query params with all filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const params: AlarmQueryParams = {
        severity: ["critical"],
        status: ["active"],
        source: ["netbox"],
        alarm_type: "ont_offline",
        resource_type: "ont",
        resource_id: "ont-123",
        customer_id: "cust-456",
        assigned_to: "user-1",
        is_root_cause: true,
        from_date: "2024-01-01T00:00:00Z",
        to_date: "2024-01-31T23:59:59Z",
        limit: 50,
        offset: 10,
      };

      renderHook(() => useAlarms(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("severity=critical");
        expect(callArg).toContain("status=active");
        expect(callArg).toContain("source=netbox");
        expect(callArg).toContain("alarm_type=ont_offline");
        expect(callArg).toContain("resource_type=ont");
        expect(callArg).toContain("resource_id=ont-123");
        expect(callArg).toContain("customer_id=cust-456");
        expect(callArg).toContain("assigned_to=user-1");
        expect(callArg).toContain("is_root_cause=true");
        expect(callArg).toContain("limit=50");
        expect(callArg).toContain("offset=10");
      });
    });

    it("should handle empty alarms array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should handle different severity levels", async () => {
      const severities: AlarmSeverity[] = ["critical", "major", "minor", "warning", "info"];

      for (const severity of severities) {
        const mockAlarm: Alarm = {
          id: `alarm-${severity}`,
          tenant_id: "tenant-1",
          alarm_id: `ALM-${severity}`,
          severity,
          status: "active",
          source: "manual",
          alarm_type: "test",
          title: `${severity} alarm`,
          subscriber_count: 1,
          correlation_action: "none",
          is_root_cause: true,
          first_occurrence: "2024-01-01T00:00:00Z",
          last_occurrence: "2024-01-01T00:00:00Z",
          occurrence_count: 1,
          tags: {},
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockAlarm] });

        const { result } = renderHook(() => useAlarms({ severity: [severity] }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].severity).toBe(severity);
      }
    });

    it("should handle different alarm statuses", async () => {
      const statuses: AlarmStatus[] = ["active", "acknowledged", "cleared", "resolved"];

      for (const status of statuses) {
        const mockAlarm: Alarm = {
          id: `alarm-${status}`,
          tenant_id: "tenant-1",
          alarm_id: `ALM-${status}`,
          severity: "minor",
          status,
          source: "manual",
          alarm_type: "test",
          title: `${status} alarm`,
          subscriber_count: 1,
          correlation_action: "none",
          is_root_cause: true,
          first_occurrence: "2024-01-01T00:00:00Z",
          last_occurrence: "2024-01-01T00:00:00Z",
          occurrence_count: 1,
          tags: {},
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockAlarm] });

        const { result } = renderHook(() => useAlarms({ status: [status] }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].status).toBe(status);
      }
    });

    it("should handle different alarm sources", async () => {
      const sources: AlarmSource[] = ["genieacs", "netbox", "netbox", "manual", "api"];

      for (const source of sources) {
        const mockAlarm: Alarm = {
          id: `alarm-${source}`,
          tenant_id: "tenant-1",
          alarm_id: `ALM-${source}`,
          severity: "minor",
          status: "active",
          source,
          alarm_type: "test",
          title: `${source} alarm`,
          subscriber_count: 1,
          correlation_action: "none",
          is_root_cause: true,
          first_occurrence: "2024-01-01T00:00:00Z",
          last_occurrence: "2024-01-01T00:00:00Z",
          occurrence_count: 1,
          tags: {},
          metadata: {},
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        };

        (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockAlarm] });

        const { result } = renderHook(() => useAlarms({ source: [source] }), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.data?.[0].source).toBe(source);
      }
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch alarms");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch alarms", error);
    });

    it("should have correct staleTime and refetchInterval", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // staleTime is 10000ms, refetchInterval is 30000ms
      expect(result.current.data).toBeDefined();
    });

    it("should handle alarms with all optional fields", async () => {
      const mockAlarm: Alarm = {
        id: "alarm-1",
        tenant_id: "tenant-1",
        alarm_id: "ALM-001",
        severity: "critical",
        status: "acknowledged",
        source: "netbox",
        alarm_type: "ont_offline",
        title: "ONT Offline",
        description: "Detailed description",
        message: "Error message",
        resource_type: "ont",
        resource_id: "ont-123",
        resource_name: "Customer ONT",
        customer_id: "cust-456",
        customer_name: "John Doe",
        subscriber_count: 5,
        correlation_id: "corr-789",
        correlation_action: "group",
        parent_alarm_id: "alarm-parent-1",
        is_root_cause: false,
        first_occurrence: "2024-01-01T00:00:00Z",
        last_occurrence: "2024-01-01T00:05:00Z",
        occurrence_count: 10,
        acknowledged_at: "2024-01-01T00:02:00Z",
        cleared_at: "2024-01-01T00:06:00Z",
        resolved_at: "2024-01-01T00:07:00Z",
        assigned_to: "user-1",
        ticket_id: "ticket-123",
        tags: { location: "datacenter-1" },
        metadata: { custom_field: "value" },
        probable_cause: "Hardware failure",
        recommended_action: "Replace ONT",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:07:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockAlarm] });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.[0]).toEqual(mockAlarm);
    });
  });

  describe("useAlarmStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const mockStats: AlarmStatistics = {
        total_alarms: 100,
        active_alarms: 50,
        critical_alarms: 10,
        acknowledged_alarms: 30,
        resolved_last_24h: 20,
        affected_subscribers: 45,
        by_severity: {
          critical: 10,
          major: 20,
          minor: 30,
          warning: 25,
          info: 15,
        },
        by_status: {
          active: 50,
          acknowledged: 30,
          cleared: 15,
          resolved: 5,
        },
        by_source: {
          genieacs: 25,
          netbox: 40,
          netbox: 15,
          manual: 10,
          api: 10,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms/statistics");
    });

    it("should handle empty statistics", async () => {
      const mockStats: AlarmStatistics = {
        total_alarms: 0,
        active_alarms: 0,
        critical_alarms: 0,
        acknowledged_alarms: 0,
        resolved_last_24h: 0,
        affected_subscribers: 0,
        by_severity: {
          critical: 0,
          major: 0,
          minor: 0,
          warning: 0,
          info: 0,
        },
        by_status: {
          active: 0,
          acknowledged: 0,
          cleared: 0,
          resolved: 0,
        },
        by_source: {
          genieacs: 0,
          netbox: 0,
          netbox: 0,
          manual: 0,
          api: 0,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
    });

    it("should handle statistics with total_impacted_subscribers", async () => {
      const mockStats: AlarmStatistics = {
        total_alarms: 100,
        active_alarms: 50,
        critical_alarms: 10,
        acknowledged_alarms: 30,
        resolved_last_24h: 20,
        affected_subscribers: 45,
        total_impacted_subscribers: 100,
        by_severity: {
          critical: 10,
          major: 20,
          minor: 30,
          warning: 25,
          info: 15,
        },
        by_status: {
          active: 50,
          acknowledged: 30,
          cleared: 15,
          resolved: 5,
        },
        by_source: {
          genieacs: 25,
          netbox: 40,
          netbox: 15,
          manual: 10,
          api: 10,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_impacted_subscribers).toBe(100);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch statistics");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch alarm statistics", error);
    });

    it("should have correct staleTime and refetchInterval", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: {
          total_alarms: 0,
          active_alarms: 0,
          critical_alarms: 0,
          acknowledged_alarms: 0,
          resolved_last_24h: 0,
          affected_subscribers: 0,
          by_severity: {},
          by_status: {},
          by_source: {},
        },
      });

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // staleTime is 30000ms, refetchInterval is 60000ms
      expect(result.current.data).toBeDefined();
    });
  });

  describe("useSLACompliance", () => {
    it("should fetch SLA compliance successfully", async () => {
      const mockCompliance: SLACompliance[] = [
        {
          date: "2024-01-01",
          compliance_percentage: 99.95,
          target_percentage: 99.9,
          uptime_minutes: 1435,
          downtime_minutes: 5,
          sla_breaches: 0,
        },
        {
          date: "2024-01-02",
          compliance_percentage: 99.8,
          target_percentage: 99.9,
          uptime_minutes: 1437,
          downtime_minutes: 3,
          sla_breaches: 1,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockCompliance });

      const { result } = renderHook(() => useSLACompliance(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockCompliance);
    });

    it("should use default days parameter when not provided", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useSLACompliance(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("/faults/sla/compliance");
        expect(callArg).toContain("from_date=");
      });
    });

    it("should use provided days parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useSLACompliance({ days: 7 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("/faults/sla/compliance");
      });
    });

    it("should use provided fromDate parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useSLACompliance({ fromDate: "2024-01-01T00:00:00Z" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("from_date=2024-01-01T00%3A00%3A00Z");
      });
    });

    it("should use excludeMaintenance parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(() => useSLACompliance({ excludeMaintenance: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("exclude_maintenance=true");
      });
    });

    it("should handle empty compliance data", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      const { result } = renderHook(() => useSLACompliance(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch SLA compliance");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSLACompliance(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch SLA compliance", error);
    });
  });

  describe("useSLARollupStats", () => {
    it("should fetch SLA rollup stats successfully", async () => {
      const mockStats: SLARollupStats = {
        total_downtime_minutes: 150,
        total_breaches: 5,
        worst_day_compliance: 99.5,
        avg_compliance: 99.85,
        days_analyzed: 30,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useSLARollupStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
    });

    it("should use default parameters when not provided", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      renderHook(() => useSLARollupStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("days=30");
        expect(callArg).toContain("target_percentage=99.9");
      });
    });

    it("should use provided days parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      renderHook(() => useSLARollupStats(7), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("days=7");
      });
    });

    it("should use provided target percentage parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      renderHook(() => useSLARollupStats(30, 99.5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("target_percentage=99.5");
      });
    });

    it("should handle null response", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      const { result } = renderHook(() => useSLARollupStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeNull();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch SLA rollup stats");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSLARollupStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch SLA rollup stats", error);
    });
  });

  describe("useAlarmDetails", () => {
    it("should fetch alarm details successfully", async () => {
      const mockHistory = [
        {
          id: "hist-1",
          alarm_id: "alarm-1",
          event: "created",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];

      const mockNotes = [
        {
          id: "note-1",
          alarm_id: "alarm-1",
          content: "Investigating issue",
          created_by: "user-1",
          created_at: "2024-01-01T00:01:00Z",
        },
      ];

      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockNotes });

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.history).toEqual(mockHistory);
      expect(result.current.notes).toEqual(mockNotes);
      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms/alarm-1/history");
      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms/alarm-1/notes");
    });

    it("should not fetch when alarmId is null", async () => {
      const { result } = renderHook(() => useAlarmDetails(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.history).toEqual([]);
      expect(result.current.notes).toEqual([]);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should add note successfully", async () => {
      const mockHistory = [];
      const mockNotes = [];

      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockNotes });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let addNoteResult: boolean = false;
      await act(async () => {
        addNoteResult = await result.current.addNote("New note");
      });

      expect(addNoteResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/notes", {
        content: "New note",
      });
    });

    it("should return false when addNote fails", async () => {
      const mockHistory = [];
      const mockNotes = [];

      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockNotes });
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Failed to add note"));

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let addNoteResult: boolean = true;
      await act(async () => {
        addNoteResult = await result.current.addNote("Failed note");
      });

      expect(addNoteResult).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should return false when addNote called with null alarmId", async () => {
      const { result } = renderHook(() => useAlarmDetails(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let addNoteResult: boolean = true;
      await act(async () => {
        addNoteResult = await result.current.addNote("Note");
      });

      expect(addNoteResult).toBe(false);
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("should handle empty history and notes", async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: null })
        .mockResolvedValueOnce({ data: null });

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.history).toEqual([]);
      expect(result.current.notes).toEqual([]);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch details");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch alarm details", error);
    });
  });

  describe("useAlarmOperations", () => {
    it("should acknowledge alarms successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      let acknowledgeResult: boolean = false;
      await act(async () => {
        acknowledgeResult = await result.current.acknowledgeAlarms(["alarm-1", "alarm-2"]);
      });

      expect(acknowledgeResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/acknowledge", {
        note: undefined,
      });
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-2/acknowledge", {
        note: undefined,
      });
    });

    it("should acknowledge alarms with note", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.acknowledgeAlarms(["alarm-1"], "Investigating");
      });

      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/acknowledge", {
        note: "Investigating",
      });
    });

    it("should return false when acknowledge fails", async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Acknowledge failed"));

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      let acknowledgeResult: boolean = true;
      await act(async () => {
        acknowledgeResult = await result.current.acknowledgeAlarms(["alarm-1"]);
      });

      expect(acknowledgeResult).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should clear alarms successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      let clearResult: boolean = false;
      await act(async () => {
        clearResult = await result.current.clearAlarms(["alarm-1", "alarm-2"]);
      });

      expect(clearResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/clear", {});
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-2/clear", {});
    });

    it("should return false when clear fails", async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Clear failed"));

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      let clearResult: boolean = true;
      await act(async () => {
        clearResult = await result.current.clearAlarms(["alarm-1"]);
      });

      expect(clearResult).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should create tickets successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      let createResult: boolean = false;
      await act(async () => {
        createResult = await result.current.createTickets(["alarm-1", "alarm-2"], "high");
      });

      expect(createResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/create-ticket", {
        priority: "high",
      });
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-2/create-ticket", {
        priority: "high",
      });
    });

    it("should create tickets with default priority", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.createTickets(["alarm-1"]);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/create-ticket", {
        priority: "normal",
      });
    });

    it("should return false when create tickets fails", async () => {
      (apiClient.post as jest.Mock).mockRejectedValue(new Error("Create failed"));

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      let createResult: boolean = true;
      await act(async () => {
        createResult = await result.current.createTickets(["alarm-1"]);
      });

      expect(createResult).toBe(false);
      expect(logger.error).toHaveBeenCalled();
    });

    it("should set isLoading correctly during mutations", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100))
      );

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.acknowledgeAlarms(["alarm-1"]);
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });

    it("should invalidate queries after successful acknowledge", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmOperations(), { wrapper });

      await act(async () => {
        await result.current.acknowledgeAlarms(["alarm-1"]);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: faultsKeys.all });
    });

    it("should invalidate queries after successful clear", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmOperations(), { wrapper });

      await act(async () => {
        await result.current.clearAlarms(["alarm-1"]);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: faultsKeys.all });
    });

    it("should invalidate queries after successful ticket creation", async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      });

      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useAlarmOperations(), { wrapper });

      await act(async () => {
        await result.current.createTickets(["alarm-1"]);
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: faultsKeys.all });
    });

    it("should expose error from mutations", async () => {
      const error = new Error("Operation failed");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await result.current.acknowledgeAlarms(["alarm-1"]);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });
  });
});
