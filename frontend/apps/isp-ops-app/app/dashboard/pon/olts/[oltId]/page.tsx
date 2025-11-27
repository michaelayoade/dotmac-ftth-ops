"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  ArrowLeft,
  Server,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Zap,
  Activity,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  LogicalDevice,
  LogicalDeviceDetailResponse,
  LogicalPort,
  OLTOverview,
} from "@/types/voltha";

type FlowEntry = Record<string, any>;

const DEFAULT_SWITCH_FEATURES = {
  n_buffers: 0,
  n_tables: 0,
  capabilities: 0,
};

function resolveStatusBadge(
  activePortCount: number,
  totalPortCount: number,
  overview?: OLTOverview,
) {
  const oper = (overview?.oper_status || "").toUpperCase();
  const connect = (overview?.connect_status || "").toUpperCase();

  if (
    activePortCount > 0 ||
    ["ACTIVE", "ENABLED", "ONLINE"].includes(oper) ||
    connect === "REACHABLE"
  ) {
    return { label: "Online", color: "bg-green-100 text-green-800", icon: CheckCircle };
  }
  if (
    totalPortCount > 0 &&
    activePortCount === 0 &&
    (["DEGRADED", "RECONCILING", "ACTIVATING"].includes(oper) || connect === "UNKNOWN")
  ) {
    return { label: "Degraded", color: "bg-amber-100 text-amber-800", icon: AlertTriangle };
  }
  if (totalPortCount === 0 && !overview) {
    return { label: "Unknown", color: "bg-muted text-muted-foreground", icon: AlertTriangle };
  }
  return { label: "Offline", color: "bg-red-100 text-red-800", icon: XCircle };
}

function getPortStatus(port: LogicalPort) {
  if (port?.["ofp_port"]?.["state"] === 0) {
    return { label: "Active", color: "bg-green-100 text-green-800", icon: CheckCircle };
  }
  return { label: "Down", color: "bg-red-100 text-red-800", icon: XCircle };
}

function formatSpeed(value?: number) {
  if (!value || value <= 0) {
    return "N/A";
  }
  if (value >= 1000) {
    return `${value / 1000} Gbps`;
  }
  return `${value} Mbps`;
}

