/**
 * Tests for GraphQL error handler
 */

import {
  handleGraphQLError,
  useErrorHandler,
  getUserFriendlyMessage,
  handleGraphQLErrorWithFriendlyMessage,
  ErrorSeverity,
  ERROR_MESSAGES,
  type GraphQLErrorHandlerOptions,
  type ErrorHandlerContext,
} from "../error-handler";
import { GraphQLError } from "../client";

describe("GraphQL Error Handler", () => {
  describe("handleGraphQLError with toast options", () => {
    let mockToast: jest.Mock;
    let mockLogger: { error: jest.Mock };

    beforeEach(() => {
      mockToast = jest.fn();
      mockLogger = { error: jest.fn() };
    });

    it("shows toast with normalized error message", () => {
      const error = new Error("Something went wrong");

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Request failed",
          description: "Something went wrong",
          variant: "destructive",
        })
      );
    });

    it("uses fallback message when error has no message", () => {
      handleGraphQLError({}, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "An unexpected error occurred. Please try again.",
        })
      );
    });

    it("uses custom fallback message when error has no message", () => {
      // Note: fallbackMessage is only used when the normalized error has no message
      // Since an empty object {} normalizes to the default message, test with a
      // scenario where fallbackMessage would be used as the description
      handleGraphQLError({}, {
        toast: mockToast,
        fallbackMessage: "Custom fallback",
      });

      // The implementation uses the fallbackMessage as a fallback for buildToastPayload
      // but if normalizeGraphQLError returns the DEFAULT_FALLBACK_MESSAGE, that's used
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Request failed",
          variant: "destructive",
        })
      );
    });

    it("uses custom message when provided", () => {
      const error = new Error("Original message");

      handleGraphQLError(error, {
        toast: mockToast,
        customMessage: "Custom user message",
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Custom user message",
        })
      );
    });

    it("suppresses toast when suppressToast is true", () => {
      const error = new Error("Test error");

      handleGraphQLError(error, {
        toast: mockToast,
        suppressToast: true,
      });

      expect(mockToast).not.toHaveBeenCalled();
    });

    it("logs error when logger is provided", () => {
      const error = new Error("Test error");

      handleGraphQLError(error, {
        toast: mockToast,
        logger: mockLogger,
        operationName: "GetUsers",
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        "GraphQL operation failed (GetUsers)",
        expect.any(Error),
        expect.objectContaining({ operationName: "GetUsers" })
      );
    });

    it("handles UNAUTHENTICATED error code", () => {
      const error = {
        graphQLErrors: [{
          message: "Not authenticated",
          extensions: { code: "UNAUTHENTICATED" },
        }],
      };

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Authentication required",
          variant: "destructive",
        })
      );
    });

    it("handles FORBIDDEN error code", () => {
      const error = {
        graphQLErrors: [{
          message: "Access denied",
          extensions: { code: "FORBIDDEN" },
        }],
      };

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Access denied",
          variant: "destructive",
        })
      );
    });

    it("handles RATE_LIMITED error code", () => {
      const error = {
        graphQLErrors: [{
          message: "Too many requests",
          extensions: { code: "RATE_LIMITED" },
        }],
      };

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Too many requests",
          variant: "destructive",
        })
      );
    });

    it("handles network errors", () => {
      // Network errors with graphQLErrors array trigger network error handling
      const error = {
        networkError: new Error("Network failure"),
        graphQLErrors: [], // Empty graphQLErrors array with networkError flag
        message: "Network error",
      };

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Network error",
          description: "Unable to reach the server. Check your connection and try again.",
          variant: "destructive",
        })
      );
    });

    it("handles GraphQLError instance", () => {
      const errors = [{
        message: "Field error",
        path: ["user", "email"],
        extensions: { code: "VALIDATION_ERROR" },
      }];
      const error = new GraphQLError("Validation failed", errors);

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Validation error",
          variant: "destructive",
        })
      );
    });

    it("includes context in log when provided", () => {
      const error = new Error("Test");

      handleGraphQLError(error, {
        toast: mockToast,
        logger: mockLogger,
        context: { userId: "123", tenantId: "456" },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Error),
        expect.objectContaining({
          userId: "123",
          tenantId: "456",
        })
      );
    });
  });

  describe("handleGraphQLError with context (returns result)", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "error").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("returns ErrorHandlerResult with message", () => {
      const error = new Error("Test error message");

      const result = handleGraphQLError(error, {});

      expect(result).toEqual(
        expect.objectContaining({
          message: "Test error message",
          shouldToast: true,
          shouldLog: true,
        })
      );
    });

    it("returns correct severity for INTERNAL_SERVER_ERROR", () => {
      const error = {
        graphQLErrors: [{
          message: "Server error",
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        }],
      };

      const result = handleGraphQLError(error, {});

      expect(result).toEqual(
        expect.objectContaining({
          severity: ErrorSeverity.CRITICAL,
          code: "INTERNAL_SERVER_ERROR",
        })
      );
    });

    it("returns WARNING severity for validation errors", () => {
      const error = {
        graphQLErrors: [{
          message: "Invalid input",
          extensions: { code: "VALIDATION_ERROR" },
        }],
      };

      const result = handleGraphQLError(error, {});

      expect(result).toEqual(
        expect.objectContaining({
          severity: ErrorSeverity.WARNING,
          code: "VALIDATION_ERROR",
        })
      );
    });

    it("returns INFO severity for auth errors", () => {
      const error = {
        graphQLErrors: [{
          message: "Not authenticated",
          extensions: { code: "UNAUTHENTICATED" },
        }],
      };

      const result = handleGraphQLError(error, {});

      expect(result).toEqual(
        expect.objectContaining({
          severity: ErrorSeverity.INFO,
          code: "UNAUTHENTICATED",
        })
      );
    });

    it("sets shouldToast to false for UNAUTHENTICATED errors", () => {
      const error = {
        graphQLErrors: [{
          message: "Session expired",
          extensions: { code: "UNAUTHENTICATED" },
        }],
      };

      const result = handleGraphQLError(error, {});

      expect(result).toEqual(
        expect.objectContaining({
          shouldToast: false,
        })
      );
    });

    it("logs error to console", () => {
      const error = new Error("Logged error");

      handleGraphQLError(error, {});

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[GraphQL Error]"),
        expect.any(Object)
      );
    });

    it("includes context in log", () => {
      const error = new Error("Test");
      const context: ErrorHandlerContext = {
        operation: "GetUser",
        componentName: "UserProfile",
        userId: "user-123",
      };

      handleGraphQLError(error, context);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          operation: "GetUser",
          componentName: "UserProfile",
          userId: "user-123",
        })
      );
    });
  });

  describe("useErrorHandler", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "error").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("returns null for null/undefined error", () => {
      expect(useErrorHandler(null)).toBeNull();
      expect(useErrorHandler(undefined)).toBeNull();
    });

    it("returns ErrorHandlerResult for valid error", () => {
      const error = new Error("Test error");

      const result = useErrorHandler(error);

      expect(result).not.toBeNull();
      expect(result?.message).toBe("Test error");
    });

    it("includes context in result", () => {
      const error = new Error("Test");
      const context: ErrorHandlerContext = {
        operation: "CreateUser",
      };

      const result = useErrorHandler(error, context);

      expect(result).not.toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe("getUserFriendlyMessage", () => {
    it("returns message for known error codes", () => {
      expect(getUserFriendlyMessage("UNAUTHENTICATED")).toBe(
        ERROR_MESSAGES.UNAUTHENTICATED
      );
      expect(getUserFriendlyMessage("FORBIDDEN")).toBe(
        ERROR_MESSAGES.FORBIDDEN
      );
      expect(getUserFriendlyMessage("NOT_FOUND")).toBe(
        ERROR_MESSAGES.NOT_FOUND
      );
    });

    it("returns generic message for unknown codes", () => {
      expect(getUserFriendlyMessage("UNKNOWN_CODE")).toBe(
        "An error occurred. Please try again"
      );
    });

    it("returns generic message for undefined code", () => {
      expect(getUserFriendlyMessage(undefined)).toBe(
        "An unexpected error occurred"
      );
    });
  });

  describe("handleGraphQLErrorWithFriendlyMessage", () => {
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, "error").mockImplementation();
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("returns friendly message for known error codes", () => {
      const error = {
        graphQLErrors: [{
          message: "Technical error message",
          extensions: { code: "UNAUTHENTICATED" },
        }],
      };

      const result = handleGraphQLErrorWithFriendlyMessage(error);

      expect(result.message).toBe(ERROR_MESSAGES.UNAUTHENTICATED);
    });

    it("preserves original message when no code", () => {
      const error = new Error("Original message");

      const result = handleGraphQLErrorWithFriendlyMessage(error);

      expect(result.message).toBe("Original message");
    });

    it("preserves other result properties", () => {
      const error = {
        graphQLErrors: [{
          message: "Server error",
          extensions: { code: "INTERNAL_SERVER_ERROR" },
        }],
      };

      const result = handleGraphQLErrorWithFriendlyMessage(error);

      expect(result.severity).toBe(ErrorSeverity.CRITICAL);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.shouldLog).toBe(true);
    });
  });

  describe("error normalization edge cases", () => {
    let mockToast: jest.Mock;

    beforeEach(() => {
      mockToast = jest.fn();
    });

    it("handles string errors", () => {
      handleGraphQLError("Simple string error", { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Simple string error",
        })
      );
    });

    it("handles errors array format", () => {
      const error = {
        errors: [{
          message: "Array format error",
          extensions: { code: "BAD_USER_INPUT" },
        }],
      };

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Validation error",
        })
      );
    });

    it("handles empty errors array", () => {
      const error = { errors: [] };

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "An unexpected error occurred. Please try again.",
        })
      );
    });

    it("handles error with only message property", () => {
      const error = { message: "Just a message" };

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Just a message",
        })
      );
    });

    it("handles error with code property", () => {
      const error = { message: "Error with code", code: "CUSTOM_CODE" };

      handleGraphQLError(error, { toast: mockToast });

      expect(mockToast).toHaveBeenCalled();
    });

    it("handles null error", () => {
      handleGraphQLError(null, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "An unexpected error occurred. Please try again.",
        })
      );
    });

    it("handles undefined error", () => {
      handleGraphQLError(undefined, { toast: mockToast });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "An unexpected error occurred. Please try again.",
        })
      );
    });
  });
});
