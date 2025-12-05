"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CheckCircle,
  Clock,
  Download,
  Eye,
  FileText,
  Loader,
  RefreshCw,
  Search,
  Settings,
  Upload,
  XCircle,
} from "lucide-react";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useConfirmDialog } from "@dotmac/ui";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Progress } from "@dotmac/ui";
import { useAppConfig } from "@/providers/AppConfigContext";

type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
type JobType =
  | "bulk_import"
  | "bulk_export"
  | "firmware_upgrade"
  | "batch_provisioning"
  | "data_migration"
  | "report_generation"
  | "custom";

interface Job {
  id: string;
  job_type: JobType;
  status: JobStatus;
  progress_percent: number;
  items_processed: number;
  items_total: number;
  items_succeeded: number;
  items_failed: number;
  current_item?: string;
  error_message?: string;
  error_traceback?: string;
  result?: unknown;
  created_by?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
}

interface JobStats {
  total_jobs: number;
  pending_jobs: number;
  running_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  cancelled_jobs: number;
  avg_duration_seconds?: number;
}

function JobsPageContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { api } = useAppConfig();
  const apiBaseUrl = api.baseUrl;
  const confirmDialog = useConfirmDialog();

  // Fetch jobs
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["jobs", statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("job_type", typeFilter);

      const response = await fetch(`${apiBaseUrl}/api/platform/v1/jobs?${params.toString()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch jobs");
      return response.json();
    },
    refetchInterval: (query) => {
      // Auto-refresh if there are running or pending jobs
      if (
        query?.state?.data?.jobs &&
        query.state.data.jobs.some((j: Job) => j.status === "running" || j.status === "pending")
      ) {
        return 5000; // Refresh every 5 seconds
      }
      return false;
    },
  });

  const jobs: Job[] = data?.jobs || [];
  const _total = data?.total || 0;

  // Fetch statistics
  const { data: statsData } = useQuery({
    queryKey: ["job-statistics"],
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/api/platform/v1/jobs/statistics`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch statistics");
      return response.json();
    },
  });

  const stats: JobStats = statsData || {
    total_jobs: jobs.length,
    pending_jobs: jobs.filter((j) => j.status === "pending").length,
    running_jobs: jobs.filter((j) => j.status === "running").length,
    completed_jobs: jobs.filter((j) => j.status === "completed").length,
    failed_jobs: jobs.filter((j) => j.status === "failed").length,
    cancelled_jobs: jobs.filter((j) => j.status === "cancelled").length,
  };

  // Cancel job mutation
  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`${apiBaseUrl}/api/platform/v1/jobs/${jobId}/cancel`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to cancel job");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-statistics"] });
      toast({ title: "Job cancelled successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to cancel job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      !searchQuery ||
      job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.job_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (job.created_by && job.created_by.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesSearch;
  });

  const getStatusBadge = (status: JobStatus) => {
    const statusConfig: Record<
      JobStatus,
      { icon: React.ElementType; color: string; label: string }
    > = {
      pending: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Pending" },
      running: { icon: Loader, color: "bg-blue-100 text-blue-800", label: "Running" },
      completed: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Completed" },
      failed: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
      cancelled: {
        icon: AlertTriangle,
        color: "bg-orange-100 text-orange-800",
        label: "Cancelled",
      },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getJobTypeIcon = (jobType: JobType) => {
    const icons: Record<JobType, LucideIcon> = {
      bulk_import: Upload,
      bulk_export: Download,
      firmware_upgrade: Settings,
      batch_provisioning: Briefcase,
      data_migration: FileText,
      report_generation: BarChart3,
      custom: Briefcase,
    };
    return icons[jobType] || Briefcase;
  };

  const getJobTypeLabel = (jobType: JobType) => {
    const labels: Record<JobType, string> = {
      bulk_import: "Bulk Import",
      bulk_export: "Bulk Export",
      firmware_upgrade: "Firmware Upgrade",
      batch_provisioning: "Batch Provisioning",
      data_migration: "Data Migration",
      report_generation: "Report Generation",
      custom: "Custom",
    };
    return labels[jobType] || jobType;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Background Jobs</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and manage asynchronous background jobs
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_jobs}</div>
            <p className="text-xs text-muted-foreground">All jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending_jobs}</div>
            <p className="text-xs text-muted-foreground">Waiting</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running_jobs}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_jobs}</div>
            <p className="text-xs text-muted-foreground">Successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed_jobs}</div>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cancelled</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.cancelled_jobs}</div>
            <p className="text-xs text-muted-foreground">Stopped</p>
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
                placeholder="Search jobs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Status" />
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

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="bulk_import">Bulk Import</SelectItem>
                <SelectItem value="bulk_export">Bulk Export</SelectItem>
                <SelectItem value="firmware_upgrade">Firmware Upgrade</SelectItem>
                <SelectItem value="batch_provisioning">Batch Provisioning</SelectItem>
                <SelectItem value="data_migration">Data Migration</SelectItem>
                <SelectItem value="report_generation">Report Generation</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Grid */}
      <div className="grid gap-4">
        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Loading jobs...
            </CardContent>
          </Card>
        ) : filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {searchQuery ? "No jobs match your search" : "No jobs found"}
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => {
            const JobIcon = getJobTypeIcon(job.job_type);
            return (
              <Card key={job.id} className="hover:border-primary transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <JobIcon className="h-8 w-8 text-primary" />
                      <div>
                        <CardTitle className="text-lg">
                          <Link
                            href={`/dashboard/jobs/${job.id}`}
                            className="hover:underline font-mono"
                          >
                            {job.id.substring(0, 8)}...
                          </Link>
                        </CardTitle>
                        <CardDescription>{getJobTypeLabel(job.job_type)}</CardDescription>
                      </div>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Progress Bar */}
                  {(job.status === "running" || job.status === "pending") && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{job.progress_percent}%</span>
                      </div>
                      <Progress value={job.progress_percent} className="h-2" />
                      {job.current_item && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">
                          Processing: {job.current_item}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Items</p>
                      <p className="font-medium">
                        {job.items_processed} / {job.items_total}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Succeeded</p>
                      <p className="font-medium text-green-600">{job.items_succeeded}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Failed</p>
                      <p className="font-medium text-red-600">{job.items_failed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {formatDistanceToNow(new Date(job.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {job.error_message && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-800 font-medium">Error:</p>
                      <p className="text-sm text-red-700">{job.error_message}</p>
                    </div>
                  )}

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/dashboard/jobs/${job.id}`}>
                        <Eye className="h-3 w-3 mr-1" />
                        View Details
                      </Link>
                    </Button>

                    {(job.status === "pending" || job.status === "running") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const confirmed = await confirmDialog({
                            title: "Cancel job",
                            description: `Cancel job ${job.id.substring(0, 8)}...?`,
                            confirmText: "Cancel job",
                            variant: "destructive",
                          });
                          if (confirmed) {
                            cancelMutation.mutate(job.id);
                          }
                        }}
                        disabled={cancelMutation.isPending}
                        className="text-orange-600 hover:text-orange-600"
                      >
                        <XCircle className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    )}
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

export default function JobsPage() {
  return (
    <RouteGuard permission="jobs:read">
      <JobsPageContent />
    </RouteGuard>
  );
}
