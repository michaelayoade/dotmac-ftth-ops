/**
 * Label Component Tests
 *
 * Tests shadcn/ui Label primitive
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { Label } from "../label";

describe("Label", () => {
  describe("Basic Rendering", () => {
    it("renders label with text", () => {
      render(<Label>Label text</Label>);

      expect(screen.getByText("Label text")).toBeInTheDocument();
    });

    it("renders as label element", () => {
      render(<Label>Label</Label>);

      const label = screen.getByText("Label");
      expect(label.tagName).toBe("LABEL");
    });

    it("applies base styles", () => {
      render(<Label>Label</Label>);

      const label = screen.getByText("Label");
      expect(label).toHaveClass("text-sm", "font-medium", "text-foreground");
    });

    it("renders with custom className", () => {
      render(<Label className="custom-class">Label</Label>);

      const label = screen.getByText("Label");
      expect(label).toHaveClass("custom-class");
    });
  });

  describe("HTML Attributes", () => {
    it("supports htmlFor attribute", () => {
      render(
        <div>
          <Label htmlFor="input-id">Label</Label>
          <input id="input-id" />
        </div>,
      );

      const label = screen.getByText("Label");
      expect(label).toHaveAttribute("for", "input-id");
    });

    it("supports id attribute", () => {
      render(<Label id="my-label">Label</Label>);

      const label = screen.getByText("Label");
      expect(label).toHaveAttribute("id", "my-label");
    });

    it("forwards data attributes", () => {
      render(
        <Label data-testid="custom-label" data-custom="value">
          Label
        </Label>,
      );

      const label = screen.getByTestId("custom-label");
      expect(label).toHaveAttribute("data-custom", "value");
    });

    it("supports onClick handler", () => {
      const handleClick = jest.fn();

      render(<Label onClick={handleClick}>Label</Label>);

      const label = screen.getByText("Label");
      label.click();

      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to label element", () => {
      const ref = React.createRef<HTMLLabelElement>();

      render(<Label ref={ref}>Label</Label>);

      expect(ref.current).toBeInstanceOf(HTMLLabelElement);
      expect(ref.current?.textContent).toBe("Label");
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      expect(Label.displayName).toBe("Label");
    });
  });

  describe("Children Content", () => {
    it("renders string children", () => {
      render(<Label>Text content</Label>);

      expect(screen.getByText("Text content")).toBeInTheDocument();
    });

    it("renders element children", () => {
      render(
        <Label>
          <span>Icon</span>
          <span>Text</span>
        </Label>,
      );

      expect(screen.getByText("Icon")).toBeInTheDocument();
      expect(screen.getByText("Text")).toBeInTheDocument();
    });

    it("handles empty children", () => {
      const { container } = render(<Label />);

      const label = container.querySelector("label");
      expect(label).toBeEmptyDOMElement();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("labels a text input", () => {
      render(
        <div>
          <Label htmlFor="name">Full Name</Label>
          <input id="name" type="text" />
        </div>,
      );

      const label = screen.getByText("Full Name");
      expect(label).toHaveAttribute("for", "name");
    });

    it("labels a checkbox", () => {
      render(
        <div>
          <Label htmlFor="terms">
            <input id="terms" type="checkbox" />I agree to the terms and conditions
          </Label>
        </div>,
      );

      expect(screen.getByText(/I agree to the terms/)).toBeInTheDocument();
    });

    it("renders required indicator", () => {
      render(
        <Label htmlFor="email">
          Email <span className="text-destructive">*</span>
        </Label>,
      );

      expect(screen.getByText("Email")).toBeInTheDocument();
      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("renders with tooltip icon", () => {
      render(
        <Label htmlFor="password">
          Password
          <span aria-label="Help">ℹ️</span>
        </Label>,
      );

      expect(screen.getByText("Password")).toBeInTheDocument();
      expect(screen.getByLabelText("Help")).toBeInTheDocument();
    });

    it("renders disabled label styling", () => {
      render(
        <Label htmlFor="disabled-input" className="opacity-50 cursor-not-allowed">
          Disabled Field
        </Label>,
      );

      const label = screen.getByText("Disabled Field");
      expect(label).toHaveClass("opacity-50", "cursor-not-allowed");
    });
  });

  describe("Accessibility", () => {
    it("associates label with input via htmlFor", () => {
      render(
        <div>
          <Label htmlFor="email-input">Email Address</Label>
          <input id="email-input" type="email" />
        </div>,
      );

      const label = screen.getByText("Email Address");
      const input = document.getElementById("email-input");

      expect(label).toHaveAttribute("for", "email-input");
      expect(input).toBeInTheDocument();
    });

    it("clicking label focuses associated input", async () => {
      const user = userEvent.setup();
      render(
        <div>
          <Label htmlFor="clickable-input">Click me</Label>
          <input id="clickable-input" type="text" />
        </div>,
      );

      const label = screen.getByText("Click me");
      const input = document.getElementById("clickable-input");

      await user.click(label);

      expect(document.activeElement).toBe(input);
    });
  });

  describe("Edge Cases", () => {
    it("handles null children", () => {
      const { container } = render(<Label>{null}</Label>);

      const label = container.querySelector("label");
      expect(label).toBeEmptyDOMElement();
    });

    it("handles undefined children", () => {
      const { container } = render(<Label>{undefined}</Label>);

      const label = container.querySelector("label");
      expect(label).toBeEmptyDOMElement();
    });

    it("handles boolean children (renders nothing)", () => {
      const { container } = render(<Label>{true}</Label>);

      const label = container.querySelector("label");
      expect(label).toBeEmptyDOMElement();
    });

    it("handles numeric children", () => {
      render(<Label>{0}</Label>);

      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });
});
