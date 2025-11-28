"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ArrowLeft,
  RefreshCw,
  Settings,
  Activity,
  Wifi,
  HardDrive,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  Clock,
  MapPin,
} from "lucide-react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";

interface DeviceDetails {
  _id: string;
  _deviceId: {
    _Manufacturer?: string;
    _ProductClass?: string;
    _SerialNumber?: string;
    _OUI?: string;
  };
  _lastInform: string;
  _registered: string;
  _connectionRequestUrl?: string;
  _tags?: string[];
  summary: {
    manufacturer?: string;
    model?: string;
    serialNumber?: string;
    softwareVersion?: string;
    hardwareVersion?: string;
    ipAddress?: string;
    macAddress?: string;
    online: boolean;
    lastContact?: string;
    uptime?: number;
  };
  wan?: {
    ipAddress?: string;
    gateway?: string;
    dns?: string[];
    connectionStatus?: string;
  };
  lan?: {
    ipAddress?: string;
    subnetMask?: string;
    dhcpEnabled?: boolean;
  };
  wifi?: {
    ssid?: string;
    enabled?: boolean;
    channel?: number;
    clients?: number;
  };
  stats?: {
    memoryUsage?: number;
    cpuUsage?: number;
    uptime?: number;
    bytesReceived?: number;
    bytesSent?: number;
  };
}

interface DeviceEvent {
  timestamp: string;
  type: string;
  message: string;
  severity: "info" | "warning" | "error";
}

