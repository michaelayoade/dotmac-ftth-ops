"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { platformConfig } from "@/lib/config";
import {
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  PlayCircle,
  StopCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface Job {
  id: number;
  name: string;
  status: "pending" | "running" | "successful" | "failed" | "canceled";
  created: string;
  started: string | null;
  finished: string | null;
  elapsed: number | null;
}

function JobsPageContent() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Check if there are any running jobs for auto-refresh
  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["ansible", "jobs"],
    queryFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/ansible/jobs`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch jobs");
      }
      return response.json();
    },
    // Auto-refresh every 10 seconds for real-time job status updates
    refetchInterval: 10000,
  });

  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: number) => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/ansible/jobs/${jobId}/cancel`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to cancel job");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ansible", "jobs"] });
      toast({
        title: "Success",
        description: "Job cancellation requested",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ansible", "jobs"] });
    toast({
      title: "Refreshed",
      description: "Job data has been refreshed",
    });
  };

  const handleCancelJob = async (jobId: number, jobName: string) => {
    const confirmed = await confirmDialog({
      title: "Cancel job",
      description: `Are you sure you want to cancel job "${jobName}"?`,
      confirmText: "Cancel job",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    cancelJobMutation.mutate(jobId);
  };

  // Filter jobs by status
  const filteredJobs = useMemo(() => {
    if (statusFilter === "all") return jobs;
    return jobs.filter((job) => job.status === statusFilter);
  }, [jobs, statusFilter]);

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total: jobs.length,
      pending: jobs.filter((j) => j.status === "pending").length,
      running: jobs.filter((j) => j.status === "running").length,
      successful: jobs.filter((j) => j.status === "successful").length,
      failed: jobs.filter((j) => j.status === "failed").length,
      canceled: jobs.filter((j) => j.status === "canceled").length,
    };
  }, [jobs]);

  const getStatusBadge = (status: Job["status"]) => {
    const statusConfig = {
      successful: {
        variant: "outline" as const,
        color: "text-green-600 bg-green-50 border-green-200",
        icon: CheckCircle,
      },
      failed: {
        variant: "destructive" as const,
        color: "text-red-600",
        icon: XCircle,
      },
      running: {
        variant: "default" as const,
        color: "text-blue-600 bg-blue-50 border-blue-200",
        icon: Loader2,
      },
      pending: {
        variant: "secondary" as const,
        color: "text-yellow-600 bg-yellow-50 border-yellow-200",
        icon: Clock,
      },
      canceled: {
        variant: "secondary" as const,
        color: "text-gray-600 bg-gray-50 border-gray-200",
        icon: StopCircle,
      },
    };

    const config = statusConfig[status];
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className={config.color}>
        <Icon className={`h-3 w-3 mr-1 ${status === "running" ? "animate-spin" : ""}`} />
        {status}
      </Badge>
    );
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ansible Jobs</h1>
          <p className="text-muted-foreground">Monitor and manage playbook execution jobs</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={jobsLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${jobsLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successful}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Canceled</CardTitle>
            <StopCircle className="h-4 w-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.canceled}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Filter by status:</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="successful">Successful</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job Executions</CardTitle>
        </CardHeader>
        <CardContent>
          {jobsLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {statusFilter === "all" ? "No jobs found" : `No ${statusFilter} jobs found`}
              </p>
              {statusFilter !== "all" && (
                <Button variant="link" onClick={() => setStatusFilter("all")} className="mt-2">
                  Clear filter
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-sm">{job.id}</TableCell>
                    <TableCell>
                      <div className="font-medium max-w-xs truncate">{job.name}</div>
                    </TableCell>
                    <TableCell>{getStatusBadge(job.status)}</TableCell>
                    <TableCell>
                      {job.started ? (
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(job.started), {
                            addSuffix: true,
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{formatDuration(job.elapsed)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/dashboard/automation/jobs/${job.id}`}>View</Link>
                        </Button>
                        {(job.status === "running" || job.status === "pending") && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              void handleCancelJob(job.id, job.name);
                            }}
                            disabled={cancelJobMutation.isPending}
                          >
                            <StopCircle className="h-3 w-3 mr-1" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function JobsPage() {
  return (
    <RouteGuard permission="isp.automation.read">
      <JobsPageContent />
    </RouteGuard>
  );
}
