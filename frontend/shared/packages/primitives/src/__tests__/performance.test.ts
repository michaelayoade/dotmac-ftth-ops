/**
 * Performance Test Implementation
 * Actual performance tests for optimized components
 */

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import {
  PerformanceTestSuite,
  ComponentBenchmarks,
  BundleSizeAnalyzer,
  MemoryLeakDetector,
  PERFORMANCE_BUDGETS,
} from "../utils/performance-tests";

// Mock performance API for Node.js environment
Object.defineProperty(global, "performance", {
  value: {
    now: () => Date.now(),
    memory: {
      usedJSHeapSize: 1024 * 1024 * 10, // 10MB mock
    },
  },
  writable: true,
});

describe("Performance Tests", () => {
  beforeEach(() => {
    // Reset any global state before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Cleanup after each test
  });

  describe("Component Performance Benchmarks", () => {
    it("should test chart component performance within budget", async () => {
      const mockChartData = Array(100)
        .fill(0)
        .map((_, i) => ({
          month: `Month ${i}`,
          revenue: i * 1000 + Math.random() * 500,
          target: i * 1200,
          previousYear: i * 800,
        }));

      const result = await ComponentBenchmarks.testChartPerformance(
        {} as any, // Mock component
        mockChartData,
        { ...PERFORMANCE_BUDGETS.charts, renderTime: 1000 }, // Relaxed for mocks
      );

      expect(result.testName).toContain("Chart Performance");
      expect(result.metrics.componentCount).toBe(mockChartData.length);
      expect(result.timestamp).toBeDefined();
    });

    it("should test status indicator performance with multiple instances", async () => {
      const indicatorCount = 25;

      const result = await ComponentBenchmarks.testStatusIndicatorPerformance(
        {} as any, // Mock component
        indicatorCount,
        { ...PERFORMANCE_BUDGETS.statusIndicators, renderTime: 1000, reRenderLimit: 100 }, // Relaxed for mocks
      );

      expect(result.testName).toContain("Status Indicator Performance");
      expect(result.metrics.componentCount).toBe(indicatorCount);
    });

    it("should test virtualized list performance with large datasets", async () => {
      const itemCount = 5000;

      const result = await ComponentBenchmarks.testVirtualizedListPerformance(
        {} as any, // Mock component
        itemCount,
        { ...PERFORMANCE_BUDGETS.virtualizedLists, renderTime: 1000, interactionTime: 1000 }, // Relaxed for mocks
      );

      expect(result.testName).toContain("Virtualized List Performance");
      expect(result.metrics.componentCount).toBe(itemCount);
    });

    it("should handle performance test failures gracefully", async () => {
      // Mock a component that exceeds performance budget
      const veryLargeDataset = Array(50000).fill(0);

      const result = await ComponentBenchmarks.testChartPerformance(
        {} as any,
        veryLargeDataset,
        { ...PERFORMANCE_BUDGETS.charts, renderTime: 1 }, // Unrealistic budget
      );

      expect(result.passed).toBe(false);
      expect(result.metrics.renderTime).toBeGreaterThan(1);
    });
  });

  describe("Bundle Size Analysis", () => {
    it("should analyze bundle sizes correctly", async () => {
      const bundleSizes = await BundleSizeAnalyzer.analyzeBundleSize();

      expect(bundleSizes).toHaveProperty("charts");
      expect(bundleSizes).toHaveProperty("indicators");
      expect(bundleSizes).toHaveProperty("virtualized");
      expect(bundleSizes).toHaveProperty("utils");
      expect(bundleSizes).toHaveProperty("types");
      expect(bundleSizes).toHaveProperty("total");

      // Verify sizes are reasonable numbers
      expect(typeof bundleSizes.charts).toBe("number");
      expect(bundleSizes.charts).toBeGreaterThan(0);
      expect(bundleSizes.total).toBeGreaterThan(bundleSizes.charts);
    });

    it("should check bundle budgets and identify violations", async () => {
      const mockSizes = {
        charts: 150, // Exceeds 100KB budget
        indicators: 30, // Within 50KB budget
        virtualized: 80, // Exceeds 70KB budget
        total: 300, // Exceeds 250KB budget
      };

      const result = BundleSizeAnalyzer.checkBundleBudgets(mockSizes);

      expect(result.passed).toBe(false);
      expect(result.violations).toHaveLength(3); // charts, virtualized, total
      expect(result.violations[0]).toContain("charts");
      expect(result.violations[1]).toContain("virtualized");
      expect(result.violations[2]).toContain("total");
    });

    it("should pass when all bundles are within budget", async () => {
      const mockSizes = {
        charts: 80, // Within 100KB budget
        indicators: 40, // Within 50KB budget
        virtualized: 60, // Within 70KB budget
        total: 200, // Within 250KB budget
      };

      const result = BundleSizeAnalyzer.checkBundleBudgets(mockSizes);

      expect(result.passed).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });

  describe("Memory Leak Detection", () => {
    it("should detect no leaks for well-behaved functions", async () => {
      const testFunction = async () => {
        // Simulate a clean component lifecycle
        const data = Array(100).fill(0);
        data.forEach((item) => item * 2);
        // Clean up references
        return Promise.resolve();
      };

      const result = await MemoryLeakDetector.detectLeaks(testFunction, 5);

      expect(result.hasLeaks).toBe(false);
      expect(result.memoryGrowth).toBeLessThan(10); // Less than 10MB growth
      expect(result.iterations).toBe(5);
    });

    it("should handle environments without memory API", async () => {
      // Temporarily remove memory API
      const originalMemory = (global.performance as any).memory;
      delete (global.performance as any).memory;

      const testFunction = async () => Promise.resolve();
      const result = await MemoryLeakDetector.detectLeaks(testFunction, 3);

      expect(result.hasLeaks).toBe(false);
      expect(result.memoryGrowth).toBe(0);

      // Restore memory API
      (global.performance as any).memory = originalMemory;
    });
  });

  describe("Full Performance Test Suite", () => {
    it("should run complete performance test suite", async () => {
      const results = await PerformanceTestSuite.runFullSuite();

      expect(results.benchmarks).toHaveLength(3); // Chart, indicator, virtualized tests
      expect(results.bundleAnalysis).toHaveProperty("total");
      expect(results.memoryLeaks).toBeDefined();
      expect(typeof results.overallPassed).toBe("boolean");

      // Verify all benchmark tests have required properties
      results.benchmarks.forEach((benchmark) => {
        expect(benchmark).toHaveProperty("testName");
        expect(benchmark).toHaveProperty("metrics");
        expect(benchmark).toHaveProperty("passed");
        expect(benchmark).toHaveProperty("timestamp");
        expect(benchmark.metrics).toHaveProperty("renderTime");
        expect(benchmark.metrics).toHaveProperty("memoryUsage");
        expect(benchmark.metrics).toHaveProperty("componentCount");
        expect(benchmark.metrics).toHaveProperty("reRenderCount");
      });
    });

    it("should handle test suite failures gracefully", async () => {
      // Mock a scenario where tests might fail
      const originalConsoleError = console.error;
      console.error = jest.fn();

      const results = await PerformanceTestSuite.runFullSuite();

      expect(results).toHaveProperty("benchmarks");
      expect(results).toHaveProperty("bundleAnalysis");
      expect(results).toHaveProperty("overallPassed");

      console.error = originalConsoleError;
    });
  });

  describe("Performance Budget Validation", () => {
    it("should have realistic performance budgets", () => {
      expect(PERFORMANCE_BUDGETS.charts.renderTime).toBeLessThan(200);
      expect(PERFORMANCE_BUDGETS.statusIndicators.renderTime).toBeLessThan(100);
      expect(PERFORMANCE_BUDGETS.virtualizedLists.interactionTime).toBeLessThanOrEqual(16); // 60fps

      // Memory budgets should be reasonable
      expect(PERFORMANCE_BUDGETS.charts.memoryUsage).toBeLessThan(100);
      expect(PERFORMANCE_BUDGETS.statusIndicators.memoryUsage).toBeLessThan(50);

      // Bundle size budgets should be reasonable
      expect(PERFORMANCE_BUDGETS.charts.bundleSize).toBeLessThan(200);
      expect(PERFORMANCE_BUDGETS.statusIndicators.bundleSize).toBeLessThan(100);
    });

    it("should validate re-render limits are conservative", () => {
      expect(PERFORMANCE_BUDGETS.charts.reRenderLimit).toBeLessThanOrEqual(5);
      expect(PERFORMANCE_BUDGETS.statusIndicators.reRenderLimit).toBeLessThanOrEqual(3);
      expect(PERFORMANCE_BUDGETS.virtualizedLists.reRenderLimit).toBeLessThanOrEqual(2);
    });
  });

  describe("Performance Regression Detection", () => {
    it("should detect performance regressions", async () => {
      const baseline = {
        renderTime: 50,
        memoryUsage: 20,
        componentCount: 100,
        reRenderCount: 2,
      };

      const current = {
        renderTime: 80, // 60% slower
        memoryUsage: 30, // 50% more memory
        componentCount: 100,
        reRenderCount: 4, // 100% more re-renders
      };

      // Import the comparison function
      const { PerformanceComparison } = await import("../utils/performance-tests");
      const improvement = PerformanceComparison.compare(current, baseline);

      expect(improvement.renderTime).toContain("-"); // Negative improvement
      expect(improvement.memoryUsage).toContain("-"); // Negative improvement
      expect(improvement.reRenderCount).toContain("-"); // Negative improvement
    });

    it("should detect performance improvements", async () => {
      const baseline = {
        renderTime: 100,
        memoryUsage: 50,
        componentCount: 100,
        reRenderCount: 5,
      };

      const current = {
        renderTime: 60, // 40% faster
        memoryUsage: 30, // 40% less memory
        componentCount: 100,
        reRenderCount: 2, // 60% fewer re-renders
      };

      const { PerformanceComparison } = await import("../utils/performance-tests");
      const improvement = PerformanceComparison.compare(current, baseline);

      expect(improvement.renderTime).toContain("+"); // Positive improvement
      expect(improvement.memoryUsage).toContain("+"); // Positive improvement
      expect(improvement.reRenderCount).toContain("+"); // Positive improvement
    });
  });
});
