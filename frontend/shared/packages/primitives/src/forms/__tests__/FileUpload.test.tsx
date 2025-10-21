/**
 * Refactored FileUpload component tests
 * Testing composition-based components with proper interfaces
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";

import {
  FilePreview,
  FileUpload,
  type FileValidation,
  FileValidationUtils,
  UploadArea,
  UploadContent,
} from "../FileUpload";

// Mock URL methods
global.URL.createObjectURL = jest.fn(() => "mock-url");
global.URL.revokeObjectURL = jest.fn();

describe("Refactored FileUpload Components", () => {
  describe("FileValidationUtils", () => {
    describe("validateFile", () => {
      const testFile = new File(["content"], "test.txt", {
        type: "text/plain",
      });

      it("validates file size correctly", () => {
        const validation: FileValidation = { maxSize: 100 };
        const largeFile = new File(["x".repeat(200)], "large.txt", {
          type: "text/plain",
        });

        const result = FileValidationUtils.validateFile(largeFile, validation);
        expect(result).toContain("exceeds maximum");
      });

      it("validates minimum file size", () => {
        const validation: FileValidation = { minSize: 1000 };
        const smallFile = new File(["small"], "small.txt", {
          type: "text/plain",
        });

        const result = FileValidationUtils.validateFile(smallFile, validation);
        expect(result).toContain("below minimum");
      });

      it("validates file types by extension", () => {
        const validation: FileValidation = { acceptedTypes: [".pdf", ".doc"] };

        const result = FileValidationUtils.validateFile(testFile, validation);
        expect(result).toContain("not allowed");
      });

      it("validates file types by MIME type", () => {
        const validation: FileValidation = { acceptedTypes: ["image/"] };

        const result = FileValidationUtils.validateFile(testFile, validation);
        expect(result).toContain("not allowed");
      });

      it("returns null for valid files", () => {
        const validation: FileValidation = {
          maxSize: 1000,
          acceptedTypes: ["text/plain"],
        };

        const result = FileValidationUtils.validateFile(testFile, validation);
        expect(result).toBeNull();
      });

      it("returns null when no validation provided", () => {
        const result = FileValidationUtils.validateFile(testFile);
        expect(result).toBeNull();
      });
    });

    describe("validateFileList", () => {
      const files = [
        new File(["1"], "file1.txt", { type: "text/plain" }),
        new File(["2"], "file2.txt", { type: "text/plain" }),
      ];

      it("validates maximum file count", () => {
        const validation: FileValidation = { maxFiles: 1 };

        const result = FileValidationUtils.validateFileList(files, validation);
        expect(result).toContain("Too many files");
      });

      it("validates required files", () => {
        const validation: FileValidation = { required: true };

        const result = FileValidationUtils.validateFileList([], validation);
        expect(result).toContain("required");
      });

      it("returns null for valid file list", () => {
        const validation: FileValidation = { maxFiles: 5 };

        const result = FileValidationUtils.validateFileList(files, validation);
        expect(result).toBeNull();
      });
    });

    describe("formatSize", () => {
      it("formats bytes correctly", () => {
        expect(FileValidationUtils.formatSize(0)).toBe("0 Bytes");
        expect(FileValidationUtils.formatSize(1024)).toBe("1 KB");
        expect(FileValidationUtils.formatSize(1024 * 1024)).toBe("1 MB");
        expect(FileValidationUtils.formatSize(1024 * 1024 * 1024)).toBe("1 GB");
      });

      it("formats partial sizes with decimals", () => {
        expect(FileValidationUtils.formatSize(1536)).toBe("1.5 KB");
        expect(FileValidationUtils.formatSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
      });
    });

    describe("file type utilities", () => {
      it("identifies image files", () => {
        const imageFile = new File([""], "image.jpg", { type: "image/jpeg" });
        expect(FileValidationUtils.isImageFile(imageFile)).toBe(true);

        const textFile = new File([""], "text.txt", { type: "text/plain" });
        expect(FileValidationUtils.isImageFile(textFile)).toBe(false);
      });

      it("returns appropriate file icons", () => {
        const imageFile = new File([""], "image.jpg", { type: "image/jpeg" });
        const pdfFile = new File([""], "doc.pdf", { type: "application/pdf" });
        const unknownFile = new File([""], "unknown", {
          type: "application/octet-stream",
        });

        expect(FileValidationUtils.getFileIcon(imageFile)).toBe("🖼️");
        expect(FileValidationUtils.getFileIcon(pdfFile)).toBe("📄");
        expect(FileValidationUtils.getFileIcon(unknownFile)).toBe("📁");
      });
    });
  });

  describe("UploadArea", () => {
    it("renders upload area correctly", () => {
      render(<UploadArea>Upload content</UploadArea>);

      const area = screen.getByText("Upload content");
      expect(area).toBeInTheDocument();
      expect(area).toHaveClass("upload-area");
    });

    it("handles drag over state", () => {
      render(<UploadArea isDragOver>Upload content</UploadArea>);

      const area = screen.getByText("Upload content");
      expect(area).toHaveClass("upload-area--dragover");
    });

    it("handles disabled state", () => {
      render(<UploadArea disabled>Upload content</UploadArea>);

      const area = screen.getByText("Upload content");
      expect(area).toHaveClass("upload-area--disabled");
      expect(area).toHaveAttribute("tabIndex", "-1");
    });

    it("handles click events when not disabled", () => {
      const onClick = jest.fn();
      render(
        <UploadArea onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick}>
          Upload content
        </UploadArea>,
      );

      fireEvent.click(screen.getByText("Upload content"));
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not handle click events when disabled", () => {
      const onClick = jest.fn();
      render(
        <UploadArea disabled onClick={onClick} onKeyDown={(e) => e.key === "Enter" && onClick}>
          Upload content
        </UploadArea>,
      );

      fireEvent.click(screen.getByText("Upload content"));
      expect(onClick).not.toHaveBeenCalled();
    });

    it("has proper accessibility attributes", () => {
      render(<UploadArea>Upload content</UploadArea>);

      const area = screen.getByRole("button");
      expect(area).toHaveAttribute("aria-label", "File upload area");
      expect(area).toHaveAttribute("tabIndex", "0");
    });
  });

  describe("UploadContent", () => {
    it("renders with default content", () => {
      render(<UploadContent />);

      expect(screen.getByText("Drop files here or click to upload")).toBeInTheDocument();
      expect(screen.getByText("📁")).toBeInTheDocument();
    });

    it("renders with custom content", () => {
      render(
        <UploadContent
          icon={<span>📷</span>}
          primaryText="Upload photos"
          secondaryText="JPG, PNG only"
        />,
      );

      expect(screen.getByText("📷")).toBeInTheDocument();
      expect(screen.getByText("Upload photos")).toBeInTheDocument();
      expect(screen.getByText("JPG, PNG only")).toBeInTheDocument();
    });

    it("renders without secondary text when not provided", () => {
      render(<UploadContent primaryText="Custom primary text" />);

      expect(screen.getByText("Custom primary text")).toBeInTheDocument();
      expect(screen.queryByText("upload-secondary")).not.toBeInTheDocument();
    });
  });

  describe("FilePreview", () => {
    it("renders file preview with info", () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      render(<FilePreview file={file} />);

      expect(screen.getByText("test.txt")).toBeInTheDocument();
      expect(screen.getByText("7 Bytes")).toBeInTheDocument();
      expect(screen.getByText("text/plain")).toBeInTheDocument();
    });

    it("renders image preview for image files", async () => {
      const imageFile = new File(["image"], "image.jpg", {
        type: "image/jpeg",
      });
      render(<FilePreview file={imageFile} />);

      await waitFor(() => {
        expect(screen.getByAltText("Preview")).toBeInTheDocument();
      });
    });

    it("renders file icon for non-image files", () => {
      const textFile = new File(["text"], "text.txt", { type: "text/plain" });
      render(<FilePreview file={textFile} />);

      expect(screen.getByText("📁")).toBeInTheDocument();
    });

    it("handles remove button", () => {
      const onRemove = jest.fn();
      const file = new File(["content"], "test.txt", { type: "text/plain" });

      render(<FilePreview file={file} onRemove={onRemove} />);

      const removeButton = screen.getByLabelText("Remove test.txt");
      fireEvent.click(removeButton);

      expect(onRemove).toHaveBeenCalledTimes(1);
    });

    it("does not render remove button when onRemove not provided", () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      render(<FilePreview file={file} />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("FileUpload main component", () => {
    const mockOnFileSelect = jest.fn();
    const mockOnError = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("renders basic file upload", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      expect(screen.getByText("Drop files here or click to upload")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "File upload area" })).toBeInTheDocument();
    });

    it("handles file selection via input", async () => {
      const { container } = render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(mockOnFileSelect).toHaveBeenCalledWith([file]);
      });
    });

    it("handles multiple file selection", async () => {
      const { container } = render(<FileUpload multiple onFileSelect={mockOnFileSelect} />);

      const files = [
        new File(["1"], "file1.txt", { type: "text/plain" }),
        new File(["2"], "file2.txt", { type: "text/plain" }),
      ];

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files } });

      await waitFor(() => {
        expect(mockOnFileSelect).toHaveBeenCalledWith(files);
      });
    });

    it("validates files on selection", async () => {
      const validation: FileValidation = { maxSize: 5 };

      const { container } = render(
        <FileUpload
          validation={validation}
          onFileSelect={mockOnFileSelect}
          onError={mockOnError}
        />,
      );

      const largeFile = new File(["x".repeat(10)], "large.txt", {
        type: "text/plain",
      });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining("exceeds maximum"));
        expect(mockOnFileSelect).not.toHaveBeenCalled();
      });
    });

    it("shows error message", async () => {
      const validation: FileValidation = { maxSize: 5 };

      const { container } = render(
        <FileUpload
          validation={validation}
          onFileSelect={mockOnFileSelect}
          onError={mockOnError}
        />,
      );

      const largeFile = new File(["x".repeat(10)], "large.txt", {
        type: "text/plain",
      });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/exceeds maximum/)).toBeInTheDocument();
      });
    });

    it("shows file previews after selection", async () => {
      const { container } = render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("test.txt")).toBeInTheDocument();
      });
    });

    it("handles file removal from preview", async () => {
      const { container } = render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText("test.txt")).toBeInTheDocument();
      });

      const removeButton = screen.getByLabelText("Remove test.txt");
      fireEvent.click(removeButton);

      expect(screen.queryByText("test.txt")).not.toBeInTheDocument();
    });

    it("handles disabled state", () => {
      const { container } = render(<FileUpload disabled onFileSelect={mockOnFileSelect} />);

      const uploadContainer = container.querySelector(".file-upload");
      expect(uploadContainer).toHaveClass("state-disabled");

      const uploadArea = screen.getByRole("button");
      expect(uploadArea).toHaveClass("upload-area--disabled");
      expect(uploadArea).toHaveAttribute("tabIndex", "-1");
    });

    it("shows validation hint in upload content", () => {
      const validation: FileValidation = { acceptedTypes: [".jpg", ".png"] };

      render(<FileUpload validation={validation} onFileSelect={mockOnFileSelect} />);

      expect(screen.getByText("Accepted types: .jpg, .png")).toBeInTheDocument();
    });

    it("renders custom children", () => {
      render(
        <FileUpload onFileSelect={mockOnFileSelect}>
          <div>Custom upload content</div>
        </FileUpload>,
      );

      expect(screen.getByText("Custom upload content")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("FileUpload should be accessible", async () => {
      const { container } = render(<FileUpload onFileSelect={jest.fn()} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("UploadArea should be accessible", async () => {
      const { container } = render(<UploadArea>Upload content</UploadArea>);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("FilePreview should be accessible", async () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const { container } = render(<FilePreview file={file} onRemove={jest.fn()} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("error messages have proper ARIA attributes", async () => {
      const validation: FileValidation = { maxSize: 5 };

      const { container } = render(
        <FileUpload validation={validation} onFileSelect={jest.fn()} onError={jest.fn()} />,
      );

      const largeFile = new File(["x".repeat(10)], "large.txt", {
        type: "text/plain",
      });
      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [largeFile] } });

      await waitFor(() => {
        const errorElement = screen.getByRole("alert");
        expect(errorElement).toHaveClass("upload-error");
      });
    });
  });

  describe("Integration patterns", () => {
    it("works with complex validation rules", async () => {
      const validation: FileValidation = {
        maxSize: 1000,
        maxFiles: 2,
        acceptedTypes: ["text/plain", ".txt"],
        required: true,
      };

      const onFileSelect = jest.fn();
      const onError = jest.fn();

      const { container } = render(
        <FileUpload
          multiple
          validation={validation}
          onFileSelect={onFileSelect}
          onError={onError}
        />,
      );

      // Test valid files
      const validFiles = [
        new File(["small"], "small1.txt", { type: "text/plain" }),
        new File(["small"], "small2.txt", { type: "text/plain" }),
      ];

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: validFiles } });

      await waitFor(() => {
        expect(onFileSelect).toHaveBeenCalledWith(validFiles);
        expect(onError).not.toHaveBeenCalled();
      });
    });

    it("accumulates files in multiple mode", async () => {
      const { container } = render(<FileUpload multiple onFileSelect={jest.fn()} />);

      const input = container.querySelector('input[type="file"]') as HTMLInputElement;

      // First selection
      const file1 = new File(["1"], "file1.txt", { type: "text/plain" });
      fireEvent.change(input, { target: { files: [file1] } });

      await waitFor(() => {
        expect(screen.getByText("file1.txt")).toBeInTheDocument();
      });

      // Second selection
      const file2 = new File(["2"], "file2.txt", { type: "text/plain" });
      fireEvent.change(input, { target: { files: [file2] } });

      await waitFor(() => {
        expect(screen.getByText("file1.txt")).toBeInTheDocument();
        expect(screen.getByText("file2.txt")).toBeInTheDocument();
      });
    });
  });
});
