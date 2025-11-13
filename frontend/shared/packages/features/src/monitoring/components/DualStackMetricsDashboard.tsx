/**
 * Dual-Stack Metrics Dashboard Component
 *
 * Displays comprehensive dual-stack IPv4/IPv6 infrastructure metrics
 * including subscriber allocation, IP utilization, connectivity, and performance.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Server,
  Wifi,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

export interface MetricsData {
  subscriber_metrics: {
    total_subscribers: number;
    dual_stack_subscribers: number;
    ipv4_only_subscribers: number;
    ipv6_only_subscribers: number;
    dual_stack_percentage: number;
  };
  ip_allocation_metrics: {
    total_ipv4_allocated: number;
    total_ipv6_allocated: number;
    ipv4_pool_utilization: number;
    ipv6_prefix_utilization: number;
    available_ipv4_addresses: number;
    available_ipv6_prefixes: number;
  };
  traffic_metrics: {
    ipv4_traffic_percentage: number;
    ipv6_traffic_percentage: number;
    ipv4_bandwidth_mbps: number;
    ipv6_bandwidth_mbps: number;
  };
  connectivity_metrics: {
    ipv4_reachable_devices: number;
    ipv6_reachable_devices: number;
    dual_stack_reachable_devices: number;
    ipv4_connectivity_percentage: number;
    ipv6_connectivity_percentage: number;
  };
  performance_metrics: {
    avg_ipv4_latency_ms: number;
    avg_ipv6_latency_ms: number;
    ipv4_packet_loss_percentage: number;
    ipv6_packet_loss_percentage: number;
  };
  wireguard_metrics: {
    wireguard_servers: number;
    wireguard_dual_stack_servers: number;
    wireguard_peers: number;
    wireguard_dual_stack_peers: number;
  };
  migration_metrics: {
    migration_started: number;
    migration_completed: number;
    migration_failed: number;
    migration_progress_percentage: number;
  };
}

export interface DualStackAlert {
  severity: "critical" | "warning";
  metric: string;
  value: number;
  threshold: number;
  message: string;
}

export function DualStackMetricsDashboard() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [alerts, setAlerts] = useState<DualStackAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [metricsRes, alertsRes] = await Promise.all([
          fetch("/metrics/dual-stack/current"),
          fetch("/metrics/dual-stack/alerts"),
        ]);

        if (!metricsRes.ok || !alertsRes.ok) {
          throw new Error("Failed to fetch metrics");
        }

        const metricsData = await metricsRes.json();
        const alertsData = await alertsRes.json();

        setMetrics(metricsData);
        setAlerts(alertsData.alerts || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Refresh every 30s

    return () => clearInterval(interval);
  }, []);

  const getUtilizationColor = (percentage: number): string => {
    if (percentage >= 85) return "text-red-600";
    if (percentage >= 70) return "text-yellow-600";
    return "text-green-600";
  };

  const getHealthStatus = () => {
    const criticalAlerts = alerts.filter((a) => a.severity === "critical");
    const warningAlerts = alerts.filter((a) => a.severity === "warning");

    if (criticalAlerts.length > 0)
      return { status: "critical", icon: XCircle, color: "text-red-600" };
    if (warningAlerts.length > 0)
      return {
        status: "warning",
        icon: AlertTriangle,
        color: "text-yellow-600",
      };
    return { status: "healthy", icon: CheckCircle2, color: "text-green-600" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading metrics...</p>
        </div>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error || "Failed to load metrics"}</AlertDescription>
      </Alert>
    );
  }

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  return (
    <div className="space-y-6">
      {/* Header with Health Status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dual-Stack Metrics Dashboard</h1>
          <p className="text-muted-foreground">Monitor IPv4/IPv6 infrastructure performance</p>
        </div>
        <div className="flex items-center gap-2">
          <HealthIcon className={`h-6 w-6 ${health.color}`} />
          <Badge
            variant={
              health.status === "critical"
                ? "destructive"
                : health.status === "warning"
                  ? "default"
                  : "outline"
            }
          >
            {health.status.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <Alert key={idx} variant={alert.severity === "critical" ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>
                {alert.severity.toUpperCase()}: {alert.metric}
              </AlertTitle>
              <AlertDescription>{alert.message}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.subscriber_metrics.total_subscribers.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.subscriber_metrics.dual_stack_subscribers} dual-stack (
              {metrics.subscriber_metrics.dual_stack_percentage.toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IPv4 Pool Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getUtilizationColor(metrics.ip_allocation_metrics.ipv4_pool_utilization)}`}
            >
              {metrics.ip_allocation_metrics.ipv4_pool_utilization.toFixed(1)}%
            </div>
            <Progress
              value={metrics.ip_allocation_metrics.ipv4_pool_utilization}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">IPv6 Prefix Utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${getUtilizationColor(metrics.ip_allocation_metrics.ipv6_prefix_utilization)}`}
            >
              {metrics.ip_allocation_metrics.ipv6_prefix_utilization.toFixed(1)}%
            </div>
            <Progress
              value={metrics.ip_allocation_metrics.ipv6_prefix_utilization}
              className="mt-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dual-Stack Adoption</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.subscriber_metrics.dual_stack_percentage.toFixed(1)}%
            </div>
            <Progress value={metrics.subscriber_metrics.dual_stack_percentage} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Detailed Metrics Tabs */}
      <Tabs defaultValue="connectivity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="connectivity">Connectivity</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="traffic">Traffic</TabsTrigger>
          <TabsTrigger value="wireguard">WireGuard VPN</TabsTrigger>
          <TabsTrigger value="migration">Migration</TabsTrigger>
        </TabsList>

        <TabsContent value="connectivity" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>IPv4 Connectivity</CardTitle>
                <CardDescription>Reachable devices over IPv4</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics.connectivity_metrics.ipv4_connectivity_percentage.toFixed(1)}%
                </div>
                <Progress
                  value={metrics.connectivity_metrics.ipv4_connectivity_percentage}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {metrics.connectivity_metrics.ipv4_reachable_devices} devices reachable
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>IPv6 Connectivity</CardTitle>
                <CardDescription>Reachable devices over IPv6</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics.connectivity_metrics.ipv6_connectivity_percentage.toFixed(1)}%
                </div>
                <Progress
                  value={metrics.connectivity_metrics.ipv6_connectivity_percentage}
                  className="mt-2"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  {metrics.connectivity_metrics.ipv6_reachable_devices} devices reachable
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Average Latency</CardTitle>
                <CardDescription>Network latency comparison</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">IPv4</span>
                    <span className="text-sm font-bold">
                      {metrics.performance_metrics.avg_ipv4_latency_ms.toFixed(2)} ms
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      (metrics.performance_metrics.avg_ipv4_latency_ms / 100) * 100,
                      100,
                    )}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">IPv6</span>
                    <span className="text-sm font-bold">
                      {metrics.performance_metrics.avg_ipv6_latency_ms.toFixed(2)} ms
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      (metrics.performance_metrics.avg_ipv6_latency_ms / 100) * 100,
                      100,
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Packet Loss</CardTitle>
                <CardDescription>Network packet loss rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">IPv4</span>
                    <span className="text-sm font-bold">
                      {metrics.performance_metrics.ipv4_packet_loss_percentage.toFixed(2)}%
                    </span>
                  </div>
                  <Progress
                    value={metrics.performance_metrics.ipv4_packet_loss_percentage * 10}
                    className={
                      metrics.performance_metrics.ipv4_packet_loss_percentage > 5
                        ? "bg-red-200"
                        : ""
                    }
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">IPv6</span>
                    <span className="text-sm font-bold">
                      {metrics.performance_metrics.ipv6_packet_loss_percentage.toFixed(2)}%
                    </span>
                  </div>
                  <Progress
                    value={metrics.performance_metrics.ipv6_packet_loss_percentage * 10}
                    className={
                      metrics.performance_metrics.ipv6_packet_loss_percentage > 5
                        ? "bg-red-200"
                        : ""
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="traffic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Traffic Distribution</CardTitle>
              <CardDescription>IPv4 vs IPv6 traffic breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">IPv4 Traffic</span>
                  <span className="text-sm font-bold">
                    {metrics.traffic_metrics.ipv4_traffic_percentage.toFixed(1)}% (
                    {metrics.traffic_metrics.ipv4_bandwidth_mbps.toFixed(0)} Mbps)
                  </span>
                </div>
                <Progress value={metrics.traffic_metrics.ipv4_traffic_percentage} />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">IPv6 Traffic</span>
                  <span className="text-sm font-bold">
                    {metrics.traffic_metrics.ipv6_traffic_percentage.toFixed(1)}% (
                    {metrics.traffic_metrics.ipv6_bandwidth_mbps.toFixed(0)} Mbps)
                  </span>
                </div>
                <Progress value={metrics.traffic_metrics.ipv6_traffic_percentage} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wireguard" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>WireGuard Servers</CardTitle>
                <CardDescription>VPN server status</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Servers</span>
                    <span className="font-bold">{metrics.wireguard_metrics.wireguard_servers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Dual-Stack Servers</span>
                    <span className="font-bold">
                      {metrics.wireguard_metrics.wireguard_dual_stack_servers}
                    </span>
                  </div>
                  <Progress
                    value={
                      metrics.wireguard_metrics.wireguard_servers > 0
                        ? (metrics.wireguard_metrics.wireguard_dual_stack_servers /
                            metrics.wireguard_metrics.wireguard_servers) *
                          100
                        : 0
                    }
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>WireGuard Peers</CardTitle>
                <CardDescription>Connected VPN peers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Peers</span>
                    <span className="font-bold">{metrics.wireguard_metrics.wireguard_peers}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Dual-Stack Peers</span>
                    <span className="font-bold">
                      {metrics.wireguard_metrics.wireguard_dual_stack_peers}
                    </span>
                  </div>
                  <Progress
                    value={
                      metrics.wireguard_metrics.wireguard_peers > 0
                        ? (metrics.wireguard_metrics.wireguard_dual_stack_peers /
                            metrics.wireguard_metrics.wireguard_peers) *
                          100
                        : 0
                    }
                    className="mt-2"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="migration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Migration Progress</CardTitle>
              <CardDescription>IPv4-only to dual-stack migration status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className="text-2xl font-bold">
                    {metrics.migration_metrics.migration_progress_percentage.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={metrics.migration_metrics.migration_progress_percentage}
                  className="h-4"
                />
              </div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {metrics.migration_metrics.migration_started}
                  </div>
                  <div className="text-xs text-muted-foreground">Started</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.migration_metrics.migration_completed}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {metrics.migration_metrics.migration_failed}
                  </div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
