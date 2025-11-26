"use client";

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = "force-dynamic";

/**
 * Network Device Monitoring Dashboard
 *
 * Comprehensive network monitoring with device health, traffic stats, and alerts
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  useNetworkDashboardGraphQL,
  useNetworkDeviceListGraphQL,
  useNetworkAlertListGraphQL,
} from "@/hooks/useNetworkGraphQL";
import { DeviceTypeEnum, DeviceStatusEnum, AlertSeverityEnum } from "@/lib/graphql/generated";
import {
  Server,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Loader2,
  Activity,
} from "lucide-react";
import { logger } from "@/lib/logger";

export default function NetworkMonitoringPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeviceStatusEnum | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<DeviceTypeEnum | undefined>(undefined);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [showDeviceDetail, setShowDeviceDetail] = useState(false);
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<AlertSeverityEnum | undefined>(
    undefined,
  );
  const [alertSortBy, setAlertSortBy] = useState<"time" | "severity">("time");
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  // Fetch dashboard data using GraphQL
  const {
    overview,
    isLoading: dashboardLoading,
    refetch: refetchDashboard,
  } = useNetworkDashboardGraphQL({
    pollInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch devices with filters
  const {
    devices,
    isLoading: devicesLoading,
    refetch: refetchDevices,
  } = useNetworkDeviceListGraphQL({
    pageSize: 100,
    status: statusFilter,
    deviceType: typeFilter,
    search: searchTerm || undefined,
    pollInterval: 30000,
  });

  // Fetch alerts
  const {
    alerts,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useNetworkAlertListGraphQL({
    pageSize: 50,
    pollInterval: 30000,
  });

  const isLoading = dashboardLoading || devicesLoading || alertsLoading;

  // Transform devices for compatibility
  const filteredDevices = devices.map((d) => ({
    ...d,
    device_name: d.deviceName,
    device_type: d.deviceType,
    ip_address: d.ipAddress,
    status: d.status,
  }));

  // Get selected device details
  const selectedDevice = selectedDeviceId
    ? filteredDevices.find((d) => d.deviceId === selectedDeviceId)
    : null;

  // Filter and sort alerts
  const filteredAlerts = alerts
    .filter((alert) => {
      if (alertSeverityFilter && alert.severity !== alertSeverityFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (alertSortBy === "severity") {
        const severityOrder = {
          [AlertSeverityEnum.Critical]: 0,
          [AlertSeverityEnum.Warning]: 1,
          [AlertSeverityEnum.Info]: 2,
        };
        return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
      }
      // Sort by time (newest first)
      return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime();
    });

  // Helper functions
  const getStatusColor = (status: DeviceStatusEnum | string) => {
    const statusStr = typeof status === "string" ? status : status;
    switch (statusStr) {
      case "ONLINE":
        return "bg-green-500";
      case "DEGRADED":
        return "bg-yellow-500";
      case "OFFLINE":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusBadgeVariant = (status: DeviceStatusEnum | string) => {
    const statusStr = typeof status === "string" ? status : status;
    switch (statusStr) {
      case "ONLINE":
        return "default";
      case "DEGRADED":
        return "warning";
      case "OFFLINE":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const handleRefresh = () => {
    refetchDashboard();
    refetchDevices();
    refetchAlerts();
  };

  const getSeverityIcon = (severity: AlertSeverityEnum) => {
    switch (severity) {
      case AlertSeverityEnum.Critical:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case AlertSeverityEnum.Warning:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case AlertSeverityEnum.Info:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatBps = (bps: number) => {
    if (bps === 0) return "0 bps";
    const k = 1000;
    const sizes = ["bps", "Kbps", "Mbps", "Gbps"];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    return `${(bps / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const handleAcknowledgeAlert = async (alertId: string) => {
    setIsAcknowledging(true);
    try {
      // Use GraphQL mutation to acknowledge the alert
      const mutation = `
        mutation AcknowledgeAlert($alertId: ID!) {
          acknowledgeAlert(alertId: $alertId) {
            id
            acknowledged
            acknowledgedAt
            acknowledgedBy
          }
        }
      `;

      const response = await fetch("/api/v1/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: mutation,
          variables: { alertId },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to acknowledge alert: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "GraphQL error");
      }

      logger.info("Alert acknowledged", { alertId });

      toast({
        title: "Success",
        description: "Alert acknowledged successfully",
      });

      // Refetch alerts to show updated state
      await refetchAlerts();
    } catch (error: unknown) {
      logger.error("Error acknowledging alert", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to acknowledge alert. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsAcknowledging(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Network Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor device health, traffic, and network alerts in real-time
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </>
          )}
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : overview?.totalDevices || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{overview?.onlineDevices || 0} online</span>
              {" • "}
              <span className="text-red-600">{overview?.offlineDevices || 0} offline</span>
              {0 ? (
                <>
                  {" • "}
                  <span className="text-yellow-600">{0} degraded</span>
                </>
              ) : null}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : overview?.activeAlerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600">{overview?.criticalAlerts || 0} critical</span>
              {" • "}
              <span className="text-yellow-600">{0 || 0} warning</span>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth In</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatBps(overview?.totalBandwidthGbps || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {0 ? `Peak: ${formatBps(0)}` : "Current incoming traffic"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth Out</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoading ? "..." : formatBps(overview?.totalBandwidthGbps || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {0 ? `Peak: ${formatBps(0)}` : "Current outgoing traffic"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="devices" className="space-y-4">
        <TabsList>
          <TabsTrigger value="devices">Devices</TabsTrigger>
          <TabsTrigger value="alerts">
            Alerts
            {overview && overview.activeAlerts > 0 && (
              <Badge variant="destructive" className="ml-2">
                {overview.activeAlerts}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
        </TabsList>

        {/* Devices Tab */}
        <TabsContent value="devices" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Devices</CardTitle>
              <CardDescription>Monitor device health and performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search devices..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>
                <Select
                  value={statusFilter || "all"}
                  onValueChange={(value) => setStatusFilter(value as DeviceStatusEnum)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="degraded">Degraded</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={typeFilter || "all"}
                  onValueChange={(value) => setTypeFilter(value as DeviceTypeEnum)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="olt">OLT</SelectItem>
                    <SelectItem value="onu">ONU</SelectItem>
                    <SelectItem value="cpe">CPE</SelectItem>
                    <SelectItem value="router">Router</SelectItem>
                    <SelectItem value="switch">Switch</SelectItem>
                    <SelectItem value="firewall">Firewall</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Devices Table */}
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="h-12 px-4 text-left align-middle font-medium">Status</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Name</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Type</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">IP Address</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Location</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">CPU</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Memory</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Uptime</th>
                      <th className="h-12 px-4 text-left align-middle font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan={9} className="h-24 text-center">
                          Loading devices...
                        </td>
                      </tr>
                    ) : filteredDevices.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="h-24 text-center">
                          No devices found
                        </td>
                      </tr>
                    ) : (
                      filteredDevices.map((device) => (
                        <tr key={device.deviceId} className="border-b">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div
                                className={`h-2 w-2 rounded-full ${getStatusColor(device.status)}`}
                              />
                              <Badge variant={getStatusBadgeVariant(device.status) as any}>
                                {device.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-4 font-medium">{device.device_name}</td>
                          <td className="p-4 uppercase text-xs">{device.device_type}</td>
                          <td className="p-4 font-mono text-xs">{device.ip_address || "-"}</td>
                          <td className="p-4">{device.location || "-"}</td>
                          <td className="p-4">
                            {device.cpuUsagePercent !== undefined &&
                            device.cpuUsagePercent !== null ? (
                              <span className={device.cpuUsagePercent > 80 ? "text-red-600" : ""}>
                                {device.cpuUsagePercent.toFixed(1)}%
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-4">
                            {device.memoryUsagePercent !== undefined &&
                            device.memoryUsagePercent !== null ? (
                              <span
                                className={device.memoryUsagePercent > 80 ? "text-red-600" : ""}
                              >
                                {device.memoryUsagePercent.toFixed(1)}%
                              </span>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="p-4">
                            {device.uptimeSeconds ? formatUptime(device.uptimeSeconds) : "-"}
                          </td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDeviceId(device.deviceId);
                                setShowDeviceDetail(true);
                              }}
                            >
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Alerts</CardTitle>
              <CardDescription>Active and recent network alerts</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Alert Filters */}
              <div className="flex gap-4 mb-4">
                <Select
                  value={alertSeverityFilter || "all"}
                  onValueChange={(value) =>
                    setAlertSeverityFilter(
                      value === "all" ? undefined : (value as AlertSeverityEnum),
                    )
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severities</SelectItem>
                    <SelectItem value={AlertSeverityEnum.Critical}>Critical</SelectItem>
                    <SelectItem value={AlertSeverityEnum.Warning}>Warning</SelectItem>
                    <SelectItem value={AlertSeverityEnum.Info}>Info</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={alertSortBy}
                  onValueChange={(value: "time" | "severity") => setAlertSortBy(value)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="time">Sort by Time</SelectItem>
                    <SelectItem value="severity">Sort by Severity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading alerts...</p>
                ) : filteredAlerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No active alerts</p>
                  </div>
                ) : (
                  filteredAlerts.map((alert) => (
                    <div
                      key={alert.alertId}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{alert.title}</h4>
                          <Badge
                            variant={
                              alert.severity === AlertSeverityEnum.Critical
                                ? "destructive"
                                : "default"
                            }
                          >
                            {alert.severity}
                          </Badge>
                          {alert.deviceName && <Badge variant="outline">{alert.deviceName}</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        {alert.metricName && (
                          <p className="text-xs text-muted-foreground">
                            {alert.metricName}: {alert.currentValue?.toFixed(2)} (threshold:{" "}
                            {alert.thresholdValue})
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.triggeredAt).toLocaleString()}
                        </div>
                      </div>
                      {!alert.isAcknowledged && alert.isActive && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledgeAlert(alert.alertId)}
                          disabled={isAcknowledging}
                        >
                          {isAcknowledging ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            "Acknowledge"
                          )}
                        </Button>
                      )}
                      {alert.isAcknowledged && <Badge variant="secondary">Acknowledged</Badge>}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Overview</CardTitle>
              <CardDescription>Summary by device type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {overview?.deviceTypeSummary?.map((summary: any) => (
                  <Card key={summary.device_type}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm uppercase">{summary.device_type}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-2xl font-bold">{summary.total_count}</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Online:</span>
                          <span className="text-green-600 font-medium">{summary.online_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Offline:</span>
                          <span className="text-red-600 font-medium">{summary.offline_count}</span>
                        </div>
                        {summary.degraded_count > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Degraded:</span>
                            <span className="text-yellow-600 font-medium">
                              {summary.degraded_count}
                            </span>
                          </div>
                        )}
                      </div>
                      {summary.avg_cpu_usage !== undefined && (
                        <div className="pt-2 border-t">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Avg CPU:</span>
                            <span>{summary.avg_cpu_usage.toFixed(1)}%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Avg Memory:</span>
                            <span>{summary.avg_memory_usage?.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Device Detail Modal */}
      {selectedDevice && (
        <Dialog open={showDeviceDetail} onOpenChange={setShowDeviceDetail}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Device Details</DialogTitle>
              <DialogDescription>
                {selectedDevice.device_name} • {selectedDevice.ip_address}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Status and Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                  <div className="mt-1 flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${getStatusColor(selectedDevice.status)}`}
                    />
                    <Badge variant={getStatusBadgeVariant(selectedDevice.status) as any}>
                      {selectedDevice.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Device Type</Label>
                  <div className="mt-1 uppercase text-sm">{selectedDevice.device_type}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">IP Address</Label>
                  <div className="mt-1 font-mono text-sm">{selectedDevice.ip_address || "N/A"}</div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                  <div className="mt-1 text-sm">{selectedDevice.location || "N/A"}</div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Performance Metrics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">CPU Usage</Label>
                    <div className="mt-1">
                      {selectedDevice.cpuUsagePercent !== undefined &&
                      selectedDevice.cpuUsagePercent !== null ? (
                        <div>
                          <div className="text-2xl font-bold">
                            {selectedDevice.cpuUsagePercent.toFixed(1)}%
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2 mt-2">
                            <div
                              className={`h-2 rounded-full ${
                                selectedDevice.cpuUsagePercent > 80
                                  ? "bg-red-500"
                                  : selectedDevice.cpuUsagePercent > 60
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${selectedDevice.cpuUsagePercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">N/A</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Memory Usage
                    </Label>
                    <div className="mt-1">
                      {selectedDevice.memoryUsagePercent !== undefined &&
                      selectedDevice.memoryUsagePercent !== null ? (
                        <div>
                          <div className="text-2xl font-bold">
                            {selectedDevice.memoryUsagePercent.toFixed(1)}%
                          </div>
                          <div className="w-full bg-secondary rounded-full h-2 mt-2">
                            <div
                              className={`h-2 rounded-full ${
                                selectedDevice.memoryUsagePercent > 80
                                  ? "bg-red-500"
                                  : selectedDevice.memoryUsagePercent > 60
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              }`}
                              style={{ width: `${selectedDevice.memoryUsagePercent}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="text-muted-foreground">N/A</div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Uptime</Label>
                    <div className="mt-1 text-lg font-semibold">
                      {selectedDevice.uptimeSeconds
                        ? formatUptime(selectedDevice.uptimeSeconds)
                        : "N/A"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Last Seen</Label>
                    <div className="mt-1 text-sm">
                      {selectedDevice.lastSeen
                        ? new Date(selectedDevice.lastSeen).toLocaleString()
                        : "N/A"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeviceDetail(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-sm font-medium ${className}`}>{children}</div>;
}
