/**
 * React Query hooks for data transfer (import/export) operations
 *
 * Connects to backend data transfer APIs:
 * - POST /api/platform/v1/admin/data-transfer/import - Create import job
 * - POST /api/platform/v1/admin/data-transfer/export - Create export job
 * - GET /api/platform/v1/admin/data-transfer/jobs - List jobs with filters
 * - GET /api/platform/v1/admin/data-transfer/jobs/{job_id} - Get job status
 * - DELETE /api/platform/v1/admin/data-transfer/jobs/{job_id} - Cancel job
 * - GET /api/platform/v1/admin/data-transfer/formats - Get supported formats
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type QueryKey,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

// ============================================
// Types matching backend data transfer models
// ============================================

export type TransferType = "import" | "export" | "sync" | "migrate";
export type TransferStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type ImportSource = "file" | "database" | "api" | "s3" | "sftp" | "http";
export type ExportTarget = "file" | "database" | "api" | "s3" | "sftp" | "email";
export type DataFormat = "csv" | "json" | "excel" | "xml";
export type CompressionType = "none" | "gzip" | "zip" | "bzip2";
export type ValidationLevel = "none" | "basic" | "strict";

export interface TransferJobResponse {
  job_id: string;
  name: string;
  type: TransferType;
  status: TransferStatus;
  progress: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  records_processed: number;
  records_failed: number;
  records_total: number | null;
  error_message: string | null;
  metadata: Record<string, any> | null;
  duration?: number | null;
  success_rate?: number;
}

export interface TransferJobListResponse {
  jobs: TransferJobResponse[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface ImportRequest {
  source_type: ImportSource;
  source_path: string;
  format: DataFormat;
  mapping?: Record<string, string> | null;
  options?: Record<string, any> | null;
  validation_level?: ValidationLevel;
  batch_size?: number;
  encoding?: string;
  skip_errors?: boolean;
  dry_run?: boolean;
}

export interface ExportRequest {
  target_type: ExportTarget;
  target_path: string;
  format: DataFormat;
  filters?: Record<string, any> | null;
  fields?: string[] | null;
  options?: Record<string, any> | null;
  compression?: CompressionType;
  batch_size?: number;
  encoding?: string;
  overwrite?: boolean;
}

export interface DataFormatInfo {
  format: DataFormat;
  name: string;
  file_extensions: string[];
  mime_types: string[];
  supports_compression: boolean;
  supports_streaming: boolean;
  options: Record<string, any>;
}

export interface FormatsResponse {
  import_formats: DataFormatInfo[];
  export_formats: DataFormatInfo[];
  compression_types: string[];
}

export interface TransferStatistics {
  total_jobs: number;
  completed_jobs: number;
  failed_jobs: number;
  in_progress_jobs: number;
  total_records_processed: number;
  total_bytes_transferred: number;
  average_job_duration: number;
  success_rate: number;
  busiest_hour: number | null;
  most_used_format: string | null;
}

// ============================================
// Query Hooks
// ============================================

type QueryOptions<TData, TKey extends QueryKey> = Omit<
  UseQueryOptions<TData, Error, TData, TKey>,
  "queryKey" | "queryFn"
>;

/**
 * Fetch transfer jobs with optional filters
 */
export function useTransferJobs(
  params?: {
    type?: TransferType;
    status?: TransferStatus;
    page?: number;
    page_size?: number;
  },
  options?: QueryOptions<TransferJobListResponse, ["data-transfer", "jobs", typeof params]>,
) {
  return useQuery<
    TransferJobListResponse,
    Error,
    TransferJobListResponse,
    ["data-transfer", "jobs", typeof params]
  >({
    queryKey: ["data-transfer", "jobs", params],
    queryFn: async () => {
      const response = await apiClient.get<TransferJobListResponse>("/data-transfer/jobs", {
        params: {
          type: params?.type,
          job_status: params?.status,
          page: params?.page || 1,
          page_size: params?.page_size || 20,
        },
      });
      return extractDataOrThrow(response, "Failed to load transfer jobs");
    },
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
    ...options,
  });
}

/**
 * Fetch single transfer job status
 */
export function useTransferJob(
  jobId: string,
  options?: QueryOptions<TransferJobResponse, ["data-transfer", "jobs", string]>,
) {
  return useQuery<
    TransferJobResponse,
    Error,
    TransferJobResponse,
    ["data-transfer", "jobs", string]
  >({
    queryKey: ["data-transfer", "jobs", jobId],
    queryFn: async () => {
      const response = await apiClient.get<TransferJobResponse>(`/data-transfer/jobs/${jobId}`);
      return extractDataOrThrow(response, "Failed to load transfer job");
    },
    enabled: !!jobId,
    refetchInterval: 3000, // Refresh every 3 seconds for job detail
    ...options,
  });
}

