/**
 * Portal Button Component Tests
 *
 * Tests portal-aware button with animations and theme integration
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { PortalButton } from "../portal-button";

// Mock the usePortalTheme hook
const mockUsePortalTheme = jest.fn();
jest.mock("../../lib/design-system/portal-themes", () => ({
  usePortalTheme: () => mockUsePortalTheme(),
}));

describe("PortalButton", () => {
  beforeEach(() => {
    // Default mock theme with animations
    mockUsePortalTheme.mockReturnValue({
      theme: {
        animations: {
          duration: 200,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          hoverScale: 1.05,
          activeScale: 0.95,
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders button element", () => {
      render(<PortalButton>Click me</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("renders button text", () => {
      render(<PortalButton>Click me</PortalButton>);

      expect(screen.getByText("Click me")).toBeInTheDocument();
    });

    it("applies base styles", () => {
      render(<PortalButton>Click me</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "inline-flex",
        "items-center",
        "justify-center",
        "rounded-md",
        "font-medium",
        "transition-all",
      );
    });

    it("has correct display name", () => {
      expect(PortalButton.displayName).toBe("PortalButton");
    });
  });

  describe("Variant Styles", () => {
    it("renders default variant", () => {
      render(<PortalButton variant="default">Default</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-portal-primary", "text-white", "hover:opacity-90");
    });

    it("renders destructive variant", () => {
      render(<PortalButton variant="destructive">Delete</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "bg-destructive",
        "text-destructive-foreground",
        "hover:bg-destructive/90",
      );
    });

    it("renders outline variant", () => {
      render(<PortalButton variant="outline">Outline</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "border-2",
        "border-portal-primary",
        "text-portal-primary",
        "bg-transparent",
        "hover:bg-portal-primary/10",
      );
    });

    it("renders secondary variant", () => {
      render(<PortalButton variant="secondary">Secondary</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "bg-secondary",
        "text-secondary-foreground",
        "hover:bg-secondary/80",
      );
    });

    it("renders ghost variant", () => {
      render(<PortalButton variant="ghost">Ghost</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("hover:bg-accent", "hover:text-accent-foreground");
    });

    it("renders link variant", () => {
      render(<PortalButton variant="link">Link</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("text-portal-primary", "underline-offset-4", "hover:underline");
    });

    it("renders accent variant", () => {
      render(<PortalButton variant="accent">Accent</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-portal-accent", "text-white", "hover:opacity-90");
    });

    it("defaults to default variant when not specified", () => {
      render(<PortalButton>Default</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-portal-primary");
    });
  });

  describe("Size Variants", () => {
    it("renders default size", () => {
      render(<PortalButton size="default">Default Size</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "px-4", "py-2");
    });

    it("renders small size", () => {
      render(<PortalButton size="sm">Small</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-9", "rounded-md", "px-3");
    });

    it("renders large size", () => {
      render(<PortalButton size="lg">Large</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-11", "rounded-md", "px-8");
    });

    it("renders icon size", () => {
      render(
        <PortalButton size="icon" aria-label="Icon button">
          ⚙️
        </PortalButton>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "w-10");
    });

    it("defaults to default size when not specified", () => {
      render(<PortalButton>Default Size</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "px-4", "py-2");
    });
  });

  describe("Custom ClassName", () => {
    it("supports custom className", () => {
      render(<PortalButton className="custom-portal-button">Click me</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-portal-button");
    });

    it("merges custom className with variant classes", () => {
      render(<PortalButton className="custom-portal-button">Click me</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-portal-button", "bg-portal-primary", "inline-flex");
    });
  });

  describe("Portal Theme Animations", () => {
    it("applies animation duration from theme", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          animations: {
            duration: 300,
            easing: "ease-in-out",
            hoverScale: 1.05,
            activeScale: 0.95,
          },
        },
      });

      render(<PortalButton>Animated</PortalButton>);

      const button = screen.getByRole("button");
      expect(button.style.transitionDuration).toBe("300ms");
    });

    it("applies animation easing from theme", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          animations: {
            duration: 200,
            easing: "cubic-bezier(0.25, 0.1, 0.25, 1)",
            hoverScale: 1.05,
            activeScale: 0.95,
          },
        },
      });

      render(<PortalButton>Animated</PortalButton>);

      const button = screen.getByRole("button");
      expect(button.style.transitionTimingFunction).toBe("cubic-bezier(0.25, 0.1, 0.25, 1)");
    });

    it("applies hover scale on mouse enter", async () => {
      const user = userEvent.setup();

      render(<PortalButton>Hover me</PortalButton>);

      const button = screen.getByRole("button");
      await user.hover(button);

      expect(button.style.transform).toBe("scale(1.05)");
    });

    it("removes scale on mouse leave", async () => {
      const user = userEvent.setup();

      render(<PortalButton>Hover me</PortalButton>);

      const button = screen.getByRole("button");
      await user.hover(button);
      await user.unhover(button);

      expect(button.style.transform).toBe("scale(1)");
    });

    it("applies active scale on mouse down", async () => {
      const user = userEvent.setup();

      render(<PortalButton>Click me</PortalButton>);

      const button = screen.getByRole("button");
      await user.pointer({ keys: "[MouseLeft>]", target: button });

      expect(button.style.transform).toBe("scale(0.95)");
    });

    it("restores hover scale on mouse up", async () => {
      const user = userEvent.setup();

      render(<PortalButton>Click me</PortalButton>);

      const button = screen.getByRole("button");
      await user.hover(button);
      await user.pointer({ keys: "[MouseLeft>]", target: button });
      await user.pointer({ keys: "[/MouseLeft]", target: button });

      expect(button.style.transform).toBe("scale(1.05)");
    });

    it("does not apply hover scale when disabled", async () => {
      const user = userEvent.setup();

      render(<PortalButton disabled>Disabled</PortalButton>);

      const button = screen.getByRole("button");
      await user.hover(button);

      expect(button.style.transform).not.toBe("scale(1.05)");
    });

    it("does not apply active scale when disabled", async () => {
      const user = userEvent.setup();

      render(<PortalButton disabled>Disabled</PortalButton>);

      const button = screen.getByRole("button");
      await user.pointer({ keys: "[MouseLeft>]", target: button });

      expect(button.style.transform).not.toBe("scale(0.95)");
    });
  });

  describe("Disabled State", () => {
    it("can be disabled", () => {
      render(<PortalButton disabled>Disabled</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
    });

    it("applies disabled styles", () => {
      render(<PortalButton disabled>Disabled</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass("disabled:pointer-events-none", "disabled:opacity-50");
    });

    it("cannot be clicked when disabled", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      render(
        <PortalButton disabled onClick={onClick}>
          Disabled
        </PortalButton>,
      );

      const button = screen.getByRole("button");
      await user.click(button);

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("Click Interactions", () => {
    it("handles onClick event", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      render(<PortalButton onClick={onClick}>Click me</PortalButton>);

      const button = screen.getByRole("button");
      await user.click(button);

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("can be clicked multiple times", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      render(<PortalButton onClick={onClick}>Click me</PortalButton>);

      const button = screen.getByRole("button");
      await user.click(button);
      await user.click(button);
      await user.click(button);

      expect(onClick).toHaveBeenCalledTimes(3);
    });
  });

  describe("HTML Attributes", () => {
    it("supports type attribute", () => {
      render(<PortalButton type="submit">Submit</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("type", "submit");
    });

    it("supports name attribute", () => {
      render(<PortalButton name="submit-button">Submit</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("name", "submit-button");
    });

    it("supports value attribute", () => {
      render(<PortalButton value="submit-value">Submit</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("value", "submit-value");
    });

    it("supports aria-label", () => {
      render(<PortalButton aria-label="Close dialog">×</PortalButton>);

      const button = screen.getByLabelText("Close dialog");
      expect(button).toBeInTheDocument();
    });

    it("supports aria-describedby", () => {
      render(
        <div>
          <PortalButton aria-describedby="description">Click me</PortalButton>
          <div id="description">This button submits the form</div>
        </div>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-describedby", "description");
    });

    it("supports data attributes", () => {
      render(<PortalButton data-testid="custom-button">Click me</PortalButton>);

      const button = screen.getByTestId("custom-button");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Focus State", () => {
    it("can be focused", () => {
      render(<PortalButton>Focus me</PortalButton>);

      const button = screen.getByRole("button");
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it("applies focus-visible styles", () => {
      render(<PortalButton>Focus me</PortalButton>);

      const button = screen.getByRole("button");
      expect(button).toHaveClass(
        "focus-visible:outline-none",
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "focus-visible:ring-offset-2",
      );
    });

    it("can be focused with keyboard", async () => {
      const user = userEvent.setup();

      render(<PortalButton>Focus me</PortalButton>);

      const button = screen.getByRole("button");
      await user.tab();

      expect(document.activeElement).toBe(button);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to button element", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<PortalButton ref={ref}>Click me</PortalButton>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });

    it("ref can be used to focus button", () => {
      const ref = React.createRef<HTMLButtonElement>();

      render(<PortalButton ref={ref}>Click me</PortalButton>);

      ref.current?.focus();

      expect(document.activeElement).toBe(ref.current);
    });

    it("ref can be used to click button", () => {
      const ref = React.createRef<HTMLButtonElement>();
      const onClick = jest.fn();

      render(
        <PortalButton ref={ref} onClick={onClick}>
          Click me
        </PortalButton>,
      );

      ref.current?.click();

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Combined Variants", () => {
    it("renders small destructive button", () => {
      render(
        <PortalButton variant="destructive" size="sm">
          Delete
        </PortalButton>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-destructive", "h-9", "px-3");
    });

    it("renders large outline button", () => {
      render(
        <PortalButton variant="outline" size="lg">
          Large Outline
        </PortalButton>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("border-2", "border-portal-primary", "h-11", "px-8");
    });

    it("renders small accent button", () => {
      render(
        <PortalButton variant="accent" size="sm">
          Small Accent
        </PortalButton>,
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-portal-accent", "h-9", "px-3");
    });
  });

  describe("Different Portal Themes", () => {
    it("applies different animation duration for different portals", () => {
      mockUsePortalTheme.mockReturnValue({
        theme: {
          animations: {
            duration: 150,
            easing: "ease-out",
            hoverScale: 1.1,
            activeScale: 0.9,
          },
        },
      });

      render(<PortalButton>Custom Animation</PortalButton>);

      const button = screen.getByRole("button");
      expect(button.style.transitionDuration).toBe("150ms");
      expect(button.style.transitionTimingFunction).toBe("ease-out");
    });

    it("applies different hover scale for different portals", async () => {
      const user = userEvent.setup();

      mockUsePortalTheme.mockReturnValue({
        theme: {
          animations: {
            duration: 200,
            easing: "ease",
            hoverScale: 1.1,
            activeScale: 0.9,
          },
        },
      });

      render(<PortalButton>Hover me</PortalButton>);

      const button = screen.getByRole("button");
      await user.hover(button);

      expect(button.style.transform).toBe("scale(1.1)");
    });

    it("applies different active scale for different portals", async () => {
      const user = userEvent.setup();

      mockUsePortalTheme.mockReturnValue({
        theme: {
          animations: {
            duration: 200,
            easing: "ease",
            hoverScale: 1.05,
            activeScale: 0.9,
          },
        },
      });

      render(<PortalButton>Click me</PortalButton>);

      const button = screen.getByRole("button");
      await user.pointer({ keys: "[MouseLeft>]", target: button });

      expect(button.style.transform).toBe("scale(0.9)");
    });
  });

  describe("Accessibility", () => {
    it("has button role", () => {
      render(<PortalButton>Click me</PortalButton>);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });

    it("is keyboard accessible", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      render(<PortalButton onClick={onClick}>Click me</PortalButton>);

      const button = screen.getByRole("button");
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard("{Enter}");

      expect(onClick).toHaveBeenCalled();
    });

    it("can be activated with Space key", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();

      render(<PortalButton onClick={onClick}>Click me</PortalButton>);

      const button = screen.getByRole("button");
      await user.tab();
      expect(button).toHaveFocus();
      await user.keyboard("{ }");

      expect(onClick).toHaveBeenCalled();
    });

    it("icon button has aria-label", () => {
      render(
        <PortalButton size="icon" aria-label="Settings">
          ⚙️
        </PortalButton>,
      );

      const button = screen.getByLabelText("Settings");
      expect(button).toBeInTheDocument();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders primary action button", () => {
      render(
        <PortalButton variant="default" size="lg">
          Create Account
        </PortalButton>,
      );

      expect(screen.getByText("Create Account")).toBeInTheDocument();
    });

    it("renders delete button", () => {
      render(
        <PortalButton variant="destructive" size="sm">
          Delete Item
        </PortalButton>,
      );

      expect(screen.getByText("Delete Item")).toBeInTheDocument();
    });

    it("renders form submit button", () => {
      render(
        <PortalButton type="submit" variant="accent">
          Submit Form
        </PortalButton>,
      );

      const button = screen.getByText("Submit Form");
      expect(button).toHaveAttribute("type", "submit");
    });

    it("renders icon button with custom aria-label", () => {
      render(
        <PortalButton size="icon" variant="ghost" aria-label="Close modal">
          ×
        </PortalButton>,
      );

      expect(screen.getByLabelText("Close modal")).toBeInTheDocument();
    });

    it("renders loading button", () => {
      render(
        <PortalButton disabled>
          <span className="spinner" />
          Loading...
        </PortalButton>,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });

  describe("Edge Cases", () => {
    it("handles button with no children", () => {
      render(<PortalButton aria-label="Empty button" />);

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("handles button with complex children", () => {
      render(
        <PortalButton>
          <span>Icon</span>
          <span>Text</span>
        </PortalButton>,
      );

      expect(screen.getByText("Icon")).toBeInTheDocument();
      expect(screen.getByText("Text")).toBeInTheDocument();
    });

    it("handles multiple event handlers", async () => {
      const user = userEvent.setup();
      const onClick = jest.fn();
      const onFocus = jest.fn();
      const onBlur = jest.fn();

      render(
        <PortalButton onClick={onClick} onFocus={onFocus} onBlur={onBlur}>
          Click me
        </PortalButton>,
      );

      const button = screen.getByRole("button");
      await user.tab();
      expect(onFocus).toHaveBeenCalled();

      await user.click(button);
      expect(onClick).toHaveBeenCalled();

      await user.tab();
      expect(onBlur).toHaveBeenCalled();
    });
  });
});
