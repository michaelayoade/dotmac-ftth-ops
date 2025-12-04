/**
 * Status Badge Component Tests
 *
 * Tests StatusBadge component with multiple variants and getStatusVariant helper
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { StatusBadge, getStatusVariant } from "../status-badge";

describe("StatusBadge", () => {
  describe("Basic Rendering", () => {
    it("renders status badge with text", () => {
      render(<StatusBadge>Active</StatusBadge>);

      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders with default variant", () => {
      const { container } = render(<StatusBadge>Status</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-muted", "text-muted-foreground");
    });

    it("is a span element", () => {
      render(<StatusBadge>Status</StatusBadge>);

      const badge = screen.getByText("Status");
      expect(badge.tagName).toBe("SPAN");
    });
  });

  describe("Variants", () => {
    it("renders success variant", () => {
      const { container } = render(<StatusBadge variant="success">Success</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("renders error variant", () => {
      const { container } = render(<StatusBadge variant="error">Error</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-red-100", "text-red-800");
    });

    it("renders warning variant", () => {
      const { container } = render(<StatusBadge variant="warning">Warning</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-yellow-100", "text-yellow-800");
    });

    it("renders info variant", () => {
      const { container } = render(<StatusBadge variant="info">Info</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-blue-100", "text-blue-800");
    });

    it("renders pending variant", () => {
      const { container } = render(<StatusBadge variant="pending">Pending</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-orange-100", "text-orange-800");
    });

    it("renders active variant", () => {
      const { container } = render(<StatusBadge variant="active">Active</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("renders inactive variant", () => {
      const { container } = render(<StatusBadge variant="inactive">Inactive</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-gray-100", "text-gray-800");
    });

    it("renders suspended variant", () => {
      const { container } = render(<StatusBadge variant="suspended">Suspended</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-orange-100", "text-orange-800");
    });

    it("renders terminated variant", () => {
      const { container } = render(<StatusBadge variant="terminated">Terminated</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-red-100", "text-red-800");
    });

    it("renders paid variant", () => {
      const { container } = render(<StatusBadge variant="paid">Paid</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-green-100", "text-green-800");
    });

    it("renders unpaid variant", () => {
      const { container } = render(<StatusBadge variant="unpaid">Unpaid</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-yellow-100", "text-yellow-800");
    });

    it("renders overdue variant", () => {
      const { container } = render(<StatusBadge variant="overdue">Overdue</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-red-100", "text-red-800");
    });

    it("renders draft variant", () => {
      const { container } = render(<StatusBadge variant="draft">Draft</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-gray-100", "text-gray-800");
    });

    it("renders published variant", () => {
      const { container } = render(<StatusBadge variant="published">Published</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-blue-100", "text-blue-800");
    });

    it("renders archived variant", () => {
      const { container } = render(<StatusBadge variant="archived">Archived</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("bg-gray-100", "text-gray-800");
    });
  });

  describe("Sizes", () => {
    it("renders small size", () => {
      const { container } = render(<StatusBadge size="sm">Small</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("text-xs", "px-2", "py-0.5");
    });

    it("renders medium size by default", () => {
      const { container } = render(<StatusBadge>Medium</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("text-sm", "px-2.5", "py-1");
    });

    it("renders large size", () => {
      const { container } = render(<StatusBadge size="lg">Large</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("text-base", "px-3", "py-1.5");
    });
  });

  describe("Dot Indicator", () => {
    it("does not show dot by default", () => {
      const { container } = render(<StatusBadge>Status</StatusBadge>);

      const dot = container.querySelector(".h-1\\.5.w-1\\.5");
      expect(dot).not.toBeInTheDocument();
    });

    it("shows dot when showDot is true", () => {
      const { container } = render(<StatusBadge showDot={true}>Active</StatusBadge>);

      const dots = container.querySelectorAll(".rounded-full");
      // Badge itself is rounded-full, plus the dot
      expect(dots.length).toBeGreaterThan(1);
    });

    it("dot has correct color for success variant", () => {
      const { container } = render(
        <StatusBadge variant="success" showDot={true}>
          Success
        </StatusBadge>,
      );

      const dot = container.querySelector(".bg-green-600");
      expect(dot).toBeInTheDocument();
    });

    it("dot has correct color for error variant", () => {
      const { container } = render(
        <StatusBadge variant="error" showDot={true}>
          Error
        </StatusBadge>,
      );

      const dot = container.querySelector(".bg-red-600");
      expect(dot).toBeInTheDocument();
    });

    it("dot is aria-hidden", () => {
      const { container } = render(<StatusBadge showDot={true}>Active</StatusBadge>);

      const dot = container.querySelector(".h-1\\.5.w-1\\.5");
      expect(dot).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Accessibility", () => {
    it("has role status", () => {
      const { container } = render(<StatusBadge>Active</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveAttribute("role", "status");
    });

    it("has aria-label with status text", () => {
      const { container } = render(<StatusBadge>Active</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveAttribute("aria-label", "Status: Active");
    });

    it("aria-label works with any children text", () => {
      const { container } = render(<StatusBadge variant="paid">Payment Complete</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveAttribute("aria-label", "Status: Payment Complete");
    });
  });

  describe("Styling", () => {
    it("has inline-flex layout", () => {
      const { container } = render(<StatusBadge>Status</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("inline-flex", "items-center");
    });

    it("has rounded-full shape", () => {
      const { container } = render(<StatusBadge>Status</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("rounded-full");
    });

    it("has border", () => {
      const { container } = render(<StatusBadge>Status</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("border");
    });

    it("has font-medium weight", () => {
      const { container } = render(<StatusBadge>Status</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("font-medium");
    });

    it("applies custom className", () => {
      const { container } = render(<StatusBadge className="custom-badge">Status</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("custom-badge");
    });

    it("has gap between dot and text", () => {
      const { container } = render(<StatusBadge showDot={true}>Active</StatusBadge>);

      const badge = container.firstChild;
      expect(badge).toHaveClass("gap-1.5");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders user status", () => {
      render(<StatusBadge variant="active">Active</StatusBadge>);

      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("renders payment status", () => {
      render(<StatusBadge variant="paid">Paid</StatusBadge>);

      expect(screen.getByText("Paid")).toBeInTheDocument();
    });

    it("renders subscription status with dot", () => {
      render(
        <StatusBadge variant="active" showDot={true}>
          Subscribed
        </StatusBadge>,
      );

      expect(screen.getByText("Subscribed")).toBeInTheDocument();
    });

    it("renders invoice status", () => {
      render(<StatusBadge variant="overdue">Overdue</StatusBadge>);

      expect(screen.getByText("Overdue")).toBeInTheDocument();
    });

    it("renders content status", () => {
      render(<StatusBadge variant="published">Published</StatusBadge>);

      expect(screen.getByText("Published")).toBeInTheDocument();
    });
  });
});

describe("getStatusVariant", () => {
  describe("Payment Statuses", () => {
    it("returns paid variant for paid", () => {
      expect(getStatusVariant("paid")).toBe("paid");
    });

    it("returns unpaid variant for unpaid", () => {
      expect(getStatusVariant("unpaid")).toBe("unpaid");
    });

    it("returns overdue variant for overdue", () => {
      expect(getStatusVariant("overdue")).toBe("overdue");
    });

    it("returns pending variant for pending", () => {
      expect(getStatusVariant("pending")).toBe("pending");
    });
  });

  describe("General Statuses", () => {
    it("returns active variant for active", () => {
      expect(getStatusVariant("active")).toBe("active");
    });

    it("returns inactive variant for inactive", () => {
      expect(getStatusVariant("inactive")).toBe("inactive");
    });

    it("returns suspended variant for suspended", () => {
      expect(getStatusVariant("suspended")).toBe("suspended");
    });

    it("returns terminated variant for terminated", () => {
      expect(getStatusVariant("terminated")).toBe("terminated");
    });
  });

  describe("Content Statuses", () => {
    it("returns draft variant for draft", () => {
      expect(getStatusVariant("draft")).toBe("draft");
    });

    it("returns published variant for published", () => {
      expect(getStatusVariant("published")).toBe("published");
    });

    it("returns archived variant for archived", () => {
      expect(getStatusVariant("archived")).toBe("archived");
    });
  });

  describe("Result Statuses", () => {
    it("returns success variant for success", () => {
      expect(getStatusVariant("success")).toBe("success");
    });

    it("returns success variant for completed", () => {
      expect(getStatusVariant("completed")).toBe("success");
    });

    it("returns success variant for approved", () => {
      expect(getStatusVariant("approved")).toBe("success");
    });

    it("returns error variant for failed", () => {
      expect(getStatusVariant("failed")).toBe("error");
    });

    it("returns error variant for rejected", () => {
      expect(getStatusVariant("rejected")).toBe("error");
    });

    it("returns error variant for error", () => {
      expect(getStatusVariant("error")).toBe("error");
    });

    it("returns warning variant for warning", () => {
      expect(getStatusVariant("warning")).toBe("warning");
    });

    it("returns info variant for info", () => {
      expect(getStatusVariant("info")).toBe("info");
    });
  });

  describe("Case Insensitivity", () => {
    it("handles uppercase", () => {
      expect(getStatusVariant("ACTIVE")).toBe("active");
    });

    it("handles mixed case", () => {
      expect(getStatusVariant("PaId")).toBe("paid");
    });

    it("handles lowercase", () => {
      expect(getStatusVariant("pending")).toBe("pending");
    });
  });

  describe("Whitespace Handling", () => {
    it("trims leading whitespace", () => {
      expect(getStatusVariant("  active")).toBe("active");
    });

    it("trims trailing whitespace", () => {
      expect(getStatusVariant("active  ")).toBe("active");
    });

    it("trims both leading and trailing whitespace", () => {
      expect(getStatusVariant("  active  ")).toBe("active");
    });
  });

  describe("Unknown Statuses", () => {
    it("returns default for unknown status", () => {
      expect(getStatusVariant("unknown")).toBe("default");
    });

    it("returns default for empty string", () => {
      expect(getStatusVariant("")).toBe("default");
    });

    it("returns default for random string", () => {
      expect(getStatusVariant("random-status-123")).toBe("default");
    });
  });

  describe("Integration with StatusBadge", () => {
    it("can be used with StatusBadge", () => {
      const status = "completed";
      const variant = getStatusVariant(status);

      render(<StatusBadge variant={variant}>{status}</StatusBadge>);

      expect(screen.getByText("completed")).toBeInTheDocument();
    });

    it("handles dynamic status mapping", () => {
      const statuses = ["paid", "pending", "failed"];

      statuses.forEach((status) => {
        const variant = getStatusVariant(status);
        render(<StatusBadge variant={variant}>{status}</StatusBadge>);

        expect(screen.getByText(status)).toBeInTheDocument();
      });
    });
  });

  describe("Real-World Scenarios", () => {
    it("maps payment statuses correctly", () => {
      const paymentStatuses = [
        { input: "paid", expected: "paid" },
        { input: "unpaid", expected: "unpaid" },
        { input: "overdue", expected: "overdue" },
        { input: "pending", expected: "pending" },
      ];

      paymentStatuses.forEach(({ input, expected }) => {
        expect(getStatusVariant(input)).toBe(expected);
      });
    });

    it("maps user account statuses correctly", () => {
      const userStatuses = [
        { input: "active", expected: "active" },
        { input: "inactive", expected: "inactive" },
        { input: "suspended", expected: "suspended" },
        { input: "terminated", expected: "terminated" },
      ];

      userStatuses.forEach(({ input, expected }) => {
        expect(getStatusVariant(input)).toBe(expected);
      });
    });

    it("maps operation results correctly", () => {
      const results = [
        { input: "success", expected: "success" },
        { input: "failed", expected: "error" },
        { input: "warning", expected: "warning" },
        { input: "info", expected: "info" },
      ];

      results.forEach(({ input, expected }) => {
        expect(getStatusVariant(input)).toBe(expected);
      });
    });
  });
});
