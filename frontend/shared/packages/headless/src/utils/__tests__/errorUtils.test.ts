/**
 * Error Utils Tests
 * Comprehensive tests for the standardized error handling system
 */

import {
  ISPError,
  classifyError,
  shouldRetry,
  calculateRetryDelay,
  deduplicateError,
  ErrorFactory,
  logError,
  setErrorLogger,
} from "../errorUtils";

describe("ISPError", () => {
  it("should create error with required properties", () => {
    const error = new ISPError({
      message: "Test error",
      category: "network",
      severity: "high",
    });

    expect(error.message).toBe("Test error");
    expect(error.category).toBe("network");
    expect(error.severity).toBe("high");
    expect(error.id).toBeDefined();
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.correlationId).toBeDefined();
  });

  it("should generate appropriate user messages", () => {
    const networkError = new ISPError({
      message: "Connection failed",
      category: "network",
      severity: "medium",
    });

    const authError = new ISPError({
      message: "Token expired",
      category: "authentication",
      severity: "high",
    });

    const validationError = new ISPError({
      message: "Invalid input",
      category: "validation",
      severity: "low",
    });

    expect(networkError.userMessage).toContain("Connection problem");
    expect(authError.userMessage).toContain("log in again");
    expect(validationError.userMessage).toContain("check your input");
  });

  it("should serialize to JSON correctly", () => {
    const error = new ISPError({
      message: "Test error",
      category: "business",
      severity: "medium",
      context: "Test Context",
      technicalDetails: { foo: "bar" },
    });

    const json = error.toJSON();

    expect(json.id).toBe(error.id);
    expect(json.message).toBe(error.message);
    expect(json.category).toBe(error.category);
    expect(json.severity).toBe(error.severity);
    expect(json.context).toBe(error.context);
    expect(json.technicalDetails).toEqual({ foo: "bar" });
  });
});

describe("classifyError", () => {
  it("should classify network errors", () => {
    const networkError = new TypeError("fetch failed");
    const classified = classifyError(networkError, "API Call");

    expect(classified).toBeInstanceOf(ISPError);
    expect(classified.category).toBe("network");
    expect(classified.retryable).toBe(true);
    expect(classified.context).toBe("API Call");
  });

  it("should classify HTTP status errors", () => {
    const unauthorizedError = { status: 401, message: "Unauthorized" };
    const classified = classifyError(unauthorizedError, "Protected Route");

    expect(classified.status).toBe(401);
    expect(classified.category).toBe("authentication");
    expect(classified.severity).toBe("high");
    expect(classified.retryable).toBe(false);
  });

  it("should classify server errors", () => {
    const serverError = { status: 500, message: "Internal Server Error" };
    const classified = classifyError(serverError, "API Call");

    expect(classified.status).toBe(500);
    expect(classified.category).toBe("system");
    expect(classified.severity).toBe("critical");
    expect(classified.retryable).toBe(true);
  });

  it("should classify validation errors", () => {
    const validationError = { status: 422, message: "Validation failed" };
    const classified = classifyError(validationError, "Form Submit");

    expect(classified.status).toBe(422);
    expect(classified.category).toBe("validation");
    expect(classified.severity).toBe("low");
    expect(classified.retryable).toBe(false);
  });

  it("should classify timeout errors", () => {
    const timeoutError = { name: "AbortError" };
    const classified = classifyError(timeoutError, "API Call");

    expect(classified.category).toBe("network");
    expect(classified.retryable).toBe(true);
    expect(classified.userMessage).toContain("timed out");
  });

  it("should handle ISPError instances", () => {
    const originalError = new ISPError({
      message: "Original error",
      category: "business",
      severity: "low",
    });

    const classified = classifyError(originalError, "Test Context");
    expect(classified).toBe(originalError);
  });

  it("should handle unknown error types", () => {
    const unknownError = "string error";
    const classified = classifyError(unknownError, "Unknown Context");

    expect(classified.category).toBe("unknown");
    expect(classified.severity).toBe("medium");
    expect(classified.message).toBe("An unknown error occurred");
  });
});

describe("retry logic", () => {
  it("should identify retryable errors", () => {
    const networkError = new ISPError({
      message: "Network error",
      category: "network",
      severity: "medium",
      retryable: true,
    });

    const validationError = new ISPError({
      message: "Validation error",
      category: "validation",
      severity: "low",
      retryable: false,
    });

    expect(shouldRetry(networkError, 0, 3)).toBe(true);
    expect(shouldRetry(validationError, 0, 3)).toBe(false);
    expect(shouldRetry(networkError, 3, 3)).toBe(false); // Max retries reached
  });

  it("should calculate retry delay with exponential backoff", () => {
    const baseDelay = 1000;

    expect(calculateRetryDelay(0, baseDelay)).toBeGreaterThanOrEqual(baseDelay);
    expect(calculateRetryDelay(0, baseDelay)).toBeLessThan(baseDelay * 1.1); // With jitter

    expect(calculateRetryDelay(1, baseDelay)).toBeGreaterThanOrEqual(baseDelay * 2);
    expect(calculateRetryDelay(2, baseDelay)).toBeGreaterThanOrEqual(baseDelay * 4);
  });

  it("should respect maximum delay", () => {
    const baseDelay = 1000;
    const maxDelay = 5000;

    const delay = calculateRetryDelay(10, baseDelay, maxDelay);
    expect(delay).toBeLessThanOrEqual(maxDelay * 1.1); // Account for jitter
  });
});

