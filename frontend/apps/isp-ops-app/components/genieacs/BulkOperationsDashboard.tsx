"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Layers,
  Plus,
  Play,
  Pause,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  Calendar,
  Download,
  Upload,
  Settings,
  Zap,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import {
  MassConfigJob,
  MassConfigJobList,
  FirmwareUpgradeSchedule,
  FirmwareUpgradeScheduleList,
} from "@/types/genieacs";

interface BulkOperationStats {
  total_operations: number;
  active_operations: number;
  completed_today: number;
  failed_today: number;
  devices_affected_today: number;
  success_rate: number;
}

export function BulkOperationsDashboard() {
  const { toast } = useToast();

  const [stats, setStats] = useState<BulkOperationStats>({
    total_operations: 0,
    active_operations: 0,
    completed_today: 0,
    failed_today: 0,
    devices_affected_today: 0,
    success_rate: 0,
  });

  const [configJobs, setConfigJobs] = useState<MassConfigJob[]>([]);
  const [firmwareSchedules, setFirmwareSchedules] = useState<FirmwareUpgradeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [configRes, firmwareRes] = await Promise.all([
        apiClient.get<MassConfigJobList>("/genieacs/mass-config"),
        apiClient.get<FirmwareUpgradeScheduleList>("/genieacs/firmware-schedules"),
      ]);

      setConfigJobs(configRes.data["jobs"]);
      setFirmwareSchedules(firmwareRes.data["schedules"]);

      // Calculate stats
      const allOperations = [...configRes.data["jobs"], ...firmwareRes.data["schedules"]];

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const completedToday = allOperations.filter((op) => {
        if (!op.completed_at) return false;
        const completedDate = new Date(op.completed_at);
        return completedDate >= today && op.status === "completed";
      }).length;

      const failedToday = allOperations.filter((op) => {
        if (!op.completed_at && !op.started_at) return false;
        const date = new Date(op.completed_at || op.started_at!);
        return date >= today && op.status === "failed";
      }).length;

      const devicesAffectedToday = allOperations
        .filter((op) => {
          if (!op.started_at) return false;
          const startedDate = new Date(op.started_at);
          return startedDate >= today;
        })
        .reduce((sum, op) => sum + (op.completed_devices || 0), 0);

      const totalCompleted = allOperations.reduce(
        (sum, op) => sum + (op.completed_devices || 0),
        0,
      );
      const totalFailed = allOperations.reduce((sum, op) => sum + (op.failed_devices || 0), 0);
      const successRate =
        totalCompleted + totalFailed > 0
          ? (totalCompleted / (totalCompleted + totalFailed)) * 100
          : 0;

      setStats({
        total_operations: allOperations.length,
        active_operations: allOperations.filter(
          (op) => op.status === "running" || op.status === "pending",
        ).length,
        completed_today: completedToday,
        failed_today: failedToday,
        devices_affected_today: devicesAffectedToday,
        success_rate: successRate,
      });
    } catch (err: any) {
      toast({
        title: "Failed to load operations",
        description: err?.response?.["data"]?.detail || "Could not fetch bulk operations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancelJob = async (jobId: string, type: "config" | "firmware") => {
    try {
      const endpoint =
        type === "config"
          ? `/genieacs/mass-config/${jobId}/cancel`
          : `/genieacs/firmware-schedules/${jobId}/cancel`;

      await apiClient.post(endpoint);
      toast({
        title: "Operation cancelled",
        description: "The bulk operation has been cancelled",
      });
      loadData();
    } catch (err: any) {
      toast({
        title: "Failed to cancel operation",
        description: err?.response?.["data"]?.detail || "Could not cancel operation",
        variant: "destructive",
      });
    }
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

  const getProgressPercentage = (job: MassConfigJob | FirmwareUpgradeSchedule): number => {
    const total = job["total_devices"] || 0;
    if (total === 0) return 0;
    const completed = (job["completed_devices"] || 0) + (job["failed_devices"] || 0);
    return (completed / total) * 100;
  };

  const filteredConfigJobs =
    statusFilter === "all" ? configJobs : configJobs.filter((job) => job.status === statusFilter);

  const filteredFirmwareSchedules =
    statusFilter === "all"
      ? firmwareSchedules
      : firmwareSchedules.filter((schedule) => schedule.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading bulk operations...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Bulk CPE Operations</h2>
          <p className="text-sm text-muted-foreground">
            Manage mass configuration and firmware upgrades
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Operation
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats["total_operations"]}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">{stats["active_operations"]}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats["completed_today"]}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Failed Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats["failed_today"]}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Devices Affected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats["devices_affected_today"]}</div>
            <p className="text-xs text-muted-foreground">Today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {stats["success_rate"].toFixed(1)}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Operations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Operations</CardTitle>
              <CardDescription>Mass configuration jobs and firmware upgrades</CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="config">
            <TabsList>
              <TabsTrigger value="config">
                <Settings className="w-4 h-4 mr-2" />
                Configuration ({filteredConfigJobs.length})
              </TabsTrigger>
              <TabsTrigger value="firmware">
                <Upload className="w-4 h-4 mr-2" />
                Firmware ({filteredFirmwareSchedules.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="space-y-3 mt-4">
              {filteredConfigJobs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No configuration jobs found
                </div>
              ) : (
                filteredConfigJobs.map((job) => (
                  <div
                    key={job["job_id"]}
                    className="p-4 rounded-lg border bg-card hover:bg-card/80 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Settings className="w-4 h-4" />
                          <div className="font-medium">{job["name"]}</div>
                          {getStatusBadge(job["status"])}
                          {job["dry_run"] && (
                            <Badge variant="outline" className="bg-blue-50">
                              Dry Run
                            </Badge>
                          )}
                        </div>
                        {job["description"] && (
                          <p className="text-sm text-muted-foreground mb-2">{job["description"]}</p>
                        )}
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Total:</span>{" "}
                            <span className="font-medium">{job["total_devices"]}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Completed:</span>{" "}
                            <span className="font-medium text-green-600">
                              {job["completed_devices"]}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Failed:</span>{" "}
                            <span className="font-medium text-red-600">
                              {job["failed_devices"]}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(job.status === "running" || job.status === "pending") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelJob(job["job_id"], "config")}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          Details
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {job.status === "running" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {getProgressPercentage(job).toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={getProgressPercentage(job)} className="h-2" />
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t">
                      <div>
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Created: {new Date(job["created_at"]).toLocaleString()}
                      </div>
                      {job["started_at"] && (
                        <div>
                          <Play className="w-3 h-3 inline mr-1" />
                          Started: {new Date(job["started_at"]).toLocaleString()}
                        </div>
                      )}
                      {job["completed_at"] && (
                        <div>
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Completed: {new Date(job["completed_at"]).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="firmware" className="space-y-3 mt-4">
              {filteredFirmwareSchedules.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No firmware schedules found
                </div>
              ) : (
                filteredFirmwareSchedules.map((schedule) => (
                  <div
                    key={schedule.schedule_id}
                    className="p-4 rounded-lg border bg-card hover:bg-card/80 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Upload className="w-4 h-4" />
                          <div className="font-medium">{schedule.name}</div>
                          {getStatusBadge(schedule.status)}
                        </div>
                        {schedule.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {schedule.description}
                          </p>
                        )}
                        <div className="grid grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Firmware:</span>{" "}
                            <span className="font-medium">{schedule.firmware_file}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Total:</span>{" "}
                            <span className="font-medium">{schedule.total_devices}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Completed:</span>{" "}
                            <span className="font-medium text-green-600">
                              {schedule.completed_devices}
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Failed:</span>{" "}
                            <span className="font-medium text-red-600">
                              {schedule.failed_devices}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {(schedule.status === "running" || schedule.status === "pending") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelJob(schedule.schedule_id!, "firmware")}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancel
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          Details
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    {schedule.status === "running" && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-medium">
                            {getProgressPercentage(schedule).toFixed(0)}%
                          </span>
                        </div>
                        <Progress value={getProgressPercentage(schedule)} className="h-2" />
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-3 pt-3 border-t">
                      <div>
                        <Clock className="w-3 h-3 inline mr-1" />
                        Scheduled: {new Date(schedule.scheduled_at).toLocaleString()}
                      </div>
                      {schedule.started_at && (
                        <div>
                          <Play className="w-3 h-3 inline mr-1" />
                          Started: {new Date(schedule.started_at).toLocaleString()}
                        </div>
                      )}
                      {schedule.completed_at && (
                        <div>
                          <CheckCircle2 className="w-3 h-3 inline mr-1" />
                          Completed: {new Date(schedule.completed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
