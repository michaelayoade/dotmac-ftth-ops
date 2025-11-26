"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { AlertTriangle, CheckCircle2, Clock, Download, FileText, XCircle } from "lucide-react";
import { format } from "date-fns";
import { useDataImport } from "@/hooks/useDataImport";
import { FailureViewer } from "./FailureViewer";

interface ImportJobDetailModalProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportJobDetailModal({ jobId, open, onOpenChange }: ImportJobDetailModalProps) {
  const { useImportJob, useImportJobStatus, downloadFailures } = useDataImport();
  const { data: job } = useImportJob(jobId);
  const { data: status } = useImportJobStatus(jobId);
  const [activeTab, setActiveTab] = useState("overview");

  if (!jobId || !job) return null;

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "-";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (minutes === 0) return `${secs}s`;
    return `${minutes}m ${secs}s`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Import Job Details
            <Badge variant="outline">{job.job_type}</Badge>
          </DialogTitle>
          <DialogDescription>Job ID: {job.id}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="failures" disabled={job.failed_records === 0}>
              Failures {job.failed_records > 0 && `(${job.failed_records})`}
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                    <Badge
                      variant={
                        job.status === "completed"
                          ? "secondary"
                          : job.status === "failed"
                            ? "destructive"
                            : "outline"
                      }
                      className="mt-1"
                    >
                      {job.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {status?.celery_task_status && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Task Status</p>
                      <p className="text-sm mt-1">{status.celery_task_status}</p>
                    </div>
                  )}
                </div>

                {job.error_message && (
                  <div className="rounded-md bg-destructive/10 p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">Error</p>
                        <p className="text-sm text-destructive/90 mt-1">{job.error_message}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* File Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>File Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">File Name</p>
                    <p className="text-sm mt-1 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      {job.file_name}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">File Size</p>
                    <p className="text-sm mt-1">{formatBytes(job.file_size)}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Format</p>
                    <p className="text-sm mt-1">{job.file_format.toUpperCase()}</p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Batch Size</p>
                    <p className="text-sm mt-1">{String(job.config?.["batch_size"] ?? 100)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timing Card */}
            <Card>
              <CardHeader>
                <CardTitle>Timing</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p className="text-sm mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(job.created_at), "MMM d, yyyy HH:mm:ss")}
                    </p>
                  </div>

                  {job.started_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Started</p>
                      <p className="text-sm mt-1">
                        {format(new Date(job.started_at), "MMM d, yyyy HH:mm:ss")}
                      </p>
                    </div>
                  )}

                  {job.completed_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="text-sm mt-1">
                        {format(new Date(job.completed_at), "MMM d, yyyy HH:mm:ss")}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Duration</p>
                    <p className="text-sm mt-1">{formatDuration(job.duration_seconds)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Progress Tab */}
          <TabsContent value="progress" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import Progress</CardTitle>
                <CardDescription>
                  {status?.progress_percentage !== undefined
                    ? `${status.progress_percentage.toFixed(1)}% complete`
                    : `${job.progress_percentage.toFixed(1)}% complete`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <Progress
                  value={status?.progress_percentage || job.progress_percentage}
                  className="h-3"
                />

                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col items-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {status?.total_records || job.total_records}
                    </p>
                    <p className="text-sm text-muted-foreground">Total Records</p>
                  </div>

                  <div className="flex flex-col items-center p-4 rounded-lg bg-green-50 dark:bg-green-950">
                    <CheckCircle2 className="h-5 w-5 text-green-600 mb-1" />
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {status?.successful_records || job.successful_records}
                    </p>
                    <p className="text-sm text-muted-foreground">Successful</p>
                  </div>

                  <div className="flex flex-col items-center p-4 rounded-lg bg-red-50 dark:bg-red-950">
                    <XCircle className="h-5 w-5 text-red-600 mb-1" />
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {status?.failed_records || job.failed_records}
                    </p>
                    <p className="text-sm text-muted-foreground">Failed</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Processed</p>
                    <p className="text-sm mt-1">
                      {status?.processed_records || job.processed_records} of{" "}
                      {status?.total_records || job.total_records}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                    <p className="text-sm mt-1">{job.success_rate.toFixed(1)}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Failures Tab */}
          <TabsContent value="failures">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Failed Records</CardTitle>
                    <CardDescription>
                      {job.failed_records} record{job.failed_records !== 1 ? "s" : ""} failed to
                      import
                    </CardDescription>
                  </div>
                  {job.failed_records > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFailures(job.id, "csv")}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <FailureViewer jobId={job.id} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
