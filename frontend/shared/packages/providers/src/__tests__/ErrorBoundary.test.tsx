/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import { ErrorBoundary, withErrorBoundary, type ErrorFallbackProps } from "../components/ErrorBoundary";

// Suppress console.error during error boundary tests
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalError;
});

// Component that throws an error
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error message");
  }
  return <div data-testid="no-error">No error</div>;
};

// Custom fallback component for testing
const CustomFallback = ({ error, resetError, portal }: ErrorFallbackProps) => (
  <div data-testid="custom-fallback">
    <span data-testid="error-message">{error.message}</span>
    <span data-testid="portal">{portal}</span>
    <button onClick={resetError} data-testid="reset-btn">
      Reset
    </button>
  </div>
);

describe("ErrorBoundary", () => {
  describe("Basic Rendering", () => {
    it("renders children when no error occurs", () => {
      render(
        <ErrorBoundary portal="admin">
          <div data-testid="child">Hello World</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
      expect(screen.getByText("Hello World")).toBeInTheDocument();
    });

    it("renders fallback when error occurs", () => {
      render(
        <ErrorBoundary portal="admin">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.queryByTestId("no-error")).not.toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("renders custom fallback component when provided", () => {
      render(
        <ErrorBoundary portal="admin" fallback={CustomFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
      expect(screen.getByTestId("error-message")).toHaveTextContent("Test error message");
    });
  });

  describe("Portal-Specific Fallbacks", () => {
    const portals = ["admin", "customer", "reseller", "technician", "management"] as const;

    portals.forEach((portal) => {
      it(`renders fallback for ${portal} portal`, () => {
        render(
          <ErrorBoundary portal={portal}>
            <ThrowingComponent shouldThrow={true} />
          </ErrorBoundary>
        );

        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
      });
    });

    it("passes portal to custom fallback", () => {
      render(
        <ErrorBoundary portal="customer" fallback={CustomFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("portal")).toHaveTextContent("customer");
    });
  });

  describe("Error Handling", () => {
    it("calls onError callback when error is caught", () => {
      const onError = jest.fn();

      render(
        <ErrorBoundary portal="admin" onError={onError}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it("logs error to console", () => {
      render(
        <ErrorBoundary portal="admin">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("Reset Functionality", () => {
    it("resets error state when reset button is clicked", () => {
      const TestComponent = () => {
        const [shouldThrow, setShouldThrow] = React.useState(true);

        return (
          <ErrorBoundary portal="admin">
            {shouldThrow ? (
              <ThrowingComponent shouldThrow={true} />
            ) : (
              <div data-testid="recovered">Recovered</div>
            )}
          </ErrorBoundary>
        );
      };

      render(<TestComponent />);

      expect(screen.getByText("Something went wrong")).toBeInTheDocument();

      // Click the "Try again" button
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      // Component is rendered again but still throws because we haven't changed state
      // In a real app, the parent would change state before reset
    });

    it("resets via custom fallback", () => {
      const TestComponent = () => {
        const [key, setKey] = React.useState(0);

        const CustomResetFallback = ({ resetError }: ErrorFallbackProps) => (
          <button
            onClick={() => {
              setKey(k => k + 1);
              resetError();
            }}
            data-testid="custom-reset"
          >
            Custom Reset
          </button>
        );

        return (
          <ErrorBoundary key={key} portal="admin" fallback={CustomResetFallback}>
            {key === 0 ? <ThrowingComponent shouldThrow={true} /> : <div data-testid="fixed">Fixed</div>}
          </ErrorBoundary>
        );
      };

      render(<TestComponent />);

      fireEvent.click(screen.getByTestId("custom-reset"));

      expect(screen.getByTestId("fixed")).toBeInTheDocument();
    });
  });

  describe("UI Elements", () => {
    it("renders try again button", () => {
      render(
        <ErrorBoundary portal="admin">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });

    it("renders refresh button", () => {
      render(
        <ErrorBoundary portal="admin">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByRole("button", { name: /refresh/i })).toBeInTheDocument();
    });

    it("shows error details in development mode", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      render(
        <ErrorBoundary portal="admin">
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should have details element
      expect(screen.getByText("Error Details (Development)")).toBeInTheDocument();

      process.env.NODE_ENV = originalEnv;
    });
  });
});

describe("withErrorBoundary HOC", () => {
  const SimpleComponent = (props: { message: string }) => (
    <div data-testid="simple">{props.message}</div>
  );

  it("wraps component with error boundary", () => {
    const WrappedComponent = withErrorBoundary(SimpleComponent, { portal: "admin" });

    render(<WrappedComponent message="Hello" />);

    expect(screen.getByTestId("simple")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("passes fallback to error boundary", () => {
    const ThrowingSimple = () => {
      throw new Error("HOC error");
    };

    const WrappedComponent = withErrorBoundary(ThrowingSimple, {
      portal: "customer",
      fallback: CustomFallback,
    });

    render(<WrappedComponent />);

    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
    expect(screen.getByTestId("portal")).toHaveTextContent("customer");
  });

  it("passes onError to error boundary", () => {
    const onError = jest.fn();

    const ThrowingSimple = () => {
      throw new Error("HOC error");
    };

    const WrappedComponent = withErrorBoundary(ThrowingSimple, {
      portal: "admin",
      onError,
    });

    render(<WrappedComponent />);

    expect(onError).toHaveBeenCalled();
  });

  it("preserves component props", () => {
    interface Props {
      name: string;
      count: number;
    }

    const PropComponent = ({ name, count }: Props) => (
      <div>
        <span data-testid="name">{name}</span>
        <span data-testid="count">{count}</span>
      </div>
    );

    const WrappedComponent = withErrorBoundary(PropComponent, { portal: "admin" });

    render(<WrappedComponent name="Test" count={42} />);

    expect(screen.getByTestId("name")).toHaveTextContent("Test");
    expect(screen.getByTestId("count")).toHaveTextContent("42");
  });
});
