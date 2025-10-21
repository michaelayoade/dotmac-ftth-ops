/**
 * Comprehensive Tests for Error Display System
 * Addresses critical testing gaps for error handling components
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { axe, toHaveNoViolations } from "jest-axe";

import {
  EnhancedErrorDisplay,
  CompactErrorDisplay,
  ErrorToast,
  EnhancedErrorBoundary,
} from "../ErrorDisplaySystem";
import { EnhancedISPError, ErrorCode } from "../../utils/enhancedErrorHandling";

expect.extend(toHaveNoViolations);

// Mock error instances for testing
const mockEnhancedError = new EnhancedISPError({
  code: ErrorCode.CUSTOMER_NOT_FOUND,
  message: "Customer with ID cust_12345 not found",
  context: {
    operation: "fetch_customer_profile",
    resource: "customer",
    resourceId: "cust_12345",
    businessProcess: "customer_management",
    customerImpact: "medium",
    correlationId: "req_abc123",
    metadata: {
      searchAttempts: 2,
      lastValidCustomer: "cust_12344",
    },
  },
  userActions: [
    "Verify the customer ID is correct",
    "Check for spelling errors in customer search",
    "Create a new customer if this is a new account",
  ],
});

const mockCriticalError = new EnhancedISPError({
  code: ErrorCode.SYSTEM_DATABASE_ERROR,
  message: "Database connection failed",
  context: {
    operation: "save_customer_data",
    businessProcess: "data_persistence",
    customerImpact: "critical",
    service: "customer-api",
    component: "database-client",
  },
  escalationRequired: true,
});

const mockNetworkError = new EnhancedISPError({
  code: ErrorCode.NETWORK_DEVICE_UNREACHABLE,
  message: "Router device_001 is unreachable",
  context: {
    operation: "configure_network_device",
    resource: "network_device",
    resourceId: "device_001",
    businessProcess: "network_management",
    customerImpact: "high",
    metadata: {
      deviceType: "Cisco 2960X",
      lastSeen: "2024-01-10T15:30:00Z",
      affectedCustomers: 23,
    },
  },
});

describe("EnhancedErrorDisplay", () => {
  const mockOnRetry = jest.fn();
  const mockOnContactSupport = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render error information correctly", () => {
      render(<EnhancedErrorDisplay error={mockEnhancedError} onRetry={mockOnRetry} />);

      expect(screen.getByText("Error CUST_001")).toBeInTheDocument();
      expect(screen.getByText("(customer_management)")).toBeInTheDocument();
      expect(screen.getByText("Customer with ID cust_12345 not found")).toBeInTheDocument();
      expect(screen.getByText("business • medium severity")).toBeInTheDocument();
    });

    it("should display user-friendly message and actions", () => {
      render(<EnhancedErrorDisplay error={mockEnhancedError} />);

      expect(screen.getByText(mockEnhancedError.userMessage)).toBeInTheDocument();
      expect(screen.getByText("What you can do:")).toBeInTheDocument();
      expect(screen.getByText("Verify the customer ID is correct")).toBeInTheDocument();
      expect(screen.getByText("Check for spelling errors in customer search")).toBeInTheDocument();
    });

    it("should show business context when available", () => {
      render(<EnhancedErrorDisplay error={mockEnhancedError} />);

      expect(screen.getByText("Operation: fetch_customer_profile")).toBeInTheDocument();
      expect(screen.getByText("Resource: customer (cust_12345)")).toBeInTheDocument();
    });
  });

  describe("Severity-Based Styling", () => {
    it("should apply correct styling for medium severity", () => {
      const { container } = render(<EnhancedErrorDisplay error={mockEnhancedError} />);
      const errorContainer = container.firstChild as HTMLElement;

      expect(errorContainer).toHaveClass("border-orange-200", "bg-orange-50", "text-orange-800");
    });

    it("should apply correct styling for critical severity", () => {
      const { container } = render(<EnhancedErrorDisplay error={mockCriticalError} />);
      const errorContainer = container.firstChild as HTMLElement;

      expect(errorContainer).toHaveClass("border-red-600", "bg-red-100", "text-red-900");
    });

    it("should display appropriate icon for severity level", () => {
      render(<EnhancedErrorDisplay error={mockCriticalError} />);
      expect(screen.getByRole("img", { name: "critical" })).toBeInTheDocument();
    });
  });

  describe("Interactive Features", () => {
    it("should call onRetry when retry button is clicked", async () => {
      const retryableError = new EnhancedISPError({
        ...mockEnhancedError,
        retryable: true,
      });

      render(<EnhancedErrorDisplay error={retryableError} onRetry={mockOnRetry} />);

      const retryButton = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(retryButton);

      expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it("should call onContactSupport for escalation-required errors", () => {
      render(
        <EnhancedErrorDisplay error={mockCriticalError} onContactSupport={mockOnContactSupport} />,
      );

      const supportButton = screen.getByRole("button", {
        name: /contact support/i,
      });
      fireEvent.click(supportButton);

      expect(mockOnContactSupport).toHaveBeenCalledTimes(1);
    });

    it("should call onDismiss when dismiss button is clicked", () => {
      render(<EnhancedErrorDisplay error={mockEnhancedError} onDismiss={mockOnDismiss} />);

      const dismissButton = screen.getByRole("button", {
        name: /dismiss error/i,
      });
      fireEvent.click(dismissButton);

      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe("Customer Impact Display", () => {
    it("should show customer impact warning for high impact errors", () => {
      render(<EnhancedErrorDisplay error={mockNetworkError} />);

      expect(screen.getByText("Customer Impact: high")).toBeInTheDocument();
      expect(
        screen.getByText("This error may significantly impact customer experience."),
      ).toBeInTheDocument();
    });

    it("should not show customer impact for none/low impact", () => {
      const lowImpactError = new EnhancedISPError({
        ...mockEnhancedError,
        context: {
          ...mockEnhancedError.enhancedContext,
          customerImpact: "low",
        },
      });

      render(<EnhancedErrorDisplay error={lowImpactError} />);
      expect(screen.queryByText("Customer Impact:")).not.toBeInTheDocument();
    });
  });

  describe("Technical Details", () => {
    it("should show technical details when showTechnicalDetails is true", () => {
      render(<EnhancedErrorDisplay error={mockEnhancedError} showTechnicalDetails={true} />);

      expect(screen.getByText("Technical Details")).toBeInTheDocument();

      // Open details
      fireEvent.click(screen.getByText("Technical Details"));

      expect(screen.getByText(`Error ID: ${mockEnhancedError.id}`)).toBeInTheDocument();
      expect(
        screen.getByText(`Correlation ID: ${mockEnhancedError.correlationId}`),
      ).toBeInTheDocument();
    });

    it("should not show technical details by default", () => {
      render(<EnhancedErrorDisplay error={mockEnhancedError} />);
      expect(screen.queryByText("Technical Details")).not.toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have no accessibility violations", async () => {
      const { container } = render(
        <EnhancedErrorDisplay
          error={mockEnhancedError}
          onRetry={mockOnRetry}
          onContactSupport={mockOnContactSupport}
          onDismiss={mockOnDismiss}
        />,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("should have proper ARIA attributes", () => {
      render(<EnhancedErrorDisplay error={mockEnhancedError} />);

      const dismissButton = screen.getByRole("button", {
        name: /dismiss error/i,
      });
      expect(dismissButton).toHaveAttribute("aria-label", "Dismiss error");
    });
  });
});

describe("CompactErrorDisplay", () => {
  const mockOnRetry = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render compact error information", () => {
    render(<CompactErrorDisplay error={mockEnhancedError} onRetry={mockOnRetry} />);

    expect(screen.getByText(mockEnhancedError.userMessage)).toBeInTheDocument();
    expect(screen.getByText("CUST_001")).toBeInTheDocument();
  });

  it("should show retry button for retryable errors", () => {
    const retryableError = new EnhancedISPError({
      ...mockEnhancedError,
      retryable: true,
    });

    render(<CompactErrorDisplay error={retryableError} onRetry={mockOnRetry} />);

    const retryButton = screen.getByRole("button", { name: /retry/i });
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it("should apply correct severity styling", () => {
    const { container } = render(<CompactErrorDisplay error={mockCriticalError} />);

    const errorContainer = container.firstChild as HTMLElement;
    expect(errorContainer).toHaveClass("text-red-800", "bg-red-100", "border-red-300");
  });
});

describe("ErrorToast", () => {
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should render toast with error information", () => {
    render(<ErrorToast error={mockEnhancedError} onDismiss={mockOnDismiss} />);

    expect(screen.getByText(mockEnhancedError.userMessage)).toBeInTheDocument();
    expect(screen.getByText("CUST_001")).toBeInTheDocument();
  });

  it("should auto-dismiss after specified duration", () => {
    render(<ErrorToast error={mockEnhancedError} onDismiss={mockOnDismiss} duration={3000} />);

    jest.advanceTimersByTime(3000);

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it("should not auto-dismiss critical errors", () => {
    render(<ErrorToast error={mockCriticalError} onDismiss={mockOnDismiss} duration={3000} />);

    jest.advanceTimersByTime(3000);

    expect(mockOnDismiss).not.toHaveBeenCalled();
  });

  it("should position correctly", () => {
    const { container } = render(
      <ErrorToast error={mockEnhancedError} onDismiss={mockOnDismiss} position="bottom-left" />,
    );

    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass("bottom-4", "left-4");
  });

  it("should handle manual dismiss", () => {
    render(<ErrorToast error={mockEnhancedError} onDismiss={mockOnDismiss} />);

    const dismissButton = screen.getByRole("button", {
      name: /dismiss notification/i,
    });
    fireEvent.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("EnhancedErrorBoundary", () => {
  // Component that throws an error
  const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
    if (shouldThrow) {
      throw new Error("Test error");
    }
    return <div>No error</div>;
  };

  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error for these tests
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it("should render children when no error occurs", () => {
    render(
      <EnhancedErrorBoundary>
        <ThrowError shouldThrow={false} />
      </EnhancedErrorBoundary>,
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("should render error display when error occurs", () => {
    render(
      <EnhancedErrorBoundary onError={mockOnError}>
        <ThrowError shouldThrow={true} />
      </EnhancedErrorBoundary>,
    );

    expect(screen.getByText(/Error UNKNOWN_001/)).toBeInTheDocument();
    expect(screen.getByText(/Test error/)).toBeInTheDocument();
  });

  it("should call onError callback when error occurs", () => {
    render(
      <EnhancedErrorBoundary onError={mockOnError}>
        <ThrowError shouldThrow={true} />
      </EnhancedErrorBoundary>,
    );

    expect(mockOnError).toHaveBeenCalledTimes(1);
    expect(mockOnError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: ErrorCode.UNKNOWN_ERROR,
        message: "Test error",
      }),
      expect.any(Object),
    );
  });

  it("should allow error reset", () => {
    const { rerender } = render(
      <EnhancedErrorBoundary>
        <ThrowError shouldThrow={true} />
      </EnhancedErrorBoundary>,
    );

    // Error should be displayed
    expect(screen.getByText(/Error UNKNOWN_001/)).toBeInTheDocument();

    // Click retry button
    const retryButton = screen.getByRole("button", { name: /try again/i });
    fireEvent.click(retryButton);

    // Rerender with no error
    rerender(
      <EnhancedErrorBoundary>
        <ThrowError shouldThrow={false} />
      </EnhancedErrorBoundary>,
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("should use custom fallback component if provided", () => {
    const CustomFallback: React.FC<{
      error: EnhancedISPError;
      resetError: () => void;
    }> = ({ error }) => <div>Custom error: {error.message}</div>;

    render(
      <EnhancedErrorBoundary fallback={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </EnhancedErrorBoundary>,
    );

    expect(screen.getByText("Custom error: Test error")).toBeInTheDocument();
  });
});

describe("Error Display Integration Tests", () => {
  it("should handle error response object instead of enhanced error instance", () => {
    const errorResponse = mockEnhancedError.toEnhancedResponse();

    render(<EnhancedErrorDisplay error={errorResponse} />);

    expect(screen.getByText("Error CUST_001")).toBeInTheDocument();
    expect(screen.getByText(errorResponse.userMessage)).toBeInTheDocument();
  });

  it("should handle missing optional props gracefully", () => {
    render(<EnhancedErrorDisplay error={mockEnhancedError} />);

    // Should render without crashing
    expect(screen.getByText("Error CUST_001")).toBeInTheDocument();
  });

  it("should handle errors without user actions", () => {
    const errorWithoutActions = new EnhancedISPError({
      code: ErrorCode.UNKNOWN_ERROR,
      message: "Unknown error",
      context: {
        operation: "unknown_operation",
        businessProcess: "unknown_process",
      },
      userActions: [],
    });

    render(<EnhancedErrorDisplay error={errorWithoutActions} />);

    expect(screen.queryByText("What you can do:")).not.toBeInTheDocument();
  });
});
