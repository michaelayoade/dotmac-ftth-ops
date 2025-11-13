/**
 * Refactored FileUpload component using composition pattern
 * Separated concerns for better testability and maintainability
 */
"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import type React from "react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";

// Basic file upload variants
const uploadVariants = cva("file-upload", {
  variants: {
    variant: {
      default: "upload-default",
      outlined: "upload-outlined",
      filled: "upload-filled",
      minimal: "upload-minimal",
    },
    size: {
      sm: "upload-sm",
      md: "upload-md",
      lg: "upload-lg",
    },
    state: {
      idle: "state-idle",
      dragover: "state-dragover",
      uploading: "state-uploading",
      success: "state-success",
      error: "state-error",
      disabled: "state-disabled",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "md",
    state: "idle",
  },
});

// Core file validation interface
export interface FileValidation {
  maxSize?: number;
  minSize?: number;
  acceptedTypes?: string[];
  maxFiles?: number;
  required?: boolean;
}

// Simple file interface for composition
export interface SimpleFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "success" | "error";
  progress?: number;
  error?: string;
}

// Base FileUpload props (simplified)
export interface BaseFileUploadProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange" | "onError">,
    VariantProps<typeof uploadVariants> {
  multiple?: boolean;
  disabled?: boolean;
  accept?: string;
  validation?: FileValidation;
  onFileSelect?: (files: File[]) => void;
  onError?: (error: string) => void;
}

// Composable file validation utilities
export const FileValidationUtils = {
  validateFile: (file: File, validation?: FileValidation): string | null => {
    if (!validation) {
      return null;
    }

    // Size validation
    if (validation.maxSize && file.size > validation.maxSize) {
      return `File size ${FileValidationUtils.formatSize(file.size)} exceeds maximum ${FileValidationUtils.formatSize(validation.maxSize)}`;
    }

    if (validation.minSize && file.size < validation.minSize) {
      return `File size ${FileValidationUtils.formatSize(file.size)} is below minimum ${FileValidationUtils.formatSize(validation.minSize)}`;
    }

    // Type validation
    if (validation.acceptedTypes && validation.acceptedTypes.length > 0) {
      const isAccepted = validation.acceptedTypes.some((type) => {
        if (type.startsWith(".")) {
          return file.name.toLowerCase().endsWith(type.toLowerCase());
        }
        return file.type.includes(type) || file.type === type;
      });

      if (!isAccepted) {
        return `File type ${file.type} is not allowed. Accepted types: ${validation.acceptedTypes.join(", ")}`;
      }
    }

    return null;
  },

  validateFileList: (files: File[], validation?: FileValidation): string | null => {
    if (!validation) {
      return null;
    }

    if (validation.maxFiles && files.length > validation.maxFiles) {
      return `Too many files selected. Maximum allowed: ${validation.maxFiles}`;
    }

    if (validation.required && files.length === 0) {
      return "At least one file is required";
    }

    return null;
  },

  formatSize: (bytes: number): string => {
    if (bytes === 0) {
      return "0 Bytes";
    }
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
  },

  isImageFile: (file: File): boolean => {
    if (file.type && file.type.startsWith("image/")) {
      return true;
    }
    return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
  },

  getFileIcon: (file: File): string => {
    if (file.type.startsWith("image/")) {
      return "🖼️";
    }
    if (file.type.startsWith("video/")) {
      return "🎥";
    }
    if (file.type.startsWith("audio/")) {
      return "🎵";
    }
    if (file.type.includes("pdf")) {
      return "📄";
    }
    if (file.type.includes("document") || file.type.includes("word")) {
      return "📝";
    }
    if (file.type.includes("spreadsheet") || file.type.includes("excel")) {
      return "📊";
    }
    if (file.type.includes("presentation") || file.type.includes("powerpoint")) {
      return "📋";
    }
    if (file.type.includes("zip") || file.type.includes("rar")) {
      return "🗜️";
    }
    return "📁";
  },
};

// Drag and drop handler composition
export const useDragAndDrop = (onFileDrop: (files: File[]) => void, disabled?: boolean) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragOver(false);
      }
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) {
        setIsDragOver(false);
        const files = Array.from(e.dataTransfer?.files || []);
        onFileDrop(files);
      }
    },
    [disabled, onFileDrop],
  );

  return {
    isDragOver,
    dragHandlers: {
      onDragEnter: handleDragEnter,
      onDragOver: handleDragOver,
      onDragLeave: handleDragLeave,
      onDrop: handleDrop,
    },
  };
};

// File input handler composition
export const useFileInput = (
  onFileSelect: (files: File[]) => void,
  multiple?: boolean,
  accept?: string,
) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        onFileSelect(files);
      }
      // Reset input value to allow selecting the same file again
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [onFileSelect],
  );

  const openFileDialog = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    inputRef,
    inputProps: {
      ref: inputRef,
      type: "file" as const,
      multiple,
      accept,
      onChange: handleFileChange,
      style: { display: "none" },
      "aria-hidden": true,
    },
    openFileDialog,
  };
};

// Upload area component (composable)
export interface UploadAreaProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onClick" | "onKeyDown"> {
  isDragOver?: boolean;
  disabled?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
}

