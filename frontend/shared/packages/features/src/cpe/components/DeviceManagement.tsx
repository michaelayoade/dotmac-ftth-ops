"use client";

import { useToast } from "@dotmac/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import {
  Server,
  RefreshCw,
  Trash2,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Power,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

import {
  DeviceInfo,
  DeviceListResponse,
  DeviceStatsResponse,
  DeviceResponse,
  TaskResponse,
} from "../types";

interface DeviceManagementProps {
  apiClient: {
    get: <T = any>(url: string) => Promise<{ data: T }>;
    post: <T = any>(url: string, data?: any) => Promise<{ data: T }>;
    delete: <T = any>(url: string) => Promise<{ data: T }>;
  };
  devicesEndpoint: string;
  statsEndpoint: string;
  tasksEndpoint: string;
}

export function DeviceManagement({
  apiClient,
  devicesEndpoint,
  statsEndpoint,
  tasksEndpoint,
}: DeviceManagementProps) {
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [stats, setStats] = useState<DeviceStatsResponse | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceResponse | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, statsRes] = await Promise.all([
        apiClient.get<DeviceListResponse>(devicesEndpoint),
        apiClient.get<DeviceStatsResponse>(statsEndpoint),
      ]);

      setDevices(devicesRes.data.devices);
      setStats(statsRes.data);
    } catch (err: any) {
      toast({
        title: "Failed to load devices",
        description: err?.response?.data?.detail || "Could not fetch device data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, apiClient, devicesEndpoint, statsEndpoint]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleViewDetails = async (deviceId: string) => {
    try {
      const response = await apiClient.get<DeviceResponse>(`${devicesEndpoint}/${deviceId}`);
      setSelectedDevice(response.data);
      setShowDetailsModal(true);
    } catch (err: any) {
      toast({
        title: "Failed to load device details",
        description: err?.response?.data?.detail || "Could not fetch device details",
        variant: "destructive",
      });
    }
  };

  const handleRefreshDevice = async (deviceId: string) => {
    try {
      await apiClient.post<TaskResponse>(`${tasksEndpoint}/refresh`, {
        device_id: deviceId,
      });

      toast({
        title: "Refresh Task Created",
        description: "Device refresh has been initiated",
      });
    } catch (err: any) {
      toast({
        title: "Failed to refresh device",
        description: err?.response?.data?.detail || "Could not create refresh task",
        variant: "destructive",
      });
    }
  };

  const handleRebootDevice = async (deviceId: string) => {
    try {
      await apiClient.post<TaskResponse>(`${tasksEndpoint}/reboot`, {
        device_id: deviceId,
      });

      toast({
        title: "Reboot Task Created",
        description: "Device reboot has been initiated",
      });
    } catch (err: any) {
      toast({
        title: "Failed to reboot device",
        description: err?.response?.data?.detail || "Could not create reboot task",
        variant: "destructive",
      });
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    const confirmed = await confirmDialog({
      title: "Delete device",
      description: `Are you sure you want to delete device ${deviceId}?`,
      confirmText: "Delete device",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.delete(`${devicesEndpoint}/${deviceId}`);

      toast({
        title: "Device Deleted",
        description: "Device has been removed from GenieACS",
      });

      await loadData();
      setShowDetailsModal(false);
      setSelectedDevice(null);
    } catch (err: any) {
      toast({
        title: "Failed to delete device",
        description: err?.response?.data?.detail || "Could not delete device",
        variant: "destructive",
      });
    }
  };

  const filteredDevices = devices.filter((device) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      device.device_id.toLowerCase().includes(query) ||
      device.manufacturer?.toLowerCase().includes(query) ||
      device.model?.toLowerCase().includes(query) ||
      device.serial_number?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{stats?.total_devices || 0}</p>
              </div>
              <Server className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-green-600">{stats?.online_devices || 0}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Offline</p>
                <p className="text-2xl font-bold text-red-600">{stats?.offline_devices || 0}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Models</p>
                <p className="text-2xl font-bold">{stats ? Object.keys(stats.models).length : 0}</p>
              </div>
              <Filter className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>CPE Devices</CardTitle>
              <CardDescription>Manage customer premises equipment devices</CardDescription>
            </div>
            <Button onClick={loadData} variant="outline" size="sm">
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by device ID, manufacturer, model, or serial number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Devices List */}
          {loading && devices.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDevices.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Devices Found</AlertTitle>
              <AlertDescription>
                {searchQuery
                  ? "No devices match your search criteria"
                  : "No CPE devices are currently registered"}
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              {filteredDevices.map((device) => (
                <Card key={device.device_id} className="hover:shadow-md transition-all">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Server className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{device.device_id}</div>
                          <div className="text-xs text-muted-foreground">
                            {device.manufacturer} {device.model} • S/N: {device.serial_number}
                          </div>
                          {device.last_inform && (
                            <div className="text-xs text-muted-foreground">
                              Last seen: {new Date(device.last_inform).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(device.device_id)}
                        >
                          <Info className="w-4 h-4 mr-1" />
                          Details
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRefreshDevice(device.device_id)}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRebootDevice(device.device_id)}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Device Details</DialogTitle>
            <DialogDescription>{selectedDevice?.device_id}</DialogDescription>
          </DialogHeader>

          {selectedDevice && (
            <div className="space-y-4">
              {/* Device Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Device Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Device ID:</span>
                      <p className="font-medium mt-1">{selectedDevice.device_id}</p>
                    </div>
                    {selectedDevice.device_info["Manufacturer"] && (
                      <div>
                        <span className="text-muted-foreground">Manufacturer:</span>
                        <p className="font-medium mt-1">
                          {selectedDevice.device_info["Manufacturer"]}
                        </p>
                      </div>
                    )}
                    {selectedDevice.device_info["ModelName"] && (
                      <div>
                        <span className="text-muted-foreground">Model:</span>
                        <p className="font-medium mt-1">
                          {selectedDevice.device_info["ModelName"]}
                        </p>
                      </div>
                    )}
                    {selectedDevice.device_info["SerialNumber"] && (
                      <div>
                        <span className="text-muted-foreground">Serial Number:</span>
                        <p className="font-medium mt-1">
                          {selectedDevice.device_info["SerialNumber"]}
                        </p>
                      </div>
                    )}
                    {selectedDevice.device_info["HardwareVersion"] && (
                      <div>
                        <span className="text-muted-foreground">Hardware Version:</span>
                        <p className="font-medium mt-1">
                          {selectedDevice.device_info["HardwareVersion"]}
                        </p>
                      </div>
                    )}
                    {selectedDevice.device_info["SoftwareVersion"] && (
                      <div>
                        <span className="text-muted-foreground">Software Version:</span>
                        <p className="font-medium mt-1">
                          {selectedDevice.device_info["SoftwareVersion"]}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Tags */}
              {selectedDevice.tags && selectedDevice.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedDevice.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Device Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleRefreshDevice(selectedDevice.device_id)}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Refresh Parameters
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleRebootDevice(selectedDevice.device_id)}
                    >
                      <Power className="w-4 h-4 mr-2" />
                      Reboot Device
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDeleteDevice(selectedDevice.device_id)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete from GenieACS
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
