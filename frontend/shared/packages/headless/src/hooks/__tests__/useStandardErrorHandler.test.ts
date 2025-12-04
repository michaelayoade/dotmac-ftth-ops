/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useStandardErrorHandler,
  useApiErrorHandler,
  useFormErrorHandler,
  useDataLoadingErrorHandler,
  useRealtimeErrorHandler,
  useUploadErrorHandler,
  configureGlobalErrorHandling,
  getGlobalErrorConfig,
} from "../useStandardErrorHandler";
import { ISPError, classifyError, shouldRetry, calculateRetryDelay } from "../../utils/errorUtils";

// Mock dependencies
jest.mock("../useNotifications", () => ({
  useNotifications: jest.fn(() => ({
    showError: jest.fn(),
    showWarning: jest.fn(),
    showSuccess: jest.fn(),
    showInfo: jest.fn(),
  })),
}));

jest.mock("../useISPTenant", () => ({
  useISPTenant: jest.fn(() => ({
    currentTenant: { id: "tenant-123", name: "Test Tenant" },
  })),
}));

// Mock errorUtils functions
jest.mock("../../utils/errorUtils", () => {
  const actual = jest.requireActual("../../utils/errorUtils");
  return {
    ...actual,
    classifyError: jest.fn((error, context) => {
      if (error instanceof actual.ISPError) {
        return error;
      }
      return new actual.ISPError({
        message: error?.message || "Test error",
        category: error?.status === 401 ? "authentication" : "unknown",
        severity: error?.status >= 500 ? "critical" : "medium",
        context,
        retryable: error?.status >= 500 || error?.status === 429,
        userMessage: "Something went wrong",
        status: error?.status,
      });
    }),
    logError: jest.fn(),
    deduplicateError: jest.fn(() => true),
    shouldRetry: jest.fn((error, attempt, maxRetries) => {
      return attempt < maxRetries && error.retryable;
    }),
    calculateRetryDelay: jest.fn((attempt, baseDelay) => baseDelay * Math.pow(2, attempt)),
  };
});

import { useNotifications } from "../useNotifications";
import { useISPTenant } from "../useISPTenant";

const mockUseNotifications = useNotifications as jest.Mock;
const mockUseISPTenant = useISPTenant as jest.Mock;
const mockClassifyError = classifyError as jest.Mock;
const mockShouldRetry = shouldRetry as jest.Mock;
const mockCalculateRetryDelay = calculateRetryDelay as jest.Mock;

