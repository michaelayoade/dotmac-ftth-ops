/**
 * @fileoverview Tests for useMetrics hook
 */

import { renderHook, act } from "@testing-library/react";
import { useMetrics, type MetricsData } from "../index";

describe("useMetrics", () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe("record", () => {
    it("should record metric with value only", () => {
      const { result } = renderHook(() => useMetrics());

      act(() => {
        result.current.record("api_latency", { value: 150 });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Recording metric:",
        "api_latency",
        expect.objectContaining({ value: 150 }),
      );
    });

    it("should record metric with value and unit", () => {
      const { result } = renderHook(() => useMetrics());

      act(() => {
        result.current.record("memory_usage", {
          value: 512,
          unit: "MB",
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Recording metric:",
        "memory_usage",
        expect.objectContaining({
          value: 512,
          unit: "MB",
        }),
      );
    });

    it("should record metric with tags", () => {
      const { result } = renderHook(() => useMetrics());

      act(() => {
        result.current.record("request_count", {
          value: 1,
          tags: {
            endpoint: "/api/users",
            method: "GET",
            status: "200",
          },
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Recording metric:",
        "request_count",
        expect.objectContaining({
          value: 1,
          tags: {
            endpoint: "/api/users",
            method: "GET",
            status: "200",
          },
        }),
      );
    });

    it("should record metric with all properties", () => {
      const { result } = renderHook(() => useMetrics());

      act(() => {
        result.current.record("database_query_time", {
          value: 45.5,
          unit: "ms",
          tags: {
            query_type: "SELECT",
            table: "users",
            database: "production",
          },
        });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Recording metric:",
        "database_query_time",
        expect.objectContaining({
          value: 45.5,
          unit: "ms",
          tags: {
            query_type: "SELECT",
            table: "users",
            database: "production",
          },
        }),
      );
    });

    it("should handle numeric metric values", () => {
      const { result } = renderHook(() => useMetrics());

      const testCases = [
        { name: "integer", value: 100 },
        { name: "decimal", value: 99.99 },
        { name: "zero", value: 0 },
        { name: "negative", value: -50 },
        { name: "large_number", value: 1000000 },
      ];

      testCases.forEach(({ name, value }) => {
        act(() => {
          result.current.record(name, { value });
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          "Recording metric:",
          name,
          expect.objectContaining({ value }),
        );
      });
    });

    it("should handle different unit types", () => {
      const { result } = renderHook(() => useMetrics());

      const metrics = [
        { name: "time_metric", value: 100, unit: "ms" },
        { name: "size_metric", value: 1024, unit: "KB" },
        { name: "count_metric", value: 50, unit: "requests" },
        { name: "percentage_metric", value: 75, unit: "%" },
        { name: "rate_metric", value: 10.5, unit: "req/sec" },
      ];

      metrics.forEach(({ name, value, unit }) => {
        act(() => {
          result.current.record(name, { value, unit });
        });

        expect(consoleLogSpy).toHaveBeenCalledWith(
          "Recording metric:",
          name,
          expect.objectContaining({ value, unit }),
        );
      });
    });
  });

  describe("hook stability", () => {
    it("should return stable record function across re-renders", () => {
      const { result, rerender } = renderHook(() => useMetrics());

      const firstRecord = result.current.record;

      rerender();

      expect(result.current.record).toBe(firstRecord);
    });
  });

  describe("edge cases", () => {
    it("should handle undefined unit gracefully", () => {
      const { result } = renderHook(() => useMetrics());

      expect(() => {
        act(() => {
          const metricData = { value: 100, unit: undefined } as unknown as MetricsData;
          result.current.record("test_metric", metricData);
        });
      }).not.toThrow();
    });

    it("should handle undefined tags gracefully", () => {
      const { result } = renderHook(() => useMetrics());

      expect(() => {
        act(() => {
          const metricData = { value: 100, tags: undefined } as unknown as MetricsData;
          result.current.record("test_metric", metricData);
        });
      }).not.toThrow();
    });

    it("should handle empty tags object", () => {
      const { result } = renderHook(() => useMetrics());

      act(() => {
        result.current.record("test_metric", { value: 100, tags: {} });
      });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        "Recording metric:",
        "test_metric",
        expect.objectContaining({ value: 100, tags: {} }),
      );
    });
  });
});
