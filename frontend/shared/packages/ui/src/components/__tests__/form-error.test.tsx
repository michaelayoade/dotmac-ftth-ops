/**
 * Form Error Component Tests
 *
 * Tests FormError component for displaying form validation errors
 */

import { render, screen } from "@testing-library/react";
import React from "react";

import { FormError } from "../form-error";

describe("FormError", () => {
  describe("Basic Rendering", () => {
    it("renders error message when error is provided", () => {
      render(<FormError error="This field is required" />);

      expect(screen.getByText("This field is required")).toBeInTheDocument();
    });

    it("does not render when error is undefined", () => {
      const { container } = render(<FormError error={undefined} />);

      expect(container.firstChild).toBeNull();
    });

    it("does not render when error is empty string", () => {
      const { container } = render(<FormError error="" />);

      expect(container.firstChild).toBeNull();
    });

    it("renders error icon", () => {
      const { container } = render(<FormError error="Error message" />);

      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
    });

    it("icon is aria-hidden", () => {
      const { container } = render(<FormError error="Error message" />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  describe("Accessibility", () => {
    it("has role alert", () => {
      const { container } = render(<FormError error="Error message" />);

      const errorElement = container.firstChild;
      expect(errorElement).toHaveAttribute("role", "alert");
    });

    it("has aria-live polite", () => {
      const { container } = render(<FormError error="Error message" />);

      const errorElement = container.firstChild;
      expect(errorElement).toHaveAttribute("aria-live", "polite");
    });

    it("applies id when provided", () => {
      const { container } = render(<FormError id="email-error" error="Invalid email" />);

      const errorElement = container.firstChild;
      expect(errorElement).toHaveAttribute("id", "email-error");
    });

    it("does not apply id when not provided", () => {
      const { container } = render(<FormError error="Error message" />);

      const errorElement = container.firstChild;
      expect(errorElement).not.toHaveAttribute("id");
    });
  });

  describe("Styling", () => {
    it("applies default error styles", () => {
      const { container } = render(<FormError error="Error message" />);

      const errorElement = container.firstChild;
      expect(errorElement).toHaveClass("text-red-400", "text-sm", "mt-1");
    });

    it("applies custom className", () => {
      const { container } = render(<FormError error="Error message" className="custom-error" />);

      const errorElement = container.firstChild;
      expect(errorElement).toHaveClass("custom-error");
    });

    it("has flex layout with gap", () => {
      const { container } = render(<FormError error="Error message" />);

      const errorElement = container.firstChild;
      expect(errorElement).toHaveClass("flex", "items-center", "gap-2");
    });

    it("icon has flex-shrink-0", () => {
      const { container } = render(<FormError error="Error message" />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("flex-shrink-0");
    });

    it("icon has correct size", () => {
      const { container } = render(<FormError error="Error message" />);

      const icon = container.querySelector("svg");
      expect(icon).toHaveClass("h-4", "w-4");
    });
  });

  describe("Error Messages", () => {
    it("renders required field error", () => {
      render(<FormError error="This field is required" />);

      expect(screen.getByText("This field is required")).toBeInTheDocument();
    });

    it("renders validation error", () => {
      render(<FormError error="Please enter a valid email address" />);

      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
    });

    it("renders custom error message", () => {
      render(<FormError error="Password must be at least 8 characters" />);

      expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    });

    it("renders long error message", () => {
      const longError =
        "This is a very long error message that explains in detail what went wrong with the validation and how to fix it.";
      render(<FormError error={longError} />);

      expect(screen.getByText(longError)).toBeInTheDocument();
    });

    it("renders error with special characters", () => {
      render(<FormError error="Email 'user@example.com' is already registered" />);

      expect(
        screen.getByText("Email 'user@example.com' is already registered"),
      ).toBeInTheDocument();
    });
  });

  describe("Integration with Forms", () => {
    it("renders below input field", () => {
      const { container } = render(
        <div>
          <input type="text" aria-describedby="email-error" />
          <FormError id="email-error" error="Invalid email" />
        </div>,
      );

      const input = container.querySelector("input");
      const error = container.querySelector("#email-error");

      expect(input).toHaveAttribute("aria-describedby", "email-error");
      expect(error).toBeInTheDocument();
    });

    it("works with multiple form fields", () => {
      render(
        <div>
          <FormError id="email-error" error="Invalid email" />
          <FormError id="password-error" error="Password too short" />
        </div>,
      );

      expect(screen.getByText("Invalid email")).toBeInTheDocument();
      expect(screen.getByText("Password too short")).toBeInTheDocument();
    });

    it("can be conditionally rendered", () => {
      const { rerender } = render(<FormError error="Error message" />);

      expect(screen.getByText("Error message")).toBeInTheDocument();

      rerender(<FormError error="" />);

      expect(screen.queryByText("Error message")).not.toBeInTheDocument();
    });
  });

  describe("Real-World Usage Patterns", () => {
    it("renders email validation error", () => {
      render(<FormError id="email-error" error="Please enter a valid email address" />);

      expect(screen.getByText("Please enter a valid email address")).toBeInTheDocument();
    });

    it("renders password validation error", () => {
      render(
        <FormError
          id="password-error"
          error="Password must contain at least one uppercase letter, one lowercase letter, and one number"
        />,
      );

      expect(
        screen.getByText(
          "Password must contain at least one uppercase letter, one lowercase letter, and one number",
        ),
      ).toBeInTheDocument();
    });

    it("renders required field error", () => {
      render(<FormError id="username-error" error="Username is required" />);

      expect(screen.getByText("Username is required")).toBeInTheDocument();
    });

    it("renders server validation error", () => {
      render(
        <FormError id="submit-error" error="Unable to submit form. Please try again later." />,
      );

      expect(
        screen.getByText("Unable to submit form. Please try again later."),
      ).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles null error", () => {
      const { container } = render(<FormError error={null as unknown as string} />);

      expect(container.firstChild).toBeNull();
    });

    it("handles whitespace-only error", () => {
      const { container } = render(<FormError error="   " />);

      // Whitespace is considered a falsy value for our purposes
      // The component renders it but it's effectively empty
      expect(container.querySelector(".text-red-400")).toBeInTheDocument();
    });

    it("renders with className and id together", () => {
      const { container } = render(
        <FormError id="test-error" error="Error" className="custom-class" />,
      );

      const errorElement = container.firstChild;
      expect(errorElement).toHaveAttribute("id", "test-error");
      expect(errorElement).toHaveClass("custom-class");
    });

    it("handles rapid error changes", () => {
      const { rerender } = render(<FormError error="Error 1" />);

      expect(screen.getByText("Error 1")).toBeInTheDocument();

      rerender(<FormError error="Error 2" />);

      expect(screen.queryByText("Error 1")).not.toBeInTheDocument();
      expect(screen.getByText("Error 2")).toBeInTheDocument();

      rerender(<FormError error="" />);

      expect(screen.queryByText("Error 2")).not.toBeInTheDocument();
    });
  });

  describe("Component Structure", () => {
    it("wraps text in span", () => {
      const { container } = render(<FormError error="Error message" />);

      const span = container.querySelector("span");
      expect(span).toHaveTextContent("Error message");
    });

    it("maintains icon and text order", () => {
      const { container } = render(<FormError error="Error message" />);

      const errorElement = container.firstChild;
      const children = errorElement?.childNodes;

      expect(children?.[0].nodeName).toBe("svg"); // Icon first
      expect(children?.[1].nodeName).toBe("SPAN"); // Text second
    });
  });
});
