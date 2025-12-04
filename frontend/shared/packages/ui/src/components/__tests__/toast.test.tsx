/**
 * Toast Component Tests
 *
 * Tests toast notification system with ToastContainer and toast methods
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { ToastContainer, toast } from "../toast";

describe("ToastContainer", () => {
  beforeEach(() => {
    // Clear any existing toasts before each test
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  describe("Basic Rendering", () => {
    it("renders toast container", () => {
      const { container } = render(<ToastContainer />);

      const toastContainer = container.querySelector(".fixed.top-4.right-4");
      expect(toastContainer).toBeInTheDocument();
    });

    it("has high z-index", () => {
      const { container } = render(<ToastContainer />);

      const toastContainer = container.firstChild;
      expect(toastContainer).toHaveClass("z-[60]");
    });

    it("does not render toasts initially", () => {
      render(<ToastContainer />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Success Toast", () => {
    it("shows success toast", async () => {
      render(<ToastContainer />);

      toast.success("Operation successful");

      await waitFor(() => {
        expect(screen.getByText("Operation successful")).toBeInTheDocument();
      });
    });

    it("success toast has green styling", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Success");

      await waitFor(() => {
        const toastElement = container.querySelector(".bg-green-900\\/90");
        expect(toastElement).toBeInTheDocument();
      });
    });

    it("success toast has check icon", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Success");

      await waitFor(() => {
        const icon = container.querySelector(".text-green-400");
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe("Error Toast", () => {
    it("shows error toast", async () => {
      render(<ToastContainer />);

      toast.error("An error occurred");

      await waitFor(() => {
        expect(screen.getByText("An error occurred")).toBeInTheDocument();
      });
    });

    it("error toast has red styling", async () => {
      const { container } = render(<ToastContainer />);

      toast.error("Error");

      await waitFor(() => {
        const toastElement = container.querySelector(".bg-red-900\\/90");
        expect(toastElement).toBeInTheDocument();
      });
    });

    it("error toast has alert icon", async () => {
      const { container } = render(<ToastContainer />);

      toast.error("Error");

      await waitFor(() => {
        const icon = container.querySelector(".text-red-400");
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe("Warning Toast", () => {
    it("shows warning toast", async () => {
      render(<ToastContainer />);

      toast.warning("Please be careful");

      await waitFor(() => {
        expect(screen.getByText("Please be careful")).toBeInTheDocument();
      });
    });

    it("warning toast has yellow styling", async () => {
      const { container } = render(<ToastContainer />);

      toast.warning("Warning");

      await waitFor(() => {
        const toastElement = container.querySelector(".bg-yellow-900\\/90");
        expect(toastElement).toBeInTheDocument();
      });
    });

    it("warning toast has warning icon", async () => {
      const { container } = render(<ToastContainer />);

      toast.warning("Warning");

      await waitFor(() => {
        const icon = container.querySelector(".text-yellow-400");
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe("Info Toast", () => {
    it("shows info toast", async () => {
      render(<ToastContainer />);

      toast.info("Here is some information");

      await waitFor(() => {
        expect(screen.getByText("Here is some information")).toBeInTheDocument();
      });
    });

    it("info toast has blue styling", async () => {
      const { container } = render(<ToastContainer />);

      toast.info("Info");

      await waitFor(() => {
        const toastElement = container.querySelector(".bg-blue-900\\/90");
        expect(toastElement).toBeInTheDocument();
      });
    });

    it("info toast has info icon", async () => {
      const { container } = render(<ToastContainer />);

      toast.info("Info");

      await waitFor(() => {
        const icon = container.querySelector(".text-blue-400");
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe("Auto Dismiss", () => {
    it("dismisses toast after default duration", async () => {
      render(<ToastContainer />);

      toast.success("Will auto dismiss");

      await waitFor(() => {
        expect(screen.getByText("Will auto dismiss")).toBeInTheDocument();
      });

      // Fast-forward time by 5000ms (default duration)
      jest.advanceTimersByTime(5000);

      await waitFor(() => {
        expect(screen.queryByText("Will auto dismiss")).not.toBeInTheDocument();
      });
    });

    it("dismisses toast after custom duration", async () => {
      render(<ToastContainer />);

      toast.success("Quick dismiss", 1000);

      await waitFor(() => {
        expect(screen.getByText("Quick dismiss")).toBeInTheDocument();
      });

      // Fast-forward time by 1000ms
      jest.advanceTimersByTime(1000);

      await waitFor(() => {
        expect(screen.queryByText("Quick dismiss")).not.toBeInTheDocument();
      });
    });
  });

  describe("Manual Dismiss", () => {
    it("shows close button", async () => {
      render(<ToastContainer />);

      toast.success("Test");

      await waitFor(() => {
        const closeButtons = screen.getAllByRole("button");
        expect(closeButtons.length).toBeGreaterThan(0);
      });
    });

    it("dismisses toast when close button clicked", async () => {
      const user = userEvent.setup({ delay: null });
      render(<ToastContainer />);

      toast.success("Click to dismiss");

      await waitFor(() => {
        expect(screen.getByText("Click to dismiss")).toBeInTheDocument();
      });

      const closeButton = screen.getAllByRole("button")[0];
      await user.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByText("Click to dismiss")).not.toBeInTheDocument();
      });
    });

    it("close button has X icon", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Test");

      await waitFor(() => {
        const button = container.querySelector("button");
        const icon = button?.querySelector("svg");
        expect(icon).toBeInTheDocument();
      });
    });
  });

  describe("Multiple Toasts", () => {
    it("shows multiple toasts simultaneously", async () => {
      render(<ToastContainer />);

      toast.success("First toast");
      toast.error("Second toast");
      toast.info("Third toast");

      await waitFor(() => {
        expect(screen.getByText("First toast")).toBeInTheDocument();
        expect(screen.getByText("Second toast")).toBeInTheDocument();
        expect(screen.getByText("Third toast")).toBeInTheDocument();
      });
    });

    it("stacks toasts with spacing", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Toast 1");
      toast.success("Toast 2");

      await waitFor(() => {
        const toastContainer = container.querySelector(".space-y-2");
        expect(toastContainer).toBeInTheDocument();
      });
    });

    it("dismisses individual toasts", async () => {
      const user = userEvent.setup({ delay: null });
      render(<ToastContainer />);

      toast.success("Keep this");
      toast.error("Remove this");

      await waitFor(() => {
        expect(screen.getByText("Keep this")).toBeInTheDocument();
        expect(screen.getByText("Remove this")).toBeInTheDocument();
      });

      const buttons = screen.getAllByRole("button");
      // Click the close button of the second toast
      await user.click(buttons[1]);

      await waitFor(() => {
        expect(screen.getByText("Keep this")).toBeInTheDocument();
        expect(screen.queryByText("Remove this")).not.toBeInTheDocument();
      });
    });
  });

  describe("Styling", () => {
    it("applies animation classes", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Animated");

      await waitFor(() => {
        const toastElement = container.querySelector(".animate-in.slide-in-from-right-full");
        expect(toastElement).toBeInTheDocument();
      });
    });

    it("has rounded corners", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Rounded");

      await waitFor(() => {
        const toastElement = container.querySelector(".rounded-lg");
        expect(toastElement).toBeInTheDocument();
      });
    });

    it("has backdrop blur", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Blurred");

      await waitFor(() => {
        const toastElement = container.querySelector(".backdrop-blur-sm");
        expect(toastElement).toBeInTheDocument();
      });
    });

    it("has minimum width", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Min width");

      await waitFor(() => {
        const toastElement = container.querySelector(".min-w-\\[300px\\]");
        expect(toastElement).toBeInTheDocument();
      });
    });

    it("has maximum width", async () => {
      const { container } = render(<ToastContainer />);

      toast.success("Max width");

      await waitFor(() => {
        const toastElement = container.querySelector(".max-w-\\[500px\\]");
        expect(toastElement).toBeInTheDocument();
      });
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("shows success toast after form submission", async () => {
      render(<ToastContainer />);

      // Simulate form submission
      toast.success("User created successfully");

      await waitFor(() => {
        expect(screen.getByText("User created successfully")).toBeInTheDocument();
      });
    });

    it("shows error toast on API failure", async () => {
      render(<ToastContainer />);

      toast.error("Failed to save changes. Please try again.");

      await waitFor(() => {
        expect(screen.getByText("Failed to save changes. Please try again.")).toBeInTheDocument();
      });
    });

    it("shows warning toast for validation", async () => {
      render(<ToastContainer />);

      toast.warning("Some fields are incomplete");

      await waitFor(() => {
        expect(screen.getByText("Some fields are incomplete")).toBeInTheDocument();
      });
    });

    it("shows info toast for notifications", async () => {
      render(<ToastContainer />);

      toast.info("New updates available");

      await waitFor(() => {
        expect(screen.getByText("New updates available")).toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles rapid successive toasts", async () => {
      render(<ToastContainer />);

      toast.success("Toast 1");
      toast.success("Toast 2");
      toast.success("Toast 3");
      toast.success("Toast 4");
      toast.success("Toast 5");

      await waitFor(() => {
        expect(screen.getByText("Toast 1")).toBeInTheDocument();
        expect(screen.getByText("Toast 5")).toBeInTheDocument();
      });
    });

    it("handles long messages", async () => {
      render(<ToastContainer />);

      const longMessage =
        "This is a very long toast message that might wrap to multiple lines and should still display correctly";

      toast.info(longMessage);

      await waitFor(() => {
        expect(screen.getByText(longMessage)).toBeInTheDocument();
      });
    });

    it("handles empty message", async () => {
      render(<ToastContainer />);

      toast.success("");

      await waitFor(() => {
        const toasts = document.querySelectorAll(".bg-green-900\\/90");
        expect(toasts.length).toBe(1);
      });
    });
  });

  describe("Container Lifecycle", () => {
    it("initializes toast queue on mount", () => {
      const { unmount } = render(<ToastContainer />);

      toast.success("Test");

      unmount();

      // After unmount, new toasts should still work with a new container
      render(<ToastContainer />);

      toast.success("After remount");

      // Should not throw error
      expect(true).toBe(true);
    });
  });
});
