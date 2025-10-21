/**
 * Button Accessibility Tests
 *
 * Tests that all button components meet WCAG 2.1 AA standards
 */

import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, X } from "lucide-react";

describe("Button Accessibility", () => {
  it("should not have accessibility violations with text content", async () => {
    const { container } = render(<Button>Click me</Button>);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should not have violations with aria-label for icon-only button", async () => {
    const { container } = render(
      <Button aria-label="Delete item">
        <Trash2 className="h-4 w-4" />
      </Button>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should not have violations with aria-labelledby", async () => {
    const { container } = render(
      <div>
        <span id="delete-label">Delete</span>
        <Button aria-labelledby="delete-label">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("should have proper focus styles", () => {
    const { container } = render(<Button>Focus me</Button>);
    const button = container.querySelector("button");

    // Button should have focus-visible class
    expect(button?.className).toContain("focus-visible:outline-none");
    expect(button?.className).toContain("focus-visible:ring-2");
  });

  it("should be keyboard accessible", () => {
    const { container } = render(<Button>Press me</Button>);
    const button = container.querySelector("button");

    // Buttons should have tabindex 0 (default)
    expect(button?.tabIndex).toBe(0);
  });

  it("should have minimum touch target size", () => {
    const { container } = render(<Button size="default">Click</Button>);
    const button = container.querySelector("button");

    // WCAG 2.1 AA requires 44x44px minimum for touch targets
    expect(button?.className).toContain("min-h-[44px]");
  });

  it("icon button should have minimum touch target size", () => {
    const { container } = render(
      <Button size="icon" aria-label="Edit">
        <Edit className="h-4 w-4" />
      </Button>,
    );
    const button = container.querySelector("button");

    expect(button?.className).toContain("min-h-[44px]");
    expect(button?.className).toContain("min-w-[44px]");
  });

  it("disabled button should be properly marked", async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    const button = container.querySelector("button");

    expect(button?.disabled).toBe(true);
    expect(button?.className).toContain("disabled:opacity-50");
  });

  describe("Development Warnings", () => {
    const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

    beforeEach(() => {
      consoleWarnSpy.mockClear();
    });

    afterAll(() => {
      consoleWarnSpy.mockRestore();
    });

    it("should warn when button has no accessible label in development", () => {
      render(
        <Button>
          <X className="h-4 w-4" />
        </Button>,
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Buttons should have accessible labels"),
        expect.any(Object),
      );
    });

    it("should not warn when button has text content", () => {
      render(<Button>Click me</Button>);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should not warn when button has aria-label", () => {
      render(
        <Button aria-label="Close">
          <X className="h-4 w-4" />
        </Button>,
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it("should not warn when button has title", () => {
      render(
        <Button title="Close dialog">
          <X className="h-4 w-4" />
        </Button>,
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});
