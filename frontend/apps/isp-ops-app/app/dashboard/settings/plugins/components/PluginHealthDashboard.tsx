"use client";

import { useState } from "react";
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  AlertCircle,
  Info,
} from "lucide-react";
import type { PluginInstance, PluginHealthCheck } from "@/hooks/usePlugins";
import { logger } from "@/lib/logger";
const toError = (error: unknown) =>
  error instanceof Error ? error : new Error(typeof error === "string" ? error : String(error));

interface PluginHealthDashboardProps {
  instances: PluginInstance[];
  healthChecks: PluginHealthCheck[];
  onRefresh: () => Promise<void>;
}

const getHealthStatusIcon = (status: string) => {
  switch (status) {
    case "healthy":
      return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    case "unhealthy":
      return <XCircle className="h-5 w-5 text-rose-500" />;
    case "error":
      return <AlertCircle className="h-5 w-5 text-rose-500" />;
    case "unknown":
    default:
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
  }
};

const getHealthStatusColor = (status: string) => {
  switch (status) {
    case "healthy":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
    case "unhealthy":
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    case "error":
      return "bg-rose-500/10 text-rose-400 border-rose-500/20";
    case "unknown":
    default:
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }
};

const formatResponseTime = (ms?: number) => {
  if (ms === undefined) return "N/A";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatTimestamp = (timestamp: string) => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString();
  } catch {
    return "Unknown";
  }
};

