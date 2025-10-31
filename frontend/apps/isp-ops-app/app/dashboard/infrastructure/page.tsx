"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Activity,
  Server,
  Database,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  Settings,
  ArrowUpRight,
  Cpu,
  HardDrive,
  Network,
  Clock,
  Zap,
} from "lucide-react";
import { metricsService, InfrastructureMetrics } from "@/lib/services/metrics-service";
import { AlertBanner } from "@/components/alerts/AlertBanner";
import { RouteGuard } from "@/components/auth/PermissionGuard";

interface SystemHealthStatus {
  service: string;
  status: "healthy" | "degraded" | "down";
  latency?: number;
  lastCheck: string;
}

function SystemHealthPanel({ services }: { services: SystemHealthStatus[] }) {
  const statusColors = {
    healthy: "text-green-400 bg-green-400/10",
    degraded: "text-yellow-400 bg-yellow-400/10",
    down: "text-red-400 bg-red-400/10",
  };

  const statusIcons = {
    healthy: CheckCircle,
    degraded: AlertTriangle,
    down: XCircle,
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h3 className="text-lg font-semibold text-foreground mb-4">System Health</h3>
      <div className="space-y-3">
        {services.map((service) => {
          const Icon = statusIcons[service.status];
          return (
            <div key={service.service} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${statusColors[service.status]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm text-muted-foreground">{service.service}</span>
              </div>
              <div className="flex items-center gap-4">
                {service.latency && (
                  <span className="text-xs text-muted-foreground">{service.latency}ms</span>
                )}
                <span
                  className={`text-xs font-medium ${
                    service.status === "healthy"
                      ? "text-green-400"
                      : service.status === "degraded"
                        ? "text-yellow-400"
                        : "text-red-400"
                  }`}
                >
                  {service.status.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-4 border-t border-border">
        <Link
          href="/dashboard/infrastructure/health"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          View detailed health metrics →
        </Link>
      </div>
    </div>
  );
}

interface ResourceUsage {
  resource: string;
  used: number;
  total: number;
  unit: string;
  icon: React.ElementType;
}

function ResourceUsageCard({ resource, used, total, unit, icon: Icon }: ResourceUsage) {
  const percentage = (used / total) * 100;
  const isHigh = percentage > 80;
  const isMedium = percentage > 60;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{resource}</span>
        </div>
        <span
          className={`text-sm font-medium ${
            isHigh ? "text-red-400" : isMedium ? "text-yellow-400" : "text-green-400"
          }`}
        >
          {percentage.toFixed(1)}%
        </span>
      </div>
      <div className="space-y-2">
        <div className="h-2 bg-accent rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isHigh
                ? "bg-red-500 dark:bg-red-400"
                : isMedium
                  ? "bg-yellow-500 dark:bg-yellow-400"
                  : "bg-green-500 dark:bg-green-400"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {used.toFixed(1)} {unit}
          </span>
          <span>
            {total.toFixed(1)} {unit}
          </span>
        </div>
      </div>
    </div>
  );
}

interface IncidentItem {
  id: string;
  title: string;
  severity: "critical" | "warning" | "info";
  service: string;
  timestamp: string;
  status: "open" | "investigating" | "resolved";
}

function IncidentsList({ incidents }: { incidents: IncidentItem[] }) {
  const severityColors = {
    critical: "text-red-400 bg-red-400/10",
    warning: "text-yellow-400 bg-yellow-400/10",
    info: "text-blue-400 bg-blue-400/10",
  };

  const statusColors = {
    open: "text-red-400",
    investigating: "text-yellow-400",
    resolved: "text-green-400",
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Recent Incidents</h3>
        <Link
          href="/dashboard/infrastructure/incidents"
          className="text-sm text-sky-400 hover:text-sky-300"
        >
          View all →
        </Link>
      </div>
      <div className="divide-y divide-border max-h-96 overflow-y-auto">
        {incidents.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground">No active incidents</div>
        ) : (
          incidents.map((incident) => (
            <div key={incident.id} className="p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className={`p-1.5 rounded-lg ${severityColors[incident.severity]}`}>
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{incident.title}</p>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-muted-foreground">{incident.service}</span>
                    <span className={`text-xs ${statusColors[incident.status]}`}>
                      {incident.status}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {incident.timestamp}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function InfrastructurePageContent() {
  const [metrics, setMetrics] = useState<InfrastructureMetrics | null>(null);
  const [healthStatus, setHealthStatus] = useState<SystemHealthStatus[]>([]);
  const [resourceUsage, setResourceUsage] = useState<ResourceUsage[]>([]);
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInfrastructureData();
    // Refresh metrics every 30 seconds
    const interval = setInterval(fetchInfrastructureData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchInfrastructureData = async () => {
    try {
      setLoading(true);

      // Fetch infrastructure metrics from the metrics service
      const infraMetrics = await metricsService.getInfrastructureMetrics();
      setMetrics(infraMetrics);

      // Convert health data to SystemHealthStatus format
      const services: SystemHealthStatus[] = infraMetrics.health.services.map((service) => ({
        service: service.name,
        status:
          service.status === "healthy"
            ? "healthy"
            : service.status === "degraded"
              ? "degraded"
              : "down",
        latency: service.latency,
        lastCheck: "Just now",
      }));

      // Add default services if not in the response
      if (!services.find((s) => s.service === "API Gateway")) {
        services.unshift({
          service: "API Gateway",
          status: infraMetrics.health.status === "critical" ? "down" : infraMetrics.health.status,
          latency: infraMetrics.performance.avgLatency,
          lastCheck: "Just now",
        });
      }

      setHealthStatus(services);

      // Update resource usage with real metrics
      setResourceUsage([
        {
          resource: "CPU Usage",
          used: infraMetrics.resources.cpu,
          total: 100,
          unit: "%",
          icon: Cpu,
        },
        {
          resource: "Memory",
          used: infraMetrics.resources.memory,
          total: 100,
          unit: "%",
          icon: HardDrive,
        },
        {
          resource: "Disk",
          used: infraMetrics.resources.disk,
          total: 100,
          unit: "%",
          icon: Database,
        },
        {
          resource: "Network",
          used: infraMetrics.resources.network,
          total: 100,
          unit: "%",
          icon: Network,
        },
      ]);

      // Generate incidents based on metrics
      const newIncidents: IncidentItem[] = [];

      if (infraMetrics.health.status === "degraded") {
        newIncidents.push({
          id: "health-degraded",
          title: "System Health Degraded",
          severity: "warning",
          service: "Health Monitor",
          timestamp: "Active",
          status: "investigating",
        });
      }

      if (infraMetrics.performance.errorRate > 1) {
        newIncidents.push({
          id: "high-errors",
          title: `High Error Rate: ${infraMetrics.performance.errorRate}%`,
          severity: "critical",
          service: "API Gateway",
          timestamp: "Current",
          status: "open",
        });
      }

      if (infraMetrics.performance.p99Latency > 500) {
        newIncidents.push({
          id: "high-latency",
          title: `High P99 Latency: ${infraMetrics.performance.p99Latency}ms`,
          severity: "warning",
          service: "Performance",
          timestamp: "Active",
          status: "investigating",
        });
      }

      if (infraMetrics.logs.errors > 100) {
        newIncidents.push({
          id: "log-errors",
          title: `${infraMetrics.logs.errors} errors in logs`,
          severity: "warning",
          service: "Logging",
          timestamp: "Last hour",
          status: "open",
        });
      }

      setIncidents(newIncidents);
    } catch (err) {
      console.error("Failed to fetch infrastructure metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  const overallHealth = healthStatus.every((s) => s.status === "healthy")
    ? "healthy"
    : healthStatus.some((s) => s.status === "down")
      ? "degraded"
      : "warning";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Infrastructure</h1>
        <p className="mt-2 text-muted-foreground">
          Monitor system health, performance metrics, and manage infrastructure
        </p>
      </div>

      {/* Alert Banner - Shows system and performance alerts */}
      <AlertBanner category="system" maxAlerts={3} />

      {/* Overall Status */}
      <div
        className={`rounded-lg border p-6 ${
          overallHealth === "healthy"
            ? "border-green-900/20 bg-green-950/20 dark:border-green-800/30 dark:bg-green-900/20"
            : overallHealth === "warning"
              ? "border-yellow-900/20 bg-yellow-950/20 dark:border-yellow-800/30 dark:bg-yellow-900/20"
              : "border-red-900/20 bg-red-950/20 dark:border-red-800/30 dark:bg-red-900/20"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {overallHealth === "healthy" ? (
              <CheckCircle className="h-6 w-6 text-green-400" />
            ) : overallHealth === "warning" ? (
              <AlertTriangle className="h-6 w-6 text-yellow-400" />
            ) : (
              <XCircle className="h-6 w-6 text-red-400" />
            )}
            <div>
              <p
                className={`font-semibold ${
                  overallHealth === "healthy"
                    ? "text-green-400"
                    : overallHealth === "warning"
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                System Status:{" "}
                {overallHealth === "healthy"
                  ? "All Systems Operational"
                  : overallHealth === "warning"
                    ? "Partial Service Disruption"
                    : "Major Service Outage"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Uptime: {metrics?.health.uptime || 0}% • RPS:{" "}
                {metrics?.performance.requestsPerSecond || 0}
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/infrastructure/status"
            className="px-4 py-2 bg-accent hover:bg-muted text-foreground rounded-lg text-sm font-medium transition-colors"
          >
            View Status Page
          </Link>
        </div>
      </div>

      {/* Resource Usage */}
      <div>
        <h2 className="text-xl font-semibold text-foreground mb-4">Resource Usage</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {resourceUsage.map((resource) => (
            <ResourceUsageCard key={resource.resource} {...resource} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Incidents */}
          <IncidentsList incidents={incidents} />

          {/* Quick Actions */}
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-4">
              Infrastructure Management
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                href="/dashboard/infrastructure/health"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg">
                  <Activity className="h-5 w-5 text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Health Checks</p>
                  <p className="text-sm text-muted-foreground">Service monitoring</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/infrastructure/logs"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg">
                  <BarChart3 className="h-5 w-5 text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Logs & Metrics</p>
                  <p className="text-sm text-muted-foreground">
                    {metrics?.logs.totalLogs || 0} logs • {metrics?.logs.errors || 0} errors
                  </p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/infrastructure/observability"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg">
                  <Zap className="h-5 w-5 text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Observability</p>
                  <p className="text-sm text-muted-foreground">Tracing & APM</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>

              <Link
                href="/dashboard/infrastructure/feature-flags"
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
              >
                <div className="p-2 bg-accent rounded-lg">
                  <Settings className="h-5 w-5 text-sky-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Feature Flags</p>
                  <p className="text-sm text-muted-foreground">Toggle features</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            </div>
          </div>
        </div>

        {/* System Health */}
        <div className="lg:col-span-1">
          <SystemHealthPanel services={healthStatus} />
        </div>
      </div>
    </div>
  );
}

export default function InfrastructurePage() {
  return (
    <RouteGuard permission="infrastructure.read">
      <InfrastructurePageContent />
    </RouteGuard>
  );
}
