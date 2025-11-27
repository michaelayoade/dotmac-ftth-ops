/**
 * Button Component Tests
 *
 * Tests shadcn/ui Button primitive with variants, sizes, and accessibility
 */

import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { Button } from "../button";

describe("Button", () => {
  describe("Basic Rendering", () => {
    it("renders button with text content", () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole("button", { name: "Click me" });
      expect(button).toBeInTheDocument();
    });

    it("renders as button element by default", () => {
      render(<Button>Button</Button>);

      const button = screen.getByRole("button");
      expect(button.tagName).toBe("BUTTON");
    });

    it("applies base styles", () => {
      render(<Button>Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("inline-flex", "items-center", "justify-center");
      expect(button).toHaveClass("rounded-md", "text-sm", "font-medium");
    });

    it("renders with custom className", () => {
      render(<Button className="custom-class">Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("Variants", () => {
    it("renders default variant with primary styles", () => {
      render(<Button variant="default">Default</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-primary", "text-primary-foreground");
    });

    it("renders secondary variant", () => {
      render(<Button variant="secondary">Secondary</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-secondary", "text-secondary-foreground");
    });

    it("renders destructive variant", () => {
      render(<Button variant="destructive">Delete</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-destructive", "text-destructive-foreground");
    });

    it("renders outline variant", () => {
      render(<Button variant="outline">Outline</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border", "border-border", "bg-background");
    });

    it("renders ghost variant", () => {
      render(<Button variant="ghost">Ghost</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-accent");
    });

    it("renders link variant", () => {
      render(<Button variant="link">Link</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("text-primary", "underline-offset-4");
    });

    it("defaults to default variant when not specified", () => {
      render(<Button>Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-primary");
    });
  });

  describe("Sizes", () => {
    it("renders default size", () => {
      render(<Button size="default">Default Size</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "px-4", "py-2", "min-h-[44px]");
    });

    it("renders small size", () => {
      render(<Button size="sm">Small</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-9", "px-3", "min-h-[36px]");
    });

    it("renders large size", () => {
      render(<Button size="lg">Large</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-11", "px-8", "min-h-[44px]");
    });

    it("renders icon size", () => {
      render(
        <Button size="icon" aria-label="Icon button">
          🔍
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "w-10", "min-h-[44px]", "min-w-[44px]");
    });

    it("defaults to default size when not specified", () => {
      render(<Button>Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10");
    });
  });

  describe("Interaction", () => {
    it("calls onClick handler when clicked", () => {
      const handleClick = jest.fn();

      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("can be disabled", () => {
      const handleClick = jest.fn();

      render(
        <Button onClick={handleClick} disabled>
          Disabled
        </Button>,
      );

      const button = screen.getByRole("button");
      fireEvent.click(button);

      expect(button).toBeDisabled();
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("applies disabled styles when disabled", () => {
      render(<Button disabled>Disabled</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("disabled:pointer-events-none", "disabled:opacity-50");
    });

    it("supports type attribute", () => {
      render(<Button type="submit">Submit</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "submit");
    });

    it("defaults to button type", () => {
      render(<Button>Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "button");
    });
  });

  describe("Accessibility", () => {
    it("has focus styles", () => {
      render(<Button>Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-primary",
      );
    });

    it("supports aria-label", () => {
      render(<Button aria-label="Custom label">Icon</Button>);

      const button = screen.getByRole("button", { name: "Custom label" });
      expect(button).toHaveAttribute("aria-label", "Custom label");
    });

    it("supports aria-labelledby", () => {
      render(
        <div>
          <span id="label-id">Label</span>
          <Button aria-labelledby="label-id">Button</Button>
        </div>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-labelledby", "label-id");
    });

    it("supports title attribute", () => {
      render(<Button title="Button title">Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("title", "Button title");
    });

    it("warns in development when button has no accessible label", () => {
      const originalEnv = process.env.NODE_ENV;
      const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

      // Set to development mode
      process.env.NODE_ENV = "development";

      render(<Button />);

      expect(consoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("Buttons should have accessible labels"),
        expect.any(Object),
      );

      consoleWarn.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it("does not warn when button has text content", () => {
      const originalEnv = process.env.NODE_ENV;
      const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

      process.env.NODE_ENV = "development";

      render(<Button>Text</Button>);

      expect(consoleWarn).not.toHaveBeenCalled();

      consoleWarn.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it("does not warn when button has aria-label", () => {
      const originalEnv = process.env.NODE_ENV;
      const consoleWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

      process.env.NODE_ENV = "development";

      render(<Button aria-label="Label" />);

      expect(consoleWarn).not.toHaveBeenCalled();

      consoleWarn.mockRestore();
      process.env.NODE_ENV = originalEnv;
    });

    it("is focusable", () => {
      render(<Button>Focusable</Button>);

      const button = screen.getByRole("button");
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it("has touch-manipulation for mobile accessibility", () => {
      render(<Button>Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("touch-manipulation");
    });

    it("has minimum touch target size", () => {
      render(<Button>Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("min-h-[44px]");
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to button element", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<Button ref={ref}>Button</Button>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
      expect(ref.current?.textContent).toBe("Button");
    });

    it("allows calling focus on ref", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<Button ref={ref}>Button</Button>);

      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe("HTML Attributes", () => {
    it("forwards data attributes", () => {
      render(
        <Button data-testid="custom-button" data-custom="value">
          Button
        </Button>,
      );

      const button = screen.getByTestId("custom-button");
      expect(button).toHaveAttribute("data-custom", "value");
    });

    it("supports id attribute", () => {
      render(<Button id="my-button">Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("id", "my-button");
    });

    it("supports name attribute", () => {
      render(<Button name="submit-button">Submit</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("name", "submit-button");
    });

    it("supports form attribute", () => {
      render(<Button form="my-form">Submit</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("form", "my-form");
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      expect(Button.displayName).toBe("Button");
    });
  });

  describe("Children Content", () => {
    it("renders string children", () => {
      render(<Button>Text content</Button>);

      expect(screen.getByText("Text content")).toBeInTheDocument();
    });

    it("renders element children", () => {
      render(
        <Button>
          <span>Span content</span>
        </Button>,
      );

      expect(screen.getByText("Span content")).toBeInTheDocument();
    });

    it("renders multiple children", () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Label</span>
        </Button>,
      );

      expect(screen.getByText("Icon")).toBeInTheDocument();
      expect(screen.getByText("Label")).toBeInTheDocument();
    });

    it("handles empty children", () => {
      const { container } = render(<Button />);

      const button = container.querySelector("button");
      expect(button).toBeEmptyDOMElement();
    });
  });

  describe("Variant and Size Combinations", () => {
    it("renders default variant with large size", () => {
      render(
        <Button variant="default" size="lg">
          Large Primary
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-primary", "h-11", "px-8");
    });

    it("renders destructive variant with small size", () => {
      render(
        <Button variant="destructive" size="sm">
          Small Delete
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-destructive", "h-9", "px-3");
    });

    it("renders ghost variant with icon size", () => {
      render(
        <Button variant="ghost" size="icon" aria-label="Ghost icon">
          🔍
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-accent", "h-10", "w-10");
    });

    it("renders link variant with default size", () => {
      render(<Button variant="link">Link Button</Button>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("text-primary", "h-10");
    });
  });

  describe("Edge Cases", () => {
    it("handles numeric children", () => {
      render(<Button>{42}</Button>);

      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("handles boolean children (renders nothing)", () => {
      const { container } = render(<Button>{true}</Button>);

      const button = container.querySelector("button");
      expect(button).toBeEmptyDOMElement();
    });

    it("handles null children", () => {
      const { container } = render(<Button>{null}</Button>);

      const button = container.querySelector("button");
      expect(button).toBeEmptyDOMElement();
    });

    it("handles undefined children", () => {
      const { container } = render(<Button>{undefined}</Button>);

      const button = container.querySelector("button");
      expect(button).toBeEmptyDOMElement();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders primary action button", () => {
      render(
        <Button variant="default" size="default">
          Save Changes
        </Button>,
      );

      const button = screen.getByRole("button", { name: "Save Changes" });
      expect(button).toHaveClass("bg-primary");
    });

    it("renders delete confirmation button", () => {
      const handleDelete = jest.fn();

      render(
        <Button variant="destructive" onClick={handleDelete}>
          Delete Account
        </Button>,
      );

      const button = screen.getByRole("button", { name: "Delete Account" });
      fireEvent.click(button);

      expect(button).toHaveClass("bg-destructive");
      expect(handleDelete).toHaveBeenCalled();
    });

    it("renders icon-only button with aria-label", () => {
      render(
        <Button variant="ghost" size="icon" aria-label="Close dialog">
          ✕
        </Button>,
      );

      const button = screen.getByRole("button", { name: "Close dialog" });
      expect(button).toHaveClass("h-10", "w-10");
    });

    it("renders submit button in form", () => {
      const handleSubmit = jest.fn((e) => e.preventDefault());

      render(
        <form onSubmit={handleSubmit}>
          <Button type="submit">Submit Form</Button>
        </form>,
      );

      const button = screen.getByRole("button", { name: "Submit Form" });
      fireEvent.click(button);

      expect(handleSubmit).toHaveBeenCalled();
    });

    it("renders loading button with disabled state", () => {
      render(
        <Button disabled>
          <span>Loading...</span>
        </Button>,
      );

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("renders button with icon and text", () => {
      render(
        <Button>
          <span aria-hidden>📁</span>
          <span>Open File</span>
        </Button>,
      );

      expect(screen.getByText("Open File")).toBeInTheDocument();
    });
  });
});