export const PluginHealthDashboard = ({
  instances,
  healthChecks,
  onRefresh,
}: PluginHealthDashboardProps) => {
  const [loading, setLoading] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      await onRefresh();
    } catch (error) {
      // Handle refresh errors gracefully
      logger.error("Failed to refresh plugin health checks", toError(error));
      // Error is logged but doesn't crash the UI
      // Could add toast notification here in the future
    } finally {
      setLoading(false);
    }
  };

  // Calculate health statistics
  const healthStats = healthChecks.reduce(
    (stats, health) => {
      stats[health.status] = (stats[health.status] || 0) + 1;
      return stats;
    },
    {} as Record<string, number>,
  );

  const totalInstances = instances.length;
  const healthyCount = healthStats["healthy"] || 0;
  const unhealthyCount = (healthStats["unhealthy"] || 0) + (healthStats["error"] || 0);
  const unknownCount = healthStats["unknown"] || 0;

  const healthPercentage =
    totalInstances > 0 ? Math.round((healthyCount / totalInstances) * 100) : 0;

  // Get average response time
  const responseTimes = healthChecks
    .map((h) => h.response_time_ms)
    .filter((time): time is number => time !== undefined);
  const avgResponseTime =
    responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;

  // Combine instance data with health data
  const instancesWithHealth = instances.map((instance) => {
    const health = healthChecks.find((h) => h.plugin_instance_id === instance.id);
    return {
      ...instance,
      health,
    };
  });

  // Sort by health status (unhealthy first)
  const sortedInstances = instancesWithHealth.sort((a, b) => {
    if (!a.health && !b.health) return 0;
    if (!a.health) return 1;
    if (!b.health) return -1;

    const statusPriority = { error: 0, unhealthy: 1, unknown: 2, healthy: 3 };
    return statusPriority[a.health.status] - statusPriority[b.health.status];
  });

  return (
    <div className="space-y-6" data-testid="plugin-health-dashboard">
      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4" data-testid="plugin-stats">
        <div className="bg-card/50 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-2xl font-semibold text-foreground"
                data-testid="health-percentage"
              >
                {healthPercentage}%
              </div>
              <div className="text-sm text-muted-foreground">Overall Health</div>
            </div>
            <div
              className={`p-2 rounded-full ${
                healthPercentage >= 90
                  ? "bg-emerald-500/10"
                  : healthPercentage >= 70
                    ? "bg-amber-500/10"
                    : "bg-rose-500/10"
              }`}
            >
              {healthPercentage >= 90 ? (
                <TrendingUp className="h-6 w-6 text-emerald-500" />
              ) : (
                <TrendingDown
                  className={`h-6 w-6 ${
                    healthPercentage >= 70 ? "text-amber-500" : "text-rose-500"
                  }`}
                />
              )}
            </div>
          </div>
          <div className="mt-2 h-2 bg-accent rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                healthPercentage >= 90
                  ? "bg-emerald-500"
                  : healthPercentage >= 70
                    ? "bg-amber-500"
                    : "bg-rose-500"
              }`}
              style={{ width: `${healthPercentage}%` }}
            />
          </div>
        </div>

        <div className="bg-card/50 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-2xl font-semibold text-foreground"
                data-testid="health-healthy-count"
              >
                {healthyCount}
              </div>
              <div className="text-sm text-muted-foreground">Healthy</div>
            </div>
            <CheckCircle className="h-8 w-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-card/50 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-2xl font-semibold text-foreground"
                data-testid="health-issues-count"
              >
                {unhealthyCount}
              </div>
              <div className="text-sm text-muted-foreground">Issues</div>
            </div>
            <XCircle className="h-8 w-8 text-rose-500" />
          </div>
        </div>

        <div className="bg-card/50 border border-border rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div
                className="text-2xl font-semibold text-foreground"
                data-testid="health-avg-response"
              >
                {formatResponseTime(avgResponseTime)}
              </div>
              <div className="text-sm text-muted-foreground">Avg Response</div>
            </div>
            <Zap className="h-8 w-8 text-sky-500" />
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Plugin Health Status</h2>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 bg-sky-500 hover:bg-sky-600 disabled:bg-muted text-white rounded-lg transition-colors flex items-center gap-2"
          data-testid="refresh-health-button"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Checking..." : "Refresh Health"}
        </button>
      </div>

      {/* Health Status List */}
      <div className="space-y-3">
        {sortedInstances.map((instance) => {
          const health = instance.health;
          const isSelected = selectedInstance === instance.id;

          return (
            <div
              key={instance.id}
              className="bg-card/50 border border-border rounded-lg overflow-hidden"
              data-testid="health-instance"
            >
              <div
                className={`p-4 cursor-pointer transition-colors ${
                  isSelected ? "bg-accent/50" : "hover:bg-accent/30"
                }`}
                onClick={() => setSelectedInstance(isSelected ? null : instance.id)}
                data-testid="health-instance-row"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getHealthStatusIcon(health?.status || "unknown")}
                    <div>
                      <h3 className="font-medium text-foreground">{instance.instance_name}</h3>
                      <p className="text-sm text-muted-foreground">{instance.plugin_name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right text-sm">
                      <div className="text-foreground">
                        {formatResponseTime(health?.response_time_ms ?? undefined)}
                      </div>
                      <div className="text-muted-foreground">Response Time</div>
                    </div>

                    <div
                      className={`px-3 py-1 rounded-full border text-sm font-medium ${getHealthStatusColor(
                        health?.status || "unknown",
                      )}`}
                    >
                      {health?.status || "unknown"}
                    </div>
                  </div>
                </div>

                {/* Health Message */}
                <div className="mt-2 text-sm text-muted-foreground">
                  {health?.message || "No health data available"}
                </div>

                {/* Last Check Time */}
                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Last checked: {health?.timestamp ? formatTimestamp(health.timestamp) : "Never"}
                </div>
              </div>

              {/* Expanded Details */}
              {isSelected && health && (
                <div className="border-t border-border p-4 bg-accent/20">
                  <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Health Check Details
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Basic Info */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Status:</span>
                        <span
                          className={`font-medium ${
                            health.status === "healthy"
                              ? "text-emerald-400"
                              : health.status === "unhealthy"
                                ? "text-rose-400"
                                : health.status === "error"
                                  ? "text-rose-400"
                                  : "text-amber-400"
                          }`}
                        >
                          {health.status}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Response Time:</span>
                        <span className="text-foreground">
                          {formatResponseTime(health.response_time_ms ?? undefined)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Timestamp:</span>
                        <span className="text-foreground">{formatTimestamp(health.timestamp)}</span>
                      </div>
                    </div>

                    {/* Additional Details */}
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-muted-foreground">
                        Additional Information
                      </h5>
                      {Object.entries(health.details).length > 0 ? (
                        Object.entries(health.details).map(([key, value]) => (
                          <div key={key} className="flex justify-between text-sm">
                            <span className="text-muted-foreground capitalize">
                              {key.replace(/_/g, " ")}:
                            </span>
                            <span className="text-foreground max-w-48 truncate">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No additional details available
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Error Information */}
                  {instance.last_error && (
                    <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-rose-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <h5 className="text-sm font-medium text-rose-400 mb-1">Last Error</h5>
                          <p className="text-sm text-rose-300">{instance.last_error}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {sortedInstances.length === 0 && (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No Plugin Instances</h3>
            <p className="text-muted-foreground">
              Add some plugin instances to monitor their health status.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
