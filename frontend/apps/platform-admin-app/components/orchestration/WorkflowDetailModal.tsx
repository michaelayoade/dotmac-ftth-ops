"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { RefreshCw, XCircle, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useOrchestrationWorkflows, type Workflow } from "@/hooks/useOrchestrationWorkflows";
import { WorkflowStepsVisualizer } from "./WorkflowStepsVisualizer";

interface WorkflowDetailModalProps {
  workflowId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkflowDetailModal({
  workflowId,
  open,
  onOpenChange,
}: WorkflowDetailModalProps) {
  const { useWorkflow, retryWorkflow, cancelWorkflow, isRetrying, isCancelling } =
    useOrchestrationWorkflows();
  const { data: workflow, isLoading } = useWorkflow(workflowId);

  if (!workflowId || !workflow) return null;

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "-";
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const calculateDuration = (): number | null => {
    if (!workflow.started_at) return null;
    const start = new Date(workflow.started_at);
    const end = workflow.completed_at ? new Date(workflow.completed_at) : new Date();
    return (end.getTime() - start.getTime()) / 1000;
  };

  const duration = calculateDuration();

  const canRetry = workflow.status === "failed" || workflow.status === "rollback_failed";
  const canCancel = workflow.status === "running" || workflow.status === "pending";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                Workflow Details
                <Badge variant="outline">{workflow.workflow_type.replace("_", " ")}</Badge>
              </DialogTitle>
              <DialogDescription className="font-mono text-xs mt-1">
                {workflow.workflow_id}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {canRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => retryWorkflow(workflow.workflow_id)}
                  disabled={isRetrying}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRetrying ? "animate-spin" : ""}`} />
                  Retry
                </Button>
              )}
              {canCancel && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => cancelWorkflow(workflow.workflow_id)}
                  disabled={isCancelling}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="steps" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="steps">Steps</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="data">Data</TabsTrigger>
          </TabsList>

          {/* Steps Tab */}
          <TabsContent value="steps" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Workflow Steps</CardTitle>
                    <CardDescription>
                      {workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""} •{" "}
                      {workflow.steps.filter((s) => s.status === "completed").length} completed
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      workflow.status === "completed"
                        ? "secondary"
                        : workflow.status === "failed"
                        ? "destructive"
                        : "default"
                    }
                  >
                    {workflow.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <WorkflowStepsVisualizer steps={workflow.steps} showDetails={true} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Execution Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Status */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status</p>
                    <div className="flex items-center gap-2 mt-1">
                      {workflow.status === "completed" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                      {workflow.status === "failed" && <XCircle className="h-4 w-4 text-destructive" />}
                      {workflow.status === "running" && <Clock className="h-4 w-4 text-blue-500 animate-spin" />}
                      {workflow.status === "rolling_back" && <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" />}
                      <span className="text-sm">{workflow.status.replace("_", " ")}</span>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Workflow Type</p>
                    <p className="text-sm mt-1">{workflow.workflow_type.replace("_", " ")}</p>
                  </div>
                </div>

                {/* Timing */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Created</p>
                    <p className="text-sm mt-1 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      {format(new Date(workflow.created_at), "MMM d, yyyy HH:mm:ss")}
                    </p>
                  </div>

                  {workflow.started_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Started</p>
                      <p className="text-sm mt-1">
                        {format(new Date(workflow.started_at), "MMM d, yyyy HH:mm:ss")}
                      </p>
                    </div>
                  )}

                  {workflow.completed_at && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed</p>
                      <p className="text-sm mt-1">
                        {format(new Date(workflow.completed_at), "MMM d, yyyy HH:mm:ss")}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Duration</p>
                    <p className="text-sm mt-1">{formatDuration(duration)}</p>
                  </div>
                </div>

                {/* Retry Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Retry Count</p>
                    <p className="text-sm mt-1">
                      {workflow.retry_count} / {workflow.max_retries}
                    </p>
                  </div>

                  {workflow.initiator_id && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Initiated By</p>
                      <p className="text-sm mt-1">
                        {workflow.initiator_type} ({workflow.initiator_id})
                      </p>
                    </div>
                  )}
                </div>

                {/* Error Message */}
                {workflow.error_message && (
                  <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-destructive">Error Message</p>
                        <p className="text-sm text-destructive/90 mt-1">{workflow.error_message}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Compensation Info */}
                {workflow.compensation_started_at && (
                  <div className="rounded-md bg-orange-50 dark:bg-orange-950/20 p-4 border border-orange-200">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-400 mb-2">
                      Compensation (Rollback) Details
                    </p>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Started:</span>{" "}
                        {format(new Date(workflow.compensation_started_at), "MMM d, yyyy HH:mm:ss")}
                      </div>
                      {workflow.compensation_completed_at && (
                        <div>
                          <span className="text-muted-foreground">Completed:</span>{" "}
                          {format(new Date(workflow.compensation_completed_at), "MMM d, yyyy HH:mm:ss")}
                        </div>
                      )}
                      {workflow.compensation_error && (
                        <div className="text-destructive">
                          <span className="font-medium">Error:</span> {workflow.compensation_error}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Tab */}
          <TabsContent value="data" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Input Data</CardTitle>
                <CardDescription>Data provided to the workflow</CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
                  {JSON.stringify(workflow.input_data, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {workflow.output_data && (
              <Card>
                <CardHeader>
                  <CardTitle>Output Data</CardTitle>
                  <CardDescription>Data produced by the workflow</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
                    {JSON.stringify(workflow.output_data, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {workflow.context && (
              <Card>
                <CardHeader>
                  <CardTitle>Execution Context</CardTitle>
                  <CardDescription>Shared context across workflow steps</CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 rounded-lg bg-muted text-xs overflow-x-auto">
                    {JSON.stringify(workflow.context, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}

            {workflow.error_details && (
              <Card>
                <CardHeader>
                  <CardTitle>Error Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="p-4 rounded-lg bg-destructive/10 text-xs overflow-x-auto">
                    {JSON.stringify(workflow.error_details, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
