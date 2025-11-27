/**
 * Comprehensive Tests for Input Component
 *
 * Tests accessibility, security, performance, and functionality
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
  userEvent,
} from "@dotmac/testing";
import { Input } from "../Input";

describe("Input Component", () => {
  // Basic functionality tests
  describe("Basic Functionality", () => {
    it("renders correctly with default props", () => {
      const { container } = render(<Input />);
      const input = container.querySelector("input");

      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "text");
    });

    it("handles value and onChange correctly", async () => {
      const handleChange = jest.fn();
      const { user } = render(<Input value="" onChange={handleChange} />);

      const input = screen.getByRole("textbox");
      await user.type(input, "hello");

      expect(handleChange).toHaveBeenCalled();
    });

    it("displays label when provided", () => {
      render(<Input label="Username" />);
      expect(screen.getByText("Username")).toBeInTheDocument();
    });

    it("shows required indicator when required", () => {
      render(<Input label="Username" required />);
      expect(screen.getByText("*")).toBeInTheDocument();
    });

    it("displays helper text", () => {
      render(<Input helperText="Enter your username" />);
      expect(screen.getByText("Enter your username")).toBeInTheDocument();
    });

    it("shows error message", () => {
      render(<Input error="Username is required" />);
      expect(screen.getByText("Username is required")).toBeInTheDocument();
    });

    it("shows success message", () => {
      render(<Input success="Looks good!" />);
      expect(screen.getByText("Looks good!")).toBeInTheDocument();
    });
  });

  // Password functionality tests
  describe("Password Functionality", () => {
    it("renders password input with toggle", () => {
      const { container } = render(<Input type="password" showPasswordToggle />);

      const input = container.querySelector('input[type="password"]');
      const toggleButton = screen.getByRole("button", {
        name: /show password/i,
      });

      expect(input).toBeInTheDocument();
      expect(toggleButton).toBeInTheDocument();
    });

    it("toggles password visibility", async () => {
      const { user, container } = render(
        <Input type="password" showPasswordToggle value="secret" />,
      );

      const input = container.querySelector("input") as HTMLInputElement;
      const toggleButton = screen.getByRole("button", {
        name: /show password/i,
      });

      expect(input.type).toBe("password");

      await user.click(toggleButton);
      expect(input.type).toBe("text");

      await user.click(toggleButton);
      expect(input.type).toBe("password");
    });
  });

  // Validation tests
  describe("Validation", () => {
    it("validates input on change when enabled", async () => {
      const validate = jest.fn().mockReturnValue("Invalid input");
      const { user } = render(<Input validate={validate} validateOnChange />);

      const input = screen.getByRole("textbox");
      await user.type(input, "test");

      expect(validate).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByText("Invalid input")).toBeInTheDocument();
      });
    });

    it("validates input on blur when enabled", async () => {
      const validate = jest.fn().mockReturnValue("Invalid input");
      const { user } = render(<Input validate={validate} validateOnBlur />);

      const input = screen.getByRole("textbox");
      await user.type(input, "test");
      await user.tab(); // Blur the input

      expect(validate).toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByText("Invalid input")).toBeInTheDocument();
      });
    });

    it("shows character count when enabled", () => {
      render(<Input maxLength={10} showCharCount value="hello" />);

      expect(screen.getByText("5/10")).toBeInTheDocument();
    });

    it("highlights character limit exceeded", () => {
      const { container } = render(<Input maxLength={5} showCharCount value="hello world" />);

      const charCount = screen.getByText("11/5");
      expect(charCount).toHaveClass("text-destructive");
    });
  });

  // Security tests
  describe("Security", () => {
    it("sanitizes input by default", async () => {
      const handleChange = jest.fn();
      const { user } = render(<Input onChange={handleChange} sanitize />);

      const input = screen.getByRole("textbox");
      await user.type(input, '<script>alert("xss")</script>');

      // Check that the onChange handler received sanitized value
      const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1];
      expect(lastCall[0].target.value).not.toContain("<script>");
    });

    it("passes security validation", async () => {
      const result = await renderSecurity(<Input value="safe input" />);

      expect(result.container).toHaveNoSecurityViolations();
    });

    it("removes javascript: urls", async () => {
      const handleChange = jest.fn();
      const { user } = render(<Input onChange={handleChange} sanitize />);

      const input = screen.getByRole("textbox");
      await user.type(input, 'javascript:alert("xss")');

      const lastCall = handleChange.mock.calls[handleChange.mock.calls.length - 1];
      expect(lastCall[0].target.value).not.toContain("javascript:");
    });
  });

  // Accessibility tests
  describe("Accessibility", () => {
    it("is accessible", async () => {
      await renderA11y(<Input label="Username" helperText="Enter your username" />);
    });

    it("has proper aria attributes", () => {
      render(<Input label="Username" error="Required field" helperText="Enter your username" />);

      const input = screen.getByRole("textbox");
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveAttribute("aria-describedby");
    });

    it("associates label correctly", () => {
      render(<Input label="Username" />);

      const input = screen.getByRole("textbox");
      const label = screen.getByText("Username");

      expect(input).toHaveAccessibleName("Username");
    });

    it("is keyboard navigable", () => {
      render(<Input showPasswordToggle type="password" />);

      const input = screen.getByRole("textbox");
      const toggleButton = screen.getByRole("button");

      expect(input).toHaveAttribute("tabindex", "0");
      expect(toggleButton).not.toHaveAttribute("tabindex", "-1");
    });

    it("supports screen readers", () => {
      render(
        <Input label="Password" type="password" error="Password is required" showPasswordToggle />,
      );

      const toggleButton = screen.getByRole("button", {
        name: /show password/i,
      });
      expect(toggleButton).toHaveAttribute("aria-label");
    });
  });

  // Performance tests
  describe("Performance", () => {
    it("renders within performance threshold", () => {
      const result = renderPerformance(<Input />);
      const metrics = result.measurePerformance();

      expect(metrics).toBePerformant();
      expect(metrics.domNodes).toBeLessThan(20); // Input shouldn't create many DOM nodes
    });

    it("handles large values efficiently", () => {
      const largeValue = "a".repeat(1000);
      const result = renderPerformance(<Input value={largeValue} />);

      const metrics = result.measurePerformance();
      expect(metrics).toBePerformant(50); // Allow more time for large values
    });
  });

  // Loading state tests
  describe("Loading State", () => {
    it("shows loading spinner when loading", () => {
      const { container } = render(<Input isLoading />);
      const spinner = container.querySelector(".animate-spin");

      expect(spinner).toBeInTheDocument();
    });

    it("disables input when loading", () => {
      render(<Input isLoading />);
      const input = screen.getByRole("textbox");

      expect(input).toBeDisabled();
    });
  });

  // Variant tests
  describe("Variants", () => {
    it("applies error variant styling", () => {
      const { container } = render(<Input variant="error" />);
      const input = container.querySelector("input");

      expect(input).toHaveClass("border-destructive");
    });

    it("applies success variant styling", () => {
      const { container } = render(<Input variant="success" />);
      const input = container.querySelector("input");

      expect(input).toHaveClass("border-success");
    });

    it("applies different sizes", () => {
      const { container: smallContainer } = render(<Input size="sm" />);
      const { container: largeContainer } = render(<Input size="lg" />);

      const smallInput = smallContainer.querySelector("input");
      const largeInput = largeContainer.querySelector("input");

      expect(smallInput).toHaveClass("h-8");
      expect(largeInput).toHaveClass("h-10");
    });
  });

  // Icon tests
  describe("Icons", () => {
    it("displays left icon", () => {
      const LeftIcon = () => <span data-testid="left-icon">📧</span>;
      const { container } = render(<Input leftIcon={<LeftIcon />} />);

      expect(screen.getByTestId("left-icon")).toBeInTheDocument();

      const input = container.querySelector("input");
      expect(input).toHaveClass("pl-10");
    });

    it("displays right icon", () => {
      const RightIcon = () => <span data-testid="right-icon">🔍</span>;
      const { container } = render(<Input rightIcon={<RightIcon />} />);

      expect(screen.getByTestId("right-icon")).toBeInTheDocument();

      const input = container.querySelector("input");
      expect(input).toHaveClass("pr-10");
    });
  });

  // Comprehensive test
  describe("Comprehensive Testing", () => {
    it("passes all comprehensive tests", async () => {
      const { result, metrics } = await renderComprehensive(
        <Input
          label="Email Address"
          type="email"
          helperText="We'll never share your email"
          required
        />,
      );

      // All tests should pass
      await expect(result.container).toBeAccessible();
      expect(result.container).toHaveNoSecurityViolations();
      expect(metrics).toBePerformant();
      expect(result.container).toHaveValidMarkup();
    });
  });
});
