/**
 * Network Monitoring Dashboard
 *
 * Real-time network health and performance monitoring.
 * Shared between ISP Ops and Platform Admin applications.
 */

"use client";

import { useToast } from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge, type BadgeProps } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  WifiOff,
  Server,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Bell,
  BellOff,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

export enum DeviceStatus {
  ONLINE = "online",
  OFFLINE = "offline",
  DEGRADED = "degraded",
  UNKNOWN = "unknown",
}

export enum AlertSeverity {
  CRITICAL = "critical",
  WARNING = "warning",
  INFO = "info",
}

export enum DeviceType {
  ONT = "ont",
  OLT = "olt",
  ROUTER = "router",
  SWITCH = "switch",
  SERVER = "server",
}

export interface NetworkOverview {
  total_devices: number;
  online_devices: number;
  offline_devices: number;
  active_alerts: number;
  critical_alerts: number;
  warning_alerts: number;
  total_bandwidth_in_bps: number;
  total_bandwidth_out_bps: number;
  peak_bandwidth_in_bps?: number;
  peak_bandwidth_out_bps?: number;
  data_source_status: Record<string, string>;
  device_type_summary: DeviceTypeSummary[];
}

export interface DeviceHealth {
  device_id: string;
  device_name: string;
  device_type: string;
  status: DeviceStatus;
  cpu_usage_percent?: number;
  memory_usage_percent?: number;
  uptime_seconds?: number;
}

export interface NetworkAlert {
  alert_id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  device_id?: string;
  device_name?: string;
  is_acknowledged: boolean;
  created_at: string;
}

export interface DeviceTypeSummary {
  device_type: string;
  total_count: number;
  online_count: number;
  offline_count: number;
  degraded_count: number;
  avg_cpu_usage?: number;
  avg_memory_usage?: number;
}

export interface NetworkMonitoringDashboardProps {
  apiClient: {
    get: <T = any>(url: string, config?: any) => Promise<{ data: T }>;
    post: <T = any>(url: string, data?: any, config?: any) => Promise<{ data: T }>;
  };
  logger?: {
    error: (message: string, error: any) => void;
  };
}

// Helper functions for status badges
const getStatusBadge = (status: DeviceStatus) => {
  switch (status) {
    case DeviceStatus.ONLINE:
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Online
        </Badge>
      );
    case DeviceStatus.OFFLINE:
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Offline
        </Badge>
      );
    case DeviceStatus.DEGRADED:
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Degraded
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          <WifiOff className="w-3 h-3 mr-1" />
          Unknown
        </Badge>
      );
  }
};

