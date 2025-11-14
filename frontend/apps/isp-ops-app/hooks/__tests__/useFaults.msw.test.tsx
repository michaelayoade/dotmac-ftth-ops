/**
 * MSW-powered tests for useFaults
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useAlarms,
  useAlarmStatistics,
  useSLACompliance,
  useSLARollupStats,
  useAlarmDetails,
  useAlarmOperations,
  faultsKeys,
} from "../useFaults";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetFaultStorage,
  createMockAlarm,
  createMockHistory,
  createMockNote,
  seedFaultData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useFaults (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetFaultStorage();
  });

  afterEach(() => {
    queryClient.clear();
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
      const mockAlarms = [
        createMockAlarm({
          id: "alarm-1",
          severity: "critical",
          status: "active",
          title: "ONT Offline",
        }),
        createMockAlarm({
          id: "alarm-2",
          severity: "major",
          status: "acknowledged",
          title: "Signal Degraded",
        }),
      ];

      seedFaultData(mockAlarms);

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify data matches
      expect(result.current.alarms).toHaveLength(2);
      expect(result.current.alarms[0].id).toBe("alarm-1");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty alarm list", async () => {
      seedFaultData([]);

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter alarms by severity", async () => {
      const alarms = [
        createMockAlarm({ severity: "critical" }),
        createMockAlarm({ severity: "major" }),
        createMockAlarm({ severity: "critical" }),
      ];

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarms({ severity: ["critical"] }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(2);
      expect(result.current.alarms.every((a) => a.severity === "critical")).toBe(true);
    });

    it("should filter alarms by status", async () => {
      const alarms = [
        createMockAlarm({ status: "active" }),
        createMockAlarm({ status: "acknowledged" }),
        createMockAlarm({ status: "active" }),
      ];

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarms({ status: ["active"] }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(2);
      expect(result.current.alarms.every((a) => a.status === "active")).toBe(true);
    });

    it("should filter alarms by source", async () => {
      const alarms = [
        createMockAlarm({ source: "voltha" }),
        createMockAlarm({ source: "genieacs" }),
        createMockAlarm({ source: "voltha" }),
      ];

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarms({ source: ["voltha"] }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(2);
      expect(result.current.alarms.every((a) => a.source === "voltha")).toBe(true);
    });

    it("should handle pagination", async () => {
      const alarms = Array.from({ length: 25 }, (_, i) =>
        createMockAlarm({ id: `alarm-${i + 1}` })
      );

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarms({ offset: 10, limit: 10 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(10);
      expect(result.current.alarms[0].id).toBe("alarm-11");
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/faults/alarms", "Server error");

      const { result } = renderHook(() => useAlarms(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useAlarmStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const alarms = [
        createMockAlarm({ severity: "critical", status: "active", source: "voltha" }),
        createMockAlarm({ severity: "major", status: "acknowledged", source: "genieacs" }),
        createMockAlarm({ severity: "critical", status: "active", source: "voltha" }),
      ];

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.statistics).toBeDefined();
      expect(result.current.statistics?.total_alarms).toBe(3);
      expect(result.current.statistics?.active_alarms).toBe(2);
      expect(result.current.statistics?.critical_alarms).toBe(2);
    });

    it("should handle empty statistics", async () => {
      seedFaultData([]);

      const { result } = renderHook(() => useAlarmStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.statistics?.total_alarms).toBe(0);
    });
  });

  describe("useSLACompliance", () => {
    it("should fetch SLA compliance successfully", async () => {
      seedFaultData([]);

      const { result } = renderHook(() => useSLACompliance(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(Array.isArray(result.current.data)).toBe(true);
    });

    it("should accept custom parameters", async () => {
      seedFaultData([]);

      const { result } = renderHook(() => useSLACompliance({ days: 7 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
    });
  });

  describe("useSLARollupStats", () => {
    it("should fetch SLA rollup stats successfully", async () => {
      seedFaultData([]);

      const { result } = renderHook(() => useSLARollupStats(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.stats).toBeDefined();
      expect(result.current.stats?.days_analyzed).toBe(30);
    });

    it("should accept custom parameters", async () => {
      seedFaultData([]);

      const { result } = renderHook(() => useSLARollupStats(7, 99.5), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.stats?.days_analyzed).toBe(7);
    });
  });

  describe("useAlarmDetails", () => {
    it("should fetch alarm details successfully", async () => {
      const alarm = createMockAlarm({ id: "alarm-1" });
      const history = [createMockHistory("alarm-1")];
      const notes = [createMockNote("alarm-1")];

      seedFaultData([alarm], history, notes);

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.history).toHaveLength(1);
      expect(result.current.notes).toHaveLength(1);
    });

    it("should not fetch when alarmId is null", () => {
      const { result } = renderHook(() => useAlarmDetails(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.history).toHaveLength(0);
      expect(result.current.notes).toHaveLength(0);
    });

    it("should add note successfully", async () => {
      const alarm = createMockAlarm({ id: "alarm-1" });
      seedFaultData([alarm], [], []);

      const { result } = renderHook(() => useAlarmDetails("alarm-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let addNoteResult;
      await act(async () => {
        addNoteResult = await result.current.addNote("New note");
      });

      expect(addNoteResult).toBe(true);
    });

    it("should return false when addNote called with null alarmId", async () => {
      const { result } = renderHook(() => useAlarmDetails(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      let addNoteResult;
      await act(async () => {
        addNoteResult = await result.current.addNote("Note");
      });

      expect(addNoteResult).toBe(false);
    });
  });

  describe("useAlarmOperations", () => {
    it("should acknowledge alarms successfully", async () => {
      const alarms = [
        createMockAlarm({ id: "alarm-1" }),
        createMockAlarm({ id: "alarm-2" }),
      ];

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let acknowledgeResult;
      await act(async () => {
        acknowledgeResult = await result.current.acknowledgeAlarms(["alarm-1", "alarm-2"]);
      });

      expect(acknowledgeResult).toBe(true);
    });

    it("should acknowledge alarms with note", async () => {
      const alarms = [createMockAlarm({ id: "alarm-1" })];

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let acknowledgeResult;
      await act(async () => {
        acknowledgeResult = await result.current.acknowledgeAlarms(["alarm-1"], "Investigating");
      });

      expect(acknowledgeResult).toBe(true);
    });

    it("should clear alarms successfully", async () => {
      const alarms = [
        createMockAlarm({ id: "alarm-1" }),
        createMockAlarm({ id: "alarm-2" }),
      ];

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let clearResult;
      await act(async () => {
        clearResult = await result.current.clearAlarms(["alarm-1", "alarm-2"]);
      });

      expect(clearResult).toBe(true);
    });

    it("should create tickets successfully", async () => {
      const alarms = [
        createMockAlarm({ id: "alarm-1" }),
        createMockAlarm({ id: "alarm-2" }),
      ];

      seedFaultData(alarms);

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let createResult;
      await act(async () => {
        createResult = await result.current.createTickets(["alarm-1", "alarm-2"], "high");
      });

      expect(createResult).toBe(true);
    });

    it("should handle acknowledge error", async () => {
      makeApiEndpointFail("post", "/faults/alarms/alarm-1/acknowledge", "Operation failed");

      const { result } = renderHook(() => useAlarmOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let acknowledgeResult;
      await act(async () => {
        acknowledgeResult = await result.current.acknowledgeAlarms(["alarm-1"]);
      });

      expect(acknowledgeResult).toBe(false);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle alarms with multiple filters", async () => {
      const alarms = [
        createMockAlarm({
          severity: "critical",
          status: "active",
          source: "voltha",
        }),
        createMockAlarm({
          severity: "major",
          status: "active",
          source: "voltha",
        }),
        createMockAlarm({
          severity: "critical",
          status: "acknowledged",
          source: "genieacs",
        }),
      ];

      seedFaultData(alarms);

      const { result } = renderHook(
        () =>
          useAlarms({
            severity: ["critical"],
            status: ["active"],
            source: ["voltha"],
          }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alarms).toHaveLength(1);
      expect(result.current.alarms[0].severity).toBe("critical");
      expect(result.current.alarms[0].status).toBe("active");
      expect(result.current.alarms[0].source).toBe("voltha");
    });

    it("should handle concurrent alarm and statistics fetches", async () => {
      const alarms = [
        createMockAlarm({ severity: "critical" }),
        createMockAlarm({ severity: "major" }),
      ];

      seedFaultData(alarms);

      const { result: alarmsResult } = renderHook(() => useAlarms(), {
        wrapper: createQueryWrapper(queryClient),
      });

      const { result: statsResult } = renderHook(() => useAlarmStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Both should load independently
      await waitFor(() => {
        expect(alarmsResult.current.isLoading).toBe(false);
        expect(statsResult.current.isLoading).toBe(false);
      });

      expect(alarmsResult.current.alarms).toHaveLength(2);
      expect(statsResult.current.statistics?.total_alarms).toBe(2);
    });
  });
});