function LogicalDeviceDetails() {
  const params = useParams();
  const oltId = params["oltId"] as string;
  const [activeTab, setActiveTab] = useState<"overview" | "ports" | "flows">("overview");

  const {
    data: detail,
    isLoading,
    refetch,
  } = useQuery<LogicalDeviceDetailResponse>({
    queryKey: ["access-logical-device", oltId],
    queryFn: async () => {
      const response = await apiClient.get<LogicalDeviceDetailResponse>(
        `/api/v1/access/logical-devices/${oltId}`,
      );
      return response["data"];
    },
    refetchInterval: 30000,
  });

  const { data: overview } = useQuery<OLTOverview>({
    queryKey: ["access-olt-overview", oltId],
    queryFn: async () => {
      const response = await apiClient.get<OLTOverview>(`/api/v1/access/olts/${oltId}/overview`);
      return response["data"];
    },
    enabled: Boolean(oltId),
    refetchInterval: 60000,
  });

  const logicalDevice: LogicalDevice | undefined = detail?.device;
  const ports: LogicalPort[] = detail?.ports ?? [];
  const flows: FlowEntry[] = detail?.flows ?? [];

  const switchFeatures = logicalDevice?.switch_features ?? DEFAULT_SWITCH_FEATURES;
  const desc = logicalDevice?.desc ?? {};

  const activePorts = ports.filter((port) => port?.["ofp_port"]?.["state"] === 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading OLT details...</p>
        </div>
      </div>
    );
  }

  if (!logicalDevice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <XCircle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-muted-foreground">OLT not found</p>
        </div>
      </div>
    );
  }

  const statusBadge = resolveStatusBadge(activePorts.length, ports.length, overview);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/pon/olts">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">OLT Details</h1>
            <p className="text-sm text-muted-foreground">{logicalDevice.id}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusBadge.color}>
              <statusBadge.icon className="h-3 w-3 mr-1" />
              {statusBadge.label}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Ports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {activePorts.length} / {ports.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Flows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flows.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{switchFeatures.n_tables}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ports">PON Ports ({ports.length})</TabsTrigger>
          <TabsTrigger value="flows">Flows ({flows.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Device Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Logical Device ID</p>
                  <p className="font-mono text-sm break-all">{logicalDevice.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Root Device ID</p>
                  <p className="font-mono text-sm break-all">
                    {logicalDevice.root_device_id || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Serial Number</p>
                  <p className="font-medium">
                    {desc.serial_num || overview?.serial_number || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Datapath ID</p>
                  <p className="font-mono text-sm break-all">
                    {logicalDevice.datapath_id || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Manufacturer</p>
                  <p className="font-medium">{desc.mfr_desc || overview?.model || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Datapath Description</p>
                  <p className="font-medium">{desc.dp_desc || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Hardware &amp; Software</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">Hardware Description</p>
                <p className="font-medium">{desc.hw_desc || "Unknown"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Software Description</p>
                <p className="font-medium">
                  {desc.sw_desc || overview?.firmware_version || "Unknown"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Switch Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Number of Buffers</p>
                  <p className="text-2xl font-bold">{switchFeatures.n_buffers}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Number of Tables</p>
                  <p className="text-2xl font-bold">{switchFeatures.n_tables}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Capabilities</p>
                  <p className="text-2xl font-bold">{switchFeatures.capabilities}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ports Tab */}
        <TabsContent value="ports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>PON Ports</CardTitle>
              <CardDescription>OpenFlow ports on this logical device</CardDescription>
            </CardHeader>
            <CardContent>
              {ports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No ports reported for this logical device
                </div>
              ) : (
                <div className="space-y-3">
                  {ports.map((port) => {
                    const status = getPortStatus(port);
                    const StatusIcon = status["icon"];

                    return (
                      <div key={port["id"]} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Zap className="h-4 w-4 text-primary" />
                              <h4 className="font-medium">
                                {port["ofp_port"]?.["name"] || port["id"]}
                              </h4>
                            </div>
                            <p className="text-xs text-muted-foreground">Port ID: {port["id"]}</p>
                          </div>
                          <Badge className={status["color"]}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status["label"]}
                          </Badge>
                        </div>

                        <div className="grid gap-2 md:grid-cols-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Port Number</p>
                            <p className="font-medium">{port["ofp_port"]?.["port_no"] ?? "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Device Port</p>
                            <p className="font-medium">{port["device_port_no"] ?? "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Current Speed</p>
                            <p className="font-medium">
                              {formatSpeed(port["ofp_port"]?.["curr_speed"])}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Max Speed</p>
                            <p className="font-medium">
                              {formatSpeed(port["ofp_port"]?.["max_speed"])}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">State</p>
                            <p className="font-mono text-xs">
                              {port["ofp_port"]?.["state"] ?? "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Config</p>
                            <p className="font-mono text-xs">
                              {port["ofp_port"]?.["config"] ?? "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flows Tab */}
        <TabsContent value="flows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>OpenFlow Rules</CardTitle>
              <CardDescription>Active flow entries on this logical device</CardDescription>
            </CardHeader>
            <CardContent>
              {flows.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No flows reported for this logical device
                </div>
              ) : (
                <div className="space-y-3">
                  {flows.map((flow, index) => (
                    <div key={(flow["id"] as string) || index} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Activity className="h-4 w-4 text-primary" />
                            <h4 className="font-medium">Flow {index + 1}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono break-all">
                            ID: {flow["id"] ?? "N/A"}
                          </p>
                        </div>
                        <Badge variant="secondary">Priority: {flow["priority"] ?? "N/A"}</Badge>
                      </div>

                      <div className="grid gap-2 md:grid-cols-3 text-sm mb-3">
                        <div>
                          <p className="text-muted-foreground">Table ID</p>
                          <p className="font-medium">{flow["table_id"] ?? "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Cookie</p>
                          <p className="font-mono text-xs break-all">{flow["cookie"] ?? "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Flags</p>
                          <p className="font-medium">{flow["flags"] ?? "N/A"}</p>
                        </div>
                      </div>

                      {flow["match"] && Object.keys(flow["match"]).length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs font-medium cursor-pointer mb-2">
                            Match Fields
                          </summary>
                          <div className="bg-muted/50 rounded-md p-3 text-xs font-mono space-y-1">
                            {Object.entries(flow["match"]).map(([key, value]) => (
                              <div key={key} className="flex justify-between gap-4">
                                <span className="text-muted-foreground">{key}</span>
                                <span>{JSON.stringify(value)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}

                      {flow["instructions"] && flow["instructions"].length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs font-medium cursor-pointer mb-2">
                            Instructions
                          </summary>
                          <div className="bg-muted/50 rounded-md p-3 text-xs font-mono space-y-1">
                            {flow["instructions"].map((instruction: any, idx: number) => (
                              <div key={idx} className="flex justify-between gap-4">
                                <span className="text-muted-foreground">Instruction {idx + 1}</span>
                                <span>{JSON.stringify(instruction)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function OLTDetailsPage() {
  return (
    <RouteGuard permission="isp.network['pon'].read">
      <LogicalDeviceDetails />
    </RouteGuard>
  );
}
