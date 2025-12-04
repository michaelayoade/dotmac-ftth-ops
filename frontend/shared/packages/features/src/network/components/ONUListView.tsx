"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wifi,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Power,
  PowerOff,
  RotateCw,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useState } from "react";

import { Device, DeviceListResponse } from "../types/voltha";

// ============================================================================
// Types
// ============================================================================

type DeviceOperation = "enable" | "disable" | "reboot" | "delete";

interface ApiClient {
  get<T>(url: string): Promise<{ data: T }>;
  post<T>(url: string, data?: any): Promise<{ data: T }>;
}

interface ToastFunction {
  (options: { title: string; description?: string; variant?: "default" | "destructive" }): void;
}

interface ConfirmDialogFunction {
  (options: {
    title: string;
    description: string;
    confirmText: string;
    variant?: "default" | "destructive";
  }): Promise<boolean>;
}

export interface ONUListViewProps {
  apiClient: ApiClient;
  useToast: () => { toast: ToastFunction };
  useConfirmDialog: () => ConfirmDialogFunction;
  Link: React.ComponentType<{ href: string; className?: string; children: React.ReactNode }>;
}

// ============================================================================
// Main Component
// ============================================================================

export function ONUListView({ apiClient, useToast, useConfirmDialog, Link }: ONUListViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [adminStateFilter, setAdminStateFilter] = useState<string>("all");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  // Fetch ONUs
  const {
    data: onusData,
    isLoading,
    refetch,
  } = useQuery<DeviceListResponse>({
    queryKey: ["access-onus"],
    queryFn: async () => {
      const response = await apiClient.get<DeviceListResponse>("/access/devices");
      return response.data;
    },
    refetchInterval: 30000,
  });

  const onus = (onusData?.devices || []).filter((device) => !device.root);

  // Device actions
  const [pendingOperation, setPendingOperation] = useState<{
    deviceId: string;
    operation: DeviceOperation;
  } | null>(null);

  const operateMutation = useMutation({
    mutationFn: async ({ device, operation }: { device: Device; operation: DeviceOperation }) => {
      const oltId =
        device.metadata?.["olt_id"] ||
        device.parent_id ||
        (device.metadata?.["root_device_id"] as string | undefined);
      const baseUrl = `/access/devices/${encodeURIComponent(device.id)}/${operation}`;
      const url = oltId ? `${baseUrl}?olt_id=${encodeURIComponent(oltId)}` : baseUrl;
      const response = await apiClient.post(url);
      return response.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["access-onus"] });
      toast({ title: `Device ${variables.operation} request sent` });
      if (variables.operation === "delete") {
        queryClient.invalidateQueries({ queryKey: ["access-onu", variables.device.id] });
      }
    },
    onError: (error: any, variables) => {
      toast({
        title: `Failed to ${variables.operation} device`,
        description: error?.response?.data?.detail || error?.message || "Operation failed",
        variant: "destructive",
      });
    },
    onSettled: () => setPendingOperation(null),
  });

  const triggerOperation = (device: Device, operation: DeviceOperation) => {
    setPendingOperation({ deviceId: device.id, operation });
    operateMutation.mutate({ device, operation });
  };

  // Filter ONUs
  const filteredONUs = onus.filter((onu) => {
    const metadata = onu.metadata || {};
    const needle = searchQuery.toLowerCase();
    const matchesSearch =
      !needle ||
      onu.id.toLowerCase().includes(needle) ||
      (onu.serial_number || "").toLowerCase().includes(needle) ||
      (onu.vendor || "").toLowerCase().includes(needle) ||
      String(metadata["olt_id"] || "")
        .toLowerCase()
        .includes(needle) ||
      String(metadata["pon_port"] || "")
        .toLowerCase()
        .includes(needle);

    const matchesStatus =
      statusFilter === "all" || (onu.oper_status || "").toUpperCase() === statusFilter;

    const matchesAdminState =
      adminStateFilter === "all" || (onu.admin_state || "").toUpperCase() === adminStateFilter;

    return matchesSearch && matchesStatus && matchesAdminState;
  });

  const getOperStatusBadge = (status?: string) => {
    const badges = {
      ACTIVE: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Active" },
      DISCOVERED: {
        icon: AlertTriangle,
        color: "bg-amber-100 text-amber-800",
        label: "Discovered",
      },
      ACTIVATING: { icon: RefreshCw, color: "bg-blue-100 text-blue-800", label: "Activating" },
      UNKNOWN: { icon: XCircle, color: "bg-gray-100 text-gray-800", label: "Unknown" },
      FAILED: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
    };
    const config = badges[(status || "UNKNOWN") as keyof typeof badges] || badges.UNKNOWN;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className={`h-3 w-3 mr-1 ${status === "ACTIVATING" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  const getAdminStateBadge = (state?: string) => {
    return state === "ENABLED" ? (
      <Badge className="bg-green-100 text-green-800">
        <Power className="h-3 w-3 mr-1" />
        Enabled
      </Badge>
    ) : (
      <Badge className="bg-gray-100 text-gray-800">
        <PowerOff className="h-3 w-3 mr-1" />
        Disabled
      </Badge>
    );
  };

  const stats = {
    total: onus.length,
    active: onus.filter((o) => (o.oper_status || "").toUpperCase() === "ACTIVE").length,
    discovered: onus.filter((o) => (o.oper_status || "").toUpperCase() === "DISCOVERED").length,
    enabled: onus.filter((o) => (o.admin_state || "").toUpperCase() === "ENABLED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ONU Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage Optical Network Units (ONU) - Subscriber devices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard/pon/onus/discover">Discover ONUs</Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total ONUs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All devices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Discovered</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.discovered}</div>
            <p className="text-xs text-muted-foreground">Not provisioned</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Enabled</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.enabled}</div>
            <p className="text-xs text-muted-foreground">Admin enabled</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by ID, serial, or vendor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="DISCOVERED">Discovered</SelectItem>
                <SelectItem value="ACTIVATING">Activating</SelectItem>
                <SelectItem value="FAILED">Failed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={adminStateFilter} onValueChange={setAdminStateFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                <SelectItem value="ENABLED">Enabled</SelectItem>
                <SelectItem value="DISABLED">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ONU Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading ONUs...
            </CardContent>
          </Card>
        ) : filteredONUs.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No ONUs match your search" : "No ONUs found"}
            </CardContent>
          </Card>
        ) : (
          filteredONUs.map((onu) => {
            const metadata = onu.metadata || {};
            const supportedOperations: string[] = Array.isArray(metadata["supported_operations"])
              ? metadata["supported_operations"]
              : [];

            const canPerform = (operation: DeviceOperation) =>
              supportedOperations.includes(operation);
            const isOperationPending = (operation: DeviceOperation) =>
              pendingOperation?.deviceId === onu.id && pendingOperation.operation === operation;

            return (
              <Card key={onu.id} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Wifi className="h-8 w-8 text-primary" />
                    <div className="flex flex-col gap-1 items-end">
                      {getOperStatusBadge(onu.oper_status)}
                      {getAdminStateBadge(onu.admin_state)}
                    </div>
                  </div>
                  <CardTitle className="mt-2 truncate">
                    <Link href={`/dashboard/pon/onus/${onu.id}`} className="hover:underline">
                      {onu.serial_number || onu.id}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vendor:</span>
                      <span className="font-medium">{onu.vendor || "Unknown"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model:</span>
                      <span className="font-medium">{onu.model || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Firmware:</span>
                      <span className="font-medium truncate ml-2">
                        {onu.firmware_version || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">OLT:</span>
                      <span className="font-medium">
                        {metadata["olt_id"] || onu.parent_id || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">PON Port:</span>
                      <span className="font-medium">
                        {metadata["pon_port"] ?? onu.parent_port_no ?? "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Supported Ops:</span>
                      <span className="font-medium">
                        {supportedOperations.length > 0 ? supportedOperations.join(", ") : "None"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerOperation(onu, "enable")}
                      disabled={
                        !canPerform("enable") ||
                        isOperationPending("enable") ||
                        onu.admin_state === "ENABLED"
                      }
                      className="flex-1"
                      title={canPerform("enable") ? undefined : "Enable operation not supported"}
                    >
                      <Power className="h-3 w-3 mr-1" />
                      Enable
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerOperation(onu, "disable")}
                      disabled={
                        !canPerform("disable") ||
                        isOperationPending("disable") ||
                        onu.admin_state === "DISABLED"
                      }
                      className="flex-1"
                      title={canPerform("disable") ? undefined : "Disable operation not supported"}
                    >
                      <PowerOff className="h-3 w-3 mr-1" />
                      Disable
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!canPerform("reboot")) {
                          return;
                        }
                        const confirmed = await confirmDialog({
                          title: "Reboot ONU",
                          description: `Reboot ONU ${onu.serial_number || onu.id}?`,
                          confirmText: "Reboot",
                        });
                        if (!confirmed) {
                          return;
                        }
                        triggerOperation(onu, "reboot");
                      }}
                      disabled={!canPerform("reboot") || isOperationPending("reboot")}
                      title={canPerform("reboot") ? undefined : "Reboot operation not supported"}
                    >
                      <RotateCw className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (!canPerform("delete")) {
                          return;
                        }
                        const confirmed = await confirmDialog({
                          title: "Delete ONU",
                          description: `Delete ONU ${onu.serial_number || onu.id}? This cannot be undone.`,
                          confirmText: "Delete",
                          variant: "destructive",
                        });
                        if (!confirmed) {
                          return;
                        }
                        triggerOperation(onu, "delete");
                      }}
                      disabled={!canPerform("delete") || isOperationPending("delete")}
                      className="text-destructive hover:text-destructive"
                      title={canPerform("delete") ? undefined : "Delete operation not supported"}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
