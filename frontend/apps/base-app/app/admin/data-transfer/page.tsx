"use client";

export const dynamic = 'force-dynamic';
export const dynamicParams = true;

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  RefreshCw,
  TrendingUp,
  XCircle,
  AlertCircle,
  Activity,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  useTransferJobs,
  getStatusColor,
  getStatusIcon,
  formatDuration,
  formatTimestamp,
  calculateETA,
  getTypeColor,
  useCancelJob,
  type TransferType,
  type TransferStatus,
  type TransferJobResponse,
} from "@/hooks/useDataTransfer";

type FilterType = TransferType | "all";
type FilterStatus = TransferStatus | "all";

export default function DataTransferPage() {
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Build query params
  const queryParams = {
    type: filterType !== "all" ? (filterType as TransferType) : undefined,
    status: filterStatus !== "all" ? (filterStatus as TransferStatus) : undefined,
    page,
    page_size: pageSize,
  };

  // Query hooks
  const { data: jobsData, isLoading, error, refetch } = useTransferJobs(queryParams);
  const cancelJob = useCancelJob();

  const jobs = jobsData?.jobs ?? [];
  const total = jobsData?.total ?? 0;
  const hasMore = jobsData?.has_more ?? false;

  const handleCancelJob = async (jobId: string) => {
    if (!confirm("Are you sure you want to cancel this job? This action cannot be undone.")) {
      return;
    }
    await cancelJob.mutateAsync(jobId);
  };

  // Calculate statistics
  const stats = {
    totalJobs: total,
    running: jobs.filter((job) => job.status === "running").length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Data Operations
            </p>
            <h1 className="text-3xl font-semibold text-foreground flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Import / Export Jobs
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and manage data import and export operations
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isLoading} variant="outline" className="gap-2">
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </header>

      {/* Error State */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load transfer jobs: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && jobs.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-sm text-muted-foreground">Loading jobs...</span>
        </div>
      )}

      {/* Statistics Cards */}
      {!isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Total Jobs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalJobs}</div>
              <p className="text-xs text-muted-foreground mt-1">
                All time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3 w-3 text-blue-400" />
                Running
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-400">{stats.running}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active jobs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-400">{stats.completed}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalJobs > 0 ? `${((stats.completed / stats.totalJobs) * 100).toFixed(1)}% success` : "N/A"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <XCircle className="h-3 w-3 text-red-400" />
                Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-400">{stats.failed}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Requires attention
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Type:</label>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value as FilterType);
              setPage(1);
            }}
            className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Types</option>
            <option value="import">Import</option>
            <option value="export">Export</option>
            <option value="sync">Sync</option>
            <option value="migrate">Migrate</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Status:</label>
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as FilterStatus);
              setPage(1);
            }}
            className="px-3 py-2 bg-card border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Jobs List */}
      {!isLoading && jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              No transfer jobs found matching your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {jobs.map((job: TransferJobResponse) => (
            <Card key={job.job_id} className="border-primary/30">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {job.type === "import" && <ArrowDownToLine className="h-5 w-5 text-blue-400" />}
                      {job.type === "export" && <ArrowUpFromLine className="h-5 w-5 text-purple-400" />}
                      {job.type === "sync" && <RefreshCw className="h-5 w-5 text-cyan-400" />}
                      {job.type === "migrate" && <TrendingUp className="h-5 w-5 text-orange-400" />}
                      <CardTitle className="text-lg">{job.name}</CardTitle>
                    </div>
                    <CardDescription className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={getTypeColor(job.type)}>
                        {job.type.toUpperCase()}
                      </Badge>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${getStatusColor(job.status)}`}>
                        {getStatusIcon(job.status)} {job.status}
                      </span>
                      <span className="text-xs">•</span>
                      <span className="text-xs flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {formatTimestamp(job.created_at)}
                      </span>
                    </CardDescription>
                  </div>

                  {/* Cancel Button */}
                  {(job.status === "pending" || job.status === "running") && (
                    <Button
                      onClick={() => handleCancelJob(job.job_id)}
                      disabled={cancelJob.isPending}
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-red-400"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress Bar */}
                {job.status === "running" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{job.progress.toFixed(1)}%</span>
                    </div>
                    <Progress value={job.progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {job.records_processed.toLocaleString()} / {job.records_total?.toLocaleString() || "?"} records
                      </span>
                      <span>ETA: {calculateETA(job)}</span>
                    </div>
                  </div>
                )}

                {/* Job Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Processed</p>
                    <p className="text-sm font-semibold text-foreground">
                      {job.records_processed.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Failed</p>
                    <p className="text-sm font-semibold text-red-400">
                      {job.records_failed.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-sm font-semibold text-foreground">
                      {job.started_at
                        ? formatDuration(
                            job.completed_at
                              ? (new Date(job.completed_at).getTime() - new Date(job.started_at).getTime()) / 1000
                              : (Date.now() - new Date(job.started_at).getTime()) / 1000
                          )
                        : "Not started"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Success Rate</p>
                    <p className="text-sm font-semibold text-emerald-400">
                      {job.records_processed + job.records_failed > 0
                        ? ((job.records_processed / (job.records_processed + job.records_failed)) * 100).toFixed(1)
                        : "100.0"}%
                    </p>
                  </div>
                </div>

                {/* Error Message */}
                {job.error_message && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{job.error_message}</AlertDescription>
                  </Alert>
                )}

                {/* Metadata */}
                {job.metadata && Object.keys(job.metadata).length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <details>
                      <summary className="cursor-pointer hover:text-foreground">
                        Job Details
                      </summary>
                      <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(job.metadata, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {jobs.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} jobs
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
              variant="outline"
              size="sm"
            >
              Previous
            </Button>
            <Button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore || isLoading}
              variant="outline"
              size="sm"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
