"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { platformConfig } from "@/lib/config";
import { useConfirmDialog } from "@dotmac/ui";
import {
  ArrowLeft,
  RefreshCw,
  Play,
  StopCircle,
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  Info,
  AlertCircle,
  Loader2,
  Calendar,
  Timer,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface Job {
  id: number;
  name: string;
  status: "pending" | "running" | "successful" | "failed" | "canceled";
  created: string;
  started: string | null;
  finished: string | null;
  elapsed: number | null;
  template_id?: number;
  extra_vars?: object;
}

function JobDetailsPageContent() {
  const params = useParams();
  const router = useRouter();
  const jobId = params?.["jobId"] as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["ansible", "job", jobId],
    queryFn: async () => {
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/ansible/jobs/${jobId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Job not found");
        }
        throw new Error("Failed to fetch job details");
      }
      return response.json();
    },
    enabled: !!jobId,
    // Auto-refresh every 5 seconds for real-time updates
    refetchInterval: 5000,
  });

  const cancelJobMutation = useMutation({
    mutationFn: async () => {
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
      queryClient.invalidateQueries({ queryKey: ["ansible", "job", jobId] });
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

  const relaunchJobMutation = useMutation({
    mutationFn: async () => {
      if (!job?.template_id) {
        throw new Error("No template ID available for relaunch");
      }

      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/ansible/jobs/launch`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_id: job.template_id,
          extra_vars: job.extra_vars,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to relaunch job");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Success",
        description: "Job relaunched successfully",
      });
      // Navigate to new job
      router.push(`/dashboard/automation/jobs/${data.id}`);
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
    queryClient.invalidateQueries({ queryKey: ["ansible", "job", jobId] });
    toast({
      title: "Refreshed",
      description: "Job data has been refreshed",
    });
  };

  const handleCancel = async () => {
    const confirmed = await confirmDialog({
      title: "Cancel job",
      description: "Are you sure you want to cancel this job?",
      confirmText: "Cancel job",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    cancelJobMutation.mutate();
  };

  const handleRelaunch = async () => {
    const confirmed = await confirmDialog({
      title: "Relaunch job",
      description: "Relaunch this job with the same configuration?",
      confirmText: "Relaunch",
    });
    if (!confirmed) {
      return;
    }
    relaunchJobMutation.mutate();
  };

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
      <Badge variant={config.variant} className={`${config.color} text-base px-3 py-1`}>
        <Icon className={`h-4 w-4 mr-2 ${status === "running" ? "animate-spin" : ""}`} />
        {status.toUpperCase()}
      </Badge>
    );
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m ${remainingSeconds}s`;
    }
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${remainingSeconds}s`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Activity className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Job Not Found</h2>
        <p className="text-muted-foreground mb-4">
          The job you&apos;re looking for doesn&apos;t exist.
        </p>
        <Button asChild>
          <Link href="/dashboard/automation/jobs">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Link>
        </Button>
      </div>
    );
  }

  const canCancel = job.status === "running" || job.status === "pending";
  const canRelaunch = job.template_id !== undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/dashboard/automation/jobs">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Job #{job.id}</h1>
            <p className="text-sm text-muted-foreground">{job.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">{getStatusBadge(job.status)}</div>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {canCancel && (
            <Button
              variant="destructive"
              onClick={() => {
                void handleCancel();
              }}
              disabled={cancelJobMutation.isPending}
            >
              <StopCircle className="h-4 w-4 mr-2" />
              {cancelJobMutation.isPending ? "Canceling..." : "Cancel Job"}
            </Button>
          )}
          {canRelaunch && (
            <Button
              onClick={() => {
                void handleRelaunch();
              }}
              disabled={relaunchJobMutation.isPending}
            >
              <Play className="h-4 w-4 mr-2" />
              {relaunchJobMutation.isPending ? "Relaunching..." : "Relaunch Job"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Status Timeline */}
      {job.status === "running" && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              <div>
                <p className="font-medium text-blue-900">Job is currently running</p>
                <p className="text-sm text-blue-700">This page will auto-refresh every 5 seconds</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Job Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Job ID</span>
                  </div>
                  <span className="font-mono">{job.id}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Status</span>
                  </div>
                  <span className="capitalize">{job.status}</span>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t">
                <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Created</span>
                  </div>
                  <span className="text-sm">{format(new Date(job.created), "PPpp")}</span>
                </div>
                {job.started && (
                  <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <div className="flex items-center gap-2">
                      <Play className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Started</span>
                    </div>
                    <span className="text-sm">
                      {format(new Date(job.started), "PPpp")}
                      <span className="text-muted-foreground ml-2">
                        ({formatDistanceToNow(new Date(job.started), { addSuffix: true })})
                      </span>
                    </span>
                  </div>
                )}
                {job.finished && (
                  <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Finished</span>
                    </div>
                    <span className="text-sm">
                      {format(new Date(job.finished), "PPpp")}
                      <span className="text-muted-foreground ml-2">
                        ({formatDistanceToNow(new Date(job.finished), { addSuffix: true })})
                      </span>
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 bg-accent rounded-lg">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Duration</span>
                  </div>
                  <span className="font-mono">{formatDuration(job.elapsed)}</span>
                </div>
              </div>

              {job.extra_vars && Object.keys(job.extra_vars).length > 0 && (
                <div className="pt-4 border-t">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Extra Variables</p>
                  </div>
                  <pre className="p-3 bg-accent rounded-lg text-sm font-mono overflow-x-auto">
                    {JSON.stringify(job.extra_vars, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Job Output</CardTitle>
              <CardDescription>Real-time logs and output from job execution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="font-medium mb-2">Real-time Logs Coming Soon</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Job output and logs will be available in a future release. For now, please check
                  the AWX interface for detailed job logs and output.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function JobDetailsPage() {
  return (
    <RouteGuard permission="isp.automation.read">
      <JobDetailsPageContent />
    </RouteGuard>
  );
}
