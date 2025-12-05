import type { AxiosError } from "axios";

import { ErrorNormalizer } from "../error-normalizer";

describe("ErrorNormalizer", () => {
  describe("normalize", () => {
    describe("axios errors with server response", () => {
      it("normalizes 400 Bad Request error", () => {
        const error = createAxiosError(400, { message: "Invalid input" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Invalid input",
          code: "BAD_REQUEST",
          status: 400,
          details: { message: "Invalid input" },
        });
      });

      it("normalizes 401 Unauthorized error", () => {
        const error = createAxiosError(401, { message: "Token expired" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Token expired",
          code: "UNAUTHORIZED",
          status: 401,
          details: { message: "Token expired" },
        });
      });

      it("normalizes 403 Forbidden error", () => {
        const error = createAxiosError(403, { message: "Access denied" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Access denied",
          code: "FORBIDDEN",
          status: 403,
          details: { message: "Access denied" },
        });
      });

      it("normalizes 404 Not Found error", () => {
        const error = createAxiosError(404, { message: "User not found" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "User not found",
          code: "NOT_FOUND",
          status: 404,
          details: { message: "User not found" },
        });
      });

      it("normalizes 409 Conflict error", () => {
        const error = createAxiosError(409, { message: "Email already exists" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Email already exists",
          code: "CONFLICT",
          status: 409,
          details: { message: "Email already exists" },
        });
      });

      it("normalizes 422 Validation error", () => {
        const error = createAxiosError(422, { detail: "Email format invalid" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Email format invalid",
          code: "VALIDATION_ERROR",
          status: 422,
          details: { detail: "Email format invalid" },
        });
      });

      it("normalizes 429 Too Many Requests error", () => {
        const error = createAxiosError(429, { error: "Rate limit exceeded" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Rate limit exceeded",
          code: "TOO_MANY_REQUESTS",
          status: 429,
          details: { error: "Rate limit exceeded" },
        });
      });

      it("normalizes 500 Internal Server error", () => {
        const error = createAxiosError(500, { message: "Database connection failed" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Database connection failed",
          code: "INTERNAL_SERVER_ERROR",
          status: 500,
          details: { message: "Database connection failed" },
        });
      });

      it("normalizes 502 Bad Gateway error", () => {
        const error = createAxiosError(502, {});
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Bad Gateway",
          code: "BAD_GATEWAY",
          status: 502,
          details: {},
        });
      });

      it("normalizes 503 Service Unavailable error", () => {
        const error = createAxiosError(503, {});
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Service unavailable",
          code: "SERVICE_UNAVAILABLE",
          status: 503,
          details: {},
        });
      });

      it("normalizes 504 Gateway Timeout error", () => {
        const error = createAxiosError(504, {});
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Gateway timeout",
          code: "GATEWAY_TIMEOUT",
          status: 504,
          details: {},
        });
      });

      it("normalizes unknown HTTP status code", () => {
        const error = createAxiosError(418, { message: "I'm a teapot" });
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "I'm a teapot",
          code: "HTTP_ERROR",
          status: 418,
          details: { message: "I'm a teapot" },
        });
      });

      it("uses default status message when no error message in response", () => {
        const error = createAxiosError(401, {});
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("Unauthorized - Please log in");
      });

      it("uses generic HTTP error message for unknown status without message", () => {
        const error = createAxiosError(499, {});
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("HTTP Error 499");
      });
    });

    describe("error message extraction patterns", () => {
      it("extracts message from data.message", () => {
        const error = createAxiosError(400, { message: "Message field" });
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("Message field");
      });

      it("extracts message from data.error", () => {
        const error = createAxiosError(400, { error: "Error field" });
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("Error field");
      });

      it("extracts message from data.detail", () => {
        const error = createAxiosError(400, { detail: "Detail field" });
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("Detail field");
      });

      it("extracts message from data.errors array (first element)", () => {
        const error = createAxiosError(400, {
          errors: ["First error", "Second error"]
        });
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("First error");
      });

      it("uses string data directly as message", () => {
        const error = createAxiosError(400, "Plain string error");
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("Plain string error");
      });

      it("prioritizes message over error field", () => {
        const error = createAxiosError(400, {
          message: "Message field",
          error: "Error field"
        });
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("Message field");
      });

      it("handles null data", () => {
        const error = createAxiosError(400, null);
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("Bad Request");
      });

      it("handles empty errors array", () => {
        const error = createAxiosError(400, { errors: [] });
        const result = ErrorNormalizer.normalize(error);

        expect(result.message).toBe("Bad Request");
      });
    });

    describe("axios errors without response (network errors)", () => {
      it("normalizes network error when request was made but no response", () => {
        const error = {
          isAxiosError: true,
          response: undefined,
          request: {},
          message: "Network Error",
        };
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Network error - no response received",
          code: "NETWORK_ERROR",
        });
      });
    });

    describe("axios request setup errors", () => {
      it("normalizes request configuration error", () => {
        const error = {
          isAxiosError: true,
          response: undefined,
          request: undefined,
          message: "Invalid URL",
        };
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Invalid URL",
          code: "REQUEST_ERROR",
        });
      });

      it("uses default message when error message is missing", () => {
        const error = {
          isAxiosError: true,
          response: undefined,
          request: undefined,
          message: "",
        };
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Request configuration error",
          code: "REQUEST_ERROR",
        });
      });
    });

    describe("generic Error instances", () => {
      it("normalizes Error with message", () => {
        const error = new Error("Something went wrong");
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Something went wrong",
          code: "GENERIC_ERROR",
        });
      });

      it("normalizes Error without message", () => {
        const error = new Error();
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "An error occurred",
          code: "GENERIC_ERROR",
        });
      });

      it("normalizes TypeError", () => {
        const error = new TypeError("Cannot read property of undefined");
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Cannot read property of undefined",
          code: "GENERIC_ERROR",
        });
      });

      it("normalizes custom Error subclass", () => {
        class CustomError extends Error {
          constructor(message: string) {
            super(message);
            this.name = "CustomError";
          }
        }
        const error = new CustomError("Custom error occurred");
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "Custom error occurred",
          code: "GENERIC_ERROR",
        });
      });
    });

    describe("string errors", () => {
      it("normalizes string error", () => {
        const result = ErrorNormalizer.normalize("Simple string error");

        expect(result).toEqual({
          message: "Simple string error",
          code: "UNKNOWN_ERROR",
        });
      });

      it("normalizes empty string error", () => {
        const result = ErrorNormalizer.normalize("");

        expect(result).toEqual({
          message: "",
          code: "UNKNOWN_ERROR",
        });
      });
    });

    describe("unknown error types", () => {
      it("normalizes object error", () => {
        const error = { foo: "bar", baz: 123 };
        const result = ErrorNormalizer.normalize(error);

        expect(result).toEqual({
          message: "An unknown error occurred",
          code: "UNKNOWN_ERROR",
          details: { foo: "bar", baz: 123 },
        });
      });

      it("throws on null error (edge case - needs null check)", () => {
        // Note: Current implementation doesn't handle null/undefined
        // This test documents the current behavior
        expect(() => ErrorNormalizer.normalize(null)).toThrow();
      });

      it("throws on undefined error (edge case - needs null check)", () => {
        // Note: Current implementation doesn't handle null/undefined
        // This test documents the current behavior
        expect(() => ErrorNormalizer.normalize(undefined)).toThrow();
      });

      it("normalizes number error", () => {
        const result = ErrorNormalizer.normalize(42);

        expect(result).toEqual({
          message: "An unknown error occurred",
          code: "UNKNOWN_ERROR",
          details: 42,
        });
      });

      it("normalizes array error", () => {
        const result = ErrorNormalizer.normalize(["error1", "error2"]);

        expect(result).toEqual({
          message: "An unknown error occurred",
          code: "UNKNOWN_ERROR",
          details: ["error1", "error2"],
        });
      });
    });
  });

  describe("isNetworkError", () => {
    it("returns true for network error", () => {
      const error = { message: "Network error", code: "NETWORK_ERROR" };
      expect(ErrorNormalizer.isNetworkError(error)).toBe(true);
    });

    it("returns false for non-network error", () => {
      const error = { message: "Server error", code: "INTERNAL_SERVER_ERROR" };
      expect(ErrorNormalizer.isNetworkError(error)).toBe(false);
    });

    it("returns false when code is undefined", () => {
      const error = { message: "Error" };
      expect(ErrorNormalizer.isNetworkError(error)).toBe(false);
    });
  });

  describe("isAuthError", () => {
    it("returns true for 401 status", () => {
      const error = { message: "Unauthorized", status: 401 };
      expect(ErrorNormalizer.isAuthError(error)).toBe(true);
    });

    it("returns true for UNAUTHORIZED code", () => {
      const error = { message: "Unauthorized", code: "UNAUTHORIZED" };
      expect(ErrorNormalizer.isAuthError(error)).toBe(true);
    });

    it("returns true for both 401 status and UNAUTHORIZED code", () => {
      const error = { message: "Unauthorized", status: 401, code: "UNAUTHORIZED" };
      expect(ErrorNormalizer.isAuthError(error)).toBe(true);
    });

    it("returns false for 403 status (forbidden, not auth)", () => {
      const error = { message: "Forbidden", status: 403 };
      expect(ErrorNormalizer.isAuthError(error)).toBe(false);
    });

    it("returns false for non-auth errors", () => {
      const error = { message: "Not found", status: 404 };
      expect(ErrorNormalizer.isAuthError(error)).toBe(false);
    });
  });

  describe("isValidationError", () => {
    it("returns true for 422 status", () => {
      const error = { message: "Validation failed", status: 422 };
      expect(ErrorNormalizer.isValidationError(error)).toBe(true);
    });

    it("returns true for VALIDATION_ERROR code", () => {
      const error = { message: "Validation failed", code: "VALIDATION_ERROR" };
      expect(ErrorNormalizer.isValidationError(error)).toBe(true);
    });

    it("returns true for both 422 status and VALIDATION_ERROR code", () => {
      const error = { message: "Validation failed", status: 422, code: "VALIDATION_ERROR" };
      expect(ErrorNormalizer.isValidationError(error)).toBe(true);
    });

    it("returns false for 400 status (bad request, not validation)", () => {
      const error = { message: "Bad request", status: 400 };
      expect(ErrorNormalizer.isValidationError(error)).toBe(false);
    });

    it("returns false for non-validation errors", () => {
      const error = { message: "Server error", status: 500 };
      expect(ErrorNormalizer.isValidationError(error)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("returns true for network errors", () => {
      const error = { message: "Network error", code: "NETWORK_ERROR" };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(true);
    });

    it("returns true for 429 Too Many Requests", () => {
      const error = { message: "Rate limited", status: 429 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(true);
    });

    it("returns true for 502 Bad Gateway", () => {
      const error = { message: "Bad Gateway", status: 502 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(true);
    });

    it("returns true for 503 Service Unavailable", () => {
      const error = { message: "Service unavailable", status: 503 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(true);
    });

    it("returns true for 504 Gateway Timeout", () => {
      const error = { message: "Gateway timeout", status: 504 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(true);
    });

    it("returns false for 400 Bad Request", () => {
      const error = { message: "Bad request", status: 400 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(false);
    });

    it("returns false for 401 Unauthorized", () => {
      const error = { message: "Unauthorized", status: 401 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(false);
    });

    it("returns false for 403 Forbidden", () => {
      const error = { message: "Forbidden", status: 403 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(false);
    });

    it("returns false for 404 Not Found", () => {
      const error = { message: "Not found", status: 404 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(false);
    });

    it("returns false for 422 Validation Error", () => {
      const error = { message: "Validation error", status: 422 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(false);
    });

    it("returns false for 500 Internal Server Error", () => {
      const error = { message: "Internal server error", status: 500 };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(false);
    });

    it("returns false for generic error without status", () => {
      const error = { message: "Generic error", code: "GENERIC_ERROR" };
      expect(ErrorNormalizer.isRetryableError(error)).toBe(false);
    });
  });

  describe("integration scenarios", () => {
    it("handles FastAPI validation error format", () => {
      const error = createAxiosError(422, {
        detail: [
          { loc: ["body", "email"], msg: "invalid email format", type: "value_error" },
          { loc: ["body", "password"], msg: "too short", type: "value_error" }
        ]
      });
      const result = ErrorNormalizer.normalize(error);

      expect(result.status).toBe(422);
      expect(result.code).toBe("VALIDATION_ERROR");
      // detail is an array, not a string, so falls back to status message
      expect(result.details).toBeDefined();
    });

    it("handles Django REST framework error format", () => {
      const error = createAxiosError(400, {
        email: ["This field is required."],
        password: ["This field is required."]
      });
      const result = ErrorNormalizer.normalize(error);

      expect(result.status).toBe(400);
      expect(result.code).toBe("BAD_REQUEST");
      expect(result.message).toBe("Bad Request"); // Falls back to status message
    });

    it("handles Express.js error format", () => {
      const error = createAxiosError(500, {
        error: "Internal Server Error",
        message: "Database connection failed",
        stack: "Error: Database connection failed\n    at ..."
      });
      const result = ErrorNormalizer.normalize(error);

      expect(result.status).toBe(500);
      expect(result.code).toBe("INTERNAL_SERVER_ERROR");
      expect(result.message).toBe("Database connection failed");
    });

    it("normalizes error and correctly identifies as retryable", () => {
      const error = createAxiosError(503, { message: "Service temporarily unavailable" });
      const normalized = ErrorNormalizer.normalize(error);

      expect(ErrorNormalizer.isRetryableError(normalized)).toBe(true);
      expect(ErrorNormalizer.isAuthError(normalized)).toBe(false);
      expect(ErrorNormalizer.isValidationError(normalized)).toBe(false);
      expect(ErrorNormalizer.isNetworkError(normalized)).toBe(false);
    });

    it("normalizes error and correctly identifies as auth error", () => {
      const error = createAxiosError(401, { message: "Token expired" });
      const normalized = ErrorNormalizer.normalize(error);

      expect(ErrorNormalizer.isAuthError(normalized)).toBe(true);
      expect(ErrorNormalizer.isRetryableError(normalized)).toBe(false);
      expect(ErrorNormalizer.isValidationError(normalized)).toBe(false);
      expect(ErrorNormalizer.isNetworkError(normalized)).toBe(false);
    });

    it("normalizes network error and correctly identifies as retryable", () => {
      const error = {
        isAxiosError: true,
        response: undefined,
        request: {},
        message: "Network Error",
      };
      const normalized = ErrorNormalizer.normalize(error);

      expect(ErrorNormalizer.isNetworkError(normalized)).toBe(true);
      expect(ErrorNormalizer.isRetryableError(normalized)).toBe(true);
      expect(ErrorNormalizer.isAuthError(normalized)).toBe(false);
      expect(ErrorNormalizer.isValidationError(normalized)).toBe(false);
    });
  });
});

// Helper function to create mock Axios errors
function createAxiosError(status: number, data: any): Partial<AxiosError> {
  return {
    isAxiosError: true,
    response: {
      status,
      data,
      statusText: "",
      headers: {},
      config: {} as any,
    },
    request: {},
    message: `Request failed with status code ${status}`,
  } as Partial<AxiosError>;
}