const getSeverityBadge = (severity: AlertSeverity) => {
  switch (severity) {
    case AlertSeverity.CRITICAL:
      return <Badge variant="destructive">Critical</Badge>;
    case AlertSeverity.WARNING:
      return <Badge variant="secondary">Warning</Badge>;
    case AlertSeverity.INFO:
      return <Badge variant="outline">Info</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatBandwidth = (bps: number) => {
  if (bps === 0) return "0 bps";
  const k = 1000;
  const sizes = ["bps", "Kbps", "Mbps", "Gbps"];
  const i = Math.floor(Math.log(bps) / Math.log(k));
  return `${(bps / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

export function NetworkMonitoringDashboard({ apiClient, logger }: NetworkMonitoringDashboardProps) {
  const { toast } = useToast();

  const [overview, setOverview] = useState<NetworkOverview | null>(null);
  const [devices, setDevices] = useState<DeviceHealth[]>([]);
  const [alerts, setAlerts] = useState<NetworkAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);

      // Fetch overview
      const overviewResponse = await apiClient.get<NetworkOverview>("/network/overview");
      setOverview(overviewResponse.data);

      // Fetch top devices (limited)
      const devicesResponse = await apiClient.get<DeviceHealth[]>("/network/devices", {
        params: { limit: 10 },
      });
      setDevices(devicesResponse.data);

      // Fetch recent alerts
      const alertsResponse = await apiClient.get<NetworkAlert[]>("/network/alerts", {
        params: { active_only: true, limit: 5 },
      });
      setAlerts(alertsResponse.data);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail || err.message || "Failed to load network monitoring data";
      setError(errorMessage);
      if (logger) {
        logger.error("Failed to fetch network monitoring data", err);
      } else {
        console.error("Failed to fetch network monitoring data", err);
      }
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast, apiClient, logger]);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleRefresh = () => {
    fetchDashboardData();
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await apiClient.post(`/network/alerts/${alertId}/acknowledge`, {
        note: "Acknowledged from dashboard",
      });

      toast({
        title: "Success",
        description: "Alert acknowledged successfully",
      });

      // Refresh alerts
      fetchDashboardData();
    } catch (err: any) {
      if (logger) {
        logger.error("Failed to acknowledge alert", err);
      } else {
        console.error("Failed to acknowledge alert", err);
      }
      toast({
        title: "Error",
        description: "Failed to acknowledge alert",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-gray-600">{error}</p>
        <Button onClick={handleRefresh} className="mt-4">
          Try Again
        </Button>
      </div>
    );
  }

  const dataSourceEntries = Object.entries(overview?.data_source_status ?? {});

  return (
    <div className="space-y-6">
      {/* Header with refresh button */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Network Monitoring</h2>
          <p className="text-gray-600">Real-time network health and performance</p>
        </div>
        <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Data Source Status */}
      <Card>
        <CardHeader>
          <CardTitle>Data Source Status</CardTitle>
          <CardDescription>Monitoring backends contributing to this overview</CardDescription>
        </CardHeader>
        <CardContent>
          {dataSourceEntries.length === 0 ? (
            <p className="text-gray-600 text-sm">No data source telemetry reported yet.</p>
          ) : (
            <div className="space-y-3">
              {dataSourceEntries.map(([name, status]) => {
                const normalized = status.toLowerCase();
                let variant: BadgeProps["variant"] = "success";
                let badgeLabel = "OK";

                if (normalized.includes("error") || normalized.includes("failed")) {
                  variant = "destructive";
                  badgeLabel = "Error";
                } else if (
                  normalized.includes("no ") ||
                  normalized.includes("skip") ||
                  normalized.includes("unavailable") ||
                  normalized.includes("pending")
                ) {
                  variant = "warning";
                  badgeLabel = "Info";
                }

                return (
                  <div
                    key={name}
                    className="flex items-start justify-between rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium capitalize">{name.replace(/\./g, " ")}</p>
                      <p className="text-xs text-gray-600 mt-1 break-words">{status}</p>
                    </div>
                    <Badge variant={variant}>{badgeLabel}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overview Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Devices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Server className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.total_devices || 0}</div>
            <div className="text-xs text-gray-600 mt-1 space-x-2">
              <span className="text-green-600">{overview?.online_devices || 0} online</span>
              <span className="text-red-600">{overview?.offline_devices || 0} offline</span>
            </div>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Bell className="w-4 h-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.active_alerts || 0}</div>
            <div className="text-xs text-gray-600 mt-1 space-x-2">
              <span className="text-red-600">{overview?.critical_alerts || 0} critical</span>
              <span className="text-yellow-600">{overview?.warning_alerts || 0} warnings</span>
            </div>
          </CardContent>
        </Card>

        {/* Bandwidth In */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth In</CardTitle>
            <TrendingDown className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBandwidth(overview?.total_bandwidth_in_bps || 0)}
            </div>
            {overview?.peak_bandwidth_in_bps && (
              <div className="text-xs text-gray-600 mt-1">
                Peak: {formatBandwidth(overview.peak_bandwidth_in_bps)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bandwidth Out */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth Out</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatBandwidth(overview?.total_bandwidth_out_bps || 0)}
            </div>
            {overview?.peak_bandwidth_out_bps && (
              <div className="text-xs text-gray-600 mt-1">
                Peak: {formatBandwidth(overview.peak_bandwidth_out_bps)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Devices */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Devices</CardTitle>
            <CardDescription>Latest device health status</CardDescription>
          </CardHeader>
          <CardContent>
            {devices.length === 0 ? (
              <p className="text-gray-600 text-center py-4">No devices found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>CPU</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => (
                    <TableRow key={device.device_id}>
                      <TableCell className="font-medium">{device.device_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{device.device_type.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell>{getStatusBadge(device.status)}</TableCell>
                      <TableCell>
                        {device.cpu_usage_percent !== undefined
                          ? `${device.cpu_usage_percent.toFixed(1)}%`
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Alerts</CardTitle>
            <CardDescription>Active network alerts</CardDescription>
          </CardHeader>
          <CardContent>
            {alerts.length === 0 ? (
              <div className="text-center py-8">
                <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-600">No active alerts</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className="flex items-start justify-between p-3 border rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getSeverityBadge(alert.severity)}
                        <span className="text-sm font-medium">{alert.title}</span>
                      </div>
                      <p className="text-xs text-gray-600">{alert.description}</p>
                      {alert.device_name && (
                        <p className="text-xs text-gray-500 mt-1">Device: {alert.device_name}</p>
                      )}
                    </div>
                    {!alert.is_acknowledged && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleAcknowledgeAlert(alert.alert_id)}
                      >
                        Acknowledge
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Device Type Summary */}
      {overview?.device_type_summary && overview.device_type_summary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Device Summary by Type</CardTitle>
            <CardDescription>Breakdown of devices by type and status</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device Type</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Online</TableHead>
                  <TableHead>Offline</TableHead>
                  <TableHead>Degraded</TableHead>
                  <TableHead>Avg CPU</TableHead>
                  <TableHead>Avg Memory</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.device_type_summary.map((summary) => (
                  <TableRow key={summary.device_type}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{summary.device_type.toUpperCase()}</Badge>
                    </TableCell>
                    <TableCell>{summary.total_count}</TableCell>
                    <TableCell className="text-green-600">{summary.online_count}</TableCell>
                    <TableCell className="text-red-600">{summary.offline_count}</TableCell>
                    <TableCell className="text-yellow-600">{summary.degraded_count}</TableCell>
                    <TableCell>
                      {summary.avg_cpu_usage !== undefined
                        ? `${summary.avg_cpu_usage.toFixed(1)}%`
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      {summary.avg_memory_usage !== undefined
                        ? `${summary.avg_memory_usage.toFixed(1)}%`
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
