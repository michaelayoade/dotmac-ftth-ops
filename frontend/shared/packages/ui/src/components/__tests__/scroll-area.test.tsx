/**
 * ScrollArea Component Tests
 *
 * Tests shadcn/ui ScrollArea component
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { ScrollArea, ScrollBar } from "../scroll-area";

describe("ScrollArea", () => {
  describe("Basic Rendering", () => {
    it("renders scroll area container", () => {
      const { container } = render(<ScrollArea>Content</ScrollArea>);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders as div element", () => {
      render(<ScrollArea data-testid="scroll-area">Content</ScrollArea>);

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea.tagName).toBe("DIV");
    });

    it("applies base styles", () => {
      render(<ScrollArea data-testid="scroll-area">Content</ScrollArea>);

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveClass("relative", "overflow-auto");
    });

    it("renders with custom className", () => {
      render(
        <ScrollArea className="custom-scroll" data-testid="scroll-area">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveClass("custom-scroll");
    });

    it("renders children content", () => {
      render(<ScrollArea>Scrollable Content</ScrollArea>);

      expect(screen.getByText("Scrollable Content")).toBeInTheDocument();
    });
  });

  describe("ScrollBar", () => {
    it("renders scroll bar", () => {
      const { container } = render(<ScrollBar />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders as div element", () => {
      render(<ScrollBar data-testid="scroll-bar" />);

      const scrollBar = screen.getByTestId("scroll-bar");
      expect(scrollBar.tagName).toBe("DIV");
    });

    it("renders with custom className", () => {
      render(<ScrollBar className="custom-bar" data-testid="scroll-bar" />);

      const scrollBar = screen.getByTestId("scroll-bar");
      expect(scrollBar).toHaveClass("custom-bar");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to ScrollArea", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<ScrollArea ref={ref}>Content</ScrollArea>);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("forwards ref to ScrollBar", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<ScrollBar ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe("Display Names", () => {
    it("ScrollArea has correct display name", () => {
      expect(ScrollArea.displayName).toBe("ScrollArea");
    });

    it("ScrollBar has correct display name", () => {
      expect(ScrollBar.displayName).toBe("ScrollBar");
    });
  });

  describe("HTML Attributes", () => {
    it("supports id attribute on ScrollArea", () => {
      const { container } = render(<ScrollArea id="my-scroll-area">Content</ScrollArea>);

      const scrollArea = container.firstChild as HTMLElement;
      expect(scrollArea).toHaveAttribute("id", "my-scroll-area");
    });

    it("forwards data attributes to ScrollArea", () => {
      render(
        <ScrollArea data-testid="custom-scroll" data-custom="value">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("custom-scroll");
      expect(scrollArea).toHaveAttribute("data-custom", "value");
    });

    it("supports aria-label on ScrollArea", () => {
      render(
        <ScrollArea aria-label="Scrollable content" data-testid="scroll-area">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveAttribute("aria-label", "Scrollable content");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders scrollable content area", () => {
      render(
        <ScrollArea className="h-96 w-full">
          <div className="space-y-4">
            <p>Item 1</p>
            <p>Item 2</p>
            <p>Item 3</p>
            <p>Item 4</p>
            <p>Item 5</p>
          </div>
        </ScrollArea>,
      );

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 5")).toBeInTheDocument();
    });

    it("renders chat messages container", () => {
      render(
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            <div>Message 1</div>
            <div>Message 2</div>
            <div>Message 3</div>
          </div>
        </ScrollArea>,
      );

      expect(screen.getByText("Message 1")).toBeInTheDocument();
    });

    it("renders code block with scroll", () => {
      render(
        <ScrollArea className="h-40 w-full rounded-md border">
          <pre className="p-4">
            <code>const example = &quot;code&quot;;</code>
          </pre>
        </ScrollArea>,
      );

      expect(screen.getByText('const example = "code";')).toBeInTheDocument();
    });

    it("renders table with scroll", () => {
      render(
        <ScrollArea className="h-80">
          <table>
            <thead>
              <tr>
                <th>Column 1</th>
                <th>Column 2</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Row 1</td>
                <td>Data 1</td>
              </tr>
            </tbody>
          </table>
        </ScrollArea>,
      );

      expect(screen.getByText("Column 1")).toBeInTheDocument();
    });

    it("renders sidebar with scrollable navigation", () => {
      render(
        <ScrollArea className="h-screen">
          <nav>
            <a href="#home">Home</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
          </nav>
        </ScrollArea>,
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("About")).toBeInTheDocument();
    });

    it("renders image gallery with horizontal scroll", () => {
      render(
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4">
            <img alt="Gallery item 1" />
            <img alt="Gallery item 2" />
            <img alt="Gallery item 3" />
          </div>
        </ScrollArea>,
      );

      expect(screen.getByAltText("Gallery item 1")).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("can be styled with custom height", () => {
      render(
        <ScrollArea className="h-96" data-testid="scroll-area">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveClass("h-96");
    });

    it("can be styled with custom width", () => {
      render(
        <ScrollArea className="w-full" data-testid="scroll-area">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveClass("w-full");
    });

    it("can be styled with borders", () => {
      render(
        <ScrollArea className="border rounded-md" data-testid="scroll-area">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveClass("border", "rounded-md");
    });
  });

  describe("Edge Cases", () => {
    it("renders with no children", () => {
      const { container } = render(<ScrollArea />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders with null children", () => {
      const { container } = render(<ScrollArea>{null}</ScrollArea>);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders with multiple children", () => {
      render(
        <ScrollArea>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ScrollArea>,
      );

      expect(screen.getByText("Child 1")).toBeInTheDocument();
      expect(screen.getByText("Child 2")).toBeInTheDocument();
      expect(screen.getByText("Child 3")).toBeInTheDocument();
    });

    it("maintains styling with custom className", () => {
      render(
        <ScrollArea className="custom-class" data-testid="scroll-area">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveClass("custom-class", "relative", "overflow-auto");
    });
  });

  describe("Accessibility", () => {
    it("is scrollable with keyboard", () => {
      render(
        <ScrollArea data-testid="scroll-area">
          <div style={{ height: "1000px" }}>Tall content</div>
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveClass("overflow-auto");
    });

    it("supports tabindex for keyboard focus", () => {
      render(
        <ScrollArea tabIndex={0} data-testid="scroll-area">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      expect(scrollArea).toHaveAttribute("tabIndex", "0");
    });

    it("can be focused", () => {
      render(
        <ScrollArea tabIndex={0} data-testid="scroll-area">
          Content
        </ScrollArea>,
      );

      const scrollArea = screen.getByTestId("scroll-area");
      scrollArea.focus();

      expect(document.activeElement).toBe(scrollArea);
    });
  });
});