export const UploadArea = forwardRef<HTMLDivElement, UploadAreaProps>(
  ({ isDragOver, disabled, children, onClick, onKeyDown, className, ...props }, ref) => {
    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onClick?.();
      }
      onKeyDown?.(event);
    };

    return (
      <div
        ref={ref}
        className={clsx(
          "upload-area",
          {
            "upload-area--dragover": isDragOver,
            "upload-area--disabled": disabled,
          },
          className,
        )}
        onClick={disabled ? undefined : onClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="File upload area"
        {...props}
      >
        {children}
      </div>
    );
  },
);

// Upload content component (composable)
export interface UploadContentProps {
  icon?: React.ReactNode;
  primaryText?: string;
  secondaryText?: string;
  className?: string;
}

export const UploadContent: React.FC<UploadContentProps> = ({
  icon = <span className="upload-icon">📁</span>,
  primaryText = "Drop files here or click to upload",
  secondaryText,
  className,
}) => {
  return (
    <div className={clsx("upload-content", className)}>
      {icon}
      <div className="upload-text">
        <div className="upload-primary">{primaryText}</div>
        {secondaryText && <div className="upload-secondary">{secondaryText}</div>}
      </div>
    </div>
  );
};

// File preview component (composable)
export interface FilePreviewProps {
  file: File;
  onRemove?: () => void;
  className?: string;
}

export const FilePreview: React.FC<FilePreviewProps> = ({ file, onRemove, className }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!FileValidationUtils.isImageFile(file)) {
      setPreviewUrl(null);
      return;
    }

    let isActive = true;

    if (typeof FileReader !== "undefined") {
      const reader = new FileReader();
      reader.onload = () => {
        if (isActive) {
          setPreviewUrl(typeof reader.result === "string" ? reader.result : null);
        }
      };
      reader.readAsDataURL(file);

      return () => {
        isActive = false;
        reader.abort();
      };
    }

    if (typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL?.(url);
    }

    return;
  }, [file]);

  return (
    <div className={clsx("file-preview", className)}>
      {previewUrl ? (
        <img src={previewUrl} alt="Preview" className="preview-image" />
      ) : (
        <div className="file-icon">{FileValidationUtils.getFileIcon(file)}</div>
      )}
      <div className="file-info">
        <div className="file-name">{file.name}</div>
        <div className="file-size">{FileValidationUtils.formatSize(file.size)}</div>
        <div className="file-type">{file.type}</div>
      </div>
      {onRemove && (
        <button
          type="button"
          className="remove-file"
          onClick={onRemove}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onRemove();
            }
          }}
          aria-label={`Remove ${file.name}`}
        >
          ×
        </button>
      )}
    </div>
  );
};

// Main FileUpload component using composition
export const FileUpload = forwardRef<HTMLDivElement, BaseFileUploadProps>(
  (
    {
      className,
      variant,
      size,
      multiple = false,
      disabled = false,
      accept,
      validation,
      onFileSelect,
      onError,
      children,
      ...props
    },
    ref,
  ) => {
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleFileSelection = useCallback(
      (files: File[]) => {
        // Validate file list
        const listError = FileValidationUtils.validateFileList(files, validation);
        if (listError) {
          setError(listError);
          onError?.(listError);
          return;
        }

        // Validate individual files
        const validFiles: File[] = [];
        for (const file of files) {
          const fileError = FileValidationUtils.validateFile(file, validation);
          if (fileError) {
            setError(fileError);
            onError?.(fileError);
            return;
          }
          validFiles.push(file);
        }

        // Clear error and update state
        setError(null);
        setSelectedFiles(multiple ? [...selectedFiles, ...validFiles] : validFiles);
        onFileSelect?.(validFiles);
      },
      [validation, multiple, selectedFiles, onFileSelect, onError],
    );

    const { isDragOver, dragHandlers } = useDragAndDrop(handleFileSelection, disabled);
    const { inputProps, openFileDialog } = useFileInput(handleFileSelection, multiple, accept);

    const state = disabled ? "disabled" : isDragOver ? "dragover" : error ? "error" : "idle";

    return (
      <div
        ref={ref}
        className={clsx(uploadVariants({ variant, size, state }), className)}
        {...dragHandlers}
        {...props}
      >
        <input {...inputProps} />

        <UploadArea
          isDragOver={isDragOver}
          disabled={disabled}
          onClick={openFileDialog}
          onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openFileDialog();
            }
          }}
        >
          {children || (
            <UploadContent
              primaryText="Drop files here or click to upload"
              {...(validation?.acceptedTypes
                ? { secondaryText: `Accepted types: ${validation.acceptedTypes.join(", ")}` }
                : {})}
            />
          )}
        </UploadArea>

        {error && (
          <div className="upload-error" role="alert">
            {error}
          </div>
        )}

        {selectedFiles.length > 0 && (
          <div className="file-list">
            {selectedFiles.map((file, index) => (
              <FilePreview
                key={`${file.name}-${index}`}
                file={file}
                onRemove={() => {
                  const newFiles = selectedFiles.filter((_, i) => i !== index);
                  setSelectedFiles(newFiles);
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  },
);

FileUpload.displayName = "FileUpload";
UploadArea.displayName = "UploadArea";
UploadContent.displayName = "UploadContent";
FilePreview.displayName = "FilePreview";
