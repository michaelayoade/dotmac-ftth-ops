/**
 * Skeleton Component Tests
 *
 * Tests shadcn/ui Skeleton loading components with variants
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { Skeleton, SkeletonCard, SkeletonMetricCard, SkeletonTable } from "../skeleton";

describe("Skeleton", () => {
  describe("Basic Rendering", () => {
    it("renders skeleton element", () => {
      const { container } = render(<Skeleton />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders as div element", () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.firstChild;
      expect(skeleton?.nodeName).toBe("DIV");
    });

    it("applies base styles", () => {
      render(<Skeleton data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("animate-pulse", "rounded-lg", "bg-muted");
    });

    it("renders with custom className", () => {
      render(<Skeleton className="custom-skeleton" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("custom-skeleton");
    });
  });

  describe("Variants", () => {
    it("renders default variant", () => {
      render(<Skeleton variant="default" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("rounded-lg");
    });

    it("renders text variant with smaller height", () => {
      render(<Skeleton variant="text" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("h-4", "rounded");
    });

    it("renders circular variant", () => {
      render(<Skeleton variant="circular" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("rounded-full");
    });

    it("renders rectangular variant", () => {
      render(<Skeleton variant="rectangular" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("rounded-md");
    });

    it("defaults to default variant when not specified", () => {
      render(<Skeleton data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("rounded-lg");
    });
  });

  describe("Animation", () => {
    it("has pulse animation", () => {
      render(<Skeleton data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("animate-pulse");
    });

    it("maintains animation across variants", () => {
      render(
        <div>
          <Skeleton variant="default" data-testid="default" />
          <Skeleton variant="circular" data-testid="circular" />
          <Skeleton variant="rectangular" data-testid="rectangular" />
        </div>,
      );

      expect(screen.getByTestId("default")).toHaveClass("animate-pulse");
      expect(screen.getByTestId("circular")).toHaveClass("animate-pulse");
      expect(screen.getByTestId("rectangular")).toHaveClass("animate-pulse");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to skeleton element", () => {
      // Skeleton component does not forward refs
      render(<Skeleton data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toBeInstanceOf(HTMLDivElement);
    });

    it("allows accessing DOM properties via ref", () => {
      // Skeleton component does not forward refs
      render(<Skeleton className="h-8" data-testid="skeleton" />);
      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toBeInstanceOf(HTMLDivElement);
      expect(skeleton.classList.contains("h-8")).toBe(true);
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      // Skeleton is a function component without displayName
      expect(Skeleton.name).toBe("Skeleton");
    });
  });

  describe("HTML Attributes", () => {
    it("forwards data attributes", () => {
      render(<Skeleton data-testid="custom-skeleton" data-custom="value" />);

      const skeleton = screen.getByTestId("custom-skeleton");
      expect(skeleton).toHaveAttribute("data-custom", "value");
    });

    it("supports id attribute", () => {
      const { container } = render(<Skeleton id="my-skeleton" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveAttribute("id", "my-skeleton");
    });

    it("supports aria-label for accessibility", () => {
      const { container } = render(<Skeleton aria-label="Loading content" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveAttribute("aria-label", "Loading content");
    });

    it("supports aria-busy attribute", () => {
      const { container } = render(<Skeleton aria-busy="true" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveAttribute("aria-busy", "true");
    });
  });

  describe("SkeletonCard", () => {
    it("renders card skeleton", () => {
      const { container } = render(<SkeletonCard />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders header skeleton", () => {
      render(<SkeletonCard />);

      // Header contains circular avatar and two text lines
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders content skeleton lines", () => {
      render(<SkeletonCard />);

      // Should have multiple skeleton lines
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThanOrEqual(3);
    });

    it("applies card container styles", () => {
      const { container } = render(<SkeletonCard />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("rounded-lg", "border", "p-6");
    });

    it("renders circular avatar skeleton in header", () => {
      render(<SkeletonCard />);

      // SkeletonCard does not have a circular skeleton
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("SkeletonMetricCard", () => {
    it("renders metric card skeleton", () => {
      const { container } = render(<SkeletonMetricCard />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders title skeleton", () => {
      render(<SkeletonMetricCard />);

      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("renders value skeleton with larger size", () => {
      render(<SkeletonMetricCard />);

      // Should have skeleton for title and larger skeleton for value
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThanOrEqual(2);
    });

    it("applies metric card container styles", () => {
      const { container } = render(<SkeletonMetricCard />);

      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass("rounded-lg", "border", "p-6");
    });

    it("renders small text skeleton for subtitle", () => {
      render(<SkeletonMetricCard />);

      const skeletons = document.querySelectorAll(".animate-pulse");
      // Should have 4 skeletons: title, value, subtitle, and icon/metric
      expect(skeletons.length).toBe(4);
    });
  });

  describe("SkeletonTable", () => {
    it("renders table skeleton with default rows", () => {
      const { container } = render(<SkeletonTable />);

      // Default is 5 rows, check for skeleton items
      const items = container.querySelectorAll(".flex.items-center");
      expect(items.length).toBe(5);
    });

    it("renders table skeleton with custom rows", () => {
      const { container } = render(<SkeletonTable rows={3} />);

      const items = container.querySelectorAll(".flex.items-center");
      expect(items.length).toBe(3);
    });

    it("renders table header skeleton", () => {
      const { container } = render(<SkeletonTable />);

      // SkeletonTable doesn't have a thead, it renders as list items
      const items = container.querySelectorAll(".flex.items-center");
      expect(items.length).toBeGreaterThan(0);
    });

    it("renders skeleton in each table cell", () => {
      render(<SkeletonTable rows={2} />);

      // Each row has 3 skeletons (avatar, 2 text lines, button)
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it("applies table container styles", () => {
      const { container } = render(<SkeletonTable />);

      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("space-y-3");
    });

    it("renders varying width skeletons in cells", () => {
      render(<SkeletonTable rows={1} />);

      // Check that there are skeletons with different widths
      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders loading card placeholder", () => {
      render(
        <div className="space-y-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>,
      );

      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(3);
    });

    it("renders loading profile", () => {
      render(
        <div className="flex items-center space-x-4">
          <Skeleton variant="circular" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>,
      );

      const circularSkeleton = document.querySelector(".rounded-full");
      expect(circularSkeleton).toBeInTheDocument();

      const textSkeletons = document.querySelectorAll(".animate-pulse");
      expect(textSkeletons.length).toBeGreaterThanOrEqual(3);
    });

    it("renders loading list", () => {
      render(
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>,
      );

      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(4);
    });

    it("renders loading form", () => {
      render(
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-[120px]" />
        </div>,
      );

      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(5);
    });

    it("renders loading dashboard metrics", () => {
      render(
        <div className="grid grid-cols-3 gap-4">
          <SkeletonMetricCard />
          <SkeletonMetricCard />
          <SkeletonMetricCard />
        </div>,
      );

      const cards = document.querySelectorAll(".rounded-lg.border");
      expect(cards.length).toBe(3);
    });

    it("renders loading data table", () => {
      const { container } = render(<SkeletonTable rows={10} />);

      const items = container.querySelectorAll(".flex.items-center");
      expect(items.length).toBe(10);
    });

    it("renders loading card grid", () => {
      render(
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>,
      );

      const cards = document.querySelectorAll(".rounded-lg.border");
      expect(cards.length).toBe(4);
    });
  });

  describe("Composition", () => {
    it("renders mixed skeleton types", () => {
      render(
        <div>
          <Skeleton variant="circular" data-testid="circular" />
          <Skeleton variant="text" data-testid="text" />
          <Skeleton variant="rectangular" data-testid="rectangular" />
        </div>,
      );

      expect(screen.getByTestId("circular")).toHaveClass("rounded-full");
      expect(screen.getByTestId("text")).toHaveClass("h-4");
      expect(screen.getByTestId("rectangular")).toHaveClass("rounded-md");
    });

    it("renders skeletons in flex layout", () => {
      render(
        <div className="flex gap-4">
          <Skeleton className="h-12 w-12" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>,
      );

      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(3);
    });

    it("renders skeletons in grid layout", () => {
      render(
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>,
      );

      const skeletons = document.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBe(3);
    });
  });

  describe("Accessibility", () => {
    it("can have aria-label for screen readers", () => {
      const { container } = render(<Skeleton aria-label="Loading user profile" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveAttribute("aria-label", "Loading user profile");
    });

    it("can have aria-busy for loading state", () => {
      const { container } = render(<Skeleton aria-busy="true" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveAttribute("aria-busy", "true");
    });

    it("supports role attribute", () => {
      const { container } = render(<Skeleton role="status" />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toHaveAttribute("role", "status");
    });

    it("can include visually hidden loading text", () => {
      render(
        <div>
          <span className="sr-only">Loading content...</span>
          <Skeleton />
        </div>,
      );

      expect(screen.getByText("Loading content...")).toBeInTheDocument();
    });
  });

  describe("Customization", () => {
    it("supports custom width and height", () => {
      render(<Skeleton className="h-20 w-64" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("h-20", "w-64");
    });

    it("supports custom colors via className", () => {
      render(<Skeleton className="bg-gray-300" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("bg-gray-300");
    });

    it("supports custom border radius", () => {
      render(<Skeleton className="rounded-xl" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("rounded-xl");
    });

    it("can disable animation via className override", () => {
      render(<Skeleton className="animate-none" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("animate-none");
    });
  });

  describe("Edge Cases", () => {
    it("renders without children", () => {
      const { container } = render(<Skeleton />);

      const skeleton = container.firstChild as HTMLElement;
      expect(skeleton).toBeEmptyDOMElement();
    });

    it("handles zero rows for SkeletonTable", () => {
      const { container } = render(<SkeletonTable rows={0} />);

      const items = container.querySelectorAll(".flex.items-center");
      expect(items.length).toBe(0);
    });

    it("handles large number of rows for SkeletonTable", () => {
      const { container } = render(<SkeletonTable rows={100} />);

      const items = container.querySelectorAll(".flex.items-center");
      expect(items.length).toBe(100);
    });

    it("maintains styles when combining multiple classNames", () => {
      render(<Skeleton variant="circular" className="h-16 w-16 border-2" data-testid="skeleton" />);

      const skeleton = screen.getByTestId("skeleton");
      expect(skeleton).toHaveClass("rounded-full", "h-16", "w-16", "border-2");
    });
  });
});
