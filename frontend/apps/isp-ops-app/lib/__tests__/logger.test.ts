/**
 * Tests for logger utility
 * Tests logging functionality including sanitization and environment handling
 */

describe("logger", () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let originalEnv: string | undefined;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation();
    consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
    jest.resetModules();
  });

  // Helper to get logger with specific NODE_ENV
  async function getLogger(env?: string) {
    if (env) {
      process.env.NODE_ENV = env;
    }
    jest.resetModules();
    const { logger } = await import("../logger");
    return logger;
  }

  // Helper to parse production mode JSON output
  function parseProductionLog(spy: jest.SpyInstance, callIndex = 0) {
    const call = spy.mock.calls[callIndex];
    if (!call || !call[0]) return null;
    try {
      return JSON.parse(call[0]);
    } catch {
      return null;
    }
  }

  describe("debug", () => {
    it("should log in development mode", async () => {
      const logger = await getLogger("development");
      logger.debug("Debug message");

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        "Debug message",
        {},
      );
    });

    it("should not log in production mode", async () => {
      const logger = await getLogger("production");
      logger.debug("Debug message");

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it("should log with context in development", async () => {
      const logger = await getLogger("development");
      logger.debug("Debug message", { key: "value" });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("[DEBUG]"),
        "Debug message",
        { key: "value" },
      );
    });
  });

  describe("info", () => {
    it("should log info messages", async () => {
      const logger = await getLogger();
      logger.info("Info message");

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should log with context", async () => {
      const logger = await getLogger();
      logger.info("Info message", { userId: "123" });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed).toBeTruthy();
      expect(parsed.message).toBe("Info message");
      expect(parsed.context.userId).toBe("123");
    });

    it("should format differently in development vs production", async () => {
      const devLogger = await getLogger("development");
      devLogger.info("Dev info");
      const devCall = consoleLogSpy.mock.calls[0];

      consoleLogSpy.mockClear();

      const prodLogger = await getLogger("production");
      prodLogger.info("Prod info");
      const prodCall = consoleLogSpy.mock.calls[0];

      // Development uses multiple args, production uses JSON
      expect(devCall.length).toBeGreaterThan(1);
      expect(prodCall.length).toBe(1);
      expect(typeof prodCall[0]).toBe("string");
    });
  });

  describe("warn", () => {
    it("should log warn messages", async () => {
      const logger = await getLogger("development");
      logger.warn("Warning message");

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("[WARN]"),
        "Warning message",
        {},
      );
    });

    it("should log with context", async () => {
      const logger = await getLogger();
      logger.warn("Warning", { reason: "test" });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("error", () => {
    it("should log error messages", async () => {
      const logger = await getLogger();
      logger.error("Error message");

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed).toBeTruthy();
      expect(parsed.message).toBe("Error message");
    });

    it("should log with Error object", async () => {
      const logger = await getLogger();
      const error = new Error("Test error");
      logger.error("Something failed", error);

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.error).toBeDefined();
      expect(parsed.context.error.message).toBe("Test error");
      expect(parsed.context.error.stack).toBeDefined();
    });

    it("should log with custom context and Error", async () => {
      const logger = await getLogger();
      const error = new Error("Test error");
      logger.error("Failed", error, { userId: "123" });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.userId).toBe("123");
      expect(parsed.context.error).toBeDefined();
    });

    it("should handle non-Error objects", async () => {
      const logger = await getLogger();
      logger.error("Failed", { custom: "error" });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.error).toEqual({ custom: "error" });
    });

    it("should handle null or undefined error", async () => {
      const logger = await getLogger();
      logger.error("Failed", null, { extra: "context" });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.extra).toBe("context");
    });
  });

  describe("Context sanitization", () => {
    it("should redact password fields", async () => {
      const logger = await getLogger();
      logger.info("Login attempt", { username: "john", password: "secret123" });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.username).toBe("john");
      expect(parsed.context.password).toBe("[REDACTED]");
    });

    it("should redact token fields", async () => {
      const logger = await getLogger();
      logger.info("API call", {
        endpoint: "/api/users",
        token: "abc123",
        accessToken: "xyz789",
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.endpoint).toBe("/api/users");
      expect(parsed.context.token).toBe("[REDACTED]");
      expect(parsed.context.accessToken).toBe("[REDACTED]");
    });

    it("should redact fields with case-insensitive matching", async () => {
      const logger = await getLogger();
      logger.info("Data", {
        Password: "secret",
        TOKEN: "token123",
        ApiKey: "key456",
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.Password).toBe("[REDACTED]");
      expect(parsed.context.TOKEN).toBe("[REDACTED]");
      expect(parsed.context.ApiKey).toBe("[REDACTED]");
    });

    it("should redact various sensitive field names", async () => {
      const logger = await getLogger();
      logger.info("Sensitive data", {
        password: "pass1",
        secret: "secret1",
        apiKey: "key1",
        cookie: "cookie1",
        authorization: "auth1",
        refreshToken: "refresh1",
        sessionId: "session1",
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.password).toBe("[REDACTED]");
      expect(parsed.context.secret).toBe("[REDACTED]");
      expect(parsed.context.apiKey).toBe("[REDACTED]");
      expect(parsed.context.cookie).toBe("[REDACTED]");
      expect(parsed.context.authorization).toBe("[REDACTED]");
      expect(parsed.context.refreshToken).toBe("[REDACTED]");
      expect(parsed.context.sessionId).toBe("[REDACTED]");
    });

    it("should not redact non-sensitive fields", async () => {
      const logger = await getLogger();
      logger.info("Safe data", {
        username: "john",
        email: "john@example.com",
        userId: "123",
        action: "login",
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context.username).toBe("john");
      expect(parsed.context.email).toBe("john@example.com");
      expect(parsed.context.userId).toBe("123");
      expect(parsed.context.action).toBe("login");
    });

    it("should handle empty context", async () => {
      const logger = await getLogger();
      logger.info("No context");

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      expect(parsed.context).toEqual({});
    });

    it("should handle undefined context", async () => {
      const logger = await getLogger();
      logger.info("Undefined context", undefined);

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe("Production logging", () => {
    beforeEach(() => {
      process.env.NODE_ENV = "production";
    });

    it("should output JSON in production", async () => {
      const logger = await getLogger("production");
      logger.info("Production log", { key: "value" });

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      const output = call[0];

      // Should be valid JSON
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Production log");
      expect(parsed.context.key).toBe("value");
      expect(parsed.timestamp).toBeDefined();
    });

    it("should include timestamp in ISO format", async () => {
      const logger = await getLogger("production");
      logger.info("Timestamped log");

      const call = consoleLogSpy.mock.calls[0];
      const parsed = JSON.parse(call[0]);

      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should still sanitize in production", async () => {
      const logger = await getLogger("production");
      logger.info("Sensitive prod log", { password: "secret" });

      const call = consoleLogSpy.mock.calls[0];
      const parsed = JSON.parse(call[0]);

      expect(parsed.context.password).toBe("[REDACTED]");
    });
  });

  describe("Edge cases", () => {
    it("should handle very long messages", async () => {
      const logger = await getLogger();
      const longMessage = "a".repeat(10000);
      logger.info(longMessage);

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should handle special characters in messages", async () => {
      const logger = await getLogger();
      logger.info("Special chars: \n\t\"'`");

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    it("should handle nested objects in context", async () => {
      const logger = await getLogger();
      logger.info("Nested", {
        user: {
          id: "123",
          credentials: {
            password: "secret",
          },
        },
      });

      expect(consoleLogSpy).toHaveBeenCalled();
      const parsed = parseProductionLog(consoleLogSpy);
      // Only top-level keys are sanitized
      expect(parsed.context.user.credentials.password).toBe("secret");
    });

    it("should handle circular references gracefully", async () => {
      const logger = await getLogger();
      const circular: any = { a: 1 };
      circular.self = circular;

      // Should not throw
      expect(() => logger.info("Circular", circular)).not.toThrow();

      // Should log with fallback for circular reference
      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0];
      const parsed = JSON.parse(call[0]);
      expect(parsed.context).toBe("[Circular Reference]");
    });

    it("should handle null and undefined values in context", async () => {
      const logger = await getLogger();
      logger.info("Null values", {
        nullValue: null,
        undefinedValue: undefined,
        zeroValue: 0,
        falseValue: false,
      });

      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });
});
