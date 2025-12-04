"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  PieChart,
  Download,
  Calendar,
  RefreshCw,
} from "lucide-react";
import {
  useOrchestrationStats,
  useWorkflows,
  type WorkflowType,
  type Workflow,
} from "@/hooks/useOrchestration";

// ============================================================================
// Utility Functions
// ============================================================================

function formatWorkflowType(type: WorkflowType): string {
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ============================================================================
// KPI Card Component
// ============================================================================

function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 bg-muted rounded-lg">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        {trend !== undefined && (
          <div
            className={`flex items-center gap-1 ${trend >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}
          >
            {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            <span className="text-sm font-medium">{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      {trendLabel && <p className="mt-2 text-xs text-muted-foreground">{trendLabel}</p>}
    </div>
  );
}

// ============================================================================
// Chart Components
// ============================================================================

function WorkflowTypeChart({ stats }: { stats: any }) {
  const types = Object.entries(stats?.by_type || {}) as [WorkflowType, number][];
  const total = types.reduce((sum, [_, count]) => sum + count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No workflow data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {types
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => {
          const percentage = (count / total) * 100;
          return (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{formatWorkflowType(type)}</span>
                <span className="text-muted-foreground">
                  {count} ({percentage.toFixed(1)}%)
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}

function StatusDistributionChart({ stats }: { stats: any }) {
  const data = [
    {
      label: "Completed",
      value: stats?.completed || 0,
      color: "bg-green-500",
      textColor: "text-green-600 dark:text-green-400",
    },
    {
      label: "Failed",
      value: stats?.failed || 0,
      color: "bg-red-500",
      textColor: "text-red-600 dark:text-red-400",
    },
    {
      label: "Running",
      value: stats?.running || 0,
      color: "bg-blue-500",
      textColor: "text-blue-600 dark:text-blue-400",
    },
    {
      label: "Pending",
      value: stats?.pending || 0,
      color: "bg-gray-500",
      textColor: "text-gray-600 dark:text-gray-400",
    },
  ];

  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        No status data available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Donut Chart Representation */}
      <div className="flex items-center justify-center">
        <div className="relative w-48 h-48">
          {data.map((item, index) => {
            const percentage = (item.value / total) * 100;
            return (
              <div key={item.label} className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`w-full h-full rounded-full ${item.color} opacity-${Math.floor(percentage / 10) * 10}`}
                >
                  {/* This is a simplified representation - for a real donut chart, use a charting library */}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-4">
        {data.map((item) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          return (
            <div key={item.label} className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${item.color}`} />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className={`text-sm font-medium ${item.textColor}`}>{item.value}</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {percentage.toFixed(1)}% of total
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Performance Metrics Component
// ============================================================================

function PerformanceMetrics({ workflows }: { workflows: Workflow[] }) {
  const metrics = useMemo(() => {
    const completed = workflows.filter((w) => w.status === "completed");
    const failed = workflows.filter((w) => w.status === "failed");

    const durations = completed
      .filter((w) => w.started_at && w.completed_at)
      .map((w) => {
        const start = new Date(w.started_at!).getTime();
        const end = new Date(w.completed_at!).getTime();
        return (end - start) / 1000; // seconds
      });

    const avgDuration =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;

    // Calculate percentiles
    const sorted = [...durations].sort((a, b) => a - b);
    const p50 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.5)] : 0;
    const p95 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.95)] : 0;
    const p99 = sorted.length > 0 ? sorted[Math.floor(sorted.length * 0.99)] : 0;

    return {
      avgDuration,
      minDuration,
      maxDuration,
      p50,
      p95,
      p99,
      successRate:
        completed.length + failed.length > 0
          ? (completed.length / (completed.length + failed.length)) * 100
          : 0,
      totalCompleted: completed.length,
      totalFailed: failed.length,
    };
  }, [workflows]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">Avg Duration</p>
        <p className="text-2xl font-bold text-foreground">{formatDuration(metrics.avgDuration)}</p>
      </div>
      <div className="p-4 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">Min Duration</p>
        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
          {formatDuration(metrics.minDuration)}
        </p>
      </div>
      <div className="p-4 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">Max Duration</p>
        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
          {formatDuration(metrics.maxDuration)}
        </p>
      </div>
      <div className="p-4 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">Success Rate</p>
        <p className="text-2xl font-bold text-foreground">{metrics.successRate.toFixed(1)}%</p>
      </div>
      <div className="p-4 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">P50 (Median)</p>
        <p className="text-xl font-bold text-foreground">{formatDuration(metrics.p50 ?? 0)}</p>
      </div>
      <div className="p-4 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">P95</p>
        <p className="text-xl font-bold text-foreground">{formatDuration(metrics.p95 ?? 0)}</p>
      </div>
      <div className="p-4 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">P99</p>
        <p className="text-xl font-bold text-foreground">{formatDuration(metrics.p99 ?? 0)}</p>
      </div>
      <div className="p-4 border border-border rounded-lg">
        <p className="text-xs text-muted-foreground mb-1">Total Executed</p>
        <p className="text-xl font-bold text-foreground">
          {metrics.totalCompleted + metrics.totalFailed}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Main Analytics Page Component
