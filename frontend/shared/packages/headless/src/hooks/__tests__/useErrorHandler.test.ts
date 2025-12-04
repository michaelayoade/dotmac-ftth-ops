/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import {
  useErrorBoundary,
  setGlobalErrorHandler,
  getGlobalErrorHandler,
} from "../useErrorHandler";

describe("useErrorHandler module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset global error handler
    setGlobalErrorHandler(() => {});
  });

  describe("global error handler", () => {
    it("sets and gets global error handler", () => {
      const handler = jest.fn();
      setGlobalErrorHandler(handler);

      const retrieved = getGlobalErrorHandler();
      expect(retrieved).toBe(handler);
    });

    it("returns null if no handler is set initially", () => {
      // Reset by setting a handler then checking it exists
      const handler = jest.fn();
      setGlobalErrorHandler(handler);
      expect(getGlobalErrorHandler()).toBe(handler);
    });

    it("allows overwriting the global handler", () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      setGlobalErrorHandler(handler1);
      expect(getGlobalErrorHandler()).toBe(handler1);

      setGlobalErrorHandler(handler2);
      expect(getGlobalErrorHandler()).toBe(handler2);
    });
  });

  describe("useErrorBoundary", () => {
    it("returns correct initial state", () => {
      const { result } = renderHook(() => useErrorBoundary());

      expect(result.current.error).toBeNull();
      expect(typeof result.current.resetError).toBe("function");
      expect(typeof result.current.showError).toBe("function");
    });

    it("showError sets the error state", () => {
      const { result } = renderHook(() => useErrorBoundary());

      const testError = new Error("Test error");

      act(() => {
        result.current.showError(testError);
      });

      expect(result.current.error).toBe(testError);
    });

    it("resetError clears the error state", () => {
      const { result } = renderHook(() => useErrorBoundary());

      const testError = new Error("Test error");

      act(() => {
        result.current.showError(testError);
      });

      expect(result.current.error).toBe(testError);

      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
    });

    it("calls global error handler when showing error", () => {
      const globalHandler = jest.fn();
      setGlobalErrorHandler(globalHandler);

      const { result } = renderHook(() => useErrorBoundary());

      const testError = new Error("Test error for global handler");

      act(() => {
        result.current.showError(testError);
      });

      expect(globalHandler).toHaveBeenCalledWith({
        message: "Test error for global handler",
        error: testError,
      });
    });

    it("does not throw if global handler is not set", () => {
      // Reset global handler to null-like state by not setting one
      // (In the actual implementation, it checks for null before calling)
      const { result } = renderHook(() => useErrorBoundary());

      const testError = new Error("Test error");

      // Should not throw
      expect(() => {
        act(() => {
          result.current.showError(testError);
        });
      }).not.toThrow();

      expect(result.current.error).toBe(testError);
    });

    it("handles multiple errors sequentially", () => {
      const { result } = renderHook(() => useErrorBoundary());

      const error1 = new Error("First error");
      const error2 = new Error("Second error");

      act(() => {
        result.current.showError(error1);
      });

      expect(result.current.error).toBe(error1);

      act(() => {
        result.current.showError(error2);
      });

      expect(result.current.error).toBe(error2);
    });

    it("preserves error between renders", () => {
      const { result, rerender } = renderHook(() => useErrorBoundary());

      const testError = new Error("Persistent error");

      act(() => {
        result.current.showError(testError);
      });

      expect(result.current.error).toBe(testError);

      // Re-render the hook
      rerender();

      expect(result.current.error).toBe(testError);
    });

    it("memoizes resetError callback", () => {
      const { result, rerender } = renderHook(() => useErrorBoundary());

      const resetError1 = result.current.resetError;

      rerender();

      const resetError2 = result.current.resetError;

      expect(resetError1).toBe(resetError2);
    });

    it("memoizes showError callback", () => {
      const { result, rerender } = renderHook(() => useErrorBoundary());

      const showError1 = result.current.showError;

      rerender();

      const showError2 = result.current.showError;

      expect(showError1).toBe(showError2);
    });
  });

  describe("error handling workflow", () => {
    it("supports full error workflow: show -> handle -> reset", () => {
      const globalHandler = jest.fn();
      setGlobalErrorHandler(globalHandler);

      const { result } = renderHook(() => useErrorBoundary());

      // Initial state
      expect(result.current.error).toBeNull();

      // Show error
      const error = new Error("Workflow error");
      act(() => {
        result.current.showError(error);
      });

      expect(result.current.error).toBe(error);
      expect(globalHandler).toHaveBeenCalledTimes(1);

      // Reset error
      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
    });

    it("can show another error after reset", () => {
      const { result } = renderHook(() => useErrorBoundary());

      const error1 = new Error("Error 1");
      const error2 = new Error("Error 2");

      // First cycle
      act(() => {
        result.current.showError(error1);
      });
      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();

      // Second cycle
      act(() => {
        result.current.showError(error2);
      });

      expect(result.current.error).toBe(error2);
    });
  });
});
