/**
 * Confirm Dialog Component Tests
 *
 * Tests ConfirmDialog component with different variants
 * Built on AlertDialog with confirmation patterns
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ConfirmDialog } from "../confirm-dialog";

describe("ConfirmDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: jest.fn(),
    title: "Confirm Action",
    description: "Are you sure you want to proceed?",
    onConfirm: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders when open is true", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
      expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      render(<ConfirmDialog {...defaultProps} open={false} />);

      expect(screen.queryByText("Confirm Action")).not.toBeInTheDocument();
    });

    it("renders confirm button", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText("Confirm")).toBeInTheDocument();
    });

    it("renders cancel button", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("renders custom confirm text", () => {
      render(<ConfirmDialog {...defaultProps} confirmText="Delete" />);

      expect(screen.getByText("Delete")).toBeInTheDocument();
      expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
    });

    it("renders custom cancel text", () => {
      render(<ConfirmDialog {...defaultProps} cancelText="Go Back" />);

      expect(screen.getByText("Go Back")).toBeInTheDocument();
      expect(screen.queryByText("Cancel")).not.toBeInTheDocument();
    });
  });

  describe("Confirm Action", () => {
    it("calls onConfirm when confirm button clicked", async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();

      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

      await user.click(screen.getByText("Confirm"));

      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls onOpenChange with false after confirm", async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

      await user.click(screen.getByText("Confirm"));

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });

    it("handles async onConfirm", async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn().mockResolvedValue(undefined);
      const onOpenChange = jest.fn();

      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} onOpenChange={onOpenChange} />);

      await user.click(screen.getByText("Confirm"));

      await waitFor(() => {
        expect(onConfirm).toHaveBeenCalled();
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe("Cancel Action", () => {
    it("calls onOpenChange with false when cancel clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

      await user.click(screen.getByText("Cancel"));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("calls onCancel when provided", async () => {
      const user = userEvent.setup();
      const onCancel = jest.fn();

      render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />);

      await user.click(screen.getByText("Cancel"));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("does not error when onCancel not provided", async () => {
      const user = userEvent.setup();

      render(<ConfirmDialog {...defaultProps} />);

      await user.click(screen.getByText("Cancel"));

      // Should not throw error
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("renders default variant by default", () => {
      render(<ConfirmDialog {...defaultProps} />);

      const confirmButton = screen.getByText("Confirm");
      expect(confirmButton).toBeInTheDocument();
    });

    it("renders destructive variant", () => {
      render(<ConfirmDialog {...defaultProps} variant="destructive" />);

      const confirmButton = screen.getByText("Confirm");
      expect(confirmButton).toHaveClass("bg-red-600");
    });

    it("renders warning variant", () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />);

      const confirmButton = screen.getByText("Confirm");
      expect(confirmButton).toHaveClass("bg-yellow-600");
    });

    it("destructive variant has hover state", () => {
      render(<ConfirmDialog {...defaultProps} variant="destructive" />);

      const confirmButton = screen.getByText("Confirm");
      expect(confirmButton).toHaveClass("hover:bg-red-700");
    });

    it("warning variant has hover state", () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />);

      const confirmButton = screen.getByText("Confirm");
      expect(confirmButton).toHaveClass("hover:bg-yellow-700");
    });
  });

  describe("Loading State", () => {
    it("does not show loading by default", () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.queryByText("Processing...")).not.toBeInTheDocument();
    });

    it("shows loading text when isLoading is true", () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      expect(screen.getByText("Processing...")).toBeInTheDocument();
      expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
    });

    it("disables confirm button when loading", () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByText("Processing...");
      expect(confirmButton).toBeDisabled();
    });

    it("disables cancel button when loading", () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByText("Cancel");
      expect(cancelButton).toBeDisabled();
    });

    it("applies opacity and cursor styles when loading", () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByText("Processing...");
      expect(confirmButton).toHaveClass("opacity-50", "cursor-not-allowed");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders delete confirmation dialog", async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();

      render(
        <ConfirmDialog
          open={true}
          onOpenChange={jest.fn()}
          title="Delete User"
          description="Are you sure you want to delete this user? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={onConfirm}
          variant="destructive"
        />,
      );

      expect(screen.getByText("Delete User")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Are you sure you want to delete this user? This action cannot be undone.",
        ),
      ).toBeInTheDocument();

      await user.click(screen.getByText("Delete"));

      expect(onConfirm).toHaveBeenCalled();
    });

    it("renders warning confirmation dialog", async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();

      render(
        <ConfirmDialog
          open={true}
          onOpenChange={jest.fn()}
          title="Unsaved Changes"
          description="You have unsaved changes. Are you sure you want to leave?"
          confirmText="Leave"
          cancelText="Stay"
          onConfirm={onConfirm}
          variant="warning"
        />,
      );

      expect(screen.getByText("Unsaved Changes")).toBeInTheDocument();
      expect(
        screen.getByText("You have unsaved changes. Are you sure you want to leave?"),
      ).toBeInTheDocument();

      await user.click(screen.getByText("Leave"));

      expect(onConfirm).toHaveBeenCalled();
    });

    it("handles async operation with loading state", async () => {
      const user = userEvent.setup();
      let resolveConfirm: () => void;
      const confirmPromise = new Promise<void>((resolve) => {
        resolveConfirm = resolve;
      });

      const TestDialog = () => {
        const [isLoading, setIsLoading] = React.useState(false);

        const handleConfirm = async () => {
          setIsLoading(true);
          await confirmPromise;
          setIsLoading(false);
        };

        return (
          <ConfirmDialog
            open={true}
            onOpenChange={jest.fn()}
            title="Submit Form"
            description="Ready to submit?"
            onConfirm={handleConfirm}
            isLoading={isLoading}
          />
        );
      };

      render(<TestDialog />);

      await user.click(screen.getByText("Confirm"));

      expect(screen.getByText("Processing...")).toBeInTheDocument();

      // Resolve the promise
      resolveConfirm!();

      await waitFor(() => {
        expect(screen.queryByText("Processing...")).not.toBeInTheDocument();
      });
    });
  });

  describe("Integration with AlertDialog", () => {
    it("uses AlertDialog components", () => {
      render(<ConfirmDialog {...defaultProps} />);

      // AlertDialog should render title and description
      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
      expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty title", () => {
      render(<ConfirmDialog {...defaultProps} title="" />);

      expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
    });

    it("handles long description", () => {
      const longDescription =
        "This is a very long description that explains in detail what will happen when you confirm this action. It should wrap properly and display correctly.";

      render(<ConfirmDialog {...defaultProps} description={longDescription} />);

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });

    it("handles multiple rapid clicks", async () => {
      const user = userEvent.setup();
      const onConfirm = jest.fn();

      render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

      const confirmButton = screen.getByText("Confirm");
      await user.click(confirmButton);
      await user.click(confirmButton);
      await user.click(confirmButton);

      // Should only call once per click (though dialog should close after first)
      expect(onConfirm).toHaveBeenCalled();
    });
  });

  describe("State Management", () => {
    it("can be controlled externally", () => {
      const { rerender } = render(<ConfirmDialog {...defaultProps} open={false} />);

      expect(screen.queryByText("Confirm Action")).not.toBeInTheDocument();

      rerender(<ConfirmDialog {...defaultProps} open={true} />);

      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    });

    it("notifies parent of state changes", async () => {
      const user = userEvent.setup();
      const onOpenChange = jest.fn();

      render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

      await user.click(screen.getByText("Cancel"));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
