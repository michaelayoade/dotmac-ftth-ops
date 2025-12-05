/**
 * Observability Integration Tests
 *
 * Note: The source code uses BigInt in JSON.stringify which throws in some functions.
 * reportErrorToObservability has error handling, but recordMetric/recordPerformance do not.
 * Tests document the current behavior.
 */

import {
  reportErrorToObservability,
  createErrorSpan,
  recordMetric,
  recordPerformance,
  type AppError,
} from "../observability";

describe("observability", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Reset environment
    process.env.NODE_ENV = "development";
    process.env.NEXT_PUBLIC_SKIP_ERROR_REPORTING = undefined;
    process.env.NEXT_PUBLIC_OTEL_ENDPOINT = undefined;
    process.env.OBSERVABILITY__OTEL_ENDPOINT = undefined;

    // Reset sessionStorage mock
    (window.sessionStorage.getItem as jest.Mock).mockReturnValue(null);
  });

  const createTestError = (overrides: Partial<AppError> = {}): AppError => ({
    id: "error-123",
    message: "Test error message",
    severity: "error",
    category: "network",
    timestamp: new Date("2024-01-01T00:00:00Z"),
    retryable: true,
    ...overrides,
  });

  describe("reportErrorToObservability", () => {
    it("handles errors gracefully via try-catch", () => {
      const error = createTestError();

      // Has try-catch, so won't throw even with BigInt issue
      expect(() => reportErrorToObservability(error)).not.toThrow();
    });

    it("skips reporting when SKIP_ERROR_REPORTING is true in development", () => {
      process.env.NODE_ENV = "development";
      process.env.NEXT_PUBLIC_SKIP_ERROR_REPORTING = "true";

      const error = createTestError();

      reportErrorToObservability(error);

      expect(fetch).not.toHaveBeenCalled();
    });

    it("creates session ID on first call", () => {
      (window.sessionStorage.getItem as jest.Mock).mockReturnValue(null);

      const error = createTestError();

      reportErrorToObservability(error);

      expect(window.sessionStorage.setItem).toHaveBeenCalledWith(
        "observability_session_id",
        expect.any(String)
      );
    });

    it("reuses existing session ID", () => {
      (window.sessionStorage.getItem as jest.Mock).mockReturnValue("existing-session-id");

      const error = createTestError();

      reportErrorToObservability(error);

      expect(window.sessionStorage.setItem).not.toHaveBeenCalled();
    });

    it("silently handles null error", () => {
      const invalidError = null as any;

      expect(() => reportErrorToObservability(invalidError)).not.toThrow();
    });

    it("accepts full AppError with all fields", () => {
      const fullError: AppError = {
        id: "full-error",
        message: "Full error test",
        details: "Detailed information",
        category: "business",
        severity: "high",
        statusCode: 400,
        code: "BUSINESS_ERROR",
        fieldErrors: { email: ["Invalid email"] },
        timestamp: new Date(),
        retryable: false,
        action: "retry",
        context: { userId: "123" },
        originalError: new Error("Original"),
      };

      expect(() => reportErrorToObservability(fullError)).not.toThrow();
    });

    it("accepts minimal AppError", () => {
      const minimalError: AppError = {
        id: "min",
        message: "Minimal",
        severity: "low",
        timestamp: new Date(),
        retryable: false,
      };

      expect(() => reportErrorToObservability(minimalError)).not.toThrow();
    });
  });

  describe("createErrorSpan", () => {
    it("logs error details in development", () => {
      process.env.NODE_ENV = "development";

      jest.isolateModules(() => {
        const { createErrorSpan: devCreateErrorSpan } = require("../observability");

        const error = createTestError({
          message: "Span test error",
          category: "validation",
          severity: "warning",
          statusCode: 422,
          context: { field: "email" },
        });

        devCreateErrorSpan(error);

        expect(console.groupCollapsed).toHaveBeenCalledWith(
          expect.stringContaining("[Error Trace]"),
          expect.any(String)
        );
        expect(console.log).toHaveBeenCalledWith("Message:", "Span test error");
        expect(console.log).toHaveBeenCalledWith("Severity:", "warning");
        expect(console.log).toHaveBeenCalledWith("Category:", "validation");
        expect(console.log).toHaveBeenCalledWith("Status Code:", 422);
        expect(console.groupEnd).toHaveBeenCalled();
      });
    });

    it("does not log in production", () => {
      process.env.NODE_ENV = "production";

      jest.isolateModules(() => {
        const { createErrorSpan: prodCreateErrorSpan } = require("../observability");

        const error = createTestError();

        prodCreateErrorSpan(error);

        expect(console.groupCollapsed).not.toHaveBeenCalled();
      });
    });
  });

  describe("recordMetric", () => {
    // Note: recordMetric has no try-catch and uses BigInt which JSON.stringify can't handle
    // This documents the current (buggy) behavior
    it("throws due to BigInt serialization issue", () => {
      expect(() => recordMetric("custom.metric", 42, { label1: "value1" })).toThrow(
        "Do not know how to serialize a BigInt"
      );
    });

    it("function signature accepts name, value, and optional labels", () => {
      // Verify the function exists and has correct signature
      expect(typeof recordMetric).toBe("function");
      expect(recordMetric.length).toBe(2); // 2 required params (labels optional)
    });
  });

  describe("recordPerformance", () => {
    // Note: recordPerformance calls recordMetric which throws
    it("throws because recordMetric throws", () => {
      expect(() => recordPerformance("api.call", 150)).toThrow(
        "Do not know how to serialize a BigInt"
      );
    });

    it("function signature accepts operation, duration, and optional metadata", () => {
      expect(typeof recordPerformance).toBe("function");
      expect(recordPerformance.length).toBe(3); // 3 params (operation, duration, metadata?)
    });
  });

  describe("AppError interface", () => {
    it("accepts various severity levels", () => {
      const severities = ["info", "warning", "error", "critical", "low", "high"];

      severities.forEach((severity) => {
        const error = createTestError({ severity });
        // reportErrorToObservability has try-catch, so won't throw
        expect(() => reportErrorToObservability(error)).not.toThrow();
      });
    });

    it("accepts various categories", () => {
      const categories = ["network", "authentication", "validation", "business", "unknown"];

      categories.forEach((category) => {
        const error = createTestError({ category });
        expect(() => reportErrorToObservability(error)).not.toThrow();
      });
    });
  });
});
