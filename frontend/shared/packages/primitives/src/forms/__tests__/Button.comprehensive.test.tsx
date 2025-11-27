/**
 * Comprehensive Button Component Tests
 * Testing all functionality, accessibility, security, and performance aspects
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { Button, type ButtonProps } from "../Button";
import * as React from "react";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock Lucide React icons
jest.mock("lucide-react", () => ({
  Loader2: ({ className }: { className?: string }) => (
    <div data-testid="loader" className={className} />
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <div data-testid="chevron-right" className={className} />
  ),
}));

// Test utilities
const renderButton = (props: Partial<ButtonProps> = {}) => {
  return render(<Button data-testid="test-button" {...props} />);
};

describe("Button Component - Comprehensive Tests", () => {
  // BASIC FUNCTIONALITY TESTS
  describe("Basic Functionality", () => {
    test("renders with default props", () => {
      renderButton({ children: "Test Button" });
      const button = screen.getByRole("button", { name: /test button/i });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("inline-flex", "items-center", "justify-center");
    });

    test("renders with custom text content", () => {
      renderButton({ children: "Custom Button Text" });
      expect(screen.getByText("Custom Button Text")).toBeInTheDocument();
    });

    test("applies variant classes correctly", () => {
      const { rerender } = renderButton({
        variant: "destructive",
        children: "Delete",
      });

      let button = screen.getByRole("button");
      expect(button).toHaveClass("bg-destructive", "text-destructive-foreground");

      rerender(
        <Button variant="outline" data-testid="test-button">
          Cancel
        </Button>,
      );
      button = screen.getByRole("button");
      expect(button).toHaveClass("border", "border-input", "bg-background");
    });

    test("applies size variants correctly", () => {
      const { rerender } = renderButton({
        size: "sm",
        children: "Small",
      });

      let button = screen.getByRole("button");
      expect(button).toHaveClass("h-8", "px-3", "text-xs");

      rerender(
        <Button size="lg" data-testid="test-button">
          Large
        </Button>,
      );
      button = screen.getByRole("button");
      expect(button).toHaveClass("h-10", "px-8");
    });
  });

  // CLICK HANDLING TESTS
  describe("Click Handling", () => {
    test("handles click events correctly", async () => {
      const handleClick = jest.fn();
      renderButton({
        onClick: handleClick,
        children: "Clickable",
      });

      const button = screen.getByRole("button");
      await userEvent.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(expect.any(Object));
    });

    test("handles secure click functionality", async () => {
      const handleSecureClick = jest.fn().mockResolvedValue(undefined);
      renderButton({
        onSecureClick: handleSecureClick,
        showAsyncLoading: true,
        children: "Secure Action",
      });

      const button = screen.getByRole("button");
      await userEvent.click(button);

      expect(handleSecureClick).toHaveBeenCalledTimes(1);
      expect(handleSecureClick).toHaveBeenCalledWith(expect.any(Object));
    });

    test("prevents multiple clicks during async operation", async () => {
      const handleSecureClick = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 100)));
      renderButton({
        onSecureClick: handleSecureClick,
        showAsyncLoading: true,
        children: "Async Action",
      });

      const button = screen.getByRole("button");

      // Click rapidly
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      // Should only be called once due to loading state
      expect(handleSecureClick).toHaveBeenCalledTimes(1);
    });
  });

  // LOADING STATES TESTS
  describe("Loading States", () => {
    test("shows loading spinner when isLoading is true", () => {
      renderButton({
        isLoading: true,
        children: "Loading Button",
      });

      expect(screen.getByTestId("loader")).toBeInTheDocument();
      expect(screen.getByRole("button")).toBeDisabled();
    });

    test("shows custom loading component when provided", () => {
      const customLoader = <div data-testid="custom-loader">Custom Loading...</div>;
      renderButton({
        isLoading: true,
        loadingComponent: customLoader,
        children: "Custom Loading",
      });

      expect(screen.getByTestId("custom-loader")).toBeInTheDocument();
      expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
    });

    test("handles async loading state correctly", async () => {
      const handleAsyncClick = jest.fn(() => new Promise((resolve) => setTimeout(resolve, 50)));
      renderButton({
        onSecureClick: handleAsyncClick,
        showAsyncLoading: true,
        children: "Async Button",
      });

      const button = screen.getByRole("button");

      // Click and immediately check loading state
      fireEvent.click(button);

      // Button should be disabled during async operation
      await waitFor(() => {
        expect(button).toBeDisabled();
      });

      // Wait for async operation to complete
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });
  });

  // ACCESSIBILITY TESTS
  describe("Accessibility", () => {
    test("has no accessibility violations", async () => {
      const { container } = renderButton({ children: "Accessible Button" });
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    test("supports keyboard navigation", async () => {
      const handleClick = jest.fn();
      renderButton({
        onClick: handleClick,
        children: "Keyboard Accessible",
      });

      const button = screen.getByRole("button");
      button.focus();

      // Test Enter key
      await userEvent.keyboard("{Enter}");
      expect(handleClick).toHaveBeenCalledTimes(1);

      // Test Space key
      await userEvent.keyboard("{Space}");
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    test("has proper ARIA attributes when disabled", () => {
      renderButton({
        disabled: true,
        children: "Disabled Button",
      });

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("disabled");
      expect(button).toHaveAttribute("aria-disabled", "true");
    });

    test("has proper ARIA attributes when loading", () => {
      renderButton({
        isLoading: true,
        children: "Loading Button",
      });

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("disabled");
      expect(button).toHaveAttribute("aria-disabled", "true");
    });
  });

  // ICON HANDLING TESTS
  describe("Icon Handling", () => {
    test("renders left icon correctly", () => {
      const leftIcon = <div data-testid="left-icon" />;
      renderButton({
        leftIcon,
        children: "With Left Icon",
      });

      expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    });

    test("renders right icon correctly", () => {
      const rightIcon = <div data-testid="right-icon" />;
      renderButton({
        rightIcon,
        children: "With Right Icon",
      });

      expect(screen.getByTestId("right-icon")).toBeInTheDocument();
    });

    test("hides icons during loading state", () => {
      const leftIcon = <div data-testid="left-icon" />;
      const rightIcon = <div data-testid="right-icon" />;

      renderButton({
        leftIcon,
        rightIcon,
        isLoading: true,
        children: "Loading with Icons",
      });

      expect(screen.queryByTestId("left-icon")).not.toBeInTheDocument();
      expect(screen.queryByTestId("right-icon")).not.toBeInTheDocument();
      expect(screen.getByTestId("loader")).toBeInTheDocument();
    });
  });

  // SECURITY TESTS
  describe("Security", () => {
    test("prevents XSS in children content", () => {
      const maliciousContent = '<script>alert("xss")</script>';
      renderButton({ children: maliciousContent });

      const button = screen.getByRole("button");
      expect(button).toHaveTextContent('<script>alert("xss")</script>');
      expect(document.querySelector("script")).not.toBeInTheDocument();
    });

    test("sanitizes className prop", () => {
      const maliciousClass = 'btn onclick="alert(\"xss\")"';
      renderButton({
        className: maliciousClass,
        children: "Test",
      });

      const button = screen.getByRole("button");
      expect(button.getAttribute("onclick")).toBeNull();
      expect(button).toHaveClass("btn");
    });

    test("handles form submission prevention", async () => {
      const mockPreventDefault = jest.fn();
      const mockEvent = {
        preventDefault: mockPreventDefault,
        currentTarget: {},
        target: {},
      } as unknown as React.MouseEvent<HTMLButtonElement>;

      renderButton({
        preventFormSubmission: true,
        onClick: (e) => e.preventDefault(),
        children: "Form Button",
      });

      const button = screen.getByRole("button");
      fireEvent.click(button);
    });
  });

  // PERFORMANCE TESTS
  describe("Performance", () => {
    test("renders efficiently with large numbers", () => {
      const startTime = performance.now();

      const buttons = Array.from({ length: 100 }, (_, i) => (
        <Button key={i} data-testid={`button-${i}`}>
          Button {i}
        </Button>
      ));

      render(<div>{buttons}</div>);

      const endTime = performance.now();

      // Should render 100 buttons quickly even in JSDOM
      expect(endTime - startTime).toBeLessThan(500);

      // Verify all buttons are rendered
      expect(screen.getAllByRole("button")).toHaveLength(100);
    });

    test("handles rapid state changes without memory leaks", async () => {
      const TestComponent = () => {
        const [loading, setLoading] = React.useState(false);

        return (
          <Button
            isLoading={loading}
            onClick={() => setLoading((prev) => !prev)}
            data-testid="toggle-button"
          >
            Toggle Loading
          </Button>
        );
      };

      render(<TestComponent />);
      const button = screen.getByTestId("toggle-button");

      // Rapidly toggle loading state
      for (let i = 0; i < 50; i++) {
        fireEvent.click(button);
      }

      // Should not crash and final state should be consistent
      expect(button).toBeInTheDocument();
    });
  });

  // AS CHILD FUNCTIONALITY TESTS
  describe("AsChild Functionality", () => {
    test("renders as Slot when asChild is true", () => {
      renderButton({
        asChild: true,
        children: <a href="#test">Link Button</a>,
      });

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "#test");
    });

    test("maintains button styling when asChild is true", () => {
      renderButton({
        asChild: true,
        variant: "destructive",
        size: "lg",
        children: <div data-testid="custom-element">Custom Element</div>,
      });

      const element = screen.getByTestId("custom-element");
      expect(element).toHaveClass("bg-destructive", "h-10", "px-8");
    });
  });

  // EDGE CASES
  describe("Edge Cases", () => {
    test("handles undefined children gracefully", () => {
      renderButton({ children: undefined });
      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
      expect(button).toBeEmptyDOMElement();
    });

    test("handles null onClick gracefully", () => {
      renderButton({
        onClick: undefined,
        children: "No Handler",
      });

      const button = screen.getByRole("button");
      expect(() => fireEvent.click(button)).not.toThrow();
    });

    test("handles async click errors gracefully", async () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
      const failingHandler = jest.fn().mockRejectedValue(new Error("Async error"));

      renderButton({
        onSecureClick: failingHandler,
        showAsyncLoading: true,
        children: "Failing Button",
      });

      const button = screen.getByRole("button");
      await userEvent.click(button);

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith("Secure click handler error:", expect.any(Error));
      });

      // Button should not remain in loading state after error
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });

      consoleError.mockRestore();
    });
  });
});