/**
 * Fetch supported data formats
 */
export function useSupportedFormats(
  options?: QueryOptions<FormatsResponse, ["data-transfer", "formats"]>,
) {
  return useQuery<FormatsResponse, Error, FormatsResponse, ["data-transfer", "formats"]>({
    queryKey: ["data-transfer", "formats"],
    queryFn: async () => {
      const response = await apiClient.get<FormatsResponse>("/data-transfer/formats");
      return extractDataOrThrow(response, "Failed to load data formats");
    },
    staleTime: 300000, // 5 minutes - formats don't change often
    ...options,
  });
}

// ============================================
// Mutation Hooks
// ============================================

/**
 * Create import job
 */
export function useCreateImportJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ImportRequest) => {
      const response = await apiClient.post<TransferJobResponse>("/data-transfer/import", data);
      return extractDataOrThrow(response, "Failed to create import job");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["data-transfer", "jobs"] });

      toast({
        title: "Import job created",
        description: `Job "${data.name}" has been queued for processing.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.response?.data?.detail || "Failed to create import job",
        variant: "destructive",
      });
    },
  });
}

/**
 * Create export job
 */
export function useCreateExportJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: ExportRequest) => {
      const response = await apiClient.post<TransferJobResponse>("/data-transfer/export", data);
      return extractDataOrThrow(response, "Failed to create export job");
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["data-transfer", "jobs"] });

      toast({
        title: "Export job created",
        description: `Job "${data.name}" has been queued for processing.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Export failed",
        description: error.response?.data?.detail || "Failed to create export job",
        variant: "destructive",
      });
    },
  });
}

/**
 * Cancel transfer job
 */
export function useCancelJob() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiClient.delete(`/data-transfer/jobs/${jobId}`);
      // Check for successful status codes (2xx)
      if (response.status < 200 || response.status >= 300) {
        throw new Error("Failed to cancel job");
      }
    },
    onSuccess: (_, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["data-transfer", "jobs"] });
      queryClient.invalidateQueries({
        queryKey: ["data-transfer", "jobs", jobId],
      });

      toast({
        title: "Job cancelled",
        description: "Transfer job has been cancelled successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cancellation failed",
        description: error.response?.data?.detail || "Failed to cancel job",
        variant: "destructive",
      });
    },
  });
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get status color class
 */
export function getStatusColor(status: TransferStatus): string {
  const colors: Record<TransferStatus, string> = {
    pending: "text-gray-400 bg-gray-500/15 border-gray-500/30",
    running: "text-blue-400 bg-blue-500/15 border-blue-500/30",
    completed: "text-emerald-400 bg-emerald-500/15 border-emerald-500/30",
    failed: "text-red-400 bg-red-500/15 border-red-500/30",
    cancelled: "text-yellow-400 bg-yellow-500/15 border-yellow-500/30",
  };
  return colors[status] || colors.pending;
}

/**
 * Get status icon
 */
export function getStatusIcon(status: TransferStatus): string {
  const icons: Record<TransferStatus, string> = {
    pending: "⏳",
    running: "▶",
    completed: "✓",
    failed: "✗",
    cancelled: "⊘",
  };
  return icons[status] || icons.pending;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "N/A";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

/**
 * Format timestamp to relative time
 */
export function formatTimestamp(timestamp: string | null | undefined): string {
  if (!timestamp) return "Never";

  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

/**
 * Calculate ETA for running job
 */
export function calculateETA(job: TransferJobResponse): string {
  if (job.status !== "running" || !job.started_at || job.progress <= 0) {
    return "N/A";
  }

  const startTime = new Date(job.started_at).getTime();
  const now = Date.now();
  const elapsed = (now - startTime) / 1000; // seconds

  const rate = job.progress / elapsed; // progress per second
  const remaining = 100 - job.progress;
  const etaSeconds = remaining / rate;

  return formatDuration(etaSeconds);
}

/**
 * Format file size
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Get transfer type badge color
 */
export function getTypeColor(type: TransferType): string {
  const colors: Record<TransferType, string> = {
    import: "text-blue-300 bg-blue-500/15",
    export: "text-purple-300 bg-purple-500/15",
    sync: "text-cyan-300 bg-cyan-500/15",
    migrate: "text-orange-300 bg-orange-500/15",
  };
  return colors[type] || colors.import;
}
