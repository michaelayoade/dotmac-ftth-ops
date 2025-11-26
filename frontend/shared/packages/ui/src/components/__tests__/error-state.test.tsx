/**
 * Error State Component Tests
 *
 * Tests ErrorState and ErrorBoundaryFallback components for error handling
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { XCircle, AlertTriangle } from "lucide-react";
import React from "react";

import { ErrorState, ErrorBoundaryFallback } from "../error-state";

describe("ErrorState", () => {
  describe("Basic Rendering", () => {
    it("renders error state with message", () => {
      render(<ErrorState message="An error occurred" />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
      expect(screen.getByText("An error occurred")).toBeInTheDocument();
    });

    it("renders with default title", () => {
      render(<ErrorState message="Test error" />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("renders with custom title", () => {
      render(<ErrorState title="Custom Error" message="Test error" />);

      expect(screen.getByText("Custom Error")).toBeInTheDocument();
      expect(screen.queryByText("Something went wrong")).not.toBeInTheDocument();
    });

    it("renders error icon by default", () => {
      const { container } = render(<ErrorState message="Test error" />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveClass("text-red-400");
    });

    it("renders custom icon", () => {
      const { container } = render(<ErrorState message="Test error" icon={XCircle} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("icon is aria-hidden", () => {
      const { container } = render(<ErrorState message="Test error" />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Retry Functionality", () => {
    it("does not show retry button when onRetry is not provided", () => {
      render(<ErrorState message="Test error" />);

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows retry button when onRetry is provided", () => {
      const onRetry = jest.fn();
      render(<ErrorState message="Test error" onRetry={onRetry} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });

    it("calls onRetry when retry button is clicked", async () => {
      const user = userEvent.setup();
      const onRetry = jest.fn();

      render(<ErrorState message="Test error" onRetry={onRetry} />);

      await user.click(screen.getByText("Try again"));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("renders custom retry label", () => {
      const onRetry = jest.fn();
      render(<ErrorState message="Test error" onRetry={onRetry} retryLabel="Reload" />);

      expect(screen.getByText("Reload")).toBeInTheDocument();
      expect(screen.queryByText("Try again")).not.toBeInTheDocument();
    });

    it("retry button has refresh icon", () => {
      const onRetry = jest.fn();
      render(<ErrorState message="Test error" onRetry={onRetry} />);

      const button = screen.getByRole("button");
      const icon = button.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("retry button has outline variant", () => {
      const onRetry = jest.fn();
      render(<ErrorState message="Test error" onRetry={onRetry} />);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border-red-800");
    });
  });

  describe("Variants", () => {
    it("renders card variant by default", () => {
      const { container } = render(<ErrorState message="Test error" />);

      const errorState = container.firstChild as HTMLElement;
      expect(errorState).toHaveClass("rounded-lg", "border", "bg-red-950/20", "p-6");
    });

    it("renders inline variant", () => {
      const { container } = render(<ErrorState message="Test error" variant="inline" />);

      const errorState = container.firstChild as HTMLElement;
      expect(errorState).toHaveClass("py-4");
      expect(errorState).not.toHaveClass("rounded-lg");
    });

    it("renders full variant", () => {
      const { container } = render(<ErrorState message="Test error" variant="full" />);

      const errorState = container.firstChild as HTMLElement;
      expect(errorState).toHaveClass("min-h-[400px]", "flex", "items-center", "justify-center");
    });
  });

  describe("Styling", () => {
    it("applies red color scheme", () => {
      const { container } = render(<ErrorState message="Test error" />);

      expect(container.querySelector(".text-red-200")).toBeInTheDocument();
      expect(container.querySelector(".text-red-300\\/80")).toBeInTheDocument();
      expect(container.querySelector(".text-red-400")).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<ErrorState message="Test error" className="custom-error" />);

      const errorState = container.firstChild as HTMLElement;
      expect(errorState).toHaveClass("custom-error");
    });

    it("icon has background circle", () => {
      const { container } = render(<ErrorState message="Test error" />);

      const iconWrapper = container.querySelector(".bg-red-900\\/30.rounded-full");
      expect(iconWrapper).toBeInTheDocument();
    });

    it("icon wrapper has animation", () => {
      const { container } = render(<ErrorState message="Test error" />);

      const iconWrapper = container.querySelector(".animate-in.fade-in.zoom-in");
      expect(iconWrapper).toBeInTheDocument();
    });

    it("content is centered", () => {
      const { container } = render(<ErrorState message="Test error" />);

      const content = container.querySelector(".flex.flex-col.items-center.justify-center");
      expect(content).toBeInTheDocument();
    });

    it("content has max-width", () => {
      const { container } = render(<ErrorState message="Test error" />);

      const content = container.querySelector(".max-w-md");
      expect(content).toBeInTheDocument();
    });

    it("title has semibold font", () => {
      render(<ErrorState message="Test error" />);

      const title = screen.getByText("Something went wrong");
      expect(title).toHaveClass("font-semibold");
    });

    it("message has smaller text", () => {
      render(<ErrorState message="Test error" />);

      const message = screen.getByText("Test error");
      expect(message).toHaveClass("text-sm");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders network error", () => {
      const onRetry = jest.fn();
      render(
        <ErrorState
          title="Network Error"
          message="Unable to connect to the server. Please check your internet connection."
          onRetry={onRetry}
          variant="card"
        />,
      );

      expect(screen.getByText("Network Error")).toBeInTheDocument();
      expect(
        screen.getByText("Unable to connect to the server. Please check your internet connection."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("renders permission denied error", () => {
      render(
        <ErrorState
          title="Access Denied"
          message="You do not have permission to view this resource."
          icon={AlertTriangle}
          variant="full"
        />,
      );

      expect(screen.getByText("Access Denied")).toBeInTheDocument();
      expect(
        screen.getByText("You do not have permission to view this resource."),
      ).toBeInTheDocument();
    });

    it("renders inline validation error", () => {
      render(
        <ErrorState
          message="Please fix the errors in the form before submitting."
          variant="inline"
        />,
      );

      expect(
        screen.getByText("Please fix the errors in the form before submitting."),
      ).toBeInTheDocument();
    });

    it("renders API error with retry", async () => {
      const user = userEvent.setup();
      const onRetry = jest.fn();

      render(
        <ErrorState
          title="Failed to load data"
          message="An error occurred while fetching data from the server."
          onRetry={onRetry}
          retryLabel="Retry request"
        />,
      );

      expect(screen.getByText("Failed to load data")).toBeInTheDocument();
      expect(
        screen.getByText("An error occurred while fetching data from the server."),
      ).toBeInTheDocument();

      await user.click(screen.getByText("Retry request"));
      expect(onRetry).toHaveBeenCalled();
    });

    it("renders not found error", () => {
      render(
        <ErrorState
          title="404 - Not Found"
          message="The page you are looking for does not exist."
          variant="full"
        />,
      );

      expect(screen.getByText("404 - Not Found")).toBeInTheDocument();
      expect(screen.getByText("The page you are looking for does not exist.")).toBeInTheDocument();
    });
  });

  describe("Multiple Retries", () => {
    it("allows multiple retry attempts", async () => {
      const user = userEvent.setup();
      const onRetry = jest.fn();

      render(<ErrorState message="Test error" onRetry={onRetry} />);

      const button = screen.getByRole("button");

      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(onRetry).toHaveBeenCalledTimes(3);
    });
  });

  describe("Custom Icons", () => {
    it("renders with AlertTriangle icon", () => {
      const { container } = render(<ErrorState message="Test error" icon={AlertTriangle} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("renders with XCircle icon", () => {
      const { container } = render(<ErrorState message="Test error" icon={XCircle} />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });
  });
});

describe("ErrorBoundaryFallback", () => {
  describe("Basic Rendering", () => {
    it("renders error boundary fallback", () => {
      const error = new Error("Component crashed");
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      expect(screen.getByText("Unexpected Error")).toBeInTheDocument();
      expect(screen.getByText("Component crashed")).toBeInTheDocument();
    });

    it("renders default message when error has no message", () => {
      const error = new Error();
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      expect(screen.getByText("Unexpected Error")).toBeInTheDocument();
      expect(
        screen.getByText("An unexpected error occurred while loading this component."),
      ).toBeInTheDocument();
    });

    it("uses full variant", () => {
      const error = new Error("Test error");
      const resetErrorBoundary = jest.fn();
      const { container } = render(
        <ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />,
      );

      const errorState = container.firstChild as HTMLElement;
      expect(errorState).toHaveClass("min-h-[400px]");
    });

    it("shows retry button", () => {
      const error = new Error("Test error");
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });
  });

  describe("Reset Functionality", () => {
    it("calls resetErrorBoundary when retry is clicked", async () => {
      const user = userEvent.setup();
      const error = new Error("Test error");
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      await user.click(screen.getByText("Try again"));

      expect(resetErrorBoundary).toHaveBeenCalledTimes(1);
    });

    it("allows multiple reset attempts", async () => {
      const user = userEvent.setup();
      const error = new Error("Test error");
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      const button = screen.getByRole("button");
      await user.click(button);
      await user.click(button);

      expect(resetErrorBoundary).toHaveBeenCalledTimes(2);
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders component initialization error", () => {
      const error = new Error("Failed to initialize component");
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      expect(screen.getByText("Failed to initialize component")).toBeInTheDocument();
    });

    it("renders data fetching error", () => {
      const error = new Error("Unable to fetch required data");
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      expect(screen.getByText("Unable to fetch required data")).toBeInTheDocument();
    });

    it("renders rendering error", () => {
      const error = new Error("Cannot read property 'map' of undefined");
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      expect(screen.getByText("Cannot read property 'map' of undefined")).toBeInTheDocument();
    });
  });

  describe("Error Object Variations", () => {
    it("handles error with long message", () => {
      const longMessage =
        "This is a very long error message that describes in detail what went wrong with the component initialization process and provides context about the failure";
      const error = new Error(longMessage);
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it("handles error with special characters", () => {
      const error = new Error("Error: <Component> failed to render");
      const resetErrorBoundary = jest.fn();

      render(<ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />);

      expect(screen.getByText("Error: <Component> failed to render")).toBeInTheDocument();
    });
  });
});

describe("Integration Tests", () => {
  it("ErrorState and ErrorBoundaryFallback use same underlying component", () => {
    const error = new Error("Test error");
    const resetErrorBoundary = jest.fn();
    const onRetry = jest.fn();

    const { container: boundaryContainer } = render(
      <ErrorBoundaryFallback error={error} resetErrorBoundary={resetErrorBoundary} />,
    );

    const { container: stateContainer } = render(
      <ErrorState title="Unexpected Error" message="Test error" onRetry={onRetry} variant="full" />,
    );

    // Both should have similar structure
    expect(boundaryContainer.querySelector(".text-red-400")).toBeInTheDocument();
    expect(stateContainer.querySelector(".text-red-400")).toBeInTheDocument();
  });
});
