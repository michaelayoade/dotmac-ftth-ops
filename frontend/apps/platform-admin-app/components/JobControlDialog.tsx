/**
 * Job Control Dialog Component
 *
 * Provides UI for controlling jobs via WebSocket (cancel, pause, resume)
 */

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import { Job, useCancelJob } from "@/hooks/useJobs";
import { AlertCircle, Loader2, PauseCircle, PlayCircle, XCircle } from "lucide-react";

interface JobControlDialogProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobControlDialog({ job, open, onOpenChange }: JobControlDialogProps) {
  const { toast } = useToast();
  const cancelJob = useCancelJob();
  const [isProcessing, setIsProcessing] = useState(false);

  if (!job) return null;

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      await cancelJob.mutateAsync(job.id);
      toast({
        title: "Job cancelled",
        description: `Job "${job.title}" has been cancelled successfully.`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Cancel failed",
        description: error instanceof Error ? error.message : "Failed to cancel job",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "running":
        return "default";
      case "completed":
        return "outline";
      case "failed":
      case "cancelled":
        return "destructive";
      case "paused":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const canCancel = ["pending", "running", "paused"].includes(job.status);
  const canPause = job.status === "running";
  const canResume = job.status === "paused";

  const progress = job.items_total > 0 ? (job.items_processed / job.items_total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Job Control</DialogTitle>
          <DialogDescription>Manage and control job execution</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{job.title}</h3>
              <Badge variant={getStatusColor(job.status)}>{job.status.toUpperCase()}</Badge>
            </div>

            {job.description && <p className="text-sm text-muted-foreground">{job.description}</p>}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Job Type:</span>
                <span className="ml-2 font-medium">{job.job_type.replace(/_/g, " ")}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Created By:</span>
                <span className="ml-2 font-medium">{job.created_by}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Started:</span>
                <span className="ml-2 font-medium">
                  {job.started_at ? new Date(job.started_at).toLocaleString() : "Not started"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Completed:</span>
                <span className="ml-2 font-medium">
                  {job.completed_at ? new Date(job.completed_at).toLocaleString() : "In progress"}
                </span>
              </div>
            </div>
          </div>

          {/* Progress */}
          {job.status === "running" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {job.items_processed} / {job.items_total} ({Math.round(progress)}%)
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="space-y-1">
              <div className="text-muted-foreground">Total Items</div>
              <div className="text-2xl font-semibold">{job.items_total}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Processed</div>
              <div className="text-2xl font-semibold text-green-600">{job.items_processed}</div>
            </div>
            <div className="space-y-1">
              <div className="text-muted-foreground">Failed</div>
              <div className="text-2xl font-semibold text-red-600">{job.items_failed}</div>
            </div>
          </div>

          {/* Error Message */}
          {job.error_message && (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-destructive">Error</div>
                <div className="text-sm text-muted-foreground">{job.error_message}</div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Actions are executed immediately and cannot be undone
          </div>
          <div className="flex gap-2">
            {canPause && (
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => {
                  toast({
                    title: "Pause not implemented",
                    description: "Job pause functionality is coming soon",
                  });
                }}
              >
                <PauseCircle className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}

            {canResume && (
              <Button
                variant="outline"
                size="sm"
                disabled={isProcessing}
                onClick={() => {
                  toast({
                    title: "Resume not implemented",
                    description: "Job resume functionality is coming soon",
                  });
                }}
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                Resume
              </Button>
            )}

            {canCancel && (
              <Button
                variant="destructive"
                size="sm"
                disabled={isProcessing}
                onClick={handleCancel}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Job
                  </>
                )}
              </Button>
            )}

            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
