/**
 * Unit Tests for useFaults hooks
 * Tests fault management hooks with Jest mocks for fast, reliable unit testing
 */

import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies BEFORE importing the hooks
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

import {
  useAlarms,
  useAlarmStatistics,
  useSLACompliance,
  useSLARollupStats,
  useAlarmDetails,
  useAlarmOperations,
  faultsKeys,
  type Alarm,
  type AlarmStatistics,
  type SLACompliance,
  type SLARollupStats,
} from "../useFaults";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

// ============================================================================
// Test Utilities
// ============================================================================

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      log: () => {},
      warn: () => {},
      error: () => {},
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function createMockAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: "alarm-1",
    tenant_id: "tenant-123",
    alarm_id: "ALM-001",
    severity: "critical",
    status: "active",
    source: "voltha",
    alarm_type: "connectivity",
    title: "ONT Offline",
    description: "ONT device is not responding",
    message: "Device unreachable",
    resource_type: "ont",
    resource_id: "ont-123",
    resource_name: "Customer ONT",
    customer_id: "cust-123",
    customer_name: "John Doe",
    subscriber_count: 1,
    correlation_id: "corr-123",
    correlation_action: "auto",
    parent_alarm_id: null,
    is_root_cause: true,
    first_occurrence: "2024-01-01T00:00:00Z",
    last_occurrence: "2024-01-01T00:00:00Z",
    occurrence_count: 1,
    acknowledged_at: null,
    cleared_at: null,
    resolved_at: null,
    assigned_to: null,
    ticket_id: null,
    tags: {},
    metadata: {},
    probable_cause: "Network connectivity issue",
    recommended_action: "Check fiber connection",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

// ============================================================================
// Tests
// ============================================================================

