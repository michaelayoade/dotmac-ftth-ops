/**
 * Separator Component Tests
 *
 * Tests shadcn/ui Separator component
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { Separator } from "../separator";

describe("Separator", () => {
  describe("Basic Rendering", () => {
    it("renders separator element", () => {
      const { container } = render(<Separator />);

      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders as div element", () => {
      render(<Separator data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator.tagName).toBe("DIV");
    });

    it("applies base styles", () => {
      render(<Separator data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("shrink-0", "bg-muted");
    });

    it("renders with custom className", () => {
      render(<Separator className="custom-separator" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("custom-separator");
    });
  });

  describe("Orientation", () => {
    it("renders horizontal by default", () => {
      render(<Separator data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("h-[1px]", "w-full");
    });

    it("renders horizontal when orientation='horizontal'", () => {
      render(<Separator orientation="horizontal" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("h-[1px]", "w-full");
      expect(separator).not.toHaveClass("h-full", "w-[1px]");
    });

    it("renders vertical when orientation='vertical'", () => {
      render(<Separator orientation="vertical" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("h-full", "w-[1px]");
      expect(separator).not.toHaveClass("h-[1px]", "w-full");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to separator element", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Separator ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("allows accessing DOM properties via ref", () => {
      const ref = React.createRef<HTMLDivElement>();

      render(<Separator ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
      expect(ref.current?.classList.contains("bg-muted")).toBe(true);
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      expect(Separator.displayName).toBe("Separator");
    });
  });

  describe("HTML Attributes", () => {
    it("supports id attribute", () => {
      const { container } = render(<Separator id="my-separator" />);

      const separator = container.firstChild as HTMLElement;
      expect(separator).toHaveAttribute("id", "my-separator");
    });

    it("forwards data attributes", () => {
      render(<Separator data-testid="custom-separator" data-custom="value" />);

      const separator = screen.getByTestId("custom-separator");
      expect(separator).toHaveAttribute("data-custom", "value");
    });

    it("supports aria-label for accessibility", () => {
      render(<Separator aria-label="Section divider" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveAttribute("aria-label", "Section divider");
    });

    it("supports role attribute", () => {
      render(<Separator role="separator" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveAttribute("role", "separator");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("separates sections in a layout", () => {
      render(
        <div>
          <section>Section 1</section>
          <Separator />
          <section>Section 2</section>
        </div>,
      );

      expect(screen.getByText("Section 1")).toBeInTheDocument();
      expect(screen.getByText("Section 2")).toBeInTheDocument();
    });

    it("separates items in a list", () => {
      render(
        <div>
          <div>Item 1</div>
          <Separator />
          <div>Item 2</div>
          <Separator />
          <div>Item 3</div>
        </div>,
      );

      expect(screen.getByText("Item 1")).toBeInTheDocument();
      expect(screen.getByText("Item 2")).toBeInTheDocument();
      expect(screen.getByText("Item 3")).toBeInTheDocument();
    });

    it("separates header and content", () => {
      render(
        <div>
          <header>
            <h1>Title</h1>
          </header>
          <Separator className="my-4" />
          <main>Content goes here</main>
        </div>,
      );

      expect(screen.getByText("Title")).toBeInTheDocument();
      expect(screen.getByText("Content goes here")).toBeInTheDocument();
    });

    it("separates sidebar items", () => {
      render(
        <aside>
          <nav>
            <a href="#home">Home</a>
            <Separator orientation="vertical" className="mx-2" />
            <a href="#about">About</a>
            <Separator orientation="vertical" className="mx-2" />
            <a href="#contact">Contact</a>
          </nav>
        </aside>,
      );

      expect(screen.getByText("Home")).toBeInTheDocument();
      expect(screen.getByText("About")).toBeInTheDocument();
      expect(screen.getByText("Contact")).toBeInTheDocument();
    });

    it("separates dropdown menu items", () => {
      render(
        <div className="dropdown-menu">
          <button>Edit</button>
          <button>Copy</button>
          <Separator className="my-2" />
          <button className="text-destructive">Delete</button>
        </div>,
      );

      expect(screen.getByText("Edit")).toBeInTheDocument();
      expect(screen.getByText("Copy")).toBeInTheDocument();
      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("separates card sections", () => {
      render(
        <div className="card">
          <div className="card-header">
            <h2>Card Title</h2>
          </div>
          <Separator />
          <div className="card-content">
            <p>Card content</p>
          </div>
          <Separator />
          <div className="card-footer">
            <button>Action</button>
          </div>
        </div>,
      );

      expect(screen.getByText("Card Title")).toBeInTheDocument();
      expect(screen.getByText("Card content")).toBeInTheDocument();
      expect(screen.getByText("Action")).toBeInTheDocument();
    });
  });

  describe("Styling", () => {
    it("can be styled with custom colors", () => {
      render(<Separator className="bg-primary" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("bg-primary");
    });

    it("can be styled with custom dimensions", () => {
      render(<Separator className="h-2 w-full" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("h-2", "w-full");
    });

    it("can be styled with spacing classes", () => {
      render(<Separator className="my-4 mx-2" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("my-4", "mx-2");
    });
  });

  describe("Edge Cases", () => {
    it("renders without any props", () => {
      const { container } = render(<Separator />);

      const separator = container.firstChild as HTMLElement;
      expect(separator).toBeInTheDocument();
      expect(separator).toHaveClass("h-[1px]", "w-full");
    });

    it("maintains base classes when adding custom className", () => {
      render(<Separator className="custom-class" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("custom-class", "shrink-0", "bg-muted");
    });

    it("handles both orientation and className", () => {
      render(<Separator orientation="vertical" className="custom-class" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveClass("custom-class", "h-full", "w-[1px]");
    });
  });

  describe("Accessibility", () => {
    it("can have semantic role", () => {
      render(<Separator role="separator" aria-orientation="horizontal" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveAttribute("role", "separator");
      expect(separator).toHaveAttribute("aria-orientation", "horizontal");
    });

    it("can have decorative role", () => {
      render(<Separator role="presentation" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveAttribute("role", "presentation");
    });

    it("supports aria-orientation attribute", () => {
      render(<Separator aria-orientation="vertical" data-testid="separator" />);

      const separator = screen.getByTestId("separator");
      expect(separator).toHaveAttribute("aria-orientation", "vertical");
    });
  });

  describe("Composition", () => {
    it("works in flex layouts", () => {
      render(
        <div className="flex items-center">
          <span>Left</span>
          <Separator orientation="vertical" className="h-4 mx-2" />
          <span>Right</span>
        </div>,
      );

      expect(screen.getByText("Left")).toBeInTheDocument();
      expect(screen.getByText("Right")).toBeInTheDocument();
    });

    it("works in grid layouts", () => {
      render(
        <div className="grid grid-cols-3">
          <div>Column 1</div>
          <Separator orientation="vertical" />
          <div>Column 2</div>
        </div>,
      );

      expect(screen.getByText("Column 1")).toBeInTheDocument();
      expect(screen.getByText("Column 2")).toBeInTheDocument();
    });

    it("works in nested layouts", () => {
      render(
        <div>
          <div>
            <h2>Heading</h2>
            <Separator />
            <div>
              <p>Paragraph 1</p>
              <Separator />
              <p>Paragraph 2</p>
            </div>
          </div>
        </div>,
      );

      expect(screen.getByText("Heading")).toBeInTheDocument();
      expect(screen.getByText("Paragraph 1")).toBeInTheDocument();
      expect(screen.getByText("Paragraph 2")).toBeInTheDocument();
    });
  });
});
