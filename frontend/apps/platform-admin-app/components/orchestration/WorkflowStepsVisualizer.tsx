"use client";

import { Badge } from "@dotmac/ui";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  SkipForward,
  RotateCcw,
  AlertTriangle,
} from "lucide-react";
import { type WorkflowStep, type WorkflowStepStatus } from "@/hooks/useOrchestrationWorkflows";

interface WorkflowStepsVisualizerProps {
  steps: WorkflowStep[];
  showDetails?: boolean;
}

export function WorkflowStepsVisualizer({ steps, showDetails = false }: WorkflowStepsVisualizerProps) {
  const getStepIcon = (status: WorkflowStepStatus) => {
    const iconMap: Record<WorkflowStepStatus, { icon: any; className: string }> = {
      pending: { icon: Clock, className: "text-muted-foreground" },
      running: { icon: Loader2, className: "text-blue-500 animate-spin" },
      completed: { icon: CheckCircle2, className: "text-green-500" },
      failed: { icon: XCircle, className: "text-destructive" },
      skipped: { icon: SkipForward, className: "text-muted-foreground" },
      compensating: { icon: RotateCcw, className: "text-orange-500 animate-spin" },
      compensated: { icon: RotateCcw, className: "text-orange-500" },
      compensation_failed: { icon: AlertTriangle, className: "text-destructive" },
    };

    const { icon: Icon, className } = iconMap[status];
    return <Icon className={`h-5 w-5 ${className}`} />;
  };

  const getStepVariant = (status: WorkflowStepStatus): "default" | "destructive" | "outline" | "secondary" => {
    const variantMap: Record<WorkflowStepStatus, "default" | "destructive" | "outline" | "secondary"> = {
      pending: "outline",
      running: "default",
      completed: "secondary",
      failed: "destructive",
      skipped: "outline",
      compensating: "outline",
      compensated: "outline",
      compensation_failed: "destructive",
    };
    return variantMap[status];
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null): string => {
    if (!startedAt) return "-";
    const start = new Date(startedAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const duration = (end.getTime() - start.getTime()) / 1000;

    if (duration < 60) return `${duration.toFixed(1)}s`;
    if (duration < 3600) return `${(duration / 60).toFixed(1)}m`;
    return `${(duration / 3600).toFixed(1)}h`;
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div key={step.id || index} className="relative">
          {/* Connector line */}
          {index < steps.length - 1 && (
            <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-border" />
          )}

          {/* Step card */}
          <div className={`flex items-start gap-4 p-4 rounded-lg border ${
            step.status === "running" ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200" :
            step.status === "failed" || step.status === "compensation_failed" ? "bg-destructive/10 border-destructive/20" :
            step.status === "completed" ? "bg-green-50 dark:bg-green-950/20 border-green-200" :
            "bg-muted/30"
          }`}>
            {/* Step icon */}
            <div className="flex-shrink-0 mt-0.5">
              {getStepIcon(step.status)}
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono text-muted-foreground">
                    #{step.sequence_number}
                  </span>
                  <h4 className="text-sm font-semibold">{step.step_name}</h4>
                </div>
                <Badge variant={getStepVariant(step.status)}>
                  {step.status.replace("_", " ")}
                </Badge>
              </div>

              {showDetails && (
                <>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                    {step.target_system && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">System:</span>
                        <Badge variant="outline" className="text-xs">
                          {step.target_system}
                        </Badge>
                      </span>
                    )}
                    {step.step_type && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Type:</span>
                        {step.step_type}
                      </span>
                    )}
                    {step.started_at && (
                      <span className="flex items-center gap-1">
                        <span className="font-medium">Duration:</span>
                        {formatDuration(step.started_at, step.completed_at)}
                      </span>
                    )}
                    {step.retry_count > 0 && (
                      <span className="flex items-center gap-1 text-orange-600">
                        <span className="font-medium">Retries:</span>
                        {step.retry_count}/{step.max_retries}
                      </span>
                    )}
                  </div>

                  {step.error_message && (
                    <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                      <p className="text-xs text-destructive font-medium mb-1">Error:</p>
                      <p className="text-xs text-destructive/90">{step.error_message}</p>
                    </div>
                  )}

                  {step.output_data && Object.keys(step.output_data).length > 0 && step.status === "completed" && (
                    <details className="mt-2">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        View output data
                      </summary>
                      <pre className="mt-2 p-2 text-xs bg-background rounded border overflow-x-auto">
                        {JSON.stringify(step.output_data, null, 2)}
                      </pre>
                    </details>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {steps.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No workflow steps found
        </div>
      )}
    </div>
  );
}
