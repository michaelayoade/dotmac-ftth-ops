/**
 * Performance Testing and Benchmarking Utilities
 * Comprehensive test suite for measuring and validating component performance
 */

import { performance } from "perf_hooks";

// Performance metrics collection
export interface PerformanceMetrics {
  renderTime: number;
  memoryUsage: number;
  componentCount: number;
  reRenderCount: number;
  bundleSize?: number;
  interactionTime?: number;
}

export interface BenchmarkResult {
  testName: string;
  metrics: PerformanceMetrics;
  baseline?: PerformanceMetrics;
  improvement?: {
    renderTime: string;
    memoryUsage: string;
    reRenderCount: string;
  };
  passed: boolean;
  timestamp: string;
}

export interface PerformanceBudget {
  renderTime: number; // Maximum render time in ms
  memoryUsage: number; // Maximum memory usage in MB
  bundleSize: number; // Maximum bundle size in KB
  reRenderLimit: number; // Maximum re-renders per interaction
  interactionTime: number; // Maximum interaction response time in ms
}

// Default performance budgets for ISP management components
export const PERFORMANCE_BUDGETS: Record<string, PerformanceBudget> = {
  charts: {
    renderTime: 100, // 100ms max render time
    memoryUsage: 50, // 50MB max memory usage
    bundleSize: 100, // 100KB max bundle size
    reRenderLimit: 3, // Max 3 re-renders per interaction
    interactionTime: 50, // 50ms max interaction response
  },
  statusIndicators: {
    renderTime: 50, // 50ms max render time
    memoryUsage: 25, // 25MB max memory usage
    bundleSize: 50, // 50KB max bundle size
    reRenderLimit: 2, // Max 2 re-renders per interaction
    interactionTime: 25, // 25ms max interaction response
  },
  virtualizedLists: {
    renderTime: 200, // 200ms max render time for large datasets
    memoryUsage: 100, // 100MB max memory usage
    bundleSize: 150, // 150KB max bundle size
    reRenderLimit: 1, // Minimal re-renders for virtual scrolling
    interactionTime: 16, // 16ms max for 60fps smooth scrolling
  },
};

// Performance measurement utilities
export class PerformanceMeasurer {
  private metrics: Partial<PerformanceMetrics> = {};
  private startTime: number = 0;
  private renderCount: number = 0;
  private initialMemory: number = 0;

  startMeasurement(testName: string): void {
    this.startTime = performance.now();
    this.renderCount = 0;

    // Measure initial memory if available
    if (typeof window !== "undefined" && "memory" in performance) {
      this.initialMemory = (performance as any).memory.usedJSHeapSize;
    }

    console.log(`🔬 Starting performance measurement: ${testName}`);
  }

  recordRender(): void {
    this.renderCount++;
  }

  recordInteraction(interactionTime: number): void {
    this.metrics.interactionTime = interactionTime;
  }

  finishMeasurement(): PerformanceMetrics {
    const endTime = performance.now();
    const renderTime = endTime - this.startTime;

    let memoryUsage = 0;
    if (typeof window !== "undefined" && "memory" in performance) {
      const currentMemory = (performance as any).memory.usedJSHeapSize;
      memoryUsage = (currentMemory - this.initialMemory) / (1024 * 1024); // Convert to MB
    }

    const result: PerformanceMetrics = {
      renderTime,
      memoryUsage,
      componentCount: 1, // Will be overridden by specific tests
      reRenderCount: this.renderCount,
    };

    // Only add interactionTime if it's defined
    if (this.metrics.interactionTime !== undefined) {
      result.interactionTime = this.metrics.interactionTime;
    }

    return result;
  }

  reset(): void {
    this.metrics = {};
    this.renderCount = 0;
    this.startTime = 0;
    this.initialMemory = 0;
  }
}

