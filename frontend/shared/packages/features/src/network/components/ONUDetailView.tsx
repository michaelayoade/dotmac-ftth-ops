"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Wifi,
  RefreshCw,
  CheckCircle,
  XCircle,
  Power,
  PowerOff,
  RotateCw,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { Device, DeviceDetailResponse, Port } from "../types/voltha";

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

interface RouterLike {
  push: (path: string) => void;
}

export interface ONUDetailViewProps {
  onuId: string;
  apiClient: ApiClient;
  useToast: () => { toast: ToastFunction };
  useConfirmDialog: () => ConfirmDialogFunction;
  router: RouterLike;
  Link: React.ComponentType<{ href: string; children: React.ReactNode }>;
}

// ============================================================================
// Helper Functions
// ============================================================================

function statusBadgeClasses(status?: string) {
  switch ((status || "").toUpperCase()) {
    case "ACTIVE":
    case "ENABLED":
    case "ONLINE":
      return "bg-green-100 text-green-800";
    case "DISABLED":
    case "OFFLINE":
    case "DEACTIVATED":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

// ============================================================================
// Main Component
// ============================================================================

export function ONUDetailView({
  onuId,
  apiClient,
  useToast,
  useConfirmDialog,
  router,
  Link,
}: ONUDetailViewProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [pendingOperation, setPendingOperation] = useState<DeviceOperation | null>(null);
  const confirmDialog = useConfirmDialog();

  const {
    data: deviceDetail,
    isLoading,
    refetch,
  } = useQuery<DeviceDetailResponse>({
    queryKey: ["access-onu", onuId],
    queryFn: async () => {
      const response = await apiClient.get<DeviceDetailResponse>(`/api/v1/access/devices/${onuId}`);
      return response.data;
    },
    refetchInterval: 30000,
  });

  const operateMutation = useMutation({
    mutationFn: async (operation: DeviceOperation) => {
      if (!deviceDetail?.device) {
        throw new Error("Device not loaded");
      }
      const device = deviceDetail.device;
      const oltId =
        device.metadata?.["olt_id"] ||
        device.parent_id ||
        (device.metadata?.["root_device_id"] as string | undefined);
      const baseUrl = `/api/v1/access/devices/${encodeURIComponent(onuId)}/${operation}`;
      const url = oltId ? `${baseUrl}?olt_id=${encodeURIComponent(oltId)}` : baseUrl;
      const response = await apiClient.post(url);
      return response.data;
    },
    onSuccess: (_, operation) => {
      if (operation === "delete") {
        toast({ title: "ONU deleted" });
        router.push("/dashboard/pon/onus");
      } else {
        queryClient.invalidateQueries({ queryKey: ["access-onu", onuId] });
        toast({ title: `Operation '${operation}' completed` });
      }
    },
    onError: (error: any, operation) => {
      toast({
        title: `Failed to ${operation} device`,
        description: error?.response?.data?.detail || error?.message || "Operation failed",
        variant: "destructive",
      });
    },
  });

  const handleOperation = (operation: DeviceOperation) => {
    setPendingOperation(operation);
    operateMutation.mutate(operation, {
      onSettled: () => setPendingOperation(null),
    });
  };

  if (isLoading || !deviceDetail?.device) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const device: Device = deviceDetail.device;
  const ports: Port[] = deviceDetail.ports ?? [];
  const supportedOperations: string[] = Array.isArray(device.metadata?.["supported_operations"])
    ? device.metadata?.["supported_operations"]
    : ["enable", "disable", "reboot", "delete"];

  const canPerform = (op: DeviceOperation) => supportedOperations.includes(op);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/dashboard/pon/onus">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">ONU Details</h1>
            <p className="text-sm text-muted-foreground">{device.serial_number || device.id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={pendingOperation !== null}>
            <RefreshCw className={`h-4 w-4 ${pendingOperation === null ? "" : "animate-spin"}`} />
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOperation("enable")}
            disabled={
              !canPerform("enable") || pendingOperation !== null || device.admin_state === "ENABLED"
            }
            title={
              canPerform("enable")
                ? undefined
                : "Enable operation not supported by this device driver"
            }
          >
            <Power className="h-4 w-4 mr-2" />
            Enable
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOperation("disable")}
            disabled={
              !canPerform("disable") ||
              pendingOperation !== null ||
              device.admin_state === "DISABLED"
            }
            title={
              canPerform("disable")
                ? undefined
                : "Disable operation not supported by this device driver"
            }
          >
            <PowerOff className="h-4 w-4 mr-2" />
            Disable
          </Button>
          <Button
            variant="outline"
            onClick={() => handleOperation("reboot")}
            disabled={!canPerform("reboot") || pendingOperation !== null}
            title={
              canPerform("reboot")
                ? undefined
                : "Reboot operation not supported by this device driver"
            }
          >
            <RotateCw className="h-4 w-4 mr-2" />
            Reboot
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (!canPerform("delete")) {
                return;
              }
              const confirmed = await confirmDialog({
                title: "Delete ONU",
                description: "Delete this ONU?",
                confirmText: "Delete",
                variant: "destructive",
              });
              if (!confirmed) {
                return;
              }
              handleOperation("delete");
            }}
            disabled={!canPerform("delete") || pendingOperation !== null}
            title={
              canPerform("delete")
                ? undefined
                : "Delete operation not supported by this device driver"
            }
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Operational Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusBadgeClasses(device.oper_status)}>
              {device.oper_status?.toUpperCase() === "ACTIVE" ? (
                <CheckCircle className="h-3 w-3 mr-1" />
              ) : (
                <XCircle className="h-3 w-3 mr-1" />
              )}
              {device.oper_status || "UNKNOWN"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Admin State</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusBadgeClasses(device.admin_state)}>
              {device.admin_state || "UNKNOWN"}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connect Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusBadgeClasses(device.connect_status)}>
              {device.connect_status || "UNKNOWN"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Device Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Device ID</p>
            <p className="font-mono text-sm break-all">{device.id}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Serial Number</p>
            <p className="font-medium">{device.serial_number || "N/A"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Vendor</p>
            <p className="font-medium">{device.vendor || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Model</p>
            <p className="font-medium">{device.model || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Firmware Version</p>
            <p className="font-medium">{device.firmware_version || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Hardware Version</p>
            <p className="font-medium">{device.hardware_version || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Parent OLT</p>
            <p className="font-medium">
              {device.parent_id || device.metadata?.["olt_id"] || "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Parent Port</p>
            <p className="font-medium">{device.parent_port_no ?? "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">VLAN</p>
            <p className="font-medium">{device.vlan ?? "N/A"}</p>
          </div>
          {device.reason && (
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Reason</p>
              <p className="font-medium">{device.reason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Connection</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Adapter</p>
            <p className="font-medium">{device.adapter || "Unknown"}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Driver</p>
            <p className="font-medium">{device.metadata?.["driver_id"] || "Unknown"}</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-sm text-muted-foreground">Supported Operations</p>
            <p className="font-medium">
              {supportedOperations.length > 0 ? supportedOperations.join(", ") : "None advertised"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ports.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Wifi className="h-5 w-5 mr-2" />
              No ports reported for this ONU
            </div>
          ) : (
            ports.map((port) => (
              <div
                key={`${port.device_id}-${port.port_no}`}
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wifi className="h-4 w-4 text-primary" />
                    <span className="font-medium">Port {port.port_no}</span>
                  </div>
                  <Badge className={statusBadgeClasses(port.oper_status)}>
                    {port.oper_status || "UNKNOWN"}
                  </Badge>
                </div>
                <div className="grid gap-2 md:grid-cols-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Admin State</p>
                    <p className="font-medium">{port.admin_state || "Unknown"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Label</p>
                    <p className="font-medium">{port.label || "N/A"}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
