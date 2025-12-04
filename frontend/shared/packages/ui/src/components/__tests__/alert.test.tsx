/**
 * Alert Component Tests
 *
 * Tests shadcn/ui Alert primitive with variants and composition
 */

import { render, screen } from "@testing-library/react";
import { Info, AlertCircle, CheckCircle, AlertTriangle } from "lucide-react";
import React from "react";

import { Alert, AlertTitle, AlertDescription } from "../alert";

describe("Alert", () => {
  describe("Basic Rendering", () => {
    it("renders alert with content", () => {
      render(<Alert>Alert content</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent("Alert content");
    });

    it("renders with custom className", () => {
      render(<Alert className="custom-class">Content</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("custom-class");
    });

    it("applies base styles", () => {
      render(<Alert>Content</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("relative", "w-full", "rounded-lg", "border", "p-4");
    });
  });

  describe("Variants", () => {
    it("renders default variant", () => {
      render(<Alert variant="default">Default alert</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("bg-background", "text-foreground", "border-border");
    });

    it("renders destructive variant", () => {
      render(<Alert variant="destructive">Error alert</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("border-destructive/50", "text-destructive");
    });

    it("renders success variant", () => {
      render(<Alert variant="success">Success alert</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("border-green-500/50", "text-green-700");
    });

    it("renders warning variant", () => {
      render(<Alert variant="warning">Warning alert</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("border-yellow-500/50", "text-yellow-700");
    });

    it("renders info variant", () => {
      render(<Alert variant="info">Info alert</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("border-blue-500/50", "text-blue-700");
    });

    it("defaults to default variant when not specified", () => {
      render(<Alert>Content</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("bg-background");
    });
  });

  describe("AlertTitle", () => {
    it("renders alert title", () => {
      render(
        <Alert>
          <AlertTitle>Alert Title</AlertTitle>
        </Alert>,
      );

      expect(screen.getByText("Alert Title")).toBeInTheDocument();
    });

    it("renders as h5 element", () => {
      render(
        <Alert>
          <AlertTitle>Title</AlertTitle>
        </Alert>,
      );

      const title = screen.getByText("Title");
      expect(title.tagName).toBe("H5");
    });

    it("applies title styles", () => {
      render(
        <Alert>
          <AlertTitle>Title</AlertTitle>
        </Alert>,
      );

      const title = screen.getByText("Title");
      expect(title).toHaveClass("mb-1", "font-medium", "leading-none", "tracking-tight");
    });

    it("supports custom className", () => {
      render(
        <Alert>
          <AlertTitle className="custom-title">Title</AlertTitle>
        </Alert>,
      );

      const title = screen.getByText("Title");
      expect(title).toHaveClass("custom-title");
    });
  });

  describe("AlertDescription", () => {
    it("renders alert description", () => {
      render(
        <Alert>
          <AlertDescription>This is the alert description</AlertDescription>
        </Alert>,
      );

      expect(screen.getByText("This is the alert description")).toBeInTheDocument();
    });

    it("renders as div element", () => {
      render(
        <Alert>
          <AlertDescription>Description</AlertDescription>
        </Alert>,
      );

      const description = screen.getByText("Description");
      expect(description.tagName).toBe("DIV");
    });

    it("applies description styles", () => {
      render(
        <Alert>
          <AlertDescription>Description</AlertDescription>
        </Alert>,
      );

      const description = screen.getByText("Description");
      expect(description).toHaveClass("text-sm");
    });

    it("supports custom className", () => {
      render(
        <Alert>
          <AlertDescription className="custom-desc">Description</AlertDescription>
        </Alert>,
      );

      const description = screen.getByText("Description");
      expect(description).toHaveClass("custom-desc");
    });
  });

  describe("Composition", () => {
    it("renders Alert with Title and Description", () => {
      render(
        <Alert>
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Your changes have been saved successfully.</AlertDescription>
        </Alert>,
      );

      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("Your changes have been saved successfully.")).toBeInTheDocument();
    });

    it("renders Alert with icon, title, and description", () => {
      render(
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Operation completed.</AlertDescription>
        </Alert>,
      );

      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("Operation completed.")).toBeInTheDocument();
    });

    it("renders destructive alert with icon", () => {
      render(
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Something went wrong.</AlertDescription>
        </Alert>,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("border-destructive/50");
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    });

    it("renders warning alert with icon", () => {
      render(
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Warning</AlertTitle>
          <AlertDescription>Please review your input.</AlertDescription>
        </Alert>,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("border-yellow-500/50");
      expect(screen.getByText("Warning")).toBeInTheDocument();
    });

    it("renders info alert with icon", () => {
      render(
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertTitle>Information</AlertTitle>
          <AlertDescription>Here&apos;s some helpful information.</AlertDescription>
        </Alert>,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("border-blue-500/50");
      expect(screen.getByText("Information")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it('has role="alert" attribute', () => {
      render(<Alert>Alert content</Alert>);

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("is accessible with screen readers", () => {
      render(
        <Alert>
          <AlertTitle>Important Notice</AlertTitle>
          <AlertDescription>This is an important message for users.</AlertDescription>
        </Alert>,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toHaveTextContent("Important Notice");
      expect(alert).toHaveTextContent("This is an important message for users.");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to Alert div", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Alert ref={ref}>Content</Alert>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveAttribute("role", "alert");
    });

    it("forwards ref to AlertTitle h5", () => {
      const ref = React.createRef<HTMLParagraphElement>();

      render(
        <Alert>
          <AlertTitle ref={ref}>Title</AlertTitle>
        </Alert>,
      );

      expect(ref.current).toBeInstanceOf(HTMLHeadingElement);
      expect(ref.current?.tagName).toBe("H5");
    });

    it("forwards ref to AlertDescription div", () => {
      const ref = React.createRef<HTMLParagraphElement>();

      render(
        <Alert>
          <AlertDescription ref={ref}>Description</AlertDescription>
        </Alert>,
      );

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("HTML Attributes", () => {
    it("forwards data attributes to Alert", () => {
      render(
        <Alert data-testid="custom-alert" data-custom="value">
          Content
        </Alert>,
      );

      const alert = screen.getByTestId("custom-alert");
      expect(alert).toHaveAttribute("data-custom", "value");
    });

    it("forwards data attributes to AlertTitle", () => {
      render(
        <Alert>
          <AlertTitle data-testid="custom-title" data-custom="value">
            Title
          </AlertTitle>
        </Alert>,
      );

      const title = screen.getByTestId("custom-title");
      expect(title).toHaveAttribute("data-custom", "value");
    });

    it("forwards data attributes to AlertDescription", () => {
      render(
        <Alert>
          <AlertDescription data-testid="custom-desc" data-custom="value">
            Description
          </AlertDescription>
        </Alert>,
      );

      const description = screen.getByTestId("custom-desc");
      expect(description).toHaveAttribute("data-custom", "value");
    });

    it("supports id attribute", () => {
      render(<Alert id="my-alert">Content</Alert>);

      const alert = screen.getByRole("alert");
      expect(alert).toHaveAttribute("id", "my-alert");
    });
  });

  describe("Display Names", () => {
    it("has correct display name for Alert", () => {
      expect(Alert.displayName).toBe("Alert");
    });

    it("has correct display name for AlertTitle", () => {
      expect(AlertTitle.displayName).toBe("AlertTitle");
    });

    it("has correct display name for AlertDescription", () => {
      expect(AlertDescription.displayName).toBe("AlertDescription");
    });
  });

  describe("Edge Cases", () => {
    it("renders empty Alert", () => {
      render(<Alert />);

      const alert = screen.getByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(alert).toBeEmptyDOMElement();
    });

    it("renders AlertTitle without AlertDescription", () => {
      render(
        <Alert>
          <AlertTitle>Title Only</AlertTitle>
        </Alert>,
      );

      expect(screen.getByText("Title Only")).toBeInTheDocument();
      expect(screen.queryByRole("paragraph")).not.toBeInTheDocument();
    });

    it("renders AlertDescription without AlertTitle", () => {
      render(
        <Alert>
          <AlertDescription>Description Only</AlertDescription>
        </Alert>,
      );

      expect(screen.getByText("Description Only")).toBeInTheDocument();
    });

    it("handles multiple AlertDescriptions", () => {
      render(
        <Alert>
          <AlertTitle>Title</AlertTitle>
          <AlertDescription>First paragraph</AlertDescription>
          <AlertDescription>Second paragraph</AlertDescription>
        </Alert>,
      );

      expect(screen.getByText("First paragraph")).toBeInTheDocument();
      expect(screen.getByText("Second paragraph")).toBeInTheDocument();
    });

    it("handles complex children in AlertDescription", () => {
      render(
        <Alert>
          <AlertDescription>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
          </AlertDescription>
        </Alert>,
      );

      expect(screen.getByText("Paragraph 1")).toBeInTheDocument();
      expect(screen.getByText("Paragraph 2")).toBeInTheDocument();
    });

    it("preserves spacing with [&_p]:leading-relaxed class", () => {
      render(
        <Alert>
          <AlertDescription>
            <p>Relaxed paragraph</p>
          </AlertDescription>
        </Alert>,
      );

      const description = screen.getByText("Relaxed paragraph").parentElement;
      expect(description).toHaveClass("[&_p]:leading-relaxed");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders success notification", () => {
      render(
        <Alert variant="success">
          <CheckCircle className="h-4 w-4" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>Your profile has been updated.</AlertDescription>
        </Alert>,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("border-green-500/50");
      expect(screen.getByText("Success")).toBeInTheDocument();
      expect(screen.getByText("Your profile has been updated.")).toBeInTheDocument();
    });

    it("renders error notification", () => {
      render(
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to save changes. Please try again.</AlertDescription>
        </Alert>,
      );

      const alert = screen.getByRole("alert");
      expect(alert).toHaveClass("text-destructive");
      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Failed to save changes. Please try again.")).toBeInTheDocument();
    });

    it("renders warning with action instructions", () => {
      render(
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Storage Almost Full</AlertTitle>
          <AlertDescription>
            You&apos;ve used 95% of your storage. Consider upgrading your plan.
          </AlertDescription>
        </Alert>,
      );

      expect(screen.getByText("Storage Almost Full")).toBeInTheDocument();
      expect(
        screen.getByText("You've used 95% of your storage. Consider upgrading your plan."),
      ).toBeInTheDocument();
    });

    it("renders informational notice", () => {
      render(
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertTitle>New Features Available</AlertTitle>
          <AlertDescription>Check out the latest updates in your dashboard.</AlertDescription>
        </Alert>,
      );

      expect(screen.getByText("New Features Available")).toBeInTheDocument();
      expect(
        screen.getByText("Check out the latest updates in your dashboard."),
      ).toBeInTheDocument();
    });
  });
});
