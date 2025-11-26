"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Label } from "@dotmac/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import { Checkbox } from "@dotmac/ui";
import {
  Upload,
  FileText,
  AlertCircle,
} from "lucide-react";
import { useDataImport, type ImportJobType } from "@/hooks/useDataImport";

interface FileUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ENTITY_TYPES: { value: ImportJobType; label: string; description: string }[] = [
  {
    value: "customers",
    label: "Customers",
    description: "Import customer records with contact and billing info",
  },
  {
    value: "invoices",
    label: "Invoices",
    description: "Import invoice data with line items and amounts",
  },
  {
    value: "subscriptions",
    label: "Subscriptions",
    description: "Import subscription data (coming soon)",
  },
  {
    value: "payments",
    label: "Payments",
    description: "Import payment records (coming soon)",
  },
  {
    value: "products",
    label: "Products",
    description: "Import product catalog (coming soon)",
  },
];

export function FileUploadDialog({ open, onOpenChange }: FileUploadDialogProps) {
  const { uploadImport, isUploading } = useDataImport();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [entityType, setEntityType] = useState<ImportJobType>("customers");
  const [batchSize, setBatchSize] = useState(100);
  const [dryRun, setDryRun] = useState(false);
  const [useAsync, setUseAsync] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = [".csv", ".json"];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!validExtensions.includes(fileExtension)) {
      setError("Please select a CSV or JSON file");
      setSelectedFile(null);
      return;
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File size must be less than 50MB");
      setSelectedFile(null);
      return;
    }

    setError(null);
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file");
      return;
    }

    uploadImport(
      {
        entity_type: entityType,
        file: selectedFile,
        batch_size: batchSize,
        dry_run: dryRun,
        use_async: useAsync,
      },
      {
        onSuccess: () => {
          // Reset form
          setSelectedFile(null);
          setError(null);
          onOpenChange(false);
        },
      }
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Data</DialogTitle>
          <DialogDescription>
            Upload a CSV or JSON file to import data into the system
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entity Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="entity-type">Data Type</Label>
            <Select value={entityType} onValueChange={(value) => setEntityType(value as ImportJobType)}>
              <SelectTrigger id="entity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex flex-col">
                      <span>{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="file-upload">File</Label>
            <div className="flex items-center gap-2">
              <Input
                id="file-upload"
                type="file"
                accept=".csv,.json"
                onChange={handleFileSelect}
                disabled={isUploading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => document.getElementById("file-upload")?.click()}
                disabled={isUploading}
              >
                <Upload className="h-4 w-4" />
              </Button>
            </div>
            {selectedFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>{selectedFile.name}</span>
                <span>({formatFileSize(selectedFile.size)})</span>
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Batch Size */}
          <div className="space-y-2">
            <Label htmlFor="batch-size">Batch Size</Label>
            <Input
              id="batch-size"
              type="number"
              min={10}
              max={1000}
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value) || 100)}
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              Number of records to process at once (10-1000)
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="dry-run"
                checked={dryRun}
                onChange={(event) => setDryRun(event.target.checked)}
                disabled={isUploading}
              />
              <Label
                htmlFor="dry-run"
                className="text-sm font-normal cursor-pointer"
              >
                Dry run (validate only, don&apos;t save)
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="use-async"
                checked={useAsync}
                onChange={(event) => setUseAsync(event.target.checked)}
                disabled={isUploading}
              />
              <Label
                htmlFor="use-async"
                className="text-sm font-normal cursor-pointer"
              >
                Process asynchronously (recommended for large files)
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={isUploading || !selectedFile}>
            {isUploading ? "Uploading..." : "Upload & Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