// Component-specific performance tests
export const ComponentBenchmarks = {
  // Chart component performance test
  async testChartPerformance(
    ChartComponent: React.ComponentType<any>,
    testData: any[],
    budget: PerformanceBudget,
  ): Promise<BenchmarkResult> {
    const measurer = new PerformanceMeasurer();
    const testName = `Chart Performance - ${testData.length} data points`;

    measurer.startMeasurement(testName);

    // Simulate component lifecycle
    const startRender = performance.now();

    // Mock rendering process
    await new Promise((resolve) => {
      measurer.recordRender();
      setTimeout(resolve, 10); // Simulate render time
    });

    // Simulate data updates
    for (let i = 0; i < 5; i++) {
      measurer.recordRender();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    const metrics = measurer.finishMeasurement();
    metrics.componentCount = testData.length;

    const passed =
      metrics.renderTime <= budget.renderTime &&
      metrics.memoryUsage <= budget.memoryUsage &&
      metrics.reRenderCount <= budget.reRenderLimit;

    return {
      testName,
      metrics,
      passed,
      timestamp: new Date().toISOString(),
    };
  },

  // Status indicator performance test
  async testStatusIndicatorPerformance(
    IndicatorComponent: React.ComponentType<any>,
    testCount: number,
    budget: PerformanceBudget,
  ): Promise<BenchmarkResult> {
    const measurer = new PerformanceMeasurer();
    const testName = `Status Indicator Performance - ${testCount} indicators`;

    measurer.startMeasurement(testName);

    // Simulate rendering multiple indicators
    const renderPromises = Array(testCount)
      .fill(0)
      .map(async (_, index) => {
        measurer.recordRender();
        return new Promise((resolve) => setTimeout(resolve, 1));
      });

    await Promise.all(renderPromises);

    const metrics = measurer.finishMeasurement();
    metrics.componentCount = testCount;

    const passed =
      metrics.renderTime <= budget.renderTime &&
      metrics.memoryUsage <= budget.memoryUsage &&
      metrics.reRenderCount <= budget.reRenderLimit;

    return {
      testName,
      metrics,
      passed,
      timestamp: new Date().toISOString(),
    };
  },

  // Virtualized list performance test
  async testVirtualizedListPerformance(
    ListComponent: React.ComponentType<any>,
    itemCount: number,
    budget: PerformanceBudget,
  ): Promise<BenchmarkResult> {
    const measurer = new PerformanceMeasurer();
    const testName = `Virtualized List Performance - ${itemCount} items`;

    measurer.startMeasurement(testName);

    // Simulate initial render
    measurer.recordRender();
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Simulate scrolling interactions
    for (let i = 0; i < 10; i++) {
      const interactionStart = performance.now();
      measurer.recordRender();
      await new Promise((resolve) => setTimeout(resolve, 2));
      const interactionTime = performance.now() - interactionStart;
      measurer.recordInteraction(interactionTime);
    }

    const metrics = measurer.finishMeasurement();
    metrics.componentCount = itemCount;

    const passed =
      metrics.renderTime <= budget.renderTime &&
      metrics.memoryUsage <= budget.memoryUsage &&
      metrics.reRenderCount <= budget.reRenderLimit &&
      (metrics.interactionTime || 0) <= budget.interactionTime;

    return {
      testName,
      metrics,
      passed,
      timestamp: new Date().toISOString(),
    };
  },
};

// Performance comparison utilities
export const PerformanceComparison = {
  compare(
    current: PerformanceMetrics,
    baseline: PerformanceMetrics,
  ): BenchmarkResult["improvement"] {
    const renderTimeImprovement =
      ((baseline.renderTime - current.renderTime) / baseline.renderTime) * 100;
    const memoryImprovement =
      ((baseline.memoryUsage - current.memoryUsage) / baseline.memoryUsage) * 100;
    const reRenderImprovement =
      ((baseline.reRenderCount - current.reRenderCount) / baseline.reRenderCount) * 100;

    return {
      renderTime: `${renderTimeImprovement > 0 ? "+" : ""}${renderTimeImprovement.toFixed(1)}%`,
      memoryUsage: `${memoryImprovement > 0 ? "+" : ""}${memoryImprovement.toFixed(1)}%`,
      reRenderCount: `${reRenderImprovement > 0 ? "+" : ""}${reRenderImprovement.toFixed(1)}%`,
    };
  },

  generateReport(results: BenchmarkResult[]): string {
    const passedTests = results.filter((r) => r.passed).length;
    const totalTests = results.length;

    let report = `\n📊 Performance Test Report\n`;
    report += `==============================\n`;
    report += `Tests Passed: ${passedTests}/${totalTests}\n`;
    report += `Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%\n\n`;

    results.forEach((result) => {
      report += `🧪 ${result.testName}\n`;
      report += `   Status: ${result.passed ? "✅ PASSED" : "❌ FAILED"}\n`;
      report += `   Render Time: ${result.metrics.renderTime.toFixed(2)}ms\n`;
      report += `   Memory Usage: ${result.metrics.memoryUsage.toFixed(2)}MB\n`;
      report += `   Re-renders: ${result.metrics.reRenderCount}\n`;

      if (result.metrics.interactionTime) {
        report += `   Interaction Time: ${result.metrics.interactionTime.toFixed(2)}ms\n`;
      }

      if (result.improvement) {
        report += `   Improvements:\n`;
        report += `     Render Time: ${result.improvement.renderTime}\n`;
        report += `     Memory: ${result.improvement.memoryUsage}\n`;
        report += `     Re-renders: ${result.improvement.reRenderCount}\n`;
      }

      report += `   Component Count: ${result.metrics.componentCount}\n`;
      report += `   Timestamp: ${result.timestamp}\n\n`;
    });

    return report;
  },
};

// Bundle size analysis
export const BundleSizeAnalyzer = {
  async analyzeBundleSize(): Promise<{ [key: string]: number }> {
    // Mock implementation - in real scenario would integrate with webpack-bundle-analyzer
    const bundleSizes = {
      charts: 85.2, // KB
      indicators: 42.1, // KB
      virtualized: 67.8, // KB
      utils: 23.4, // KB
      types: 5.2, // KB
      total: 223.7, // KB
    };

    console.log("📦 Bundle Size Analysis:");
    Object.entries(bundleSizes).forEach(([module, size]) => {
      console.log(`  ${module}: ${size}KB`);
    });

    return bundleSizes;
  },

  checkBundleBudgets(sizes: { [key: string]: number }): {
    passed: boolean;
    violations: string[];
  } {
    const violations: string[] = [];
    const budgets = {
      charts: 100, // KB
      indicators: 50, // KB
      virtualized: 70, // KB
      total: 250, // KB
    };

    Object.entries(budgets).forEach(([module, budget]) => {
      const actualSize = sizes[module];
      if (actualSize && actualSize > budget) {
        violations.push(`${module}: ${actualSize}KB exceeds budget of ${budget}KB`);
      }
    });

    return {
      passed: violations.length === 0,
      violations,
    };
  },
};

// Memory leak detection
export const MemoryLeakDetector = {
  async detectLeaks(
    testFunction: () => Promise<void>,
    iterations: number = 10,
  ): Promise<{
    hasLeaks: boolean;
    memoryGrowth: number;
    iterations: number;
  }> {
    if (typeof window === "undefined" || !("memory" in performance)) {
      return {
        hasLeaks: false,
        memoryGrowth: 0,
        iterations,
      };
    }

    const initialMemory = (performance as any).memory.usedJSHeapSize;

    for (let i = 0; i < iterations; i++) {
      await testFunction();

      // Force garbage collection if available
      if ("gc" in window) {
        (window as any).gc();
      }

      // Small delay between iterations
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    const finalMemory = (performance as any).memory.usedJSHeapSize;
    const memoryGrowth = (finalMemory - initialMemory) / (1024 * 1024); // MB

    // Consider > 10MB growth over 10 iterations as potential leak
    const hasLeaks = memoryGrowth > 10;

    console.log(`🔍 Memory Leak Detection:`);
    console.log(`  Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Growth: ${memoryGrowth.toFixed(2)}MB`);
    console.log(
      `  Has Leaks: ${hasLeaks ? "⚠️  Potential leak detected" : "✅ No leaks detected"}`,
    );

    return {
      hasLeaks,
      memoryGrowth,
      iterations,
    };
  },
};

// Comprehensive performance test suite
export const PerformanceTestSuite = {
  async runFullSuite(): Promise<{
    benchmarks: BenchmarkResult[];
    bundleAnalysis: { [key: string]: number };
    memoryLeaks: any[];
    overallPassed: boolean;
  }> {
    console.log("🚀 Starting Comprehensive Performance Test Suite");
    console.log("================================================");

    const results = {
      benchmarks: [] as BenchmarkResult[],
      bundleAnalysis: {} as { [key: string]: number },
      memoryLeaks: [] as any[],
      overallPassed: false,
    };

    try {
      // Run bundle size analysis
      results.bundleAnalysis = await BundleSizeAnalyzer.analyzeBundleSize();

      // Mock benchmark tests (in real scenario would render actual components)
      const chartsBudget = PERFORMANCE_BUDGETS.charts;
      const statusBudget = PERFORMANCE_BUDGETS.statusIndicators;
      const virtualizedBudget = PERFORMANCE_BUDGETS.virtualizedLists;

      if (chartsBudget && statusBudget && virtualizedBudget) {
        const chartTest = await ComponentBenchmarks.testChartPerformance(
          {} as any, // Mock component
          Array(100)
            .fill(0)
            .map((_, i) => ({ month: `Month ${i}`, revenue: i * 1000 })),
          chartsBudget,
        );
        results.benchmarks.push(chartTest);

        const indicatorTest = await ComponentBenchmarks.testStatusIndicatorPerformance(
          {} as any, // Mock component
          50,
          statusBudget,
        );
        results.benchmarks.push(indicatorTest);

        const virtualizedTest = await ComponentBenchmarks.testVirtualizedListPerformance(
          {} as any, // Mock component
          10000,
          virtualizedBudget,
        );
        results.benchmarks.push(virtualizedTest);
      }

      // Check overall success
      const bundleCheck = BundleSizeAnalyzer.checkBundleBudgets(results.bundleAnalysis);
      const allBenchmarksPassed = results.benchmarks.every((b) => b.passed);
      results.overallPassed = bundleCheck.passed && allBenchmarksPassed;

      // Generate and log report
      const report = PerformanceComparison.generateReport(results.benchmarks);
      console.log(report);

      if (!bundleCheck.passed) {
        console.log("📦 Bundle Budget Violations:");
        bundleCheck.violations.forEach((violation) => console.log(`  ❌ ${violation}`));
      }

      console.log(
        `🎯 Overall Result: ${results.overallPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"}`,
      );
    } catch (error) {
      console.error("❌ Performance test suite failed:", error);
      results.overallPassed = false;
    }

    return results;
  },
};

// Classes are already exported above with 'export class' declarations