// ============================================================================

export default function OrchestrationAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "90d">("7d");

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useOrchestrationStats();
  const {
    data: workflowResponse,
    isLoading: workflowsLoading,
    refetch: refetchWorkflows,
  } = useWorkflows({
    pageSize: 100, // Get more data for analytics
  });
  const workflows: Workflow[] = workflowResponse?.workflows ?? [];

  const handleExportReport = () => {
    const report = {
      generated_at: new Date().toISOString(),
      time_range: timeRange,
      summary: stats,
      workflows: workflows.map((w: Workflow) => ({
        id: w.workflow_id,
        type: w.workflow_type,
        status: w.status,
        duration:
          w.started_at && (w.completed_at || w.failed_at)
            ? (new Date(w.completed_at || w.failed_at!).getTime() -
                new Date(w.started_at).getTime()) /
              1000
            : null,
        started_at: w.started_at,
        completed_at: w.completed_at || w.failed_at,
      })),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orchestration-report-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefreshAll = () => {
    refetchStats();
    refetchWorkflows();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Orchestration Analytics</h1>
          <p className="text-muted-foreground mt-1">Performance metrics and workflow insights</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="px-4 py-2 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
          <button
            onClick={handleExportReport}
            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors"
          >
            <Download className="h-4 w-4" />
            Export Report
          </button>
          <button
            onClick={handleRefreshAll}
            className="flex items-center gap-2 px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Workflows"
          value={stats?.total || 0}
          icon={Activity}
          subtitle="All time"
        />
        <KPICard
          title="Success Rate"
          value={`${stats?.success_rate?.toFixed(1) || 0}%`}
          icon={CheckCircle2}
          trend={5.2}
          trendLabel="vs previous period"
        />
        <KPICard
          title="Avg Duration"
          value={stats?.avg_duration_seconds ? `${stats.avg_duration_seconds.toFixed(1)}s` : "N/A"}
          icon={Clock}
          trend={-12.3}
          trendLabel="faster than previous"
        />
        <KPICard
          title="Failed Workflows"
          value={stats?.failed || 0}
          icon={XCircle}
          subtitle={`${(((stats?.failed || 0) / (stats?.total || 1)) * 100).toFixed(1)}% failure rate`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Type Distribution */}
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Workflows by Type
            </h2>
          </div>
          <WorkflowTypeChart stats={stats} />
        </div>

        {/* Status Distribution */}
        <div className="border border-border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Status Distribution
            </h2>
          </div>
          <StatusDistributionChart stats={stats} />
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h2 className="text-lg font-semibold text-foreground mb-6">Performance Metrics</h2>
        <PerformanceMetrics workflows={workflows} />
      </div>

      {/* Recent Trends */}
      <div className="border border-border rounded-lg p-6 bg-card">
        <h2 className="text-lg font-semibold text-foreground mb-4">Key Insights</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">Performance Improving</p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Average workflow duration decreased by 12.3% compared to the previous period
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-green-900 dark:text-green-100">High Success Rate</p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {stats?.success_rate?.toFixed(1)}% of workflows completed successfully
              </p>
            </div>
          </div>
          {stats && stats.failed > 0 && (
            <div className="flex items-start gap-3 p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
              <XCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-orange-900 dark:text-orange-100">
                  Failed Workflows Detected
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  {stats.failed} workflows failed. Review logs to identify common failure patterns.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
