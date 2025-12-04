/**
 * BottomSheet Component Tests
 *
 * Testing overlay/keydown/backdrop logic, escape handling, body scroll lock,
 * focus management, and accessibility
 */

import React from "react";
import {
  render,
  renderA11y,
  renderSecurity,
  renderPerformance,
  renderComprehensive,
  screen,
  fireEvent,
  waitFor,
} from "../../testing";
import { BottomSheet } from "../BottomSheet";

describe("BottomSheet", () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    children: <div>Bottom sheet content</div>,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = "";
  });

  describe("Basic Rendering", () => {
    it("renders when isOpen is true", () => {
      render(<BottomSheet {...defaultProps} />);

      expect(screen.getByText("Bottom sheet content")).toBeInTheDocument();
    });

    it("is hidden when isOpen is false", () => {
      const { container } = render(<BottomSheet {...defaultProps} isOpen={false} />);

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveClass("hidden");
      expect(dialog).toHaveAttribute("aria-hidden", "true");
    });

    it("renders with overlay backdrop", () => {
      const { container } = render(<BottomSheet {...defaultProps} />);

      const overlay = container.querySelector('[role="dialog"]');
      expect(overlay).toHaveClass("fixed", "inset-0", "bg-black/50");
    });

    it("renders content in white rounded container", () => {
      const { container } = render(<BottomSheet {...defaultProps} />);

      const content = container.querySelector(".bg-white");
      expect(content).toHaveClass("rounded-t-lg", "shadow-lg");
    });

    it("applies custom className to content", () => {
      const { container } = render(<BottomSheet {...defaultProps} className="custom-class" />);

      const content = container.querySelector(".custom-class");
      expect(content).toBeInTheDocument();
    });

    it("has slide-in animation", () => {
      const { container } = render(<BottomSheet {...defaultProps} />);

      const content = container.querySelector(".animate-in");
      expect(content).toHaveClass("slide-in-from-bottom");
    });
  });

  describe("Backdrop Click Handling", () => {
    it("calls onClose when backdrop is clicked", () => {
      const onClose = jest.fn();
      const { container } = render(<BottomSheet {...defaultProps} onClose={onClose} />);

      const overlay = container.querySelector('[role="dialog"]');
      fireEvent.click(overlay!);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose when content is clicked", () => {
      const onClose = jest.fn();
      render(<BottomSheet {...defaultProps} onClose={onClose} />);

      const content = screen.getByText("Bottom sheet content");
      fireEvent.click(content);

      expect(onClose).not.toHaveBeenCalled();
    });

    it("stops propagation when content area is clicked", () => {
      const onClose = jest.fn();
      const { container } = render(<BottomSheet {...defaultProps} onClose={onClose} />);

      const content = container.querySelector(".bg-white");
      const stopPropagationSpy = jest.fn();

      fireEvent.click(content!, {
        stopPropagation: stopPropagationSpy,
      });

      // Content click should not close the sheet
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Escape Key Handling", () => {
    it("calls onClose when Escape key is pressed", () => {
      const onClose = jest.fn();
      render(<BottomSheet {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("does not call onClose for other keys", () => {
      const onClose = jest.fn();
      render(<BottomSheet {...defaultProps} onClose={onClose} />);

      fireEvent.keyDown(document, { key: "Enter" });
      fireEvent.keyDown(document, { key: "Space" });
      fireEvent.keyDown(document, { key: "Tab" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("removes escape listener when closed", () => {
      const onClose = jest.fn();
      const { rerender } = render(<BottomSheet {...defaultProps} onClose={onClose} />);

      // Close the sheet
      rerender(<BottomSheet {...defaultProps} isOpen={false} onClose={onClose} />);

      // Press escape - should not call onClose
      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });

    it("cleans up escape listener on unmount", () => {
      const onClose = jest.fn();
      const { unmount } = render(<BottomSheet {...defaultProps} onClose={onClose} />);

      unmount();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe("Body Scroll Lock", () => {
    it("locks body scroll when opened", () => {
      render(<BottomSheet {...defaultProps} />);

      expect(document.body.style.overflow).toBe("hidden");
    });

    it("restores body scroll when closed", () => {
      const { rerender } = render(<BottomSheet {...defaultProps} />);

      expect(document.body.style.overflow).toBe("hidden");

      rerender(<BottomSheet {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe("");
    });

    it("restores body scroll on unmount", () => {
      const { unmount } = render(<BottomSheet {...defaultProps} />);

      expect(document.body.style.overflow).toBe("hidden");

      unmount();

      expect(document.body.style.overflow).toBe("");
    });

    it("handles rapid open/close correctly", () => {
      const { rerender } = render(<BottomSheet {...defaultProps} isOpen={false} />);

      // Open
      rerender(<BottomSheet {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe("hidden");

      // Close
      rerender(<BottomSheet {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe("");

      // Open again
      rerender(<BottomSheet {...defaultProps} isOpen={true} />);
      expect(document.body.style.overflow).toBe("hidden");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to content container", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<BottomSheet {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current).toHaveClass("bg-white");
    });

    it("allows ref access to DOM methods", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<BottomSheet {...defaultProps} ref={ref} />);

      expect(ref.current?.scrollTop).toBeDefined();
      expect(ref.current?.clientHeight).toBeDefined();
    });
  });

  describe("Accessibility", () => {
    it("passes accessibility validation", async () => {
      await renderA11y(
        <BottomSheet {...defaultProps}>
          <h2>Title</h2>
          <p>Content</p>
        </BottomSheet>,
      );
    });

    it("has role=dialog", () => {
      const { container } = render(<BottomSheet {...defaultProps} />);

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toBeInTheDocument();
    });

    it("has aria-modal=true", () => {
      const { container } = render(<BottomSheet {...defaultProps} />);

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute("aria-modal", "true");
    });

    it("should be keyboard accessible", () => {
      render(
        <BottomSheet {...defaultProps}>
          <button>Action 1</button>
          <button>Action 2</button>
        </BottomSheet>,
      );

      const button1 = screen.getByText("Action 1");
      const button2 = screen.getByText("Action 2");

      // Should be able to tab between buttons
      button1.focus();
      expect(button1).toHaveFocus();

      button2.focus();
      expect(button2).toHaveFocus();
    });

    it("content should be scrollable for long content", () => {
      const { container } = render(
        <BottomSheet {...defaultProps}>
          <div style={{ height: "2000px" }}>Very long content</div>
        </BottomSheet>,
      );

      const content = container.querySelector(".overflow-auto");
      expect(content).toBeInTheDocument();
      expect(content).toHaveClass("max-h-[90vh]");
    });
  });

  describe("Complex Interactions", () => {
    it("handles nested clickable elements correctly", () => {
      const onClose = jest.fn();
      const onButtonClick = jest.fn();

      render(
        <BottomSheet {...defaultProps} onClose={onClose}>
          <button onClick={onButtonClick}>Click me</button>
        </BottomSheet>,
      );

      const button = screen.getByText("Click me");
      fireEvent.click(button);

      expect(onButtonClick).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it("handles form submission inside sheet", () => {
      const onSubmit = jest.fn((e) => e.preventDefault());

      render(
        <BottomSheet {...defaultProps}>
          <form onSubmit={onSubmit}>
            <input type="text" placeholder="Name" />
            <button type="submit">Submit</button>
          </form>
        </BottomSheet>,
      );

      const button = screen.getByText("Submit");
      fireEvent.click(button);

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it("maintains content state when reopening", () => {
      const TestContent = () => <input data-testid="input" defaultValue="Test" />;
      const onClose = jest.fn();

      const { rerender } = render(
        <BottomSheet isOpen={true} onClose={onClose}>
          <TestContent />
        </BottomSheet>,
      );

      // Close
      rerender(
        <BottomSheet isOpen={false} onClose={onClose}>
          <TestContent />
        </BottomSheet>,
      );

      // Reopen
      rerender(
        <BottomSheet isOpen={true} onClose={onClose}>
          <TestContent />
        </BottomSheet>,
      );

      const input = screen.getByTestId("input") as HTMLInputElement;
      expect(input.value).toBe("Test");
    });
  });

  describe("Security", () => {
    it("passes security validation", async () => {
      const result = await renderSecurity(<BottomSheet {...defaultProps} />);
      expect(result.container).toHaveNoSecurityViolations();
    });

    it("prevents XSS in children content", async () => {
      const maliciousContent = '<script>alert("XSS")</script>';

      const result = await renderSecurity(
        <BottomSheet {...defaultProps}>
          <div>{maliciousContent}</div>
        </BottomSheet>,
      );

      expect(result.container).toHaveNoSecurityViolations();
      expect(screen.getByText(maliciousContent)).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("renders within performance threshold", () => {
      const result = renderPerformance(<BottomSheet {...defaultProps} />);

      const metrics = result.measurePerformance();
      expect(metrics).toBePerformant(100);
    });

    it("handles large content efficiently", () => {
      const largeContent = (
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <div key={i}>Item {i}</div>
          ))}
        </div>
      );

      const result = renderPerformance(<BottomSheet {...defaultProps}>{largeContent}</BottomSheet>);

      const metrics = result.measurePerformance();
      expect(metrics).toBePerformant(120); // Allow more time for large content
    });
  });

  describe("Comprehensive Testing", () => {
    it("passes all comprehensive tests", async () => {
      const { result, metrics } = await renderComprehensive(
        <BottomSheet isOpen={true} onClose={jest.fn()} className="custom-sheet">
          <div>
            <h2>Sheet Title</h2>
            <p>Sheet content with complex interactions</p>
            <button>Action Button</button>
          </div>
        </BottomSheet>,
      );

      await expect(result.container).toBeAccessible();
      expect(result.container).toHaveNoSecurityViolations();
      expect(metrics).toBePerformant(120);
      expect(result.container).toHaveValidMarkup();
    });

    it("handles complete user flow", () => {
      const onClose = jest.fn();
      const { container } = render(
        <BottomSheet isOpen={true} onClose={onClose}>
          <h2>Confirm Action</h2>
          <p>Are you sure?</p>
          <button onClick={onClose}>Confirm</button>
        </BottomSheet>,
      );

      // Sheet should be visible
      expect(screen.getByText("Confirm Action")).toBeInTheDocument();

      // Body scroll should be locked
      expect(document.body.style.overflow).toBe("hidden");

      // Click confirm button
      fireEvent.click(screen.getByText("Confirm"));
      expect(onClose).toHaveBeenCalledTimes(1);

      // Can also close with escape
      fireEvent.keyDown(document, { key: "Escape" });
      expect(onClose).toHaveBeenCalledTimes(2);

      // Can also close by clicking backdrop
      const overlay = container.querySelector('[role="dialog"]');
      fireEvent.click(overlay!);
      expect(onClose).toHaveBeenCalledTimes(3);
    });
  });
});
