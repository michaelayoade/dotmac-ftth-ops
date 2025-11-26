/**
 * Badge Component Tests
 *
 * Tests shadcn/ui Badge primitive with variants and styling
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { Badge } from "../badge";

describe("Badge", () => {
  describe("Basic Rendering", () => {
    it("renders badge with content", () => {
      render(<Badge>New</Badge>);

      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("renders as div element", () => {
      const { container } = render(<Badge>Badge</Badge>);

      const badge = container.firstChild;
      expect(badge?.nodeName).toBe("DIV");
    });

    it("applies base styles", () => {
      const { container } = render(<Badge>Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("inline-flex", "items-center", "rounded-full");
      expect(badge).toHaveClass("border", "px-2.5", "py-0.5");
      expect(badge).toHaveClass("text-xs", "font-semibold");
    });

    it("renders with custom className", () => {
      const { container } = render(<Badge className="custom-class">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("custom-class");
    });
  });

  describe("Variants", () => {
    it("renders default variant", () => {
      const { container } = render(<Badge variant="default">Default</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("border-transparent", "bg-primary", "text-primary-foreground");
    });

    it("renders secondary variant", () => {
      const { container } = render(<Badge variant="secondary">Secondary</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("border-transparent", "bg-secondary", "text-secondary-foreground");
    });

    it("renders destructive variant", () => {
      const { container } = render(<Badge variant="destructive">Error</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass(
        "border-transparent",
        "bg-destructive",
        "text-destructive-foreground",
      );
    });

    it("renders outline variant", () => {
      const { container } = render(<Badge variant="outline">Outline</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("text-foreground");
    });

    it("renders success variant", () => {
      const { container } = render(<Badge variant="success">Success</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("border-transparent", "bg-green-500", "text-white");
    });

    it("renders warning variant", () => {
      const { container } = render(<Badge variant="warning">Warning</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("border-transparent", "bg-yellow-500", "text-white");
    });

    it("renders info variant", () => {
      const { container } = render(<Badge variant="info">Info</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("border-transparent", "bg-blue-500", "text-white");
    });

    it("defaults to default variant when not specified", () => {
      const { container } = render(<Badge>Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("bg-primary");
    });
  });

  describe("Accessibility", () => {
    it("has focus styles", () => {
      const { container } = render(<Badge>Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("focus:outline-none", "focus:ring-2", "focus:ring-primary");
    });

    it("supports role attribute", () => {
      const { container } = render(<Badge role="status">5</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute("role", "status");
    });

    it("supports aria-label", () => {
      const { container } = render(<Badge aria-label="5 notifications">5</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute("aria-label", "5 notifications");
    });

    it("supports aria-live for dynamic content", () => {
      const { container } = render(<Badge aria-live="polite">3</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("HTML Attributes", () => {
    it("forwards data attributes", () => {
      render(
        <Badge data-testid="custom-badge" data-custom="value">
          Badge
        </Badge>,
      );

      const badge = screen.getByTestId("custom-badge");
      expect(badge).toHaveAttribute("data-custom", "value");
    });

    it("supports id attribute", () => {
      const { container } = render(<Badge id="my-badge">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute("id", "my-badge");
    });

    it("supports onClick handler", () => {
      const handleClick = jest.fn();
      const { container } = render(<Badge onClick={handleClick}>Clickable</Badge>);

      const badge = container.firstChild as HTMLElement;
      badge.click();

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("supports title attribute", () => {
      const { container } = render(<Badge title="Badge tooltip">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveAttribute("title", "Badge tooltip");
    });
  });

  describe("Children Content", () => {
    it("renders string children", () => {
      render(<Badge>Text</Badge>);

      expect(screen.getByText("Text")).toBeInTheDocument();
    });

    it("renders numeric children", () => {
      render(<Badge>{99}</Badge>);

      expect(screen.getByText("99")).toBeInTheDocument();
    });

    it("renders element children", () => {
      render(
        <Badge>
          <span>Icon</span>
          <span>Label</span>
        </Badge>,
      );

      expect(screen.getByText("Icon")).toBeInTheDocument();
      expect(screen.getByText("Label")).toBeInTheDocument();
    });

    it("handles empty children", () => {
      const { container } = render(<Badge />);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeEmptyDOMElement();
    });
  });

  describe("Styling", () => {
    it("has transition-colors for smooth hover effects", () => {
      const { container } = render(<Badge>Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("transition-colors");
    });

    it("has rounded-full for pill shape", () => {
      const { container } = render(<Badge>Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("rounded-full");
    });

    it("has proper padding for content", () => {
      const { container } = render(<Badge>Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("px-2.5", "py-0.5");
    });
  });

  describe("Edge Cases", () => {
    it("handles very long text", () => {
      const longText = "This is a very long badge text that might overflow";
      render(<Badge>{longText}</Badge>);

      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it("handles boolean children (renders nothing)", () => {
      const { container } = render(<Badge>{true}</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeEmptyDOMElement();
    });

    it("handles null children", () => {
      const { container } = render(<Badge>{null}</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeEmptyDOMElement();
    });

    it("handles undefined children", () => {
      const { container } = render(<Badge>{undefined}</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toBeEmptyDOMElement();
    });

    it("handles zero as content", () => {
      render(<Badge>{0}</Badge>);

      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders notification badge", () => {
      render(
        <Badge variant="destructive" aria-label="5 unread notifications">
          5
        </Badge>,
      );

      expect(screen.getByText("5")).toBeInTheDocument();
      const badge = screen.getByLabelText("5 unread notifications");
      expect(badge).toHaveClass("bg-destructive");
    });

    it("renders status badge", () => {
      render(
        <Badge variant="success" role="status">
          Active
        </Badge>,
      );

      const badge = screen.getByRole("status");
      expect(badge).toHaveTextContent("Active");
      expect(badge).toHaveClass("bg-green-500");
    });

    it("renders category badge", () => {
      render(<Badge variant="outline">Technology</Badge>);

      expect(screen.getByText("Technology")).toBeInTheDocument();
    });

    it("renders priority badge", () => {
      render(
        <Badge variant="warning" title="High priority">
          High
        </Badge>,
      );

      const badge = screen.getByTitle("High priority");
      expect(badge).toHaveTextContent("High");
      expect(badge).toHaveClass("bg-yellow-500");
    });

    it("renders new feature badge", () => {
      render(<Badge variant="info">New</Badge>);

      expect(screen.getByText("New")).toBeInTheDocument();
    });

    it("renders badge with icon", () => {
      render(
        <Badge variant="success">
          <span aria-hidden>✓</span>
          <span>Verified</span>
        </Badge>,
      );

      expect(screen.getByText("Verified")).toBeInTheDocument();
    });

    it("renders count badge", () => {
      render(
        <Badge variant="default" aria-label="99 items">
          99+
        </Badge>,
      );

      expect(screen.getByText("99+")).toBeInTheDocument();
    });

    it("renders dismissible badge with onClick", () => {
      const handleDismiss = jest.fn();

      const { container } = render(
        <Badge variant="secondary" onClick={handleDismiss}>
          Dismissible
        </Badge>,
      );

      const badge = container.firstChild as HTMLElement;
      badge.click();

      expect(handleDismiss).toHaveBeenCalled();
    });
  });

  describe("Variant Hover States", () => {
    it("default variant has hover state", () => {
      const { container } = render(<Badge variant="default">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("hover:bg-primary/80");
    });

    it("secondary variant has hover state", () => {
      const { container } = render(<Badge variant="secondary">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("hover:bg-secondary/80");
    });

    it("destructive variant has hover state", () => {
      const { container } = render(<Badge variant="destructive">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("hover:bg-destructive/80");
    });

    it("success variant has hover state", () => {
      const { container } = render(<Badge variant="success">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("hover:bg-green-600");
    });

    it("warning variant has hover state", () => {
      const { container } = render(<Badge variant="warning">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("hover:bg-yellow-600");
    });

    it("info variant has hover state", () => {
      const { container } = render(<Badge variant="info">Badge</Badge>);

      const badge = container.firstChild as HTMLElement;
      expect(badge).toHaveClass("hover:bg-blue-600");
    });
  });

  describe("Multiple Badges", () => {
    it("renders multiple badges together", () => {
      render(
        <div>
          <Badge variant="default">Default</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
        </div>,
      );

      expect(screen.getByText("Default")).toBeInTheDocument();
      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("Warning")).toBeInTheDocument();
    });

    it("each badge maintains independent styling", () => {
      render(
        <div>
          <Badge variant="success">Success</Badge>
          <Badge variant="destructive">Error</Badge>
        </div>,
      );

      const successBadge = screen.getByText("Success");
      const destructiveBadge = screen.getByText("Error");
      expect(successBadge).toHaveClass("bg-green-500");
      expect(destructiveBadge).toHaveClass("bg-destructive");
    });
  });
});
