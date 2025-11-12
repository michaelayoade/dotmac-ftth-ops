"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useToast } from "@dotmac/ui";
import { platformConfig } from "@/lib/config";

// Types matching backend models
export type ImportJobType = "customers" | "invoices" | "subscriptions" | "payments" | "products" | "mixed";
export type ImportJobStatus = "pending" | "validating" | "in_progress" | "completed" | "failed" | "partially_completed" | "cancelled";

export interface ImportJob {
  id: string;
  job_type: ImportJobType;
  status: ImportJobStatus;
  file_name: string;
  file_size: number;
  file_format: string;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  started_at: string | null;
  completed_at: string | null;
  initiated_by: string | null;
  config: Record<string, any>;
  summary: Record<string, any>;
  error_message: string | null;
  celery_task_id: string | null;
  created_at: string;
  updated_at: string;
  progress_percentage: number;
  success_rate: number;
  duration_seconds: number | null;
}

export interface ImportFailure {
  row_number: number;
  error_type: string;
  error_message: string;
  row_data: Record<string, any>;
  field_errors: Record<string, string>;
}

export interface ImportStatus {
  job_id: string;
  status: ImportJobStatus;
  progress_percentage: number;
  total_records: number;
  processed_records: number;
  successful_records: number;
  failed_records: number;
  celery_task_status: string | null;
  error_message: string | null;
}

export interface UploadImportParams {
  entity_type: ImportJobType;
  file: File;
  batch_size?: number;
  dry_run?: boolean;
  use_async?: boolean;
}

/**
 * Hook for managing data imports
 */
export function useDataImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pollingJobId, setPollingJobId] = useState<string | null>(null);

  // Upload import file
  const uploadMutation = useMutation({
    mutationFn: async (params: UploadImportParams) => {
      const formData = new FormData();
      formData.append("file", params.file);
      formData.append("batch_size", String(params.batch_size || 100));
      formData.append("dry_run", String(params.dry_run || false));
      formData.append("use_async", String(params.use_async || true));

      const url = platformConfig.api.buildUrl(`/data-import/upload/${params.entity_type}`);
      const response = await fetch(url, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      return response.json() as Promise<ImportJob>;
    },
    onSuccess: (data) => {
      toast({
        title: "Upload successful",
        description: `Import job ${data.id} created`,
      });
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });

      // Start polling for status if async
      if (data.celery_task_id) {
        setPollingJobId(data.id);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // List import jobs
  const useImportJobs = (params?: {
    status?: ImportJobStatus;
    job_type?: ImportJobType;
    limit?: number;
    offset?: number;
  }) => {
    return useQuery({
      queryKey: ["import-jobs", params],
      queryFn: async () => {
        const searchParams = new URLSearchParams();
        if (params?.status) searchParams.append("status", params.status);
        if (params?.job_type) searchParams.append("job_type", params.job_type);
        if (params?.limit) searchParams.append("limit", String(params.limit));
        if (params?.offset) searchParams.append("offset", String(params.offset));

        const url = platformConfig.api.buildUrl(`/data-import/jobs?${searchParams.toString()}`);
        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch import jobs");
        }

        return response.json() as Promise<{ jobs: ImportJob[]; total: number }>;
      },
      refetchInterval: 5000, // Poll every 5 seconds
    });
  };

  // Get single import job
  const useImportJob = (jobId: string | null) => {
    return useQuery({
      queryKey: ["import-job", jobId],
      queryFn: async () => {
        if (!jobId) return null;

        const url = platformConfig.api.buildUrl(`/data-import/jobs/${jobId}`);
        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch import job");
        }

        return response.json() as Promise<ImportJob>;
      },
      enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      // Poll more frequently for in-progress jobs
      if (job?.status === "in_progress" || job?.status === "pending") {
        return 2000;
      }
      return false;
      },
    });
  };

  // Get import job status
  const useImportJobStatus = (jobId: string | null) => {
    return useQuery({
      queryKey: ["import-job-status", jobId],
      queryFn: async () => {
        if (!jobId) return null;

        const url = platformConfig.api.buildUrl(`/data-import/jobs/${jobId}/status`);
        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch import job status");
        }

        return response.json() as Promise<ImportStatus>;
      },
      enabled: !!jobId,
    refetchInterval: (query) => {
      const job = query.state.data;
      if (job?.status === "in_progress" || job?.status === "pending") {
        return 1000; // Poll every second for active jobs
      }
      return false;
      },
    });
  };

  // Get import failures
  const useImportFailures = (jobId: string | null) => {
    return useQuery({
      queryKey: ["import-failures", jobId],
      queryFn: async () => {
        if (!jobId) return [];

        const url = platformConfig.api.buildUrl(`/data-import/jobs/${jobId}/failures`);
        const response = await fetch(url, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to fetch import failures");
        }

        return response.json() as Promise<ImportFailure[]>;
      },
      enabled: !!jobId,
    });
  };

  // Cancel import job
  const cancelMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const url = platformConfig.api.buildUrl(`/data-import/jobs/${jobId}`);
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Cancel failed");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Job cancelled",
        description: "Import job has been cancelled",
      });
      queryClient.invalidateQueries({ queryKey: ["import-jobs"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Cancel failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Download failures
  const downloadFailures = async (jobId: string, format: "csv" | "json" = "csv") => {
    try {
      const url = platformConfig.api.buildUrl(`/data-import/jobs/${jobId}/export-failures?format=${format}`);
      const response = await fetch(url, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to export failures");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `import_failures_${jobId}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: `Failures exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return {
    uploadImport: uploadMutation.mutate,
    cancelImport: cancelMutation.mutate,
    downloadFailures,
    useImportJobs,
    useImportJob,
    useImportJobStatus,
    useImportFailures,
    isUploading: uploadMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}
