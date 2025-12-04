"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  File,
  Upload,
  Download,
  Trash2,
  Search,
  Filter,
  MoreVertical,
  FileText,
  Image as ImageIcon,
  Video,
  Archive,
  FolderOpen,
} from "lucide-react";
import { PageHeader } from "@dotmac/ui";
import { EmptyState } from "@dotmac/ui";
import { StatusBadge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { useConfirmDialog } from "@dotmac/ui";
import { logger } from "@/lib/logger";
import { useApiConfig } from "@/hooks/useApiConfig";

interface FileMetadata {
  file_id: string;
  file_name: string;
  file_size: number;
  content_type: string;
  created_at: string;
  updated_at?: string;
  path?: string;
  description?: string;
}

interface FilesResponse {
  files: FileMetadata[];
  total: number;
  page: number;
  per_page: number;
}

export default function FilesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const queryClient = useQueryClient();
  const confirmDialog = useConfirmDialog();
  const { buildApiUrl } = useApiConfig();

  // Fetch files
  const { data, isLoading, error } = useQuery<FilesResponse>({
    queryKey: ["files"],
    queryFn: async () => {
      const url = buildApiUrl("/files/storage");
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      return response.json();
    },
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const url = buildApiUrl("/files/storage/upload");
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      logger.info("File uploaded successfully");
    },
    onError: (error) => {
      logger.error("File upload failed", { error });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const url = buildApiUrl(`/files/storage/${fileId}`);
      const response = await fetch(url, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      if (response.status === 204) {
        return null;
      }

      const text = await response.text();
      return text ? JSON.parse(text) : null;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files"] });
      setSelectedFiles([]);
      logger.info("File deleted successfully");
    },
    onError: (error) => {
      logger.error("File deletion failed", { error });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadMutation.mutateAsync(file);
      }
    } finally {
      setIsUploading(false);
      event.target.value = ""; // Reset input
    }
  };

  const handleDelete = async (fileId: string) => {
    const confirmed = await confirmDialog({
      title: "Delete file",
      description: "Are you sure you want to delete this file?",
      confirmText: "Delete file",
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(fileId);
  };

  const handleDownload = (fileId: string, fileName: string) => {
    const url = buildApiUrl(`/files/storage/${fileId}/download`);
    window.open(url, "_blank");
    logger.info("File downloaded", { fileId, fileName });
  };

  const getFileIcon = (contentType: string) => {
    if (contentType.startsWith("image/")) return ImageIcon;
    if (contentType.startsWith("video/")) return Video;
    if (contentType.includes("zip") || contentType.includes("archive")) return Archive;
    if (contentType.includes("pdf") || contentType.includes("document")) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatDate = (timestamp: string): string => {
    try {
      // Handle various timestamp formats
      if (!timestamp) return "Unknown";

      // Try parsing as ISO string or Unix timestamp
      const date = new Date(timestamp);

      if (isNaN(date.getTime())) {
        // Log for debugging in development
        logger.debug("Invalid timestamp format", { timestamp });
        return "Unknown";
      }

      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (error) {
      logger.error("Date formatting error", { timestamp, error });
      return "Unknown";
    }
  };

  const filteredFiles =
    data?.files.filter((file) =>
      file.file_name.toLowerCase().includes(searchQuery.toLowerCase()),
    ) || [];

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12" role="status" aria-live="polite">
          <div className="text-muted-foreground">Loading files...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <EmptyState.Error
          title="Failed to load files"
          description="Unable to fetch file list. Please try again."
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["files"] })}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <PageHeader
        title="File Operations"
        description="Upload, download, and manage your files"
        icon={FolderOpen}
        actions={
          <PageHeader.Actions>
            <input
              type="file"
              id="file-upload"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              aria-label="Upload files"
            />
            <Button
              onClick={() => document.getElementById("file-upload")?.click()}
              disabled={isUploading}
              aria-label="Upload new files"
            >
              <Upload className="h-4 w-4 mr-2" />
              {isUploading ? "Uploading..." : "Upload Files"}
            </Button>
          </PageHeader.Actions>
        }
      >
        <div className="flex gap-4 mt-4">
          <PageHeader.Stat label="Total Files" value={data?.total || 0} icon={File} />
          <PageHeader.Stat
            label="Total Size"
            value={formatFileSize(filteredFiles.reduce((sum, file) => sum + file.file_size, 0))}
          />
        </div>
      </PageHeader>

      {/* Search and Filters */}
      <div className="mb-6 flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-accent border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label="Search files"
          />
        </div>
      </div>

      {/* Files List */}
      {filteredFiles.length === 0 ? (
        <EmptyState.List
          entityName="files"
          onCreateClick={() => document.getElementById("file-upload")?.click()}
          icon={File}
        />
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <table className="w-full" role="table">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Uploaded
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredFiles.map((file) => {
                const FileIconComponent = getFileIcon(file.content_type);
                return (
                  <tr key={file.file_id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <FileIconComponent
                          className="h-5 w-5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div>
                          <div className="font-medium text-foreground">{file.file_name}</div>
                          {file.description && (
                            <div className="text-sm text-muted-foreground">{file.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge variant="info" size="sm">
                        {file.content_type.split("/")[1]?.toUpperCase() || "FILE"}
                      </StatusBadge>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatFileSize(file.file_size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {formatDate(file.created_at)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(file.file_id, file.file_name)}
                          aria-label={`Download ${file.file_name}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void handleDelete(file.file_id);
                          }}
                          aria-label={`Delete ${file.file_name}`}
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
