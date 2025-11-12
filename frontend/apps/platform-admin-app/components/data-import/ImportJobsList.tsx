"use client";

import { useState } from "react";
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
  XCircle,
  Download,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useDataImport, type ImportJob, type ImportJobStatus } from "@/hooks/useDataImport";

interface ImportJobsListProps {
  onViewDetails: (job: ImportJob) => void;
}

export function ImportJobsList({ onViewDetails }: ImportJobsListProps) {
  const { useImportJobs, cancelImport, isCancelling } = useDataImport();
  const [statusFilter, setStatusFilter] = useState<ImportJobStatus | undefined>();
  const { data, isLoading, error, refetch } = useImportJobs(
    statusFilter ? { status: statusFilter } : {},
  );

  const getStatusBadge = (status: ImportJobStatus) => {
    const variants: Record<ImportJobStatus, { variant: "default" | "destructive" | "outline" | "secondary"; icon: any }> = {
      pending: { variant: "outline", icon: Clock },
      validating: { variant: "outline", icon: RefreshCw },
      in_progress: { variant: "default", icon: Loader2 },
      completed: { variant: "secondary", icon: CheckCircle2 },
      failed: { variant: "destructive", icon: AlertCircle },
      partially_completed: { variant: "outline", icon: AlertCircle },
      cancelled: { variant: "outline", icon: XCircle },
    };

    const { variant, icon: Icon } = variants[status];

    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${status === "in_progress" ? "animate-spin" : ""}`} />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "-";
    if (seconds < 60) return `${seconds.toFixed(0)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        <p className="text-sm text-muted-foreground">Failed to load import jobs</p>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data || data.jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2">
        <p className="text-sm text-muted-foreground">No import jobs found</p>
        <p className="text-xs text-muted-foreground">
          Start by uploading a CSV or JSON file
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {data.total} job{data.total !== 1 ? "s" : ""} found
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Jobs table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>File</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.jobs.map((job) => (
              <TableRow key={job.id} className="hover:bg-muted/50">
                <TableCell>
                  <Badge variant="outline">{job.job_type}</Badge>
                </TableCell>

                <TableCell>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{job.file_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(job.file_size)} • {job.file_format.toUpperCase()}
                    </span>
                  </div>
                </TableCell>

                <TableCell>{getStatusBadge(job.status)}</TableCell>

                <TableCell>
                  {job.status === "in_progress" || job.status === "pending" ? (
                    <div className="space-y-1 min-w-[120px]">
                      <Progress value={job.progress_percentage} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {job.progress_percentage.toFixed(1)}%
                      </p>
                    </div>
                  ) : job.status === "completed" || job.status === "partially_completed" ? (
                    <span className="text-sm text-green-600">100%</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>

                <TableCell>
                  <div className="flex flex-col text-sm">
                    <span className="text-green-600">{job.successful_records} success</span>
                    {job.failed_records > 0 && (
                      <span className="text-destructive">{job.failed_records} failed</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      of {job.total_records} total
                    </span>
                  </div>
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {formatDuration(job.duration_seconds)}
                </TableCell>

                <TableCell className="text-sm text-muted-foreground">
                  {job.started_at
                    ? format(new Date(job.started_at), "MMM d, HH:mm")
                    : "-"}
                </TableCell>

                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onViewDetails(job)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>

                      {job.failed_records > 0 && (
                        <DropdownMenuItem onClick={() => {}}>
                          <Download className="h-4 w-4 mr-2" />
                          Download Failures
                        </DropdownMenuItem>
                      )}

                      <DropdownMenuSeparator />

                      {(job.status === "in_progress" || job.status === "pending") && (
                        <DropdownMenuItem
                          onClick={() => cancelImport(job.id)}
                          disabled={isCancelling}
                          className="text-destructive"
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Job
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
