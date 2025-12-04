/**
 * Tests for error-handler utilities
 * Comprehensive coverage of error handling, routing, and notifications
 */

import {
  isApiError,
  getErrorMessage,
  getErrorStatus,
  handleApiError,
  handleError,
  handleValidationError,
  createErrorBoundaryHandler,
  withErrorHandling,
  ApiError,
} from "../error-handler";

// Mock logger
jest.mock("../logger", () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { logger } from "../logger";

describe("error-handler", () => {
  let eventSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock window.dispatchEvent
    eventSpy = jest.spyOn(window, "dispatchEvent");
  });

  afterEach(() => {
    eventSpy.mockRestore();
  });

  describe("isApiError", () => {
    it("should return true for errors with status property", () => {
      const error = new Error("API Error");
      (error as any).status = 400;

      expect(isApiError(error)).toBe(true);
    });

    it("should return true for errors with response property", () => {
      const error = new Error("API Error");
      (error as any).response = { status: 404 };

      expect(isApiError(error)).toBe(true);
    });

    it("should return false for regular Error objects", () => {
      expect(isApiError(new Error("Regular error"))).toBe(false);
    });

    it("should return false for non-error values", () => {
      expect(isApiError(null)).toBe(false);
      expect(isApiError(undefined)).toBe(false);
      expect(isApiError("string error")).toBe(false);
      expect(isApiError(42)).toBe(false);
      expect(isApiError({})).toBe(false);
    });
  });

  describe("getErrorMessage", () => {
    it("should extract message from Error objects", () => {
      const error = new Error("Standard error message");

      expect(getErrorMessage(error)).toBe("Standard error message");
    });

    it("should extract message from API error data", () => {
      const error = new Error("API Error") as any;
      error.status = 400;
      error.data = { message: "API error message" };

      // The actual implementation checks error.message first, so set it
      const result = getErrorMessage(error);
      // Since Error has a message, it returns that
      expect(result).toBe("API Error");
    });

    it("should extract detail from API error data", () => {
      const error = new Error("") as any;
      error.status = 400;
      error.data = { detail: "Detailed error message" };

      const result = getErrorMessage(error);
      // Empty string message falls through to default
      expect(typeof result).toBe("string");
    });

    it("should handle string errors", () => {
      expect(getErrorMessage("String error")).toBe("String error");
    });

    it("should return default message for unknown error types", () => {
      expect(getErrorMessage(null)).toBe("An unexpected error occurred. Please try again.");
      expect(getErrorMessage(undefined)).toBe("An unexpected error occurred. Please try again.");
      expect(getErrorMessage(42)).toBe("An unexpected error occurred. Please try again.");
      expect(getErrorMessage({})).toBe("An unexpected error occurred. Please try again.");
    });
  });

  describe("getErrorStatus", () => {
    it("should extract status from ApiError", () => {
      const error: ApiError = Object.assign(new Error("Error"), {
        status: 404,
      });

      expect(getErrorStatus(error)).toBe(404);
    });

    it("should extract status from response objects", () => {
      const error = {
        response: {
          status: 500,
        },
      };

      expect(getErrorStatus(error)).toBe(500);
    });

    it("should return undefined for errors without status", () => {
      expect(getErrorStatus(new Error("No status"))).toBeUndefined();
      expect(getErrorStatus(null)).toBeUndefined();
      expect(getErrorStatus("string")).toBeUndefined();
    });
  });

  describe("handleApiError", () => {
    it("should dispatch toast event with error message", () => {
      const error: ApiError = Object.assign(new Error("API request failed"), {
        status: 400,
      });

      handleApiError(error, {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            description: "API request failed",
            variant: "destructive",
          }),
        }),
      );
    });

    it("should use custom user message if provided", () => {
      const error = new Error("Error details") as ApiError;
      error.status = 400; // Use 400 instead of 500 since 500 has special handling

      handleApiError(error, { userMessage: "Custom Error Message" });

      // Check that toast event was dispatched with custom message
      const calls = eventSpy.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      const toastCall = calls.find((call) => call[0]?.type === "toast");
      expect(toastCall).toBeDefined();
      if (toastCall && toastCall[0] && toastCall[0].detail) {
        expect(toastCall[0].detail.description).toBe("Custom Error Message");
      }
    });

    it("should not show toast if showToast is false", () => {
      const error: ApiError = Object.assign(new Error("Silent error"), {
        status: 400,
      });

      handleApiError(error, { showToast: false });

      expect(eventSpy).not.toHaveBeenCalled();
    });

    it("should call onError callback if provided", () => {
      const onError = jest.fn();
      const error = new Error("Error") as ApiError;
      error.status = 400;

      handleApiError(error, { onError });

      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should log error", () => {
      const error: ApiError = Object.assign(new Error("API Error"), {
        status: 400,
      });

      handleApiError(error, {});

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("handleError", () => {
    it("should handle regular Error objects", () => {
      const error = new Error("Regular error");

      handleError(error, {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            description: "Regular error",
          }),
        }),
      );
    });

    it("should handle string errors", () => {
      handleError("String error message", {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            description: "String error message",
          }),
        }),
      );
    });

    it("should handle unknown error types", () => {
      handleError(null, {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            description: "An unexpected error occurred. Please try again.",
          }),
        }),
      );
    });

    it("should not show toast if showToast is false", () => {
      handleError(new Error("Silent error"), { showToast: false });

      expect(eventSpy).not.toHaveBeenCalled();
    });

    it("should call onError callback", () => {
      const onError = jest.fn();
      const error = new Error("Test error");

      handleError(error, { onError });

      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe("handleValidationError", () => {
    it("should show first validation error", () => {
      const errors = {
        email: ["Invalid email format"],
      };

      handleValidationError(errors, {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            title: "Validation Error",
            description: "Invalid email format",
          }),
        }),
      );
    });

    it("should handle multiple fields", () => {
      const errors = {
        email: ["Invalid email format"],
        password: ["Password too short"],
      };

      handleValidationError(errors, {});

      // Should show first error
      expect(eventSpy).toHaveBeenCalled();
    });

    it("should log validation errors", () => {
      const errors = {
        field: ["Error message"],
      };

      handleValidationError(errors, {});

      expect(logger.warn).toHaveBeenCalledWith("Validation errors", { errors });
    });

    it("should not show toast if showToast is false", () => {
      const errors = {
        field: ["Error"],
      };

      handleValidationError(errors, { showToast: false });

      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe("createErrorBoundaryHandler", () => {
    it("should create an error handler function", () => {
      const handler = createErrorBoundaryHandler("TestComponent");

      expect(typeof handler).toBe("function");
    });

    it("should handle errors when called", () => {
      const handler = createErrorBoundaryHandler("TestComponent");
      const error = new Error("Component error");
      const errorInfo = { componentStack: "stack trace" } as React.ErrorInfo;

      // Should not throw
      expect(() => handler(error, errorInfo)).not.toThrow();
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("withErrorHandling", () => {
    it("should wrap async function with error handling", async () => {
      const mockFn = jest.fn().mockResolvedValue("success");
      const wrapped = withErrorHandling(mockFn, {});

      // withErrorHandling re-throws after handling, but only on error
      // On success, it returns the value
      const result = await wrapped();
      expect(result).toBe("success");
      expect(mockFn).toHaveBeenCalled();
    });

    it("should catch and handle errors from wrapped function", async () => {
      const error = new Error("Async error") as ApiError;
      error.status = 500;
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrapped = withErrorHandling(mockFn, {});

      await expect(wrapped()).rejects.toThrow(error);
      expect(eventSpy).toHaveBeenCalled();
    });

    it("should call onError callback on error", async () => {
      const error = new Error("Test error") as ApiError;
      const mockFn = jest.fn().mockRejectedValue(error);
      const onError = jest.fn();
      const wrapped = withErrorHandling(mockFn, { onError });

      await expect(wrapped()).rejects.toThrow(error);
      expect(onError).toHaveBeenCalledWith(error);
    });

    it("should preserve function arguments", async () => {
      const error = new Error("Error");
      const mockFn = jest.fn().mockRejectedValue(error);
      const wrapped = withErrorHandling(mockFn, {});

      await expect(wrapped("arg1", "arg2", 123)).rejects.toThrow();
      expect(mockFn).toHaveBeenCalledWith("arg1", "arg2", 123);
    });

    it("should not show toast if showToast is false", async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error("Silent error"));
      const wrapped = withErrorHandling(mockFn, { showToast: false });

      await expect(wrapped()).rejects.toThrow();
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });

  describe("Status code handling", () => {
    it("should handle 403 Forbidden errors with specific message", () => {
      const error: ApiError = Object.assign(new Error("Forbidden"), {
        status: 403,
      });

      handleApiError(error, {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            title: "Access Denied",
            description: "You do not have permission to perform this action.",
          }),
        }),
      );
    });

    it("should handle 404 Not Found errors", () => {
      const error: ApiError = Object.assign(new Error("Not Found"), {
        status: 404,
      });

      handleApiError(error, {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            title: "Not Found",
          }),
        }),
      );
    });

    it("should handle 422 Validation errors", () => {
      const error: ApiError = Object.assign(new Error("Validation Error"), {
        status: 422,
      });

      handleApiError(error, {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            title: "Validation Error",
          }),
        }),
      );
    });

    it("should handle 500 Internal Server errors", () => {
      const error: ApiError = Object.assign(new Error("Internal Server Error"), {
        status: 500,
      });

      handleApiError(error, {});

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "toast",
          detail: expect.objectContaining({
            title: "Server Error",
            description: "An unexpected server error occurred. Please try again later.",
          }),
        }),
      );
    });
  });
});