describe("useFaults", () => {
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

  describe("useAlarms", () => {
    it("should fetch alarms successfully", async () => {
      const mockAlarms = [
        createMockAlarm({ id: "alarm-1", title: "ONT Offline" }),
        createMockAlarm({ id: "alarm-2", title: "Signal Degraded" }),
      ];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockAlarms,
      });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(2);
      expect(result.current.alarms[0].title).toBe("ONT Offline");
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms");
    });

    it("should handle empty alarm list", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter alarms by severity", async () => {
      const mockAlarms = [createMockAlarm({ severity: "critical" })];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockAlarms,
      });

      const { result } = renderHook(() => useAlarms({ severity: ["critical"] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms?severity=critical");
      expect(result.current.alarms).toHaveLength(1);
    });

    it("should filter alarms by multiple statuses", async () => {
      const mockAlarms = [createMockAlarm()];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockAlarms,
      });

      const { result } = renderHook(() => useAlarms({ status: ["active", "acknowledged"] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith(
        "/faults/alarms?status=active&status=acknowledged",
      );
    });

    it("should filter alarms by source", async () => {
      const mockAlarms = [createMockAlarm({ source: "voltha" })];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockAlarms,
      });

      const { result } = renderHook(() => useAlarms({ source: ["voltha"] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms?source=voltha");
    });

    it("should handle pagination parameters", async () => {
      const mockAlarms = [createMockAlarm()];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockAlarms,
      });

      const { result } = renderHook(() => useAlarms({ limit: 10, offset: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms?limit=10&offset=20");
    });

    it("should handle all query parameters", async () => {
      const mockAlarms = [createMockAlarm()];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockAlarms,
      });

      const { result } = renderHook(
        () =>
          useAlarms({
            severity: ["critical"],
            status: ["active"],
            source: ["voltha"],
            alarm_type: "connectivity",
            resource_type: "ont",
            resource_id: "ont-123",
            customer_id: "cust-123",
            assigned_to: "user-1",
            is_root_cause: true,
            from_date: "2024-01-01",
            to_date: "2024-12-31",
            limit: 50,
            offset: 10,
          }),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("severity=critical");
      expect(callUrl).toContain("status=active");
      expect(callUrl).toContain("source=voltha");
      expect(callUrl).toContain("alarm_type=connectivity");
      expect(callUrl).toContain("resource_type=ont");
      expect(callUrl).toContain("resource_id=ont-123");
      expect(callUrl).toContain("customer_id=cust-123");
      expect(callUrl).toContain("assigned_to=user-1");
      expect(callUrl).toContain("is_root_cause=true");
      expect(callUrl).toContain("from_date=2024-01-01");
      expect(callUrl).toContain("to_date=2024-12-31");
      expect(callUrl).toContain("limit=50");
      expect(callUrl).toContain("offset=10");
    });

    it("should handle is_root_cause=false parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({ data: [] });

      const { result } = renderHook(() => useAlarms({ is_root_cause: false }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms?is_root_cause=false");
    });

    it("should handle fetch error", async () => {
      const error = new Error("Network error");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.alarms).toHaveLength(0);
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch alarms", error);
    });

    it("should handle null data from API", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: null,
      });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(0);
    });

    it("should handle undefined data from API", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: undefined,
      });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(0);
    });
  });

  describe("useAlarmStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const mockStats: AlarmStatistics = {
        total_alarms: 10,
        active_alarms: 5,
        critical_alarms: 2,
        acknowledged_alarms: 3,
        resolved_last_24h: 4,
        affected_subscribers: 15,
        total_impacted_subscribers: 15,
        by_severity: {
          critical: 2,
          major: 3,
          minor: 3,
          warning: 2,
          info: 0,
        },
        by_status: {
          active: 5,
          acknowledged: 3,
          cleared: 1,
          resolved: 1,
        },
        by_source: {
          genieacs: 3,
          voltha: 5,
          netbox: 1,
          manual: 1,
          api: 0,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockStats,
      });

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.statistics).toEqual(mockStats);
      expect(result.current.statistics?.total_alarms).toBe(10);
      expect(result.current.statistics?.critical_alarms).toBe(2);
      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms/statistics");
    });

    it("should handle empty statistics", async () => {
      const emptyStats: AlarmStatistics = {
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
          voltha: 0,
          netbox: 0,
          manual: 0,
          api: 0,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: emptyStats,
      });

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.statistics?.total_alarms).toBe(0);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Statistics fetch failed");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch alarm statistics", error);
    });

    it("should handle null data", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: null,
      });

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.statistics).toEqual({});
    });
  });

  describe("useSLACompliance", () => {
    it("should fetch SLA compliance successfully", async () => {
      const mockCompliance: SLACompliance[] = [
        {
          date: "2024-01-01",
          compliance_percentage: 99.9,
          target_percentage: 99.9,
          uptime_minutes: 1439,
          downtime_minutes: 1,
          sla_breaches: 0,
        },
        {
          date: "2024-01-02",
          compliance_percentage: 99.5,
          target_percentage: 99.9,
          uptime_minutes: 1433,
          downtime_minutes: 7,
          sla_breaches: 1,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockCompliance,
      });

      const { result } = renderHook(() => useSLACompliance(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].compliance_percentage).toBe(99.9);
      expect(apiClient.get).toHaveBeenCalled();
    });

    it("should use default days parameter (30)", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const { result } = renderHook(() => useSLACompliance(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("/faults/sla/compliance");
      expect(callUrl).toContain("from_date=");
    });

    it("should accept custom days parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const { result } = renderHook(() => useSLACompliance({ days: 7 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(apiClient.get).toHaveBeenCalled();
    });

    it("should accept custom fromDate parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const { result } = renderHook(() => useSLACompliance({ fromDate: "2024-01-01" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("from_date=2024-01-01");
    });

    it("should accept excludeMaintenance parameter", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [],
      });

      const { result } = renderHook(() => useSLACompliance({ excludeMaintenance: true }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("exclude_maintenance=true");
    });

    it("should handle fetch error", async () => {
      const error = new Error("SLA compliance fetch failed");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useSLACompliance(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch SLA compliance", error);
    });

    it("should handle null data", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: null,
      });

      const { result } = renderHook(() => useSLACompliance(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });
  });

  describe("useSLARollupStats", () => {
    it("should fetch SLA rollup stats successfully", async () => {
      const mockStats: SLARollupStats = {
        total_downtime_minutes: 120,
        total_breaches: 5,
        worst_day_compliance: 98.5,
        avg_compliance: 99.7,
        days_analyzed: 30,
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: mockStats,
      });

      const { result } = renderHook(() => useSLARollupStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.stats).toEqual(mockStats);
      expect(result.current.stats?.days_analyzed).toBe(30);
      expect(result.current.stats?.avg_compliance).toBe(99.7);
    });

    it("should use default parameters (30 days, 99.9%)", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: null,
      });

      const { result } = renderHook(() => useSLARollupStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("days=30");
      expect(callUrl).toContain("target_percentage=99.9");
    });

    it("should accept custom parameters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: { days_analyzed: 7 },
      });

      const { result } = renderHook(() => useSLARollupStats(7, 99.5), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const callUrl = (apiClient.get as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain("days=7");
      expect(callUrl).toContain("target_percentage=99.5");
    });

    it("should handle fetch error", async () => {
      const error = new Error("SLA rollup fetch failed");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useSLARollupStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch SLA rollup stats", error);
    });

    it("should handle null data", async () => {
      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: null,
      });

      const { result } = renderHook(() => useSLARollupStats(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.stats).toBeNull();
    });
  });

  describe("useAlarmDetails", () => {
    it("should fetch alarm details successfully", async () => {
      const mockHistory = [
        {
          id: "hist-1",
          alarm_id: "alarm-1",
          event_type: "created",
          timestamp: "2024-01-01T00:00:00Z",
        },
      ];
      const mockNotes = [
        {
          id: "note-1",
          alarm_id: "alarm-1",
          content: "Investigating issue",
          created_by: "user-1",
          created_at: "2024-01-01T01:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: mockHistory })
        .mockResolvedValueOnce({ data: mockNotes });

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.history).toHaveLength(1);
      expect(result.current.notes).toHaveLength(1);
      expect(result.current.error).toBeNull();
      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms/alarm-1/history");
      expect(apiClient.get).toHaveBeenCalledWith("/faults/alarms/alarm-1/notes");
    });

    it("should not fetch when alarmId is null", () => {
      const { result } = renderHook(() => useAlarmDetails(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.history).toHaveLength(0);
      expect(result.current.notes).toHaveLength(0);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle empty history and notes", async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.history).toHaveLength(0);
      expect(result.current.notes).toHaveLength(0);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch details");
      (apiClient.get as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).toBeTruthy());

      expect(logger.error).toHaveBeenCalledWith("Failed to fetch alarm details", error);
    });

    it("should add note successfully", async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: [
            {
              id: "note-1",
              content: "New note",
              created_at: "2024-01-01T00:00:00Z",
            },
          ],
        });

      (apiClient.post as jest.Mock).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let addNoteResult: boolean | undefined;
      await waitFor(async () => {
        addNoteResult = await result.current.addNote("New note");
      });

      expect(addNoteResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/notes", {
        content: "New note",
      });
    });

    it("should return false when addNote called with null alarmId", async () => {
      const { result } = renderHook(() => useAlarmDetails(null), {
        wrapper: createWrapper(),
      });

      const addNoteResult = await result.current.addNote("Note");

      expect(addNoteResult).toBe(false);
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("should handle addNote error", async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      const error = new Error("Failed to add note");
      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let addNoteResult: boolean | undefined;
      await waitFor(async () => {
        addNoteResult = await result.current.addNote("Failed note");
      });

      expect(addNoteResult).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Failed to add note", error);
    });

    it("should have refetch function", async () => {
      (apiClient.get as jest.Mock)
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({ data: [] });

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.refetch).toBeDefined();
      expect(typeof result.current.refetch).toBe("function");
    });
  });

  describe("useAlarmOperations", () => {
    it("should acknowledge alarms successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({}).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const acknowledgeResult = await result.current.acknowledgeAlarms(["alarm-1", "alarm-2"]);

      expect(acknowledgeResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/acknowledge", {});
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-2/acknowledge", {});
    });

    it("should acknowledge alarms with note", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const acknowledgeResult = await result.current.acknowledgeAlarms(
        ["alarm-1"],
        "Investigating",
      );

      expect(acknowledgeResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/acknowledge", {
        note: "Investigating",
      });
    });

    it("should handle acknowledge error", async () => {
      const error = new Error("Acknowledge failed");
      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const acknowledgeResult = await result.current.acknowledgeAlarms(["alarm-1"]);

      expect(acknowledgeResult).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Failed to acknowledge alarms", error);
    });

    it("should clear alarms successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({}).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const clearResult = await result.current.clearAlarms(["alarm-1", "alarm-2"]);

      expect(clearResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/clear", {});
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-2/clear", {});
    });

    it("should handle clear error", async () => {
      const error = new Error("Clear failed");
      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const clearResult = await result.current.clearAlarms(["alarm-1"]);

      expect(clearResult).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Failed to clear alarms", error);
    });

    it("should create tickets successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({}).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const createResult = await result.current.createTickets(["alarm-1", "alarm-2"], "high");

      expect(createResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/create-ticket", {
        priority: "high",
      });
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-2/create-ticket", {
        priority: "high",
      });
    });

    it("should use default priority when not specified", async () => {
      (apiClient.post as jest.Mock).mockResolvedValueOnce({});

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const createResult = await result.current.createTickets(["alarm-1"]);

      expect(createResult).toBe(true);
      expect(apiClient.post).toHaveBeenCalledWith("/faults/alarms/alarm-1/create-ticket", {
        priority: "normal",
      });
    });

    it("should handle create tickets error", async () => {
      const error = new Error("Create tickets failed");
      (apiClient.post as jest.Mock).mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const createResult = await result.current.createTickets(["alarm-1"]);

      expect(createResult).toBe(false);
      expect(logger.error).toHaveBeenCalledWith("Failed to create tickets", error);
    });

    it("should handle empty alarm IDs array", async () => {
      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      const acknowledgeResult = await result.current.acknowledgeAlarms([]);

      expect(acknowledgeResult).toBe(true);
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("should have isLoading state", () => {
      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("should have error state", () => {
      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle alarms with optional fields missing", async () => {
      const minimalAlarm = {
        id: "alarm-1",
        tenant_id: "tenant-123",
        alarm_id: "ALM-001",
        severity: "critical" as const,
        status: "active" as const,
        source: "voltha" as const,
        alarm_type: "connectivity",
        title: "ONT Offline",
        subscriber_count: 0,
        correlation_action: "auto",
        is_root_cause: false,
        first_occurrence: "2024-01-01T00:00:00Z",
        last_occurrence: "2024-01-01T00:00:00Z",
        occurrence_count: 1,
        tags: {},
        metadata: {},
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [minimalAlarm],
      });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(1);
      expect(result.current.alarms[0].description).toBeUndefined();
      expect(result.current.alarms[0].customer_name).toBeUndefined();
    });

    it("should handle alarms with zero occurrence count", async () => {
      const alarm = createMockAlarm({ occurrence_count: 0 });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [alarm],
      });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms[0].occurrence_count).toBe(0);
    });

    it("should handle alarms with empty tags and metadata", async () => {
      const alarm = createMockAlarm({ tags: {}, metadata: {} });

      (apiClient.get as jest.Mock).mockResolvedValueOnce({
        data: [alarm],
      });

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms[0].tags).toEqual({});
      expect(result.current.alarms[0].metadata).toEqual({});
    });
  });
});
