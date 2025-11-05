"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Download,
  Upload,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  FileText,
  Database,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { platformConfig } from "@/lib/config";
import { useToast } from "@/components/ui/use-toast";
import { RouteGuard } from "@/components/auth/PermissionGuard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog-provider";

interface TransferJob {
  job_id: string;
  name: string;
  type: "IMPORT" | "EXPORT";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  progress: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  records_processed: number;
  records_failed: number;
  records_total?: number;
  error_message?: string;
  metadata?: Record<string, any>;
}

interface DataFormat {
  format: string;
  name: string;
  file_extensions: string[];
  mime_types: string[];
  supports_compression: boolean;
  supports_streaming: boolean;
  options: Record<string, string>;
}

interface FormatsResponse {
  import_formats: DataFormat[];
  export_formats: DataFormat[];
  compression_types: string[];
}

function DataTransferPageContent() {
  const [importSource, setImportSource] = useState("");
  const [importFormat, setImportFormat] = useState("CSV");
  const [importType, setImportType] = useState("FILE");
  const [exportTarget, setExportTarget] = useState("");
  const [exportFormat, setExportFormat] = useState("CSV");
  const [exportType, setExportType] = useState("FILE");
  const [exportCompression, setExportCompression] = useState("none");

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const confirmDialog = useConfirmDialog();

  // Fetch supported formats
  const { data: formats } = useQuery<FormatsResponse>({
    queryKey: ["data-transfer-formats"],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/data-transfer/formats`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch formats");
      return response.json();
    },
  });

  // Fetch transfer jobs
  const { data: jobsData, isLoading, refetch } = useQuery<{ jobs: TransferJob[]; total: number }>({
    queryKey: ["data-transfer-jobs"],
    queryFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/data-transfer/jobs`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Failed to fetch jobs");
      return response.json();
    },
    refetchInterval: 5000, // Refresh every 5s for job progress
  });

  const jobs = jobsData?.jobs || [];

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/data-transfer/import`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_path: importSource,
            source_type: importType,
            format: importFormat,
            batch_size: 1000,
            validate: true,
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to start import");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-transfer-jobs"] });
      toast({ title: "Import job started successfully" });
      setImportSource("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start import",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Export mutation
  const exportMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/data-transfer/export`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            target_path: exportTarget,
            target_type: exportType,
            format: exportFormat,
            compression: exportCompression,
            batch_size: 1000,
          }),
        }
      );
      if (!response.ok) throw new Error("Failed to start export");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-transfer-jobs"] });
      toast({ title: "Export job started successfully" });
      setExportTarget("");
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to start export",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel job mutation
  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/data-transfer/jobs/${jobId}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to cancel job");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["data-transfer-jobs"] });
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

  const handleImport = () => {
    if (!importSource) {
      toast({
        title: "Source required",
        description: "Please specify an import source",
        variant: "destructive",
      });
      return;
    }
    importMutation.mutate();
  };

  const handleExport = () => {
    if (!exportTarget) {
      toast({
        title: "Target required",
        description: "Please specify an export target",
        variant: "destructive",
      });
      return;
    }
    exportMutation.mutate();
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      PENDING: { icon: Clock, color: "bg-gray-100 text-gray-800", label: "Pending" },
      RUNNING: { icon: RefreshCw, color: "bg-blue-100 text-blue-800", label: "Running" },
      COMPLETED: { icon: CheckCircle, color: "bg-green-100 text-green-800", label: "Completed" },
      FAILED: { icon: XCircle, color: "bg-red-100 text-red-800", label: "Failed" },
      CANCELLED: { icon: AlertCircle, color: "bg-amber-100 text-amber-800", label: "Cancelled" },
    };
    const config = badges[status as keyof typeof badges] || badges.PENDING;
    const Icon = config.icon;
    return (
      <Badge className={config.color}>
        <Icon className={`h-3 w-3 mr-1 ${status === "RUNNING" ? "animate-spin" : ""}`} />
        {config.label}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    return type === "IMPORT" ? (
      <Badge className="bg-purple-100 text-purple-800">
        <Upload className="h-3 w-3 mr-1" />
        Import
      </Badge>
    ) : (
      <Badge className="bg-cyan-100 text-cyan-800">
        <Download className="h-3 w-3 mr-1" />
        Export
      </Badge>
    );
  };

  const stats = {
    total: jobs.length,
    running: jobs.filter((j) => j.status === "RUNNING").length,
    completed: jobs.filter((j) => j.status === "COMPLETED").length,
    failed: jobs.filter((j) => j.status === "FAILED").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Import/Export</h1>
          <p className="text-sm text-muted-foreground">
            Bulk data operations for import and export
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">All transfer jobs</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running}</div>
            <p className="text-xs text-muted-foreground">In progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
            <p className="text-xs text-muted-foreground">Successfully finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.failed}</div>
            <p className="text-xs text-muted-foreground">Errors occurred</p>
          </CardContent>
        </Card>
      </div>

      {/* Import/Export Forms */}
      <Tabs defaultValue="import" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import">
            <Upload className="h-4 w-4 mr-2" />
            Import Data
          </TabsTrigger>
          <TabsTrigger value="export">
            <Download className="h-4 w-4 mr-2" />
            Export Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>Import Configuration</CardTitle>
              <CardDescription>
                Import data from external sources into the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="import-type">Source Type</Label>
                  <Select value={importType} onValueChange={setImportType}>
                    <SelectTrigger id="import-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FILE">Local File</SelectItem>
                      <SelectItem value="URL">Remote URL</SelectItem>
                      <SelectItem value="S3">S3 Bucket</SelectItem>
                      <SelectItem value="FTP">FTP Server</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="import-format">Data Format</Label>
                  <Select value={importFormat} onValueChange={setImportFormat}>
                    <SelectTrigger id="import-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formats?.import_formats.map((fmt) => (
                        <SelectItem key={fmt.format} value={fmt.format}>
                          {fmt.name} ({fmt.file_extensions.join(", ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="import-source">Source Path/URL</Label>
                <Input
                  id="import-source"
                  placeholder="e.g., /data/import.csv or https://example.com/data.json"
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value)}
                />
              </div>

              <Button
                onClick={handleImport}
                disabled={importMutation.isPending}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importMutation.isPending ? "Starting Import..." : "Start Import"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export Configuration</CardTitle>
              <CardDescription>
                Export system data to external targets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="export-type">Target Type</Label>
                  <Select value={exportType} onValueChange={setExportType}>
                    <SelectTrigger id="export-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FILE">Local File</SelectItem>
                      <SelectItem value="S3">S3 Bucket</SelectItem>
                      <SelectItem value="FTP">FTP Server</SelectItem>
                      <SelectItem value="HTTP">HTTP POST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="export-format">Data Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger id="export-format">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formats?.export_formats.map((fmt) => (
                        <SelectItem key={fmt.format} value={fmt.format}>
                          {fmt.name} ({fmt.file_extensions.join(", ")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-compression">Compression</Label>
                <Select value={exportCompression} onValueChange={setExportCompression}>
                  <SelectTrigger id="export-compression">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formats?.compression_types.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="export-target">Target Path/URL</Label>
                <Input
                  id="export-target"
                  placeholder="e.g., /data/export.csv or s3://bucket/data.json"
                  value={exportTarget}
                  onChange={(e) => setExportTarget(e.target.value)}
                />
              </div>

              <Button
                onClick={handleExport}
                disabled={exportMutation.isPending}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                {exportMutation.isPending ? "Starting Export..." : "Start Export"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Jobs List */}
      <Card>
        <CardHeader>
          <CardTitle>Transfer Jobs ({jobs.length})</CardTitle>
          <CardDescription>Recent import and export operations</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading jobs...
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transfer jobs found. Start an import or export to begin.
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.job_id}
                  className="border rounded-lg p-4 hover:bg-accent transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{job.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(job.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {getTypeBadge(job.type)}
                      {getStatusBadge(job.status)}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {job.status === "RUNNING" && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>{Math.round(job.progress)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Processed</p>
                      <p className="font-medium">{job.records_processed.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Failed</p>
                      <p className="font-medium text-red-600">{job.records_failed.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium">
                        {job.records_total ? job.records_total.toLocaleString() : "N/A"}
                      </p>
                    </div>
                  </div>

                  {/* Error Message */}
                  {job.error_message && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      {job.error_message}
                    </div>
                  )}

                  {/* Actions */}
                  {(job.status === "RUNNING" || job.status === "PENDING") && (
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          const confirmed = await confirmDialog({
                            title: "Cancel transfer job",
                            description: `Cancel job "${job.name}"?`,
                            confirmText: "Cancel job",
                            variant: "destructive",
                          });
                          if (confirmed) {
                            cancelMutation.mutate(job.job_id);
                          }
                        }}
                        disabled={cancelMutation.isPending}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Cancel Job
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function DataTransferPage() {
  return (
    <RouteGuard permission="admin">
      <DataTransferPageContent />
    </RouteGuard>
  );
}