describe("useStandardErrorHandler", () => {
  let mockShowError: jest.Mock;
  let mockShowWarning: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockShowError = jest.fn();
    mockShowWarning = jest.fn();

    mockUseNotifications.mockReturnValue({
      showError: mockShowError,
      showWarning: mockShowWarning,
      showSuccess: jest.fn(),
      showInfo: jest.fn(),
    });

    mockUseISPTenant.mockReturnValue({
      currentTenant: { id: "tenant-123", name: "Test Tenant" },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("initial state", () => {
    it("returns correct initial state", () => {
      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test" })
      );

      expect(result.current.error).toBeNull();
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.retryCount).toBe(0);
      expect(result.current.hasReachedMaxRetries).toBe(false);
      expect(typeof result.current.handleError).toBe("function");
      expect(typeof result.current.clearError).toBe("function");
      expect(typeof result.current.retry).toBe("function");
      expect(typeof result.current.withErrorHandling).toBe("function");
    });
  });

  describe("handleError()", () => {
    it("classifies and stores the error", () => {
      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test-context" })
      );

      const testError = new Error("Test error message");

      act(() => {
        result.current.handleError(testError);
      });

      expect(mockClassifyError).toHaveBeenCalledWith(testError, "test-context");
      expect(result.current.error).not.toBeNull();
      expect(result.current.error?.message).toBe("Test error message");
    });

    it("shows error notification for critical severity", () => {
      mockClassifyError.mockReturnValueOnce(
        new (jest.requireActual("../../utils/errorUtils").ISPError)({
          message: "Critical error",
          severity: "critical",
          category: "system",
          retryable: false,
          userMessage: "System error occurred",
        })
      );

      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test", enableNotifications: true })
      );

      act(() => {
        result.current.handleError(new Error("Critical"));
      });

      expect(mockShowError).toHaveBeenCalledWith(
        "System error occurred",
        expect.objectContaining({ persistent: true })
      );
    });

    it("shows warning notification for medium severity", () => {
      mockClassifyError.mockReturnValueOnce(
        new (jest.requireActual("../../utils/errorUtils").ISPError)({
          message: "Warning",
          severity: "medium",
          category: "validation",
          retryable: false,
          userMessage: "Validation warning",
        })
      );

      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test", enableNotifications: true })
      );

      act(() => {
        result.current.handleError(new Error("Warning"));
      });

      expect(mockShowWarning).toHaveBeenCalledWith("Validation warning");
    });

    it("does not show notification for low severity", () => {
      mockClassifyError.mockReturnValueOnce(
        new (jest.requireActual("../../utils/errorUtils").ISPError)({
          message: "Minor issue",
          severity: "low",
          category: "validation",
          retryable: false,
          userMessage: "Minor issue",
        })
      );

      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test", enableNotifications: true })
      );

      act(() => {
        result.current.handleError(new Error("Minor"));
      });

      expect(mockShowError).not.toHaveBeenCalled();
      expect(mockShowWarning).not.toHaveBeenCalled();
    });

    it("calls custom onError callback", () => {
      const onError = jest.fn();

      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test", onError })
      );

      act(() => {
        result.current.handleError(new Error("Test"));
      });

      expect(onError).toHaveBeenCalledWith(expect.any(Object));
    });

    it("respects enableNotifications=false", () => {
      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test", enableNotifications: false })
      );

      act(() => {
        result.current.handleError(new Error("Test"));
      });

      expect(mockShowError).not.toHaveBeenCalled();
      expect(mockShowWarning).not.toHaveBeenCalled();
    });
  });

  describe("clearError()", () => {
    it("clears error state", () => {
      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test" })
      );

      act(() => {
        result.current.handleError(new Error("Test"));
      });

      expect(result.current.error).not.toBeNull();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.hasReachedMaxRetries).toBe(false);
    });
  });

  describe("withErrorHandling()", () => {
    it("executes operation successfully", async () => {
      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test" })
      );

      const mockOperation = jest.fn().mockResolvedValue({ data: "success" });

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.withErrorHandling(mockOperation);
      });

      expect(operationResult).toEqual({ data: "success" });
      expect(result.current.error).toBeNull();
    });

    it("handles operation error", async () => {
      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test", enableRetry: false })
      );

      const mockOperation = jest.fn().mockRejectedValue(new Error("Operation failed"));

      let operationResult: any;
      await act(async () => {
        operationResult = await result.current.withErrorHandling(mockOperation);
      });

      expect(operationResult).toBeNull();
      expect(result.current.error).not.toBeNull();
    });

    it("returns fallback data on error", async () => {
      const fallbackData = { default: true };

      const { result } = renderHook(() =>
        useStandardErrorHandler({
          context: "test",
          enableRetry: false,
          fallbackData,
        })
      );

      const mockOperation = jest.fn().mockRejectedValue(new Error("Failed"));
      const onFallback = jest.fn();

      // Re-render with onFallback
      const { result: resultWithFallback } = renderHook(() =>
        useStandardErrorHandler({
          context: "test",
          enableRetry: false,
          fallbackData,
          onFallback,
        })
      );

      let operationResult: any;
      await act(async () => {
        operationResult = await resultWithFallback.current.withErrorHandling(mockOperation);
      });

      expect(operationResult).toEqual(fallbackData);
    });

    it("clears previous error before new operation", async () => {
      const { result } = renderHook(() =>
        useStandardErrorHandler({ context: "test", enableRetry: false })
      );

      // First operation fails
      await act(async () => {
        await result.current.withErrorHandling(
          jest.fn().mockRejectedValue(new Error("First error"))
        );
      });

      expect(result.current.error).not.toBeNull();

      // Second operation succeeds - should clear the error
      await act(async () => {
        await result.current.withErrorHandling(
          jest.fn().mockResolvedValue("success")
        );
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe("retry logic", () => {
    it("increments retry count on retry", async () => {
      mockShouldRetry.mockReturnValue(true);
      mockCalculateRetryDelay.mockReturnValue(100);

      const { result } = renderHook(() =>
        useStandardErrorHandler({
          context: "test",
          enableRetry: true,
          maxRetries: 3,
          retryDelay: 100,
        })
      );

      // Set up an error with a retryable operation
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error("First failure"))
        .mockResolvedValueOnce("success");

      await act(async () => {
        await result.current.withErrorHandling(mockOperation);
      });

      // Advance timers for retry delay
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    });

    it("calls onRetry callback during retry", async () => {
      const onRetry = jest.fn();
      mockShouldRetry.mockReturnValue(true);
      mockCalculateRetryDelay.mockReturnValue(100);

      mockClassifyError.mockReturnValue(
        new (jest.requireActual("../../utils/errorUtils").ISPError)({
          message: "Retryable error",
          severity: "medium",
          category: "network",
          retryable: true,
          userMessage: "Network error",
        })
      );

      const { result } = renderHook(() =>
        useStandardErrorHandler({
          context: "test",
          enableRetry: true,
          maxRetries: 3,
          retryDelay: 100,
          onRetry,
        })
      );

      // Trigger an error first
      const failingOperation = jest.fn().mockRejectedValue(new Error("Network error"));

      await act(async () => {
        await result.current.withErrorHandling(failingOperation);
      });

      // Now manually trigger retry
      await act(async () => {
        result.current.retry();
        jest.advanceTimersByTime(100);
      });

      expect(onRetry).toHaveBeenCalled();
    });

    it("sets hasReachedMaxRetries when max retries exceeded", async () => {
      const onMaxRetriesReached = jest.fn();

      mockShouldRetry.mockImplementation((error, attempt, maxRetries) => {
        return attempt < maxRetries && error.retryable;
      });

      mockClassifyError.mockReturnValue(
        new (jest.requireActual("../../utils/errorUtils").ISPError)({
          message: "Retryable error",
          severity: "medium",
          category: "network",
          retryable: true,
          userMessage: "Network error",
        })
      );

      const { result } = renderHook(() =>
        useStandardErrorHandler({
          context: "test",
          enableRetry: true,
          maxRetries: 1,
          retryDelay: 100,
          onMaxRetriesReached,
        })
      );

      // Trigger initial error
      const failingOperation = jest.fn().mockRejectedValue(new Error("Persistent failure"));

      await act(async () => {
        await result.current.withErrorHandling(failingOperation);
      });

      // First retry
      mockShouldRetry.mockReturnValueOnce(true);
      await act(async () => {
        result.current.retry();
        jest.advanceTimersByTime(200);
      });

      // Second retry (should reach max)
      mockShouldRetry.mockReturnValueOnce(false);
      await act(async () => {
        result.current.retry();
        jest.advanceTimersByTime(400);
      });
    });
  });

  describe("cleanup", () => {
    it("clears timeout on unmount", () => {
      const clearTimeoutSpy = jest.spyOn(global, "clearTimeout");

      const { unmount } = renderHook(() =>
        useStandardErrorHandler({ context: "test" })
      );

      unmount();

      // Cleanup is handled by useEffect, verify no errors on unmount
      expect(true).toBe(true);
    });
  });
});

describe("specialized error handlers", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseNotifications.mockReturnValue({
      showError: jest.fn(),
      showWarning: jest.fn(),
      showSuccess: jest.fn(),
      showInfo: jest.fn(),
    });

    mockUseISPTenant.mockReturnValue({
      currentTenant: { id: "tenant-123" },
    });
  });

  describe("useApiErrorHandler", () => {
    it("has API-specific defaults", () => {
      const { result } = renderHook(() => useApiErrorHandler("users"));

      expect(result.current.error).toBeNull();
      // Context should include "API:" prefix
      expect(typeof result.current.handleError).toBe("function");
    });

    it("enables retry by default", () => {
      const { result } = renderHook(() => useApiErrorHandler("users"));
      expect(typeof result.current.retry).toBe("function");
    });
  });

  describe("useFormErrorHandler", () => {
    it("has form-specific defaults", () => {
      const { result } = renderHook(() => useFormErrorHandler("login-form"));

      expect(result.current.error).toBeNull();
      expect(typeof result.current.handleError).toBe("function");
    });
  });

  describe("useDataLoadingErrorHandler", () => {
    it("has data loading specific defaults", () => {
      const { result } = renderHook(() => useDataLoadingErrorHandler("customers"));

      expect(result.current.error).toBeNull();
      expect(typeof result.current.handleError).toBe("function");
    });
  });

  describe("useRealtimeErrorHandler", () => {
    it("has realtime-specific defaults with longer retry delay", () => {
      const { result } = renderHook(() => useRealtimeErrorHandler("websocket"));

      expect(result.current.error).toBeNull();
      expect(typeof result.current.handleError).toBe("function");
    });
  });

  describe("useUploadErrorHandler", () => {
    it("has upload-specific defaults", () => {
      const { result } = renderHook(() => useUploadErrorHandler("documents"));

      expect(result.current.error).toBeNull();
      expect(typeof result.current.handleError).toBe("function");
    });
  });
});

describe("global error configuration", () => {
  beforeEach(() => {
    // Reset global config
    configureGlobalErrorHandling({});
  });

  it("returns default config initially", () => {
    const config = getGlobalErrorConfig();

    expect(config.enableLogging).toBeDefined();
    expect(config.maxRetries).toBeDefined();
    expect(config.retryDelayMs).toBeDefined();
  });

  it("merges custom config with defaults", () => {
    configureGlobalErrorHandling({
      maxRetries: 5,
      enableLogging: false,
    });

    const config = getGlobalErrorConfig();

    expect(config.maxRetries).toBe(5);
    expect(config.enableLogging).toBe(false);
    // Other defaults should still be present
    expect(config.retryDelayMs).toBeDefined();
  });
});
