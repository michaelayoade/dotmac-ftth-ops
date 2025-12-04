/**
 * Button component unit tests
 * Testing all variants, sizes, and states
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import React from "react";

import { Button, type ButtonProps } from "../Button";

describe("Button Component", () => {
  it("renders button with default props", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: /click me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass("inline-flex", "items-center", "justify-center");
  });

  it("handles click events", () => {
    const handleClick = jest.fn();
    render(
      <Button onClick={handleClick} onKeyDown={(e) => e.key === "Enter" && handleClick}>
        Click me
      </Button>,
    );

    fireEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("applies variant classes correctly", () => {
    const { rerender } = render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-destructive");

    rerender(<Button variant="outline">Cancel</Button>);
    expect(screen.getByRole("button")).toHaveClass("border", "border-input");

    rerender(<Button variant="ghost">Ghost</Button>);
    expect(screen.getByRole("button")).toHaveClass("hover:bg-accent");
  });

  it("applies size classes correctly", () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8", "text-xs");

    rerender(<Button size="lg">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10", "px-8");

    rerender(<Button size="icon">Icon</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-9", "w-9");
  });

  it("renders as disabled when disabled prop is true", () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(button).toHaveClass("disabled:opacity-50");
  });

  it("forwards ref correctly", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it("renders as Slot when asChild is true", () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: /link button/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
  });

  it("applies custom className alongside default classes", () => {
    render(<Button className="custom-class">Custom</Button>);
    const button = screen.getByRole("button");
    expect(button).toHaveClass("custom-class");
    expect(button).toHaveClass("inline-flex"); // Default class should still be present
  });

  it("passes through additional props", () => {
    render(
      <Button data-testid="custom-button" aria-label="Custom button">
        Button
      </Button>,
    );
    const button = screen.getByTestId("custom-button");
    expect(button).toHaveAttribute("aria-label", "Custom button");
  });

  describe("Accessibility", () => {
    it("should be accessible", async () => {
      const { container } = render(<Button>Accessible Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should be accessible when disabled", async () => {
      const { container } = render(<Button disabled>Disabled Button</Button>);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have proper focus styles", () => {
      render(<Button>Focus me</Button>);
      const button = screen.getByRole("button");
      expect(button).toHaveClass("focus-visible:outline-none", "focus-visible:ring-1");
    });
  });

  describe("Variant combinations", () => {
    const variants: ButtonProps["variant"][] = [
      "default",
      "destructive",
      "outline",
      "secondary",
      "ghost",
      "link",
    ];
    const sizes: ButtonProps["size"][] = ["default", "sm", "lg", "icon"];

    variants.forEach((variant) => {
      it(`renders ${variant} variant correctly`, () => {
        render(<Button variant={variant}>{variant} button</Button>);
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });

    sizes.forEach((size) => {
      it(`renders ${size} size correctly`, () => {
        render(<Button size={size}>{size} button</Button>);
        expect(screen.getByRole("button")).toBeInTheDocument();
      });
    });
  });
});
