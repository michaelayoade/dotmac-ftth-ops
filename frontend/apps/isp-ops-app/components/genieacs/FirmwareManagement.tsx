"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Upload,
  Calendar,
  Play,
  XCircle,
  CheckCircle2,
  Loader2,
  Clock,
  AlertTriangle,
  FileUp,
  Server,
  Download,
  Info,
  Pause,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
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
import { Label } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Textarea } from "@dotmac/ui";
import { Alert, AlertDescription, AlertTitle } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import {
  FileResponse,
  FirmwareUpgradeSchedule,
  FirmwareUpgradeScheduleCreate,
  FirmwareUpgradeScheduleList,
  FirmwareUpgradeScheduleResponse,
} from "@/types/genieacs";

export function FirmwareManagement() {
  const { toast } = useToast();

  const [firmwareFiles, setFirmwareFiles] = useState<FileResponse[]>([]);
  const [schedules, setSchedules] = useState<FirmwareUpgradeSchedule[]>([]);
  const [selectedSchedule, setSelectedSchedule] = useState<FirmwareUpgradeSchedule | null>(null);
  const [scheduleDetails, setScheduleDetails] = useState<FirmwareUpgradeScheduleResponse | null>(
    null,
  );

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create schedule form
  const [createForm, setCreateForm] = useState<FirmwareUpgradeScheduleCreate>({
    name: "",
    description: "",
    firmware_file: "",
    file_type: "1 Firmware Upgrade Image",
    device_filter: {},
    scheduled_at: new Date().toISOString(),
    timezone: "UTC",
    max_concurrent: 5,
  });

  const [deviceFilter, setDeviceFilter] = useState<string>("{}");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, schedulesRes] = await Promise.all([
        apiClient.get<FileResponse[]>("/genieacs/files"),
        apiClient.get<FirmwareUpgradeScheduleList>("/genieacs/firmware-upgrades/schedules"),
      ]);

      setFirmwareFiles(filesRes.data);
      setSchedules(schedulesRes.data["schedules"]);
    } catch (err: any) {
      toast({
        title: "Failed to load data",
        description: err?.response?.["data"]?.detail || "Could not fetch firmware data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  const loadScheduleDetails = async (scheduleId: string) => {
    try {
      const response = await apiClient.get<FirmwareUpgradeScheduleResponse>(
        `/genieacs/firmware-upgrades/schedules/${scheduleId}`,
      );
      setScheduleDetails(response["data"]);
    } catch (err: any) {
      toast({
        title: "Failed to load schedule details",
        description: err?.response?.["data"]?.detail || "Could not fetch schedule details",
        variant: "destructive",
      });
    }
  };

  const handleCreateSchedule = async () => {
    if (!createForm.name || !createForm.firmware_file) {
      toast({
        title: "Invalid Form",
        description: "Please provide name and firmware file",
        variant: "destructive",
      });
      return;
    }

    // Parse device filter
    let parsedFilter: Record<string, any>;
    try {
      parsedFilter = JSON.parse(deviceFilter);
    } catch (e) {
      toast({
        title: "Invalid Device Filter",
        description: "Device filter must be valid JSON",
        variant: "destructive",
      });
      return;
    }

    setCreating(true);
    try {
      const payload: FirmwareUpgradeScheduleCreate = {
        ...createForm,
        device_filter: parsedFilter,
      };

      const response = await apiClient.post<FirmwareUpgradeScheduleResponse>(
        "/genieacs/firmware-upgrades/schedule",
        payload,
      );

      toast({
        title: "Schedule Created",
        description: `Firmware upgrade scheduled for ${response["data"].total_devices} devices`,
      });

      setShowCreateModal(false);
      setCreateForm({
        name: "",
        description: "",
        firmware_file: "",
        file_type: "1 Firmware Upgrade Image",
        device_filter: {},
        scheduled_at: new Date().toISOString(),
        timezone: "UTC",
        max_concurrent: 5,
      });
      setDeviceFilter("{}");

      await loadData();
    } catch (err: any) {
      toast({
        title: "Failed to create schedule",
        description:
          err?.response?.["data"]?.detail || "Could not create firmware upgrade schedule",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleExecuteSchedule = async (scheduleId: string) => {
    try {
      await apiClient.post<FirmwareUpgradeScheduleResponse>(
        `/genieacs/firmware-upgrades/schedules/${scheduleId}/execute`,
      );

      toast({
        title: "Schedule Executing",
        description: "Firmware upgrade has been started",
      });

      await loadData();
      if (selectedSchedule?.schedule_id === scheduleId) {
        await loadScheduleDetails(scheduleId);
      }
    } catch (err: any) {
      toast({
        title: "Failed to execute schedule",
        description: err?.response?.["data"]?.detail || "Could not execute firmware upgrade",
        variant: "destructive",
      });
    }
  };

  const handleCancelSchedule = async (scheduleId: string) => {
    try {
      await apiClient.delete(`/genieacs/firmware-upgrades/schedules/${scheduleId}`);

      toast({
        title: "Schedule Cancelled",
        description: "Firmware upgrade has been cancelled",
      });

      await loadData();
      if (selectedSchedule?.schedule_id === scheduleId) {
        setShowDetailsModal(false);
        setSelectedSchedule(null);
        setScheduleDetails(null);
      }
    } catch (err: any) {
      toast({
        title: "Failed to cancel schedule",
        description: err?.response?.["data"]?.detail || "Could not cancel firmware upgrade",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = async (schedule: FirmwareUpgradeSchedule) => {
    setSelectedSchedule(schedule);
    if (schedule.schedule_id) {
      await loadScheduleDetails(schedule.schedule_id);
    }
    setShowDetailsModal(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: any; icon: any; color: string }> = {
      pending: { variant: "secondary", icon: Clock, color: "text-blue-600" },
      running: { variant: "default", icon: Play, color: "text-green-600" },
      completed: {
        variant: "outline",
        icon: CheckCircle2,
        color: "text-green-600",
      },
      failed: { variant: "destructive", icon: XCircle, color: "text-red-600" },
      cancelled: { variant: "outline", icon: Pause, color: "text-gray-600" },
    };

    const normalizedStatus = status as keyof typeof styles;
    const styleRecord = (styles[normalizedStatus] ?? styles["pending"])!;
    const Icon = styleRecord.icon;

    return (
      <Badge variant={styleRecord.variant}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getProgressPercentage = (schedule: FirmwareUpgradeSchedule): number => {
    const total = scheduleDetails?.total_devices || schedule.total_devices || 0;
    if (total === 0) return 0;
    const completed =
      (scheduleDetails?.completed_devices || 0) + (scheduleDetails?.failed_devices || 0);
    return (completed / total) * 100;
  };

  const getDeviceResultBadge = (status: string) => {
    const styles: Record<string, { variant: any; icon: any }> = {
      success: { variant: "outline", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: XCircle },
      pending: { variant: "secondary", icon: Clock },
      in_progress: { variant: "default", icon: Loader2 },
    };

    const normalizedStatus = status as keyof typeof styles;
    const styleRecord = (styles[normalizedStatus] ?? styles["pending"])!;
    const Icon = styleRecord.icon;

    return (
      <Badge variant={styleRecord.variant} className="text-xs">
        <Icon className={`w-3 h-3 mr-1 ${status === "in_progress" ? "animate-spin" : ""}`} />
        {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Firmware Management</h2>
          <p className="text-muted-foreground">Schedule and manage CPE firmware upgrades</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Calendar className="w-4 h-4 mr-2" />
          Schedule Upgrade
        </Button>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
                <p className="text-2xl font-bold">{schedules.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Running</p>
                <p className="text-2xl font-bold">
                  {schedules.filter((s) => s.status === "running").length}
                </p>
              </div>
              <Play className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">
                  {schedules.filter((s) => s.status === "pending").length}
                </p>
              </div>
              <Clock className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Firmware Files</p>
                <p className="text-2xl font-bold">{firmwareFiles.length}</p>
              </div>
              <FileUp className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle>Firmware Upgrade Schedules</CardTitle>
          <CardDescription>View and manage scheduled firmware upgrades</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && schedules.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : schedules.length === 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>No Schedules</AlertTitle>
              <AlertDescription>
                No firmware upgrade schedules have been created yet. Click &quot;Schedule
                Upgrade&quot; to create one.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <Card key={schedule.schedule_id} className="hover:shadow-md transition-all">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{schedule.name}</h4>
                          {getStatusBadge(schedule.status)}
                        </div>

                        {schedule.description && (
                          <p className="text-sm text-muted-foreground">{schedule.description}</p>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <span className="text-muted-foreground">Firmware:</span>
                            <p className="font-medium truncate">{schedule.firmware_file}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Scheduled:</span>
                            <p className="font-medium">
                              {new Date(schedule.scheduled_at).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Max Concurrent:</span>
                            <p className="font-medium">{schedule.max_concurrent}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Created:</span>
                            <p className="font-medium">
                              {schedule.created_at
                                ? new Date(schedule.created_at).toLocaleDateString()
                                : "N/A"}
                            </p>
                          </div>
                        </div>

                        {schedule.status === "running" && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">
                                {Math.round(getProgressPercentage(schedule))}%
                              </span>
                            </div>
                            <Progress value={getProgressPercentage(schedule)} className="h-2" />
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetails(schedule)}
                        >
                          <Info className="w-4 h-4 mr-1" />
                          Details
                        </Button>

                        {schedule.status === "pending" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() =>
                              schedule.schedule_id && handleExecuteSchedule(schedule.schedule_id)
                            }
                          >
                            <Play className="w-4 h-4 mr-1" />
                            Execute
                          </Button>
                        )}

                        {(schedule.status === "pending" || schedule.status === "running") && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              schedule.schedule_id && handleCancelSchedule(schedule.schedule_id)
                            }
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Schedule Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Schedule Firmware Upgrade</DialogTitle>
            <DialogDescription>
              Create a scheduled firmware upgrade for multiple CPE devices
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Schedule Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g., Q1 2025 Firmware Rollout"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                placeholder="Optional description of this firmware upgrade"
                rows={2}
              />
            </div>

            {/* Firmware File */}
            <div className="space-y-2">
              <Label htmlFor="firmware_file">
                Firmware File <span className="text-red-500">*</span>
              </Label>
              <select
                id="firmware_file"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={createForm.firmware_file}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    firmware_file: e.target.value,
                  })
                }
              >
                <option value="">Select firmware file</option>
                {firmwareFiles.map((file) => (
                  <option key={file.file_id} value={file.file_id}>
                    {file.file_id} (
                    {file.length ? `${(file.length / 1024 / 1024).toFixed(2)} MB` : "Unknown size"})
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {firmwareFiles.length === 0
                  ? "No firmware files available. Upload files to GenieACS first."
                  : `${firmwareFiles.length} firmware file(s) available`}
              </p>
            </div>

            {/* Device Filter */}
            <div className="space-y-2">
              <Label htmlFor="device_filter">Device Filter (JSON)</Label>
              <Textarea
                id="device_filter"
                value={deviceFilter}
                onChange={(e) => setDeviceFilter(e.target.value)}
                placeholder='{"InternetGatewayDevice.DeviceInfo.ModelName": "ROUTER-X1000"}'
                rows={3}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                MongoDB-style query to select target devices. Example: {`{"_tags": "production"}`}
              </p>
            </div>

            {/* Scheduled Time */}
            <div className="space-y-2">
              <Label htmlFor="scheduled_at">Scheduled Time</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={createForm.scheduled_at.slice(0, 16)}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    scheduled_at: new Date(e.target.value).toISOString(),
                  })
                }
              />
            </div>

            {/* Max Concurrent */}
            <div className="space-y-2">
              <Label htmlFor="max_concurrent">Max Concurrent Upgrades</Label>
              <Input
                id="max_concurrent"
                type="number"
                min="1"
                max="50"
                value={createForm.max_concurrent}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    max_concurrent: parseInt(e.target.value) || 5,
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of devices to upgrade simultaneously (1-50)
              </p>
            </div>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription className="text-xs">
                Firmware upgrades may cause device reboots and temporary service interruption.
                Ensure you have selected the correct devices and firmware version.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSchedule} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Calendar className="w-4 h-4 mr-2" />
                  Create Schedule
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedSchedule?.name}</DialogTitle>
            <DialogDescription>Firmware upgrade schedule details and progress</DialogDescription>
          </DialogHeader>

          {selectedSchedule && (
            <div className="space-y-4">
              {/* Schedule Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Schedule Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <div className="mt-1">{getStatusBadge(selectedSchedule.status)}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Firmware File:</span>
                      <p className="font-medium mt-1">{selectedSchedule.firmware_file}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Scheduled At:</span>
                      <p className="font-medium mt-1">
                        {new Date(selectedSchedule.scheduled_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Max Concurrent:</span>
                      <p className="font-medium mt-1">{selectedSchedule.max_concurrent}</p>
                    </div>
                  </div>

                  {selectedSchedule.description && (
                    <div>
                      <span className="text-muted-foreground text-sm">Description:</span>
                      <p className="text-sm mt-1">{selectedSchedule.description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Progress */}
              {scheduleDetails && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-bold">{scheduleDetails.total_devices}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-green-600">
                          {scheduleDetails.completed_devices}
                        </p>
                        <p className="text-xs text-muted-foreground">Completed</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-red-600">
                          {scheduleDetails.failed_devices}
                        </p>
                        <p className="text-xs text-muted-foreground">Failed</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-blue-600">
                          {scheduleDetails.pending_devices}
                        </p>
                        <p className="text-xs text-muted-foreground">Pending</p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Overall Progress</span>
                        <span className="font-medium">
                          {Math.round(getProgressPercentage(selectedSchedule))}%
                        </span>
                      </div>
                      <Progress value={getProgressPercentage(selectedSchedule)} className="h-3" />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Device Results */}
              {scheduleDetails && scheduleDetails.results && scheduleDetails.results.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Device Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {scheduleDetails.results.map((result) => (
                        <div
                          key={result["device_id"]}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Server className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{result["device_id"]}</p>
                              {result["error_message"] && (
                                <p className="text-xs text-red-600">{result["error_message"]}</p>
                              )}
                              {result["started_at"] && (
                                <p className="text-xs text-muted-foreground">
                                  Started: {new Date(result["started_at"]).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                          {getDeviceResultBadge(result["status"])}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
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
