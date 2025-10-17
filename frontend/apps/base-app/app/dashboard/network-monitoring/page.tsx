'use client';

// Force dynamic rendering to avoid SSR issues with React Query hooks
export const dynamic = 'force-dynamic';

/**
 * Network Device Monitoring Dashboard
 *
 * Comprehensive network monitoring with device health, traffic stats, and alerts
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useNetworkDashboardGraphQL,
  useNetworkDeviceListGraphQL,
  useNetworkAlertListGraphQL,
} from '@/hooks/useNetworkGraphQL';
import {
  DeviceTypeEnum,
  DeviceStatusEnum,
  AlertSeverityEnum,
} from '@/lib/graphql/generated';
import {
  Server,
  Activity,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Wifi,
  Router,
  Shield,
  Search,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export default function NetworkMonitoringPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatusEnum | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState<DeviceTypeEnum | undefined>(undefined);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  // Fetch dashboard data using GraphQL
  const {
    dashboard,
    isLoading: dashboardLoading,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useNetworkDashboardGraphQL({
    pollInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Fetch devices with filters
  const {
    devices,
    total: totalDevices,
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
    total: totalAlerts,
    isLoading: alertsLoading,
    refetch: refetchAlerts,
  } = useNetworkAlertListGraphQL({
    pageSize: 50,
    pollInterval: 30000,
  });

  const isLoading = dashboardLoading || devicesLoading || alertsLoading;
  const overview = dashboard || {};

  // Transform devices for compatibility
  const filteredDevices = devices.map(d => ({
    ...d,
    device_name: d.deviceName,
    device_type: d.deviceType,
    ip_address: d.ipAddress,
    status: d.status,
  }));

  // Helper functions
  const getStatusColor = (status: DeviceStatusEnum | string) => {
    const statusStr = typeof status === 'string' ? status : status;
    switch (statusStr) {
      case 'ONLINE':
        return 'bg-green-500';
      case 'DEGRADED':
        return 'bg-yellow-500';
      case 'OFFLINE':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusBadgeVariant = (status: DeviceStatusEnum | string) => {
    const statusStr = typeof status === 'string' ? status : status;
    switch (statusStr) {
      case 'ONLINE':
        return 'default';
      case 'DEGRADED':
        return 'warning';
      case 'OFFLINE':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const handleRefresh = () => {
    refetchDashboard();
    refetchDevices();
    refetchAlerts();
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return <XCircle className="h-4 w-4 text-red-500" />;
      case AlertSeverity.WARNING:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case AlertSeverity.INFO:
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatBps = (bps: number) => {
    if (bps === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
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
    await acknowledgeAlert.mutateAsync({
      alertId,
      data: { note: 'Acknowledged from dashboard' },
    });
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
              {isLoading ? '...' : overview?.total_devices || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-green-600">{overview?.online_devices || 0} online</span>
              {' • '}
              <span className="text-red-600">{overview?.offline_devices || 0} offline</span>
              {overview?.degraded_devices ? (
                <>
                  {' • '}
                  <span className="text-yellow-600">{overview.degraded_devices} degraded</span>
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
              {isLoading ? '...' : overview?.active_alerts || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="text-red-600">{overview?.critical_alerts || 0} critical</span>
              {' • '}
              <span className="text-yellow-600">{overview?.warning_alerts || 0} warning</span>
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
              {isLoading ? '...' : formatBps(overview?.total_bandwidth_in_bps || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview?.peak_bandwidth_in_bps
                ? `Peak: ${formatBps(overview.peak_bandwidth_in_bps)}`
                : 'Current incoming traffic'}
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
              {isLoading ? '...' : formatBps(overview?.total_bandwidth_out_bps || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {overview?.peak_bandwidth_out_bps
                ? `Peak: ${formatBps(overview.peak_bandwidth_out_bps)}`
                : 'Current outgoing traffic'}
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
            {overview && overview.active_alerts > 0 && (
              <Badge variant="destructive" className="ml-2">
                {overview.active_alerts}
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
                <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                <Select value={typeFilter} onValueChange={setTypeFilter}>
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
                        <tr key={device.device_id} className="border-b">
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${getStatusColor(device.status)}`} />
                              <Badge variant={getStatusBadgeVariant(device.status) as any}>
                                {device.status}
                              </Badge>
                            </div>
                          </td>
                          <td className="p-4 font-medium">{device.device_name}</td>
                          <td className="p-4 uppercase text-xs">{device.device_type}</td>
                          <td className="p-4 font-mono text-xs">{device.ip_address || '-'}</td>
                          <td className="p-4">{device.location || '-'}</td>
                          <td className="p-4">
                            {device.cpu_usage_percent !== undefined ? (
                              <span className={device.cpu_usage_percent > 80 ? 'text-red-600' : ''}>
                                {device.cpu_usage_percent.toFixed(1)}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-4">
                            {device.memory_usage_percent !== undefined ? (
                              <span
                                className={device.memory_usage_percent > 80 ? 'text-red-600' : ''}
                              >
                                {device.memory_usage_percent.toFixed(1)}%
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="p-4">
                            {device.uptime_seconds ? formatUptime(device.uptime_seconds) : '-'}
                          </td>
                          <td className="p-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedDevice(device.device_id)}
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
              <div className="space-y-4">
                {isLoading ? (
                  <p className="text-center text-muted-foreground py-8">Loading alerts...</p>
                ) : alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
                    <p className="text-muted-foreground">No active alerts</p>
                  </div>
                ) : (
                  alerts.map((alert) => (
                    <div
                      key={alert.alert_id}
                      className="flex items-start gap-4 p-4 border rounded-lg"
                    >
                      <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{alert.title}</h4>
                          <Badge variant={alert.severity === AlertSeverity.CRITICAL ? 'destructive' : 'default'}>
                            {alert.severity}
                          </Badge>
                          {alert.device_name && (
                            <Badge variant="outline">{alert.device_name}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{alert.description}</p>
                        {alert.metric_name && (
                          <p className="text-xs text-muted-foreground">
                            {alert.metric_name}: {alert.current_value?.toFixed(2)} (threshold:{' '}
                            {alert.threshold_value})
                          </p>
                        )}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {new Date(alert.triggered_at).toLocaleString()}
                        </div>
                      </div>
                      {!alert.is_acknowledged && alert.is_active && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledgeAlert(alert.alert_id)}
                          disabled={acknowledgeAlert.isPending}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {alert.is_acknowledged && (
                        <Badge variant="secondary">Acknowledged</Badge>
                      )}
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
                {overview?.device_type_summary?.map((summary) => (
                  <Card key={summary.device_type}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm uppercase">{summary.device_type}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="text-2xl font-bold">{summary.total_count}</div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Online:</span>
                          <span className="text-green-600 font-medium">
                            {summary.online_count}
                          </span>
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
    </div>
  );
}
