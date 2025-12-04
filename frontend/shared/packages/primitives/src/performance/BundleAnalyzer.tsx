/**
 * Bundle Analysis Component for Performance Monitoring
 * Tracks bundle sizes, chunk loading, and provides optimization insights
 */
import React, { useEffect, useState, useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle, FileText, Zap } from "lucide-react";

interface BundleMetric {
  name: string;
  size: number;
  gzipSize: number;
  loadTime: number;
  isAsync: boolean;
  dependencies: string[];
}

interface BundleAnalysisProps {
  /**
   * Performance budget thresholds in KB
   */
  budgets?: {
    main: number;
    vendor: number;
    async: number;
    total: number;
  };
  /**
   * Enable real-time monitoring
   */
  realTimeMonitoring?: boolean;
  /**
   * Show detailed breakdown
   */
  showDetails?: boolean;
  /**
   * Callback when budget is exceeded
   */
  onBudgetExceeded?: (metric: string, actual: number, budget: number) => void;
}

const defaultBudgets = {
  main: 250, // 250KB
  vendor: 500, // 500KB
  async: 100, // 100KB per chunk
  total: 1000, // 1MB total
};

export function BundleAnalyzer({
  budgets = defaultBudgets,
  realTimeMonitoring = false,
  showDetails = false,
  onBudgetExceeded,
}: BundleAnalysisProps) {
  const [metrics, setMetrics] = useState<BundleMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [performanceScore, setPerformanceScore] = useState(0);

  // Analyze bundle metrics
  const analysis = useMemo(() => {
    if (metrics.length === 0) return null;

    const main = metrics.find((m) => m.name === "main") || {
      size: 0,
      gzipSize: 0,
    };
    const vendor = metrics.find((m) => m.name === "vendor") || {
      size: 0,
      gzipSize: 0,
    };
    const asyncChunks = metrics.filter((m) => m.isAsync);
    const totalSize = metrics.reduce((sum, m) => sum + m.gzipSize, 0);

    const issues: Array<{ type: "warning" | "error"; message: string }> = [];

    // Check budgets
    if (main.gzipSize > budgets.main) {
      issues.push({
        type: "error",
        message: `Main bundle (${Math.round(main.gzipSize)}KB) exceeds budget (${budgets.main}KB)`,
      });
      onBudgetExceeded?.("main", main.gzipSize, budgets.main);
    }

    if (vendor.gzipSize > budgets.vendor) {
      issues.push({
        type: "error",
        message: `Vendor bundle (${Math.round(vendor.gzipSize)}KB) exceeds budget (${budgets.vendor}KB)`,
      });
      onBudgetExceeded?.("vendor", vendor.gzipSize, budgets.vendor);
    }

    if (totalSize > budgets.total) {
      issues.push({
        type: "error",
        message: `Total bundle size (${Math.round(totalSize)}KB) exceeds budget (${budgets.total}KB)`,
      });
      onBudgetExceeded?.("total", totalSize, budgets.total);
    }

    asyncChunks.forEach((chunk) => {
      if (chunk.gzipSize > budgets.async) {
        issues.push({
          type: "warning",
          message: `Async chunk "${chunk.name}" (${Math.round(chunk.gzipSize)}KB) exceeds budget (${budgets.async}KB)`,
        });
      }
    });

    // Calculate performance score (0-100)
    const mainScore = Math.max(0, 100 - (main.gzipSize / budgets.main) * 100);
    const vendorScore = Math.max(0, 100 - (vendor.gzipSize / budgets.vendor) * 100);
    const totalScore = Math.max(0, 100 - (totalSize / budgets.total) * 100);
    const avgAsyncScore =
      asyncChunks.length > 0
        ? asyncChunks.reduce(
            (sum, chunk) => sum + Math.max(0, 100 - (chunk.gzipSize / budgets.async) * 100),
            0,
          ) / asyncChunks.length
        : 100;

    const score = Math.round((mainScore + vendorScore + totalScore + avgAsyncScore) / 4);

    return {
      main,
      vendor,
      asyncChunks,
      totalSize,
      issues,
      score,
      recommendations: generateRecommendations(metrics, issues),
    };
  }, [metrics, budgets, onBudgetExceeded]);

  // Collect bundle metrics
  useEffect(() => {
    const collectMetrics = async () => {
      setIsLoading(true);

      try {
        // In a real implementation, this would collect actual webpack stats
        // For now, we'll simulate the metrics
        const simulatedMetrics: BundleMetric[] = [
          {
            name: "main",
            size: 280000, // 280KB
            gzipSize: 95000, // 95KB gzipped
            loadTime: 150,
            isAsync: false,
            dependencies: ["react", "react-dom"],
          },
          {
            name: "vendor",
            size: 850000, // 850KB
            gzipSize: 280000, // 280KB gzipped
            loadTime: 420,
            isAsync: false,
            dependencies: ["@tanstack/react-query", "lucide-react"],
          },
          {
            name: "dashboard",
            size: 120000, // 120KB
            gzipSize: 35000, // 35KB gzipped
            loadTime: 85,
            isAsync: true,
            dependencies: ["recharts"],
          },
          {
            name: "billing",
            size: 95000, // 95KB
            gzipSize: 28000, // 28KB gzipped
            loadTime: 65,
            isAsync: true,
            dependencies: ["stripe"],
          },
        ];

        setMetrics(simulatedMetrics);

        // Calculate performance score
        const score = calculatePerformanceScore(simulatedMetrics);
        setPerformanceScore(score);
      } catch (error) {
        console.error("Failed to collect bundle metrics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    collectMetrics();

    if (realTimeMonitoring) {
      const interval = setInterval(collectMetrics, 30000); // Update every 30s
      return () => clearInterval(interval);
    }

    return undefined;
  }, [realTimeMonitoring]);

  if (isLoading) {
    return (
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
          <span className="text-gray-600">Analyzing bundle performance...</span>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <div className="text-center text-gray-500">No bundle metrics available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Performance Score */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Bundle Performance</h3>
          <div className="flex items-center gap-2">
            {analysis.score >= 80 ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : analysis.score >= 60 ? (
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            )}
            <span
              className={`text-2xl font-bold ${
                analysis.score >= 80
                  ? "text-green-600"
                  : analysis.score >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {analysis.score}
            </span>
          </div>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              analysis.score >= 80
                ? "bg-green-500"
                : analysis.score >= 60
                  ? "bg-yellow-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${analysis.score}%` }}
          />
        </div>
      </div>

      {/* Bundle Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Main Bundle"
          size={analysis.main.gzipSize}
          budget={budgets.main}
          icon={<Zap className="h-5 w-5" />}
        />
        <MetricCard
          title="Vendor Bundle"
          size={analysis.vendor.gzipSize}
          budget={budgets.vendor}
          icon={<FileText className="h-5 w-5" />}
        />
        <MetricCard
          title="Total Size"
          size={analysis.totalSize}
          budget={budgets.total}
          icon={<Activity className="h-5 w-5" />}
        />
      </div>

      {/* Issues */}
      {analysis.issues.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Performance Issues</h4>
          <div className="space-y-2">
            {analysis.issues.map((issue, index) => (
              <div
                key={index}
                className={`flex items-start gap-2 p-3 rounded-lg ${
                  issue.type === "error" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700"
                }`}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5" />
                <span className="text-sm">{issue.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Async Chunks */}
      {analysis.asyncChunks.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Async Chunks</h4>
          <div className="space-y-2">
            {analysis.asyncChunks.map((chunk, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 rounded border border-gray-100"
              >
                <span className="font-medium text-gray-900">{chunk.name}</span>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">
                    {Math.round(chunk.gzipSize / 1024)}KB
                  </span>
                  <span className="text-sm text-gray-600">{chunk.loadTime}ms</span>
                  <div
                    className={`w-2 h-2 rounded-full ${
                      chunk.gzipSize <= budgets.async ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations.length > 0 && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h4 className="text-md font-semibold text-blue-900 mb-3">Optimization Recommendations</h4>
          <ul className="space-y-2">
            {analysis.recommendations.map((rec, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-blue-800">
                <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Detailed View */}
      {showDetails && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold text-gray-900 mb-3">Detailed Analysis</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2">Bundle</th>
                  <th className="text-right py-2">Raw Size</th>
                  <th className="text-right py-2">Gzipped</th>
                  <th className="text-right py-2">Load Time</th>
                  <th className="text-left py-2">Dependencies</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 font-medium">{metric.name}</td>
                    <td className="text-right py-2">{Math.round(metric.size / 1024)}KB</td>
                    <td className="text-right py-2">{Math.round(metric.gzipSize / 1024)}KB</td>
                    <td className="text-right py-2">{metric.loadTime}ms</td>
                    <td className="py-2 text-gray-600">{metric.dependencies.join(", ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  title,
  size,
  budget,
  icon,
}: {
  title: string;
  size: number;
  budget: number;
  icon: React.ReactNode;
}) {
  const percentage = (size / budget) * 100;
  const isOverBudget = percentage > 100;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`p-1 rounded ${isOverBudget ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600"}`}
        >
          {icon}
        </div>
        <h4 className="font-medium text-gray-900">{title}</h4>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold text-gray-900">{Math.round(size / 1024)}KB</span>
          <span className="text-sm text-gray-600">of {Math.round(budget)}KB</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${
              isOverBudget ? "bg-red-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(100, percentage)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function calculatePerformanceScore(metrics: BundleMetric[]): number {
  // Simplified scoring algorithm
  const totalSize = metrics.reduce((sum, m) => sum + m.gzipSize, 0);
  const totalLoadTime = metrics.reduce((sum, m) => sum + m.loadTime, 0);

  // Penalties for large sizes and slow load times
  const sizePenalty = Math.max(0, (totalSize - 500000) / 10000); // Penalty after 500KB
  const timePenalty = Math.max(0, (totalLoadTime - 1000) / 100); // Penalty after 1s

  return Math.max(0, Math.round(100 - sizePenalty - timePenalty));
}

function generateRecommendations(
  metrics: BundleMetric[],
  issues: Array<{ type: string; message: string }>,
): string[] {
  const recommendations: string[] = [];

  if (issues.length > 0) {
    const mainBundle = metrics.find((m) => m.name === "main");
    const vendorBundle = metrics.find((m) => m.name === "vendor");

    if (mainBundle && mainBundle.gzipSize > 100000) {
      recommendations.push("Consider code splitting to reduce main bundle size");
    }

    if (vendorBundle && vendorBundle.gzipSize > 300000) {
      recommendations.push(
        "Analyze vendor dependencies and consider lazy loading non-critical libraries",
      );
    }

    const largeAsyncChunks = metrics.filter((m) => m.isAsync && m.gzipSize > 50000);
    if (largeAsyncChunks.length > 0) {
      recommendations.push("Break down large async chunks into smaller, more focused modules");
    }

    recommendations.push("Enable gzip compression on your server");
    recommendations.push("Consider using dynamic imports for rarely used features");
    recommendations.push("Use webpack-bundle-analyzer to identify duplicate dependencies");
  }

  return recommendations;
}

export type { BundleMetric, BundleAnalysisProps };
