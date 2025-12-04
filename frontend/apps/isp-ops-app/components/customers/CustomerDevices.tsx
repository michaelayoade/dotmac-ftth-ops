import { useState, useEffect, useCallback } from "react";
import {
  Router,
  Wifi,
  Server,
  RefreshCw,
  Power,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Settings,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";

interface Device {
  id: string;
  device_type: "ont" | "router" | "cpe" | "onu" | "modem";
  vendor: string;
  model: string;
  serial_number: string;
  mac_address?: string;
  status: "online" | "offline" | "degraded";
  firmware_version?: string;
  last_seen?: string;
  uptime_hours?: number;
  signal_strength_dbm?: number;
  temperature_celsius?: number;
}

interface CustomerDevicesProps {
  customerId: string;
}

const getDeviceIcon = (type: Device["device_type"]) => {
  switch (type) {
    case "ont":
    case "onu":
      return Server;
    case "router":
      return Router;
    case "cpe":
    case "modem":
      return Wifi;
    default:
      return Server;
  }
};

const getStatusBadge = (status: Device["status"]) => {
  switch (status) {
    case "online":
      return (
        <Badge className="bg-green-500">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Online
        </Badge>
      );
    case "offline":
      return (
        <Badge variant="destructive">
          <XCircle className="w-3 h-3 mr-1" />
          Offline
        </Badge>
      );
    case "degraded":
      return (
        <Badge variant="secondary">
          <AlertCircle className="w-3 h-3 mr-1" />
          Degraded
        </Badge>
      );
  }
};

const formatUptime = (hours: number) => {
  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);
  return `${days}d ${remainingHours}h`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function CustomerDevices({ customerId }: CustomerDevicesProps) {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDevices = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ devices: Device[] }>(
        `/api/v1/customers/${customerId}/devices`,
      );
      setDevices(response.data.devices);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to load devices",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [customerId, toast]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleRebootDevice = async (deviceId: string) => {
    try {
      await apiClient.post(`/api/v1/devices/${deviceId}/reboot`);
      toast({
        title: "Reboot Initiated",
        description: "Device reboot command has been sent",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to reboot device",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDevices();
    setRefreshing(false);
  };

  const handleViewDevice = (deviceId: string) => {
    window.open(`/tenant/devices/${deviceId}`, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading devices...</div>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-center py-12">
        <Router className="w-12 h-12 text-slate-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-slate-300 mb-2">No Devices</h3>
        <p className="text-slate-500">No devices registered for this customer.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-white">Customer Equipment</h3>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Devices Table */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-slate-400">Device</TableHead>
              <TableHead className="text-slate-400">Type</TableHead>
              <TableHead className="text-slate-400">Status</TableHead>
              <TableHead className="text-slate-400">Vendor/Model</TableHead>
              <TableHead className="text-slate-400">Serial Number</TableHead>
              <TableHead className="text-slate-400">Firmware</TableHead>
              <TableHead className="text-slate-400">Last Seen</TableHead>
              <TableHead className="text-slate-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.map((device) => {
              const Icon = getDeviceIcon(device.device_type);
              return (
                <TableRow key={device.id} className="border-slate-700">
                  <TableCell className="font-medium text-white">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-blue-400" />
                      <div>
                        <div>{device.device_type.toUpperCase()}</div>
                        {device.mac_address && (
                          <div className="text-xs text-slate-500 font-mono">
                            {device.mac_address}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300 capitalize">{device.device_type}</TableCell>
                  <TableCell>{getStatusBadge(device.status)}</TableCell>
                  <TableCell className="text-slate-300">
                    {device.vendor}
                    <div className="text-xs text-slate-500">{device.model}</div>
                  </TableCell>
                  <TableCell className="text-slate-300 font-mono text-sm">
                    {device.serial_number}
                  </TableCell>
                  <TableCell className="text-slate-300 text-sm">
                    {device.firmware_version || "N/A"}
                  </TableCell>
                  <TableCell className="text-slate-300 text-sm">
                    {device.last_seen ? formatDate(device.last_seen) : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDevice(device.id)}
                        title="View Details"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRebootDevice(device.id)}
                        title="Reboot Device"
                        disabled={device.status === "offline"}
                      >
                        <Power className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Device Details Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((device) => (
          <div key={device.id} className="bg-slate-800 rounded-lg p-6 border border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const Icon = getDeviceIcon(device.device_type);
                  return <Icon className="w-6 h-6 text-blue-400" />;
                })()}
                <div>
                  <h4 className="text-white font-semibold">{device.device_type.toUpperCase()}</h4>
                  <p className="text-sm text-slate-500">{device.vendor}</p>
                </div>
              </div>
              {getStatusBadge(device.status)}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Model:</span>
                <span className="text-white">{device.model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Serial:</span>
                <span className="text-white font-mono text-xs">{device.serial_number}</span>
              </div>
              {device.firmware_version && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Firmware:</span>
                  <span className="text-white">{device.firmware_version}</span>
                </div>
              )}
              {device.uptime_hours !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Uptime:</span>
                  <span className="text-white">{formatUptime(device.uptime_hours)}</span>
                </div>
              )}
              {device.signal_strength_dbm !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Signal:</span>
                  <span className="text-white">{device.signal_strength_dbm} dBm</span>
                </div>
              )}
              {device.temperature_celsius !== undefined && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Temperature:</span>
                  <span className="text-white">{device.temperature_celsius}°C</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => handleViewDevice(device.id)}
              >
                <Settings className="w-4 h-4 mr-2" />
                Manage
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRebootDevice(device.id)}
                disabled={device.status === "offline"}
              >
                <Power className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
