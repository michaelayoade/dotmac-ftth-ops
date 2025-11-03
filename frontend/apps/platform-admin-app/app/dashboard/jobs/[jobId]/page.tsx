"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Briefcase,
  CheckCircle,
  XCircle,
  Clock,
  Loader,
  AlertTriangle,
  Calendar,
  User,
  BarChart3,
  FileText,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@/components/ui/use-toast";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";

type JobStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

interface Job {
  id: string;
  job_type: string;
  status: JobStatus;
  progress_percent: number;
  items_processed: number;
  items_total: number;
  items_succeeded: number;
  items_failed: number;
  current_item?: string;
  error_message?: string;
  error_traceback?: string;
  result?: any;
  created_by?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
}

function JobDetailsPageContent() {
  const params = useParams();
  const jobId = params?.jobId as string;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch job details
  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/jobs/${jobId}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch job");
      return response.json();
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      // Auto-refresh while job is running or pending
      if (query?.state?.data && (query.state.data.status === "running" || query.state.data.status === "pending")) {
        return 3000; // Refresh every 3 seconds
      }
      return false;
    },
  });

  // Cancel job mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/jobs/${jobId}/cancel`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to cancel job");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["job", jobId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
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

  // Retry job mutation
  const retryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/jobs/${jobId}/retry`,
        {
          method: "POST",
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to retry job");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast({
        title: "Retry job created",
        description: `New job ${data.retry_job_id?.substring(0, 8)}... created to retry failed items`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to retry job",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: JobStatus) => {
    const statusConfig: Record<JobStatus, { icon: any; color: string; label: string }> = {
      pending: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Pending" },
      running: { icon: Loader, color: "bg-blue-100 text-blue-800", label: "Running" },
      completed: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Completed" },
      failed: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
      cancelled: { icon: AlertTriangle, color: "bg-orange-100 text-orange-800", label: "Cancelled" },
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
        <p className="text-muted-foreground mb-4">The job you're looking for doesn't exist.</p>
        <Button asChild>
          <Link href="/dashboard/jobs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Link>
        </Button>
      </div>
    );
  }

  const calculateDuration = () => {
    if (!job.started_at) return null;
    const end = job.completed_at || job.cancelled_at || new Date().toISOString();
    const durationMs = new Date(end).getTime() - new Date(job.started_at).getTime();
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/jobs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold font-mono">{job.id.substring(0, 8)}...</h1>
            <p className="text-sm text-muted-foreground">{job.job_type.replace(/_/g, " ").toUpperCase()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(job.status)}
          {(job.status === "pending" || job.status === "running") && (
            <Button
              variant="outline"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancel Job
            </Button>
          )}
          {job.status === "failed" && job.items_failed > 0 && (
            <Button
              variant="outline"
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Retry Failed
            </Button>
          )}
        </div>
      </div>

      {/* Progress Section */}
      {(job.status === "running" || job.status === "pending") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Progress</CardTitle>
            <CardDescription>
              {job.status === "pending" ? "Waiting to start..." : "Job in progress"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Completion</span>
                <span className="font-medium">{job.progress_percent}%</span>
              </div>
              <Progress value={job.progress_percent} className="h-3" />
            </div>
            {job.current_item && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800 font-medium">Currently Processing:</p>
                <p className="text-sm text-blue-700 font-mono">{job.current_item}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{job.items_total}</div>
            <p className="text-xs text-muted-foreground">To process</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Processed</CardTitle>
            <Loader className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{job.items_processed}</div>
            <p className="text-xs text-muted-foreground">
              {job.items_total > 0 ? Math.round((job.items_processed / job.items_total) * 100) : 0}% complete
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Succeeded</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{job.items_succeeded}</div>
            <p className="text-xs text-muted-foreground">Successful</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{job.items_failed}</div>
            <p className="text-xs text-muted-foreground">Errors</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="result">Result</TabsTrigger>
          {job.error_message && <TabsTrigger value="error">Error Details</TabsTrigger>}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Job ID</p>
                  </div>
                  <p className="font-medium font-mono">{job.id}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Job Type</p>
                  </div>
                  <p className="font-medium">{job.job_type.replace(/_/g, " ").toUpperCase()}</p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Created By</p>
                  </div>
                  <p className="font-medium">{job.created_by || "System"}</p>
                </div>
                {calculateDuration() && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Duration</p>
                    </div>
                    <p className="font-medium">{calculateDuration()}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Created At</p>
                  </div>
                  <p className="font-medium">{format(new Date(job.created_at), "PPpp")}</p>
                </div>
                {job.started_at && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Loader className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Started At</p>
                    </div>
                    <p className="font-medium">{format(new Date(job.started_at), "PPpp")}</p>
                  </div>
                )}
                {job.completed_at && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Completed At</p>
                    </div>
                    <p className="font-medium">{format(new Date(job.completed_at), "PPpp")}</p>
                  </div>
                )}
                {job.cancelled_at && (
                  <>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <XCircle className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Cancelled At</p>
                      </div>
                      <p className="font-medium">{format(new Date(job.cancelled_at), "PPpp")}</p>
                    </div>
                    {job.cancelled_by && (
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Cancelled By</p>
                        </div>
                        <p className="font-medium">{job.cancelled_by}</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Result Tab */}
        <TabsContent value="result" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Result</CardTitle>
              <CardDescription>Output data from the completed job</CardDescription>
            </CardHeader>
            <CardContent>
              {job.result ? (
                <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-sm">
                  {JSON.stringify(job.result, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground">
                  {job.status === "completed" ? "No result data available" : "Job has not completed yet"}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Error Tab */}
        {job.error_message && (
          <TabsContent value="error" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg text-red-600">Error Details</CardTitle>
                <CardDescription>Information about the job failure</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800 font-medium mb-1">Error Message:</p>
                  <p className="text-sm text-red-700">{job.error_message}</p>
                </div>
                {job.error_traceback && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Stack Trace:</p>
                    <pre className="p-4 bg-accent rounded-lg overflow-x-auto text-xs">
                      {job.error_traceback}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

export default function JobDetailsPage() {
  return (
    <RouteGuard permission="jobs:read">
      <JobDetailsPageContent />
    </RouteGuard>
  );
}
