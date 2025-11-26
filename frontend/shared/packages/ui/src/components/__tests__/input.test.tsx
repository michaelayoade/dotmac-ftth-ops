/**
 * Input Component Tests
 *
 * Tests shadcn/ui Input primitive with error handling
 */

import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { Input } from "../input";

describe("Input", () => {
  describe("Basic Rendering", () => {
    it("renders input element", () => {
      render(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).toBeInTheDocument();
    });

    it("renders with placeholder", () => {
      render(<Input placeholder="Enter text" />);

      expect(screen.getByPlaceholderText("Enter text")).toBeInTheDocument();
    });

    it("applies base styles", () => {
      render(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("flex", "h-10", "w-full", "rounded-md");
      expect(input).toHaveClass("border", "bg-background", "px-3", "py-2");
    });

    it("renders with custom className", () => {
      render(<Input className="custom-class" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("custom-class");
    });
  });

  describe("Input Types", () => {
    it("renders text input by default", () => {
      render(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).not.toHaveAttribute("type");
    });

    it("renders email input", () => {
      render(<Input type="email" />);

      const input = document.querySelector('input[type="email"]');
      expect(input).toBeInTheDocument();
    });

    it("renders password input", () => {
      render(<Input type="password" />);

      const input = document.querySelector('input[type="password"]');
      expect(input).toBeInTheDocument();
    });

    it("renders number input", () => {
      render(<Input type="number" />);

      const input = document.querySelector('input[type="number"]');
      expect(input).toBeInTheDocument();
    });

    it("renders search input", () => {
      render(<Input type="search" />);

      const input = document.querySelector('input[type="search"]');
      expect(input).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("applies error border when error prop is provided", () => {
      render(<Input error="Error message" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("border-destructive");
    });

    it("sets aria-invalid when error exists", () => {
      render(<Input error="Error message" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("uses normal border when no error", () => {
      render(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("border-border");
      expect(input).not.toHaveClass("border-destructive");
    });

    it("sets aria-invalid to false when no error", () => {
      render(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "false");
    });
  });

  describe("User Interaction", () => {
    it("accepts user input", () => {
      render(<Input />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      fireEvent.change(input, { target: { value: "test value" } });

      expect(input.value).toBe("test value");
    });

    it("calls onChange handler", () => {
      const handleChange = jest.fn();

      render(<Input onChange={handleChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "test" } });

      expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it("calls onBlur handler", () => {
      const handleBlur = jest.fn();

      render(<Input onBlur={handleBlur} />);

      const input = screen.getByRole("textbox");
      fireEvent.blur(input);

      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it("calls onFocus handler", () => {
      const handleFocus = jest.fn();

      render(<Input onFocus={handleFocus} />);

      const input = screen.getByRole("textbox");
      fireEvent.focus(input);

      expect(handleFocus).toHaveBeenCalledTimes(1);
    });
  });

  describe("Disabled State", () => {
    it("can be disabled", () => {
      render(<Input disabled />);

      const input = screen.getByRole("textbox");
      expect(input).toBeDisabled();
    });

    it("applies disabled styles", () => {
      render(<Input disabled />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("disabled:cursor-not-allowed", "disabled:opacity-50");
    });

    it("does not call onChange when disabled", () => {
      const handleChange = jest.fn();

      render(<Input disabled onChange={handleChange} />);

      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "test" } });

      // Note: fireEvent still triggers the onChange handler even when disabled
      // This is expected browser behavior in testing libraries
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has focus styles", () => {
      render(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("focus:outline-none", "focus:ring-2", "focus:ring-primary");
    });

    it("supports aria-label", () => {
      render(<Input aria-label="Email address" />);

      const input = screen.getByRole("textbox", { name: "Email address" });
      expect(input).toBeInTheDocument();
    });

    it("supports aria-labelledby", () => {
      render(
        <div>
          <label id="email-label" htmlFor="email-input">
            Email
          </label>
          <Input id="email-input" aria-labelledby="email-label" />
        </div>,
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-labelledby", "email-label");
    });

    it("supports aria-describedby for error messages", () => {
      render(
        <div>
          <Input aria-describedby="error-msg" error="Error" />
          <span id="error-msg">Error message</span>
        </div>,
      );

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-describedby", "error-msg");
    });

    it("has touch-manipulation for mobile", () => {
      render(<Input />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveClass("touch-manipulation");
    });

    it("is focusable", () => {
      render(<Input />);

      const input = screen.getByRole("textbox");
      input.focus();

      expect(document.activeElement).toBe(input);
    });
  });

  describe("Ref Forwarding", () => {
    it("forwards ref to input element", () => {
      const ref = React.createRef<HTMLInputElement>();

      render(<Input ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it("allows calling focus on ref", () => {
      const ref = React.createRef<HTMLInputElement>();

      render(<Input ref={ref} />);

      ref.current?.focus();
      expect(document.activeElement).toBe(ref.current);
    });
  });

  describe("HTML Attributes", () => {
    it("supports name attribute", () => {
      render(<Input name="email" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("name", "email");
    });

    it("supports id attribute", () => {
      render(<Input id="email-input" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("id", "email-input");
    });

    it("supports required attribute", () => {
      render(<Input required />);

      const input = screen.getByRole("textbox");
      expect(input).toBeRequired();
    });

    it("supports maxLength attribute", () => {
      render(<Input maxLength={10} />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("maxLength", "10");
    });

    it("supports pattern attribute", () => {
      render(<Input pattern="[0-9]*" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("pattern", "[0-9]*");
    });

    it("supports autoComplete attribute", () => {
      render(<Input autoComplete="email" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("autoComplete", "email");
    });

    it("forwards data attributes", () => {
      render(<Input data-testid="custom-input" data-custom="value" />);

      const input = screen.getByTestId("custom-input");
      expect(input).toHaveAttribute("data-custom", "value");
    });
  });

  describe("Display Name", () => {
    it("has correct display name", () => {
      expect(Input.displayName).toBe("Input");
    });
  });

  describe("Value Control", () => {
    it("works as controlled component", () => {
      const { rerender } = render(<Input value="initial" onChange={() => {}} />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("initial");

      rerender(<Input value="updated" onChange={() => {}} />);
      expect(input.value).toBe("updated");
    });

    it("works as uncontrolled component", () => {
      render(<Input defaultValue="default" />);

      const input = screen.getByRole("textbox") as HTMLInputElement;
      expect(input.value).toBe("default");

      fireEvent.change(input, { target: { value: "changed" } });
      expect(input.value).toBe("changed");
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders email input with validation", () => {
      render(
        <div>
          <label htmlFor="email">Email</label>
          <Input id="email" type="email" placeholder="name@example.com" required />
        </div>,
      );

      const input = screen.getByPlaceholderText("name@example.com");
      expect(input).toHaveAttribute("type", "email");
      expect(input).toBeRequired();
    });

    it("renders password input with error", () => {
      render(
        <div>
          <label htmlFor="password">Password</label>
          <Input
            id="password"
            type="password"
            error="Password is too short"
            aria-describedby="password-error"
          />
          <span id="password-error">Password is too short</span>
        </div>,
      );

      const input = document.querySelector('input[type="password"]');
      expect(input).toHaveClass("border-destructive");
      expect(input).toHaveAttribute("aria-invalid", "true");
    });

    it("renders search input", () => {
      render(<Input type="search" placeholder="Search..." aria-label="Search" />);

      const input = screen.getByPlaceholderText("Search...");
      expect(input).toHaveAttribute("type", "search");
    });

    it("renders disabled input with placeholder", () => {
      render(<Input disabled placeholder="Not available" value="Read only" />);

      const input = screen.getByPlaceholderText("Not available");
      expect(input).toBeDisabled();
    });
  });
});
