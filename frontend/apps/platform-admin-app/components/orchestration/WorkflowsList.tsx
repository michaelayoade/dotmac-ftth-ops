"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@dotmac/ui";
import {
  MoreHorizontal,
  Eye,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useOrchestrationWorkflows, type Workflow, type WorkflowStatus } from "@/hooks/useOrchestrationWorkflows";

interface WorkflowsListProps {
  onViewDetails: (workflow: Workflow) => void;
}

export function WorkflowsList({ onViewDetails }: WorkflowsListProps) {
  const { useWorkflows, retryWorkflow, cancelWorkflow, isRetrying, isCancelling } =
    useOrchestrationWorkflows();
  const { data, isLoading, error, refetch } = useWorkflows({});

  const getStatusBadge = (status: WorkflowStatus) => {
    const variants: Record<
      WorkflowStatus,
      { variant: "default" | "destructive" | "outline" | "secondary"; icon: any }
    > = {
      pending: { variant: "outline", icon: Clock },
      running: { variant: "default", icon: Loader2 },
      completed: { variant: "secondary", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: AlertCircle },
      partially_completed: { variant: "outline", icon: AlertCircle },
      rolling_back: { variant: "outline", icon: RefreshCw },
      rolled_back: { variant: "outline", icon: RefreshCw },
      rollback_failed: { variant: "destructive", icon: XCircle },
      timeout: { variant: "destructive", icon: Clock },
      compensated: { variant: "outline", icon: CheckCircle2 },
    };

    const { variant, icon: Icon } = variants[status];

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${status === "running" || status === "rolling_back" ? "animate-spin" : ""}`} />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const calculateProgress = (workflow: Workflow): number => {
    if (workflow.steps.length === 0) return 0;
    const completed = workflow.steps.filter((s) => s.status === "completed").length;
    return (completed / workflow.steps.length) * 100;
  };

  const formatDuration = (workflow: Workflow): string => {
    if (!workflow.started_at) return "-";
    const start = new Date(workflow.started_at);
    const end = workflow.completed_at ? new Date(workflow.completed_at) : new Date();
    const seconds = (end.getTime() - start.getTime()) / 1000;

    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-sm text-muted-foreground">Failed to load workflows</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-sm text-muted-foreground">No workflows found</p>
        <p className="text-xs text-muted-foreground">Workflows will appear here when they are created</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.total} workflow{data.total !== 1 ? "s" : ""} found
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Workflows table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workflow ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.workflows.map((workflow) => (
              <TableRow key={workflow.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => onViewDetails(workflow)}>
                <TableCell className="font-mono text-xs">{workflow.workflow_id.slice(0, 8)}...</TableCell>

                <TableCell>
                  <Badge variant="outline">{workflow.workflow_type.replace("_", " ")}</Badge>
                </TableCell>

                <TableCell>{getStatusBadge(workflow.status)}</TableCell>

                <TableCell>
                  {workflow.status === "running" || workflow.status === "rolling_back" ? (
                    <div className="space-y-1 min-w-[120px]">
                      <Progress value={calculateProgress(workflow)} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {calculateProgress(workflow).toFixed(0)}%
                      </p>
                    </div>
                  ) : workflow.status === "completed" ? (
                    <span className="text-sm text-green-600">100%</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span className="text-green-600">
                      {workflow.steps.filter((s) => s.status === "completed").length} completed
                    </span>
                    {workflow.steps.filter((s) => s.status === "failed").length > 0 && (
                      <span className="text-destructive">
                        {workflow.steps.filter((s) => s.status === "failed").length} failed
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      of {workflow.steps.length} total
                    </span>
                  </div>
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {formatDuration(workflow)}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {workflow.started_at
                    ? format(new Date(workflow.started_at), "MMM d, HH:mm")
                    : "-"}
                </TableCell>

                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetails(workflow); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>

                      <DropdownMenuSeparator />

                      {(workflow.status === "failed" || workflow.status === "rollback_failed") && (
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); retryWorkflow(workflow.workflow_id); }}
                          disabled={isRetrying}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Retry Workflow
                        </DropdownMenuItem>
                      )}

                      {(workflow.status === "running" || workflow.status === "pending") && (
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); cancelWorkflow(workflow.workflow_id); }}
                          disabled={isCancelling}
                          className="text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Workflow
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