function DeviceDetailsPageContent() {
  const params = useParams();
  const deviceId = params["deviceId"] as string;
  const [activeTab, setActiveTab] = useState("overview");
  const [refreshKey, setRefreshKey] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();

  // Fetch device details
  const { data: device, isLoading } = useQuery<DeviceDetails>({
    queryKey: ["device", deviceId, refreshKey],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch device");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch device events
  const { data: events = [] } = useQuery<DeviceEvent[]>({
    queryKey: ["device-events", deviceId, refreshKey],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/events`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Refresh device
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to refresh device");
      return response.json();
    },
    onSuccess: () => {
      setRefreshKey((k) => k + 1);
      toast({ title: "Device refresh initiated", description: "The device will update shortly." });
    },
    onError: () => {
      toast({
        title: "Refresh failed",
        description: "Could not refresh the device.",
        variant: "destructive",
      });
    },
  });

  // Reboot device
  const rebootMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/reboot`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to reboot device");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Reboot initiated", description: "The device is rebooting." });
    },
    onError: () => {
      toast({
        title: "Reboot failed",
        description: "Could not reboot the device.",
        variant: "destructive",
      });
    },
  });

  const formatUptime = (seconds?: number) => {
    if (!seconds) return "N/A";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  const formatBytes = (bytes?: number) => {
    if (!bytes) return "0 B";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getStatusBadge = (online?: boolean) => {
    if (online) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400">
          <CheckCircle className="h-3 w-3 mr-1" />
          Online
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400">
        <XCircle className="h-3 w-3 mr-1" />
        Offline
      </Badge>
    );
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "warning":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400">
            Warning
          </Badge>
        );
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading device details...</p>
        </div>
      </div>
    );
  }

  if (!device) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">Device not found</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/dashboard/devices">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Devices
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/devices">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold text-foreground">
                {device.summary?.serialNumber || device._deviceId?._SerialNumber}
              </h1>
              {getStatusBadge(device.summary?.online)}
            </div>
            <p className="text-sm text-muted-foreground">
              {device.summary?.manufacturer || device._deviceId?._Manufacturer} •{" "}
              {device.summary?.model || device._deviceId?._ProductClass}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            onClick={() => rebootMutation.mutate()}
            disabled={rebootMutation.isPending || !device.summary?.online}
          >
            <Zap className="h-4 w-4 mr-2" />
            Reboot
          </Button>
          <Button asChild>
            <Link href={`/dashboard/devices/${deviceId}/parameters`}>
              <Settings className="h-4 w-4 mr-2" />
              Parameters
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Software Version</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{device.summary?.softwareVersion || "N/A"}</div>
            <p className="text-xs text-muted-foreground">
              Hardware: {device.summary?.hardwareVersion || "N/A"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatUptime(device.stats?.uptime)}</div>
            <p className="text-xs text-muted-foreground">
              Last seen:{" "}
              {device.summary?.lastContact
                ? new Date(device.summary.lastContact).toLocaleString()
                : "Never"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1">
                <Download className="h-3 w-3 text-green-600" />
                <span>{formatBytes(device.stats?.bytesReceived)}</span>
              </div>
              <div className="flex items-center gap-1">
                <Upload className="h-3 w-3 text-blue-600" />
                <span>{formatBytes(device.stats?.bytesSent)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">WiFi Clients</CardTitle>
            <Wifi className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{device.wifi?.clients || 0}</div>
            <p className="text-xs text-muted-foreground">SSID: {device.wifi?.ssid || "N/A"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="network">Network</TabsTrigger>
          <TabsTrigger value="wifi">WiFi</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Device Information</CardTitle>
                <CardDescription>Basic device details and identifiers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Serial Number</span>
                  <span className="font-medium">{device._deviceId?._SerialNumber}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">OUI</span>
                  <span className="font-medium">{device._deviceId?._OUI || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">MAC Address</span>
                  <span className="font-medium">{device.summary?.macAddress || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">IP Address</span>
                  <span className="font-medium">{device.summary?.ipAddress || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Registered</span>
                  <span className="font-medium">
                    {device._registered ? new Date(device._registered).toLocaleString() : "N/A"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
                <CardDescription>Current resource utilization</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">CPU Usage</span>
                    <span className="text-sm font-medium">{device.stats?.cpuUsage || 0}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${device.stats?.cpuUsage || 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm text-muted-foreground">Memory Usage</span>
                    <span className="text-sm font-medium">{device.stats?.memoryUsage || 0}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary rounded-full h-2 transition-all"
                      style={{ width: `${device.stats?.memoryUsage || 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Network Tab */}
        <TabsContent value="network" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>WAN Configuration</CardTitle>
                <CardDescription>Wide Area Network settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">IP Address</span>
                  <span className="font-medium">{device.wan?.ipAddress || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Gateway</span>
                  <span className="font-medium">{device.wan?.gateway || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">DNS Servers</span>
                  <span className="font-medium">{device.wan?.dns?.join(", ") || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">Connection Status</span>
                  <span className="font-medium">{device.wan?.connectionStatus || "N/A"}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>LAN Configuration</CardTitle>
                <CardDescription>Local Area Network settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">IP Address</span>
                  <span className="font-medium">{device.lan?.ipAddress || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Subnet Mask</span>
                  <span className="font-medium">{device.lan?.subnetMask || "N/A"}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">DHCP Enabled</span>
                  <span className="font-medium">{device.lan?.dhcpEnabled ? "Yes" : "No"}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* WiFi Tab */}
        <TabsContent value="wifi" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WiFi Configuration</CardTitle>
              <CardDescription>Wireless network settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">SSID</span>
                <span className="font-medium">{device.wifi?.ssid || "N/A"}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium">{device.wifi?.enabled ? "Enabled" : "Disabled"}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Channel</span>
                <span className="font-medium">{device.wifi?.channel || "N/A"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Connected Clients</span>
                <span className="font-medium">{device.wifi?.clients || 0}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
              <CardDescription>Device activity and diagnostic events</CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No events recorded</div>
              ) : (
                <div className="space-y-3">
                  {events.map((event, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 rounded-lg border">
                      <div className="flex-shrink-0 mt-0.5">{getSeverityBadge(event.severity)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-medium">{event.type}</p>
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{event.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common device management tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4">
            <Button variant="outline" asChild className="w-full">
              <Link href={`/dashboard/devices/${deviceId}/parameters`}>
                <Settings className="h-4 w-4 mr-2" />
                View Parameters
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href={`/dashboard/devices/${deviceId}/diagnostics`}>
                <Activity className="h-4 w-4 mr-2" />
                Run Diagnostics
              </Link>
            </Button>
            <Button variant="outline" asChild className="w-full">
              <Link href={`/dashboard/devices/${deviceId}/firmware`}>
                <Download className="h-4 w-4 mr-2" />
                Update Firmware
              </Link>
            </Button>
            <Button
              variant="outline"
              onClick={() => rebootMutation.mutate()}
              disabled={rebootMutation.isPending || !device.summary?.online}
              className="w-full"
            >
              <Zap className="h-4 w-4 mr-2" />
              Reboot Device
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DeviceDetailsPage() {
  return (
    <RouteGuard permission="devices.read">
      <DeviceDetailsPageContent />
    </RouteGuard>
  );
}
