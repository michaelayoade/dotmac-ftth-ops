"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Progress } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import { useToast } from "@dotmac/ui";
import {
  Upload,
  Download,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  FileText,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@dotmac/ui";
import { format } from "date-fns";

interface ImportJob {
  id: string;
  job_type: string;
  status: string;
  file_name: string;
  file_size: number;
  file_format: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  progress_percentage: number;
  success_rate: number;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  error_message?: string;
  created_at: string;
}

interface ImportFailure {
  row_number: number;
  error_type: string;
  error_message: string;
  row_data: Record<string, any>;
  field_errors: Record<string, string>;
}

export default function ImportsPage() {
  const { toast } = useToast();
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedJob, setSelectedJob] = useState<ImportJob | null>(null);
  const [failures, setFailures] = useState<ImportFailure[]>([]);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadConfig, setUploadConfig] = useState({
    entity_type: "customers",
    batch_size: 100,
    dry_run: false,
    use_async: false,
  });
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (typeFilter !== "all") params.append("job_type", typeFilter);
      params.append("limit", "50");

      const response = await fetch(`/api/v1/import/jobs?${params}`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs);
      }
    } catch (error) {
      console.error("Failed to fetch import jobs:", error);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchJobs();
    const interval = setInterval(fetchJobs, 5000);
    return () => clearInterval(interval);
  }, [fetchJobs]);

  const fetchFailures = async (jobId: string) => {
    try {
      const response = await fetch(`/api/v1/import/jobs/${jobId}/failures`);
      if (response.ok) {
        const data = await response.json();
        setFailures(data);
      }
    } catch (error) {
      console.error("Failed to fetch failures:", error);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", uploadFile);
    formData.append("batch_size", String(uploadConfig.batch_size));
    formData.append("dry_run", String(uploadConfig.dry_run));
    formData.append("use_async", String(uploadConfig.use_async));

    try {
      setLoading(true);
      const response = await fetch(`/api/v1/import/upload/${uploadConfig.entity_type}`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Import job created successfully",
        });
        setShowUploadDialog(false);
        setUploadFile(null);
        fetchJobs();
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.detail || "Failed to create import job",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportFailures = async (jobId: string, format: "csv" | "json") => {
    try {
      const response = await fetch(`/api/v1/import/jobs/${jobId}/export-failures?format=${format}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `import_failures_${jobId}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export failures",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      pending: { label: "Pending", variant: "secondary" as const, icon: Clock },
      validating: {
        label: "Validating",
        variant: "secondary" as const,
        icon: RefreshCw,
      },
      in_progress: {
        label: "In Progress",
        variant: "default" as const,
        icon: RefreshCw,
      },
      completed: {
        label: "Completed",
        variant: "success" as const,
        icon: CheckCircle,
      },
      failed: {
        label: "Failed",
        variant: "destructive" as const,
        icon: XCircle,
      },
      partially_completed: {
        label: "Partial",
        variant: "secondary" as const,
        icon: AlertCircle,
      },
      cancelled: {
        label: "Cancelled",
        variant: "secondary" as const,
        icon: XCircle,
      },
    };

    const config = statusMap[status as keyof typeof statusMap] || statusMap.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Data Imports</h1>
          <p className="text-muted-foreground">Manage bulk data imports and migrations</p>
        </div>
        <Button onClick={() => setShowUploadDialog(true)}>
          <Upload className="mr-2 h-4 w-4" />
          New Import
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {jobs.filter((j) => j.status === "in_progress").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {jobs.filter((j) => j.status === "completed").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {jobs.filter((j) => j.status === "failed").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Import Jobs</CardTitle>
          <div className="flex gap-4 mt-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 w-[180px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="partially_completed">Partial</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 w-[180px] rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="all">All Types</option>
              <option value="customers">Customers</option>
              <option value="invoices">Invoices</option>
              <option value="subscriptions">Subscriptions</option>
              <option value="payments">Payments</option>
            </select>
            <Button variant="outline" onClick={fetchJobs}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{job.file_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {formatBytes(job.file_size)} • {job.file_format.toUpperCase()}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="capitalize">{job.job_type}</TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    <div className="w-[100px]">
                      <Progress value={job.progress_percentage} className="h-2" />
                      <span className="text-xs text-muted-foreground">
                        {job.processed_records}/{job.total_records}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div className="text-green-600 dark:text-green-400">
                        ✓ {job.successful_records}
                      </div>
                      {job.failed_records > 0 && (
                        <div className="text-red-600 dark:text-red-400">✗ {job.failed_records}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{job.success_rate.toFixed(1)}%</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {format(new Date(job.created_at), "MMM d, h:mm a")}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedJob(job);
                          fetchFailures(job.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {job.failed_records > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportFailures(job.id, "csv")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Import Data</DialogTitle>
            <DialogDescription>Upload a CSV or JSON file to import data in bulk</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="entity-type" className="text-right">
                Type
              </Label>
              <select
                id="entity-type"
                value={uploadConfig.entity_type}
                onChange={(e) =>
                  setUploadConfig({
                    ...uploadConfig,
                    entity_type: e.target.value,
                  })
                }
                className="col-span-3 h-10 rounded-md border border-border bg-card px-3 text-sm text-foreground"
              >
                <option value="customers">Customers</option>
                <option value="invoices">Invoices</option>
                <option value="subscriptions">Subscriptions</option>
                <option value="payments">Payments</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="file" className="text-right">
                File
              </Label>
              <Input
                id="file"
                type="file"
                accept=".csv,.json"
                className="col-span-3"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="batch-size" className="text-right">
                Batch Size
              </Label>
              <Input
                id="batch-size"
                type="number"
                className="col-span-3"
                value={uploadConfig.batch_size}
                onChange={(e) =>
                  setUploadConfig({
                    ...uploadConfig,
                    batch_size: parseInt(e.target.value) || 100,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="dry-run" className="text-right">
                Options
              </Label>
              <div className="col-span-3 space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="dry-run"
                    checked={uploadConfig.dry_run}
                    onChange={(e) =>
                      setUploadConfig({
                        ...uploadConfig,
                        dry_run: e.target.checked,
                      })
                    }
                  />
                  <Label htmlFor="dry-run">Dry run (validate without saving)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="use-async"
                    checked={uploadConfig.use_async}
                    onChange={(e) =>
                      setUploadConfig({
                        ...uploadConfig,
                        use_async: e.target.checked,
                      })
                    }
                  />
                  <Label htmlFor="use-async">Process in background</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={loading || !uploadFile}>
              {loading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Job Details Dialog */}
      {selectedJob && (
        <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
            <DialogHeader>
              <DialogTitle>Import Job Details</DialogTitle>
              <DialogDescription>
                {selectedJob.file_name} • {selectedJob.job_type}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Job Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Status</Label>
                      <div>{getStatusBadge(selectedJob.status)}</div>
                    </div>
                    <div>
                      <Label>Progress</Label>
                      <Progress value={selectedJob.progress_percentage} />
                    </div>
                    <div>
                      <Label>Total Records</Label>
                      <div>{selectedJob.total_records}</div>
                    </div>
                    <div>
                      <Label>Processed</Label>
                      <div>{selectedJob.processed_records}</div>
                    </div>
                    <div>
                      <Label>Successful</Label>
                      <div className="text-green-600 dark:text-green-400">
                        {selectedJob.successful_records}
                      </div>
                    </div>
                    <div>
                      <Label>Failed</Label>
                      <div className="text-red-600 dark:text-red-400">
                        {selectedJob.failed_records}
                      </div>
                    </div>
                  </div>
                  {selectedJob.error_message && (
                    <div className="mt-4 p-3 bg-red-100 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded">
                      <Label>Error</Label>
                      <div>{selectedJob.error_message}</div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Failures */}
              {failures.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Failed Records</CardTitle>
                    <CardDescription>Showing {failures.length} failed records</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Error Type</TableHead>
                          <TableHead>Error Message</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {failures.slice(0, 20).map((failure, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{failure.row_number}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{failure.error_type}</Badge>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              {failure.error_message}
                            </TableCell>
                            <TableCell>
                              <details>
                                <summary className="cursor-pointer text-sm text-blue-600 dark:text-blue-400">
                                  View data
                                </summary>
                                <pre className="mt-2 text-xs overflow-auto">
                                  {JSON.stringify(failure.row_data, null, 2)}
                                </pre>
                              </details>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
