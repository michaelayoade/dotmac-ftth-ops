"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Search,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  Filter,
  Download,
  Settings,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Router as RouterIcon,
} from "lucide-react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";

interface Device {
  _id: string;
  _deviceId: {
    _Manufacturer?: string;
    _ProductClass?: string;
    _SerialNumber?: string;
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
    online: boolean;
    lastContact?: string;
  };
}

interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  warning: number;
}

function DevicesPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "online" | "offline" | "warning">("all");
  const [manufacturerFilter, setManufacturerFilter] = useState("all");
  const [refreshKey, setRefreshKey] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { apiBaseUrl } = useApiConfig();

  // Fetch devices
  const { data: devices = [], isLoading } = useQuery<Device[]>({
    queryKey: ["genieacs-devices", refreshKey, statusFilter, manufacturerFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (manufacturerFilter !== "all") params.append("manufacturer", manufacturerFilter);

      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices?${params.toString()}`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Failed to fetch devices");
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch device statistics
  const { data: stats } = useQuery<DeviceStats>({
    queryKey: ["genieacs-stats", refreshKey],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/stats`, {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Refresh device
  const refreshMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const response = await fetch(`${apiBaseUrl}/api/isp/v1/admin/genieacs/devices/${deviceId}/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) throw new Error("Failed to refresh device");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["genieacs-devices"] });
      toast({ title: "Device refresh initiated", description: "The device will update shortly." });
    },
    onError: () => {
      toast({
        title: "Refresh failed",
        description: "Could not refresh the device. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Filter devices
  const filteredDevices = devices.filter((device) => {
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      device._deviceId?._SerialNumber?.toLowerCase().includes(searchLower) ||
      device._deviceId?._Manufacturer?.toLowerCase().includes(searchLower) ||
      device.summary?.ipAddress?.toLowerCase().includes(searchLower);

    return matchesSearch;
  });

  // Get unique manufacturers
  const manufacturers = Array.from(
    new Set(devices.map((d) => d._deviceId?._Manufacturer).filter(Boolean)),
  );

  const getDeviceStatusIcon = (online: boolean, lastContact?: string) => {
    if (online) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }

    if (lastContact) {
      const lastContactDate = new Date(lastContact);
      const hoursSinceContact = (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceContact < 24) {
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      }
    }

    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getDeviceStatusBadge = (online: boolean, lastContact?: string) => {
    if (online) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-950/20 dark:text-green-400">
          Online
        </Badge>
      );
    }

    if (lastContact) {
      const lastContactDate = new Date(lastContact);
      const hoursSinceContact = (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60);

      if (hoursSinceContact < 24) {
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400">
            Warning
          </Badge>
        );
      }
    }

    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400">
        Offline
      </Badge>
    );
  };

  const formatLastContact = (lastContact?: string) => {
    if (!lastContact) return "Never";

    const date = new Date(lastContact);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Device Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage TR-069 CPE devices (ONTs, routers, modems)
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setRefreshKey((k) => k + 1)}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard/devices/provision">
              <Plus className="h-4 w-4 mr-2" />
              Provision Device
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Devices</CardTitle>
            <RouterIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Online</CardTitle>
            <Wifi className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.online || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.total ? ((stats.online / stats.total) * 100).toFixed(1) : 0}% uptime
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offline</CardTitle>
            <WifiOff className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.offline || 0}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Warning</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.warning || 0}</div>
            <p className="text-xs text-muted-foreground">Intermittent connectivity</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Search and filter devices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by serial, manufacturer, or IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="all">All Status</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
                <option value="warning">Warning</option>
              </select>
            </div>

            {/* Manufacturer Filter */}
            <div>
              <select
                value={manufacturerFilter}
                onChange={(e) => setManufacturerFilter(e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
              >
                <option value="all">All Manufacturers</option>
                {manufacturers.map((mfr) => (
                  <option key={mfr} value={mfr}>
                    {mfr}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Devices</CardTitle>
              <CardDescription>
                {filteredDevices.length} of {devices.length} devices
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading devices...</div>
          ) : filteredDevices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {devices.length === 0 ? "No devices found" : "No devices match your filters"}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDevices.map((device) => (
                <Link
                  key={device._id}
                  href={`/dashboard/devices/${device._id}`}
                  className="block p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      {/* Status Icon */}
                      <div className="flex-shrink-0">
                        {getDeviceStatusIcon(device.summary.online, device.summary.lastContact)}
                      </div>

                      {/* Device Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {device.summary?.serialNumber ||
                              device._deviceId?._SerialNumber ||
                              "Unknown"}
                          </span>
                          {getDeviceStatusBadge(device.summary.online, device.summary.lastContact)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {device.summary?.manufacturer || device._deviceId?._Manufacturer} •{" "}
                          {device.summary?.model || device._deviceId?._ProductClass} •{" "}
                          {device.summary?.ipAddress || "No IP"}
                        </div>
                      </div>

                      {/* Software Version */}
                      <div className="hidden md:block text-sm">
                        <div className="text-muted-foreground">Software</div>
                        <div className="font-medium">
                          {device.summary?.softwareVersion || "N/A"}
                        </div>
                      </div>

                      {/* Last Contact */}
                      <div className="hidden lg:block text-sm">
                        <div className="text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last Contact
                        </div>
                        <div className="font-medium">
                          {formatLastContact(device.summary?.lastContact)}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.preventDefault();
                          refreshMutation.mutate(device._id);
                        }}
                        disabled={refreshMutation.isPending}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${refreshMutation.isPending ? "animate-spin" : ""}`}
                        />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DevicesPage() {
  return (
    <RouteGuard permission="devices.read">
      <DevicesPageContent />
    </RouteGuard>
  );
}
