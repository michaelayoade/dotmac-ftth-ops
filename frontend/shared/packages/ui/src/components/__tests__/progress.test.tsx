/**
 * Progress Component Tests
 *
 * Tests shadcn/ui Progress component
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { Progress } from "../progress";

describe("Progress", () => {
  describe("Basic Rendering", () => {
    it("renders progress container", () => {
      const { container } = render(<Progress />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders as div element", () => {
      render(<Progress data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress.tagName).toBe("DIV");
    });

    it("applies base styles", () => {
      render(<Progress data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveClass(
        "relative",
        "h-2",
        "w-full",
        "overflow-hidden",
        "rounded-full",
        "bg-muted",
      );
    });

    it("renders with custom className", () => {
      render(<Progress className="custom-progress" data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveClass("custom-progress");
    });

    it("renders indicator element", () => {
      const { container } = render(<Progress />);

      const indicator = container.querySelector(".h-full.transition-all");
      expect(indicator).toBeInTheDocument();
    });
  });

  describe("Value Prop", () => {
    it("renders with 0% progress by default", () => {
      const { container } = render(<Progress />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "0%" });
    });

    it("renders with specified progress value", () => {
      const { container } = render(<Progress value={50} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "50%" });
    });

    it("renders full progress at 100", () => {
      const { container } = render(<Progress value={100} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "100%" });
    });

    it("renders partial progress values", () => {
      const { container } = render(<Progress value={75} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "75%" });
    });

    it("handles decimal progress values", () => {
      const { container } = render(<Progress value={33.33} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "33.33%" });
    });
  });

  describe("Value Constraints", () => {
    it("clamps value below 0 to 0%", () => {
      const { container } = render(<Progress value={-10} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "0%" });
    });

    it("clamps value above 100 to 100%", () => {
      const { container } = render(<Progress value={150} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "100%" });
    });

    it("handles value of 0", () => {
      const { container } = render(<Progress value={0} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "0%" });
    });

    it("handles value of 100", () => {
      const { container } = render(<Progress value={100} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "100%" });
    });
  });

  describe("Indicator Styling", () => {
    it("applies default indicator color", () => {
      const { container } = render(<Progress />);

      const indicator = container.querySelector(".h-full.transition-all");
      expect(indicator).toHaveClass("bg-sky-500");
    });

    it("supports custom indicator className", () => {
      const { container } = render(<Progress indicatorClassName="bg-green-500" />);

      const indicator = container.querySelector(".h-full.transition-all");
      expect(indicator).toHaveClass("bg-green-500");
      expect(indicator).not.toHaveClass("bg-sky-500");
    });

    it("has transition animation on indicator", () => {
      const { container } = render(<Progress />);

      const indicator = container.querySelector(".h-full.transition-all");
      expect(indicator).toHaveClass("transition-all");
    });
  });

  describe("Dynamic Updates", () => {
    it("updates progress when value changes", () => {
      const { container, rerender } = render(<Progress value={25} />);

      let indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "25%" });

      rerender(<Progress value={75} />);

      indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "75%" });
    });

    it("animates from 0 to 100", () => {
      const { container, rerender } = render(<Progress value={0} />);

      let indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "0%" });

      rerender(<Progress value={100} />);

      indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "100%" });
    });

    it("handles incremental updates", () => {
      const { container, rerender } = render(<Progress value={0} />);

      for (let i = 0; i <= 100; i += 10) {
        rerender(<Progress value={i} />);
        const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
        expect(indicator).toHaveStyle({ width: `${i}%` });
      }
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to progress container", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Progress ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("allows accessing DOM properties via ref", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Progress ref={ref} value={50} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.classList.contains("rounded-full")).toBe(true);
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      expect(Progress.displayName).toBe("Progress");
    });
  });

  describe("HTML Attributes", () => {
    it("supports id attribute", () => {
      const { container } = render(<Progress id="my-progress" />);

      const progress = container.firstChild as HTMLElement;
      expect(progress).toHaveAttribute("id", "my-progress");
    });

    it("forwards data attributes", () => {
      render(<Progress data-testid="custom-progress" data-custom="value" />);

      const progress = screen.getByTestId("custom-progress");
      expect(progress).toHaveAttribute("data-custom", "value");
    });

    it("supports aria-label for accessibility", () => {
      render(<Progress aria-label="Upload progress" data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveAttribute("aria-label", "Upload progress");
    });

    it("supports aria-valuenow attribute", () => {
      render(<Progress value={50} aria-valuenow={50} data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveAttribute("aria-valuenow", "50");
    });

    it("supports aria-valuemin and aria-valuemax", () => {
      render(<Progress value={50} aria-valuemin={0} aria-valuemax={100} data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveAttribute("aria-valuemin", "0");
      expect(progress).toHaveAttribute("aria-valuemax", "100");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders file upload progress", () => {
      render(
        <div>
          <div className="flex justify-between mb-2">
            <span>Uploading file.pdf</span>
            <span>65%</span>
          </div>
          <Progress value={65} />
        </div>,
      );

      expect(screen.getByText("Uploading file.pdf")).toBeInTheDocument();
      expect(screen.getByText("65%")).toBeInTheDocument();
    });

    it("renders download progress", () => {
      render(
        <div>
          <label htmlFor="download-progress">Download Progress</label>
          <Progress id="download-progress" value={80} aria-label="Download 80% complete" />
        </div>,
      );

      expect(screen.getByText("Download Progress")).toBeInTheDocument();
    });

    it("renders task completion progress", () => {
      render(
        <div>
          <h3>Task Progress</h3>
          <p className="text-sm text-muted-foreground">3 of 5 tasks completed</p>
          <Progress value={60} indicatorClassName="bg-green-500" />
        </div>,
      );

      expect(screen.getByText("Task Progress")).toBeInTheDocument();
      expect(screen.getByText("3 of 5 tasks completed")).toBeInTheDocument();
    });

    it("renders loading indicator", () => {
      render(
        <div>
          <p>Loading...</p>
          <Progress value={45} />
        </div>,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("renders profile completion progress", () => {
      render(
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Profile Completion</span>
            <span className="text-sm text-muted-foreground">90%</span>
          </div>
          <Progress value={90} indicatorClassName="bg-blue-500" />
          <p className="text-xs text-muted-foreground">
            Almost there! Add a profile picture to complete.
          </p>
        </div>,
      );

      expect(screen.getByText("Profile Completion")).toBeInTheDocument();
      expect(screen.getByText("90%")).toBeInTheDocument();
    });

    it("renders multi-step form progress", () => {
      render(
        <div>
          <div className="flex justify-between mb-2">
            <span>Step 2 of 4</span>
            <span>50%</span>
          </div>
          <Progress value={50} />
        </div>,
      );

      expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });
  });

  describe("Styling Variations", () => {
    it("renders with custom height", () => {
      render(<Progress className="h-4" data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveClass("h-4");
    });

    it("renders with custom width", () => {
      render(<Progress className="w-1/2" data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveClass("w-1/2");
    });

    it("renders with different colors", () => {
      const { container } = render(<Progress value={50} indicatorClassName="bg-red-500" />);

      const indicator = container.querySelector(".h-full.transition-all");
      expect(indicator).toHaveClass("bg-red-500");
    });

    it("renders with gradient indicator", () => {
      const { container } = render(
        <Progress value={75} indicatorClassName="bg-gradient-to-r from-blue-500 to-purple-500" />,
      );

      const indicator = container.querySelector(".h-full.transition-all");
      expect(indicator).toHaveClass("bg-gradient-to-r", "from-blue-500", "to-purple-500");
    });
  });

  describe("Edge Cases", () => {
    it("handles undefined value", () => {
      const { container } = render(<Progress value={undefined} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "0%" });
    });

    it("handles NaN value", () => {
      const { container } = render(<Progress value={NaN} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "0%" });
    });

    it("handles very small values", () => {
      const { container } = render(<Progress value={0.1} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "0.1%" });
    });

    it("handles very large values", () => {
      const { container } = render(<Progress value={999} />);

      const indicator = container.querySelector(".h-full.transition-all") as HTMLElement;
      expect(indicator).toHaveStyle({ width: "100%" });
    });

    it("maintains styling with custom className", () => {
      render(<Progress value={50} className="custom-class" data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveClass("custom-class", "rounded-full", "bg-muted");
    });
  });

  describe("Accessibility", () => {
    it("can have role='progressbar'", () => {
      render(<Progress role="progressbar" aria-valuenow={50} data-testid="progress" />);

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveAttribute("role", "progressbar");
    });

    it("supports complete ARIA attributes", () => {
      render(
        <Progress
          role="progressbar"
          aria-valuenow={50}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
          data-testid="progress"
        />,
      );

      const progress = screen.getByTestId("progress");
      expect(progress).toHaveAttribute("role", "progressbar");
      expect(progress).toHaveAttribute("aria-valuenow", "50");
      expect(progress).toHaveAttribute("aria-valuemin", "0");
      expect(progress).toHaveAttribute("aria-valuemax", "100");
      expect(progress).toHaveAttribute("aria-label", "Upload progress");
    });
  });
});
