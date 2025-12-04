/**
 * Loading Overlay Component Tests
 *
 * Tests LoadingOverlay and InlineLoader components
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { LoadingOverlay, InlineLoader } from "../loading-overlay";

describe("LoadingOverlay", () => {
  describe("Basic Rendering", () => {
    it("renders loading overlay when loading is true", () => {
      const { container } = render(<LoadingOverlay loading={true} />);

      const overlay = container.querySelector(".absolute.inset-0");
      expect(overlay).toBeInTheDocument();
    });

    it("does not render when loading is false", () => {
      const { container } = render(<LoadingOverlay loading={false} />);

      expect(container.firstChild).toBeNull();
    });

    it("renders by default when loading prop not provided", () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.querySelector(".absolute.inset-0");
      expect(overlay).toBeInTheDocument();
    });
  });

  describe("Variants", () => {
    it("renders spinner variant by default", () => {
      const { container } = render(<LoadingOverlay />);

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("renders spinner variant explicitly", () => {
      const { container } = render(<LoadingOverlay variant="spinner" />);

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });

    it("renders pulse variant", () => {
      const { container } = render(<LoadingOverlay variant="pulse" />);

      const pulse = container.querySelector(".animate-pulse");
      expect(pulse).toBeInTheDocument();
    });

    it("renders dots variant", () => {
      const { container } = render(<LoadingOverlay variant="dots" />);

      const dots = container.querySelectorAll(".animate-bounce");
      expect(dots.length).toBe(3);
    });

    it("dots have staggered animation delays", () => {
      const { container } = render(<LoadingOverlay variant="dots" />);

      const dots = container.querySelectorAll(".animate-bounce");
      expect(dots[0]).toHaveStyle({ animationDelay: "0ms" });
      expect(dots[1]).toHaveStyle({ animationDelay: "150ms" });
      expect(dots[2]).toHaveStyle({ animationDelay: "300ms" });
    });
  });

  describe("Sizes", () => {
    it("renders medium size by default", () => {
      const { container } = render(<LoadingOverlay variant="spinner" />);

      const spinner = container.querySelector(".h-8.w-8");
      expect(spinner).toBeInTheDocument();
    });

    it("renders small size", () => {
      const { container } = render(<LoadingOverlay variant="spinner" size="sm" />);

      const spinner = container.querySelector(".h-4.w-4");
      expect(spinner).toBeInTheDocument();
    });

    it("renders large size", () => {
      const { container } = render(<LoadingOverlay variant="spinner" size="lg" />);

      const spinner = container.querySelector(".h-12.w-12");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Message Display", () => {
    it("does not show message by default", () => {
      render(<LoadingOverlay />);

      expect(screen.queryByText(/./)).toBeNull(); // No text content
    });

    it("shows custom message when provided", () => {
      render(<LoadingOverlay message="Loading data..." />);

      expect(screen.getByText("Loading data...")).toBeInTheDocument();
    });

    it("message has correct styling", () => {
      render(<LoadingOverlay message="Loading..." />);

      const message = screen.getByText("Loading...");
      expect(message).toHaveClass("text-sm", "text-muted-foreground");
    });

    it("message has animation", () => {
      render(<LoadingOverlay message="Loading..." />);

      const message = screen.getByText("Loading...");
      expect(message).toHaveClass("animate-in", "slide-in-from-bottom-2");
    });
  });

  describe("Styling", () => {
    it("has absolute positioning", () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.firstChild;
      expect(overlay).toHaveClass("absolute", "inset-0");
    });

    it("has backdrop blur", () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.firstChild;
      expect(overlay).toHaveClass("backdrop-blur-sm");
    });

    it("has semi-transparent background", () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.firstChild;
      expect(overlay).toHaveClass("bg-card/80");
    });

    it("is centered", () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.firstChild;
      expect(overlay).toHaveClass("flex", "items-center", "justify-center");
    });

    it("has high z-index", () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.firstChild;
      expect(overlay).toHaveClass("z-50");
    });

    it("has rounded corners", () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.firstChild;
      expect(overlay).toHaveClass("rounded-lg");
    });

    it("has fade-in animation", () => {
      const { container } = render(<LoadingOverlay />);

      const overlay = container.firstChild;
      expect(overlay).toHaveClass("animate-in", "fade-in");
    });

    it("applies custom className", () => {
      const { container } = render(<LoadingOverlay className="custom-overlay" />);

      const overlay = container.firstChild;
      expect(overlay).toHaveClass("custom-overlay");
    });
  });

  describe("Icon Styling", () => {
    it("spinner has sky color", () => {
      const { container } = render(<LoadingOverlay variant="spinner" />);

      const spinner = container.querySelector(".text-sky-400");
      expect(spinner).toBeInTheDocument();
    });

    it("pulse has sky color", () => {
      const { container } = render(<LoadingOverlay variant="pulse" />);

      const pulse = container.querySelector(".bg-sky-400");
      expect(pulse).toBeInTheDocument();
    });

    it("dots have sky color", () => {
      const { container } = render(<LoadingOverlay variant="dots" />);

      const dots = container.querySelectorAll(".bg-sky-400");
      expect(dots.length).toBe(3);
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders over card content", () => {
      render(
        <div style={{ position: "relative" }}>
          <div>Card Content</div>
          <LoadingOverlay loading={true} message="Loading..." />
        </div>,
      );

      expect(screen.getByText("Card Content")).toBeInTheDocument();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("shows while data is fetching", () => {
      const { rerender } = render(<LoadingOverlay loading={true} message="Fetching data..." />);

      expect(screen.getByText("Fetching data...")).toBeInTheDocument();

      rerender(<LoadingOverlay loading={false} />);

      expect(screen.queryByText("Fetching data...")).not.toBeInTheDocument();
    });

    it("indicates form submission in progress", () => {
      render(<LoadingOverlay loading={true} message="Submitting..." variant="spinner" />);

      expect(screen.getByText("Submitting...")).toBeInTheDocument();
    });
  });

  describe("Conditional Rendering", () => {
    it("can be toggled on and off", () => {
      const { rerender } = render(<LoadingOverlay loading={false} />);

      expect(screen.queryByRole("img")).not.toBeInTheDocument();

      rerender(<LoadingOverlay loading={true} />);

      const { container } = render(<LoadingOverlay loading={true} />);
      expect(container.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });
});

describe("InlineLoader", () => {
  describe("Basic Rendering", () => {
    it("renders inline loader", () => {
      const { container } = render(<InlineLoader />);

      const loader = container.querySelector(".flex.items-center");
      expect(loader).toBeInTheDocument();
    });

    it("renders spinner icon", () => {
      const { container } = render(<InlineLoader />);

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Sizes", () => {
    it("renders medium size by default", () => {
      const { container } = render(<InlineLoader />);

      const spinner = container.querySelector(".h-6.w-6");
      expect(spinner).toBeInTheDocument();
    });

    it("renders small size", () => {
      const { container } = render(<InlineLoader size="sm" />);

      const spinner = container.querySelector(".h-4.w-4");
      expect(spinner).toBeInTheDocument();
    });

    it("renders large size", () => {
      const { container } = render(<InlineLoader size="lg" />);

      const spinner = container.querySelector(".h-8.w-8");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Message Display", () => {
    it("does not show message by default", () => {
      const { container } = render(<InlineLoader />);

      const text = container.querySelector("span");
      expect(text).not.toBeInTheDocument();
    });

    it("shows custom message when provided", () => {
      render(<InlineLoader message="Loading..." />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("message has correct styling", () => {
      render(<InlineLoader message="Please wait..." />);

      const message = screen.getByText("Please wait...");
      expect(message).toHaveClass("text-sm", "text-muted-foreground");
    });
  });

  describe("Styling", () => {
    it("has flex layout", () => {
      const { container } = render(<InlineLoader />);

      const loader = container.firstChild;
      expect(loader).toHaveClass("flex", "items-center");
    });

    it("has gap between spinner and message", () => {
      const { container } = render(<InlineLoader message="Loading..." />);

      const loader = container.firstChild;
      expect(loader).toHaveClass("gap-3");
    });

    it("spinner has sky color", () => {
      const { container } = render(<InlineLoader />);

      const spinner = container.querySelector(".text-sky-400");
      expect(spinner).toBeInTheDocument();
    });

    it("applies custom className", () => {
      const { container } = render(<InlineLoader className="custom-loader" />);

      const loader = container.firstChild;
      expect(loader).toHaveClass("custom-loader");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders in button", () => {
      render(
        <button>
          <InlineLoader size="sm" message="Saving..." />
        </button>,
      );

      expect(screen.getByText("Saving...")).toBeInTheDocument();
    });

    it("renders inline with text", () => {
      render(
        <div>
          <InlineLoader size="sm" /> <span>Processing request...</span>
        </div>,
      );

      expect(screen.getByText("Processing request...")).toBeInTheDocument();
    });

    it("indicates background operation", () => {
      render(<InlineLoader message="Syncing data..." size="sm" />);

      expect(screen.getByText("Syncing data...")).toBeInTheDocument();
    });
  });

  describe("Integration", () => {
    it("works alongside LoadingOverlay", () => {
      render(
        <div>
          <LoadingOverlay loading={false} />
          <InlineLoader message="Loading items..." />
        </div>,
      );

      expect(screen.getByText("Loading items...")).toBeInTheDocument();
    });
  });

  describe("Animation", () => {
    it("spinner rotates continuously", () => {
      const { container } = render(<InlineLoader />);

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("provides context through message", () => {
      render(<InlineLoader message="Loading data..." />);

      const message = screen.getByText("Loading data...");
      expect(message).toBeInTheDocument();
    });
  });
});

describe("LoadingOverlay and InlineLoader Together", () => {
  it("can be used in same component", () => {
    render(
      <div>
        <div style={{ position: "relative" }}>
          <LoadingOverlay loading={true} message="Loading main content..." />
        </div>
        <div>
          <InlineLoader message="Loading sidebar..." />
        </div>
      </div>,
    );

    expect(screen.getByText("Loading main content...")).toBeInTheDocument();
    expect(screen.getByText("Loading sidebar...")).toBeInTheDocument();
  });

  it("different loading states for different sections", () => {
    render(
      <div>
        <div style={{ position: "relative" }}>
          <LoadingOverlay loading={false} />
          <div>Main Content</div>
        </div>
        <InlineLoader message="Loading additional data..." size="sm" />
      </div>,
    );

    expect(screen.getByText("Main Content")).toBeInTheDocument();
    expect(screen.getByText("Loading additional data...")).toBeInTheDocument();
  });
});