describe("error deduplication", () => {
  beforeEach(() => {
    // Clear error cache
    jest.clearAllMocks();
  });

  it("should deduplicate identical errors within time window", () => {
    const error1 = new ISPError({
      message: "Same error",
      context: "Same context",
      severity: "medium",
    });

    const error2 = new ISPError({
      message: "Same error",
      context: "Same context",
      severity: "medium",
    });

    expect(deduplicateError(error1)).toBe(true); // First occurrence
    expect(deduplicateError(error2)).toBe(false); // Duplicate within window
  });

  it("should allow errors after time window expires", (done) => {
    const error = new ISPError({
      message: "Time-based error",
      context: "Test context",
      severity: "medium",
    });

    expect(deduplicateError(error, 50)).toBe(true); // First occurrence

    setTimeout(() => {
      expect(deduplicateError(error, 50)).toBe(true); // After time window
      done();
    }, 60);
  });
});

describe("ErrorFactory", () => {
  it("should create network errors", () => {
    const error = ErrorFactory.network("Connection failed", "API Call");

    expect(error.category).toBe("network");
    expect(error.retryable).toBe(true);
    expect(error.context).toBe("API Call");
  });

  it("should create validation errors", () => {
    const details = { field: "email", value: "invalid" };
    const error = ErrorFactory.validation("Invalid email", "User Form", details);

    expect(error.category).toBe("validation");
    expect(error.retryable).toBe(false);
    expect(error.technicalDetails).toEqual(details);
  });

  it("should create authentication errors", () => {
    const error = ErrorFactory.authentication("Protected Route");

    expect(error.category).toBe("authentication");
    expect(error.severity).toBe("high");
    expect(error.retryable).toBe(false);
  });

  it("should create authorization errors", () => {
    const error = ErrorFactory.authorization("Admin Panel", "User Dashboard");

    expect(error.category).toBe("authorization");
    expect(error.message).toContain("Admin Panel");
    expect(error.userMessage).toContain("Admin Panel");
  });

  it("should create business errors", () => {
    const error = ErrorFactory.business("Invalid payment state", "Payment Flow", "high");

    expect(error.category).toBe("business");
    expect(error.severity).toBe("high");
    expect(error.retryable).toBe(false);
  });

  it("should create system errors", () => {
    const error = ErrorFactory.system("Database unavailable", "Data Layer", "critical");

    expect(error.category).toBe("system");
    expect(error.severity).toBe("critical");
    expect(error.retryable).toBe(true);
  });
});

describe("error logging", () => {
  it("should call error logger when set", () => {
    const mockLogger = jest.fn();
    setErrorLogger(mockLogger);

    const error = new ISPError({
      message: "Test error",
      category: "network",
      severity: "medium",
    });

    logError(error, { userId: "user123" });

    expect(mockLogger).toHaveBeenCalledWith(
      expect.objectContaining({
        error: error.toJSON(),
        userId: "user123",
        userAgent: expect.any(String),
        url: expect.any(String),
      }),
    );
  });

  it("should handle logging without logger set", () => {
    setErrorLogger(null as any);

    const error = new ISPError({
      message: "Test error",
      category: "network",
      severity: "medium",
    });

    expect(() => {
      logError(error);
    }).not.toThrow();
  });
});

describe("error context and correlation", () => {
  it("should maintain correlation IDs", () => {
    const error = new ISPError({
      message: "Correlated error",
      category: "business",
      severity: "medium",
      correlationId: "custom-correlation-123",
    });

    expect(error.correlationId).toBe("custom-correlation-123");
  });

  it("should generate unique IDs and correlation IDs", () => {
    const error1 = new ISPError({
      message: "Error 1",
      category: "network",
      severity: "medium",
    });

    const error2 = new ISPError({
      message: "Error 2",
      category: "network",
      severity: "medium",
    });

    expect(error1.id).not.toBe(error2.id);
    expect(error1.correlationId).not.toBe(error2.correlationId);
    expect(error1.id).toMatch(/^err_\d+_[a-z0-9]+$/);
    expect(error1.correlationId).toMatch(/^corr_\d+_[a-z0-9]+$/);
  });

  it("should preserve context information", () => {
    const context = "Payment Processing - Credit Card Validation";
    const technicalDetails = {
      cardType: "visa",
      lastFour: "1234",
      attempts: 3,
    };

    const error = new ISPError({
      message: "Card validation failed",
      category: "validation",
      severity: "low",
      context,
      technicalDetails,
    });

    expect(error.context).toBe(context);
    expect(error.technicalDetails).toEqual(technicalDetails);
  });
});

describe("error severity and user messages", () => {
  it("should provide appropriate user messages for different categories", () => {
    const categories = [
      "network",
      "authentication",
      "authorization",
      "validation",
      "business",
      "system",
      "unknown",
    ];

    categories.forEach((category) => {
      const error = new ISPError({
        message: `Test ${category} error`,
        category: category as any,
        severity: "medium",
      });

      expect(error.userMessage).toBeDefined();
      expect(error.userMessage.length).toBeGreaterThan(0);
      expect(error.userMessage).not.toBe(error.message); // User message should be different from technical message
    });
  });

  it("should allow custom user messages", () => {
    const customMessage =
      "Your custom payment method could not be processed. Please try a different card.";

    const error = new ISPError({
      message: "Payment processor returned error code 4001",
      category: "business",
      severity: "medium",
      userMessage: customMessage,
    });

    expect(error.userMessage).toBe(customMessage);
  });
});
