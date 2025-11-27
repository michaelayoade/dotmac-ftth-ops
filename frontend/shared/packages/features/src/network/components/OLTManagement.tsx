"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useQuery } from "@tanstack/react-query";
import {
  Server,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  Users,
  Zap,
  Activity,
} from "lucide-react";
import { useMemo, useState } from "react";

import {
  Device,
  DeviceListResponse,
  LogicalDevice,
  LogicalDeviceListResponse,
} from "../types/voltha";

// ============================================================================
// Types
// ============================================================================

interface ApiClient {
  get<T>(url: string): Promise<{ data: T }>;
}

interface AccessStatistics {
  total_olts: number;
  active_olts: number;
  total_onus: number;
  active_onus: number;
  online_onus: number;
  offline_onus: number;
  total_flows: number;
  total_ports: number;
  active_ports: number;
  adapters: string[];
}

export interface OLTManagementProps {
  apiClient: ApiClient;
  Link: React.ComponentType<{ href: string; className?: string; children: React.ReactNode }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getOLTStatus(
  olt: LogicalDevice,
  rootDeviceMap: Map<string, Device>,
): { label: string; color: string; icon: typeof CheckCircle } {
  const ports = olt.ports ?? [];
  const activePortCount = ports.filter((port) => port?.ofp_port?.["state"] === 0).length;

  if (ports.length > 0) {
    if (activePortCount === 0) {
      return { label: "Offline", color: "bg-red-100 text-red-800", icon: XCircle };
    }
    if (activePortCount < ports.length) {
      return { label: "Degraded", color: "bg-amber-100 text-amber-800", icon: AlertTriangle };
    }
    return { label: "Online", color: "bg-green-100 text-green-800", icon: CheckCircle };
  }

  const rootDevice = rootDeviceMap.get(olt.root_device_id || "") || rootDeviceMap.get(olt.id);

  if (rootDevice) {
    const oper = (rootDevice.oper_status || "").toUpperCase();
    const connect = (rootDevice.connect_status || "").toUpperCase();

    if (["ACTIVE", "ENABLED", "ONLINE"].includes(oper) || connect === "REACHABLE") {
      return { label: "Online", color: "bg-green-100 text-green-800", icon: CheckCircle };
    }
    if (["ACTIVATING", "RECONCILING", "DISCOVERED"].includes(oper) || connect === "UNKNOWN") {
      return { label: "Degraded", color: "bg-amber-100 text-amber-800", icon: AlertTriangle };
    }
    return { label: "Offline", color: "bg-red-100 text-red-800", icon: XCircle };
  }

  return { label: "Unknown", color: "bg-muted text-muted-foreground", icon: AlertTriangle };
}

// ============================================================================
// Main Component
// ============================================================================

export function OLTManagement({ apiClient, Link }: OLTManagementProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: oltsData,
    isLoading,
    refetch: refetchOlts,
  } = useQuery<LogicalDeviceListResponse>({
    queryKey: ["access-logical-devices"],
    queryFn: async () => {
      const response = await apiClient.get<LogicalDeviceListResponse>("/access/logical-devices");
      return response.data;
    },
    refetchInterval: 30000,
  });

  const { data: devicesData, refetch: refetchDevices } = useQuery<DeviceListResponse>({
    queryKey: ["access-devices"],
    queryFn: async () => {
      const response = await apiClient.get<DeviceListResponse>("/access/devices");
      return response.data;
    },
    refetchInterval: 30000,
  });

  const { data: stats, refetch: refetchStats } = useQuery<AccessStatistics>({
    queryKey: ["access-statistics"],
    queryFn: async () => {
      const response = await apiClient.get<AccessStatistics>("/access/statistics");
      return response.data;
    },
    refetchInterval: 30000,
  });

  const logicalDevices = useMemo<LogicalDevice[]>(() => {
    return oltsData?.devices || oltsData?.logical_devices || [];
  }, [oltsData]);

  const rootDeviceMap = useMemo(() => {
    const map = new Map<string, Device>();
    (devicesData?.devices || [])
      .filter((device) => device.root)
      .forEach((device) => {
        map.set(device.id, device);
        if (device.metadata?.["olt_id"]) {
          map.set(String(device.metadata["olt_id"]), device);
        }
      });
    return map;
  }, [devicesData]);

  const filteredOLTs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return logicalDevices;
    }
    return logicalDevices.filter((olt) => {
      const serial = olt.desc?.serial_num?.toLowerCase() ?? "";
      const rootId = olt.root_device_id?.toLowerCase() ?? "";
      return (
        olt.id.toLowerCase().includes(query) || serial.includes(query) || rootId.includes(query)
      );
    });
  }, [logicalDevices, searchQuery]);

  const handleRefresh = async () => {
    await Promise.all([refetchOlts(), refetchDevices(), refetchStats()]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">OLT Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage Optical Line Terminals (OLT) - PON aggregation devices
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total OLTs</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_olts ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.active_olts ?? 0} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total ONUs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_onus ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.active_onus ?? stats?.online_onus ?? 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">PON Ports</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_ports ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.active_ports ?? 0} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Flows</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_flows ?? 0}</div>
            <p className="text-xs text-muted-foreground">Across all OLTs</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search OLTs by ID, serial number, or device ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* OLT List */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading OLTs...
            </CardContent>
          </Card>
        ) : filteredOLTs.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No OLTs match your search" : "No OLTs found"}
            </CardContent>
          </Card>
        ) : (
          filteredOLTs.map((olt) => {
            const status = getOLTStatus(olt, rootDeviceMap);
            const StatusIcon = status.icon;
            const ports = olt.ports ?? [];
            const activePorts = ports.filter((p) => p?.ofp_port?.["state"] === 0).length;
            const flowsCount = Array.isArray(olt.flows) ? olt.flows.length : 0;
            const datapath = olt.datapath_id || "N/A";
            const datapathDisplay = datapath.length > 12 ? `${datapath.slice(0, 12)}...` : datapath;

            return (
              <Link key={olt.id} href={`/dashboard/pon/olts/${olt.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <Server className="h-8 w-8 text-primary" />
                      <Badge className={status.color}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </div>
                    <CardTitle className="mt-2 truncate">{olt.id}</CardTitle>
                    <CardDescription>S/N: {olt.desc?.serial_num || "Unknown"}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hardware:</span>
                        <span className="font-medium truncate ml-2">
                          {olt.desc?.hw_desc || "Unknown"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Software:</span>
                        <span className="font-medium truncate ml-2">
                          {olt.desc?.sw_desc || "Unknown"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Root Device:</span>
                        <span className="font-medium truncate ml-2">
                          {olt.root_device_id || "N/A"}
                        </span>
                      </div>
                    </div>

                    <div className="pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          PON Ports
                        </span>
                        <span className="font-medium">
                          {ports.length > 0 ? `${activePorts} / ${ports.length}` : "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Activity className="h-3 w-3" />
                          Active Flows
                        </span>
                        <span className="font-medium">{flowsCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Datapath ID</span>
                        <span className="font-mono text-xs">{datapathDisplay}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
