/**
 * ErrorBoundary component tests
 * Testing error handling and fallback rendering
 */

import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import React from "react";

import { ErrorBoundary } from "../ErrorBoundary";

expect.extend(toHaveNoViolations);

// Mock the useErrorBoundary hook since it has dependencies
jest.mock("../../hooks/useErrorHandler", () => ({
  useErrorBoundary: jest.fn(() => ({
    reportError: jest.fn(),
    clearError: jest.fn(),
  })),
}));

// Component that throws an error for testing
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div data-testid="no-error">No error</div>;
};

describe("ErrorBoundary", () => {
  // Suppress console.error for cleaner test output
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Test content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("renders default error UI when child throws error", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    expect(screen.queryByTestId("no-error")).not.toBeInTheDocument();
  });

  it("renders custom fallback when provided", () => {
    const customFallback = (error: Error) => (
      <div data-testid="custom-fallback">Custom error: {error.message}</div>
    );

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.getByText("Custom error: Test error")).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      }),
    );
  });

  it("resets error when resetKeys change", () => {
    const { rerender } = render(
      <ErrorBoundary resetKeys={["key1"]}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Change resetKeys to trigger reset
    rerender(
      <ErrorBoundary resetKeys={["key2"]}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("no-error")).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it("resets error when resetOnPropsChange is true and props change", () => {
    const { rerender } = render(
      <ErrorBoundary resetOnPropsChange={true}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Change props to trigger reset
    rerender(
      <ErrorBoundary resetOnPropsChange={true}>
        <ThrowError shouldThrow={false} />
        <div>Additional content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByTestId("no-error")).toBeInTheDocument();
    expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
  });

  it("shows retry button in default error UI", () => {
    render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    const retryButton = screen.getByRole("button", { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
  });

  it("handles multiple errors correctly", () => {
    const TestWrapper = ({ resetKey = "initial" }: { resetKey?: string }) => (
      <ErrorBoundary resetKeys={[resetKey]}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    const { rerender } = render(<TestWrapper />);

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    // Change resetKeys to trigger reset
    rerender(<TestWrapper resetKey="changed" />);

    // After reset keys change, error should still be there initially
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  describe("Accessibility", () => {
    it("should be accessible with no error", async () => {
      const { container } = render(
        <ErrorBoundary>
          <div>Test content</div>
        </ErrorBoundary>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should be accessible with error state", async () => {
      const { container } = render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("error message has proper role", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
    });

    it("retry button is focusable", () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      const retryButton = screen.getByRole("button", { name: /try again/i });
      retryButton.focus();
      expect(retryButton).toHaveFocus();
    });
  });

  describe("Error details", () => {
    it("captures error message correctly", () => {
      render(
        <ErrorBoundary fallback={(error) => <div data-testid="error-message">{error.message}</div>}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId("error-message")).toHaveTextContent("Test error");
    });

    it("captures component stack in error info", () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        }),
      );
    });
  });

  describe("Edge cases", () => {
    it("handles null children gracefully", () => {
      render(<ErrorBoundary>{null}</ErrorBoundary>);
      // Should not crash
    });

    it("handles undefined fallback gracefully", () => {
      render(
        <ErrorBoundary fallback={undefined}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    });

    it("handles async errors in effects", () => {
      const AsyncErrorComponent = () => {
        React.useEffect(() => {
          // This won't be caught by ErrorBoundary, but we test the component doesn't crash
          setTimeout(() => {
            throw new Error("Async error");
          }, 0);
        }, []);

        return <div data-testid="async-component">Async component</div>;
      };

      render(
        <ErrorBoundary>
          <AsyncErrorComponent />
        </ErrorBoundary>,
      );

      expect(screen.getByTestId("async-component")).toBeInTheDocument();
    });
  });
});
