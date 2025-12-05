import { ErrorNormalizer } from "../error-normalizer";
import { RetryHandler } from "../retry-handler";

// Mock timers for testing delays
jest.useFakeTimers();

// Default shouldRetry function that properly binds ErrorNormalizer methods
const boundIsRetryableError = (error: any) => ErrorNormalizer.isRetryableError(error);

describe("RetryHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.useFakeTimers();
  });

  describe("constructor", () => {
    it("uses default configuration when no config provided", () => {
      const handler = new RetryHandler();
      // Defaults are verified through behavior in other tests
      expect(handler).toBeInstanceOf(RetryHandler);
    });

    it("merges custom configuration with defaults", () => {
      const customShouldRetry = jest.fn().mockReturnValue(false);
      const handler = new RetryHandler({
        retries: 5,
        retryDelay: 2000,
        shouldRetry: customShouldRetry,
      });
      expect(handler).toBeInstanceOf(RetryHandler);
    });
  });

  describe("static create", () => {
    it("creates a new RetryHandler instance", () => {
      const handler = RetryHandler.create();
      expect(handler).toBeInstanceOf(RetryHandler);
    });

    it("creates a new RetryHandler with custom config", () => {
      const handler = RetryHandler.create({ retries: 10 });
      expect(handler).toBeInstanceOf(RetryHandler);
    });
  });

  describe("execute", () => {
    describe("successful operations", () => {
      it("returns result on first successful attempt", async () => {
        const handler = new RetryHandler();
        const operation = jest.fn().mockResolvedValue("success");

        const result = await handler.execute(operation);

        expect(result).toBe("success");
        expect(operation).toHaveBeenCalledTimes(1);
      });

      it("returns complex data types", async () => {
        const handler = new RetryHandler();
        const data = { users: [{ id: 1, name: "John" }], total: 1 };
        const operation = jest.fn().mockResolvedValue(data);

        const result = await handler.execute(operation);

        expect(result).toEqual(data);
      });
    });

    describe("retry behavior", () => {
      it("retries on retryable error and succeeds", async () => {
        jest.useRealTimers();

        const handler = new RetryHandler({ retries: 3, retryDelay: 10, shouldRetry: boundIsRetryableError });
        const networkError = {
          isAxiosError: true,
          response: undefined,
          request: {},
          message: "Network Error",
        };

        const operation = jest.fn()
          .mockRejectedValueOnce(networkError)
          .mockRejectedValueOnce(networkError)
          .mockResolvedValueOnce("success");

        const result = await handler.execute(operation);

        expect(result).toBe("success");
        expect(operation).toHaveBeenCalledTimes(3);
      });

      it("exhausts retries and throws normalized error", async () => {
        jest.useRealTimers();

        const handler = new RetryHandler({ retries: 2, retryDelay: 10, shouldRetry: boundIsRetryableError });
        const networkError = {
          isAxiosError: true,
          response: undefined,
          request: {},
          message: "Network Error",
        };

        const operation = jest.fn().mockRejectedValue(networkError);

        await expect(handler.execute(operation)).rejects.toEqual({
          message: "Network error - no response received",
          code: "NETWORK_ERROR",
        });

        // Initial attempt + 2 retries = 3 calls
        expect(operation).toHaveBeenCalledTimes(3);
      });

      it("does not retry non-retryable errors", async () => {
        const handler = new RetryHandler({ retries: 3, shouldRetry: boundIsRetryableError });
        const badRequestError = {
          isAxiosError: true,
          response: { status: 400, data: { message: "Bad request" } },
          request: {},
        };

        const operation = jest.fn().mockRejectedValue(badRequestError);

        await expect(handler.execute(operation)).rejects.toEqual({
          message: "Bad request",
          code: "BAD_REQUEST",
          status: 400,
          details: { message: "Bad request" },
        });

        expect(operation).toHaveBeenCalledTimes(1);
      });

      it("does not retry 401 Unauthorized errors", async () => {
        const handler = new RetryHandler({ retries: 3, shouldRetry: boundIsRetryableError });
        const authError = {
          isAxiosError: true,
          response: { status: 401, data: { message: "Unauthorized" } },
          request: {},
        };

        const operation = jest.fn().mockRejectedValue(authError);

        await expect(handler.execute(operation)).rejects.toMatchObject({
          status: 401,
          code: "UNAUTHORIZED",
        });

        expect(operation).toHaveBeenCalledTimes(1);
      });

      it("does not retry 403 Forbidden errors", async () => {
        const handler = new RetryHandler({ retries: 3, shouldRetry: boundIsRetryableError });
        const forbiddenError = {
          isAxiosError: true,
          response: { status: 403, data: { message: "Forbidden" } },
          request: {},
        };

        const operation = jest.fn().mockRejectedValue(forbiddenError);

        await expect(handler.execute(operation)).rejects.toMatchObject({
          status: 403,
          code: "FORBIDDEN",
        });

        expect(operation).toHaveBeenCalledTimes(1);
      });

      it("does not retry 404 Not Found errors", async () => {
        const handler = new RetryHandler({ retries: 3, shouldRetry: boundIsRetryableError });
        const notFoundError = {
          isAxiosError: true,
          response: { status: 404, data: { message: "Not found" } },
          request: {},
        };

        const operation = jest.fn().mockRejectedValue(notFoundError);

        await expect(handler.execute(operation)).rejects.toMatchObject({
          status: 404,
          code: "NOT_FOUND",
        });

        expect(operation).toHaveBeenCalledTimes(1);
      });

      it("does not retry 422 Validation errors", async () => {
        const handler = new RetryHandler({ retries: 3, shouldRetry: boundIsRetryableError });
        const validationError = {
          isAxiosError: true,
          response: { status: 422, data: { detail: "Invalid data" } },
          request: {},
        };

        const operation = jest.fn().mockRejectedValue(validationError);

        await expect(handler.execute(operation)).rejects.toMatchObject({
          status: 422,
          code: "VALIDATION_ERROR",
        });

        expect(operation).toHaveBeenCalledTimes(1);
      });

      it("retries 429 Too Many Requests errors", async () => {
        jest.useRealTimers();

        const handler = new RetryHandler({ retries: 2, retryDelay: 10, shouldRetry: boundIsRetryableError });
        const rateLimitError = {
          isAxiosError: true,
          response: { status: 429, data: { message: "Rate limited" } },
          request: {},
        };

        const operation = jest.fn()
          .mockRejectedValueOnce(rateLimitError)
          .mockResolvedValueOnce("success");

        const result = await handler.execute(operation);

        expect(result).toBe("success");
        expect(operation).toHaveBeenCalledTimes(2);
      });

      it("retries 502 Bad Gateway errors", async () => {
        jest.useRealTimers();

        const handler = new RetryHandler({ retries: 2, retryDelay: 10, shouldRetry: boundIsRetryableError });
        const gatewayError = {
          isAxiosError: true,
          response: { status: 502, data: {} },
          request: {},
        };

        const operation = jest.fn()
          .mockRejectedValueOnce(gatewayError)
          .mockResolvedValueOnce("success");

        const result = await handler.execute(operation);

        expect(result).toBe("success");
        expect(operation).toHaveBeenCalledTimes(2);
      });

      it("retries 503 Service Unavailable errors", async () => {
        jest.useRealTimers();

        const handler = new RetryHandler({ retries: 2, retryDelay: 10, shouldRetry: boundIsRetryableError });
        const serviceError = {
          isAxiosError: true,
          response: { status: 503, data: {} },
          request: {},
        };

        const operation = jest.fn()
          .mockRejectedValueOnce(serviceError)
          .mockResolvedValueOnce("success");

        const result = await handler.execute(operation);

        expect(result).toBe("success");
        expect(operation).toHaveBeenCalledTimes(2);
      });

      it("retries 504 Gateway Timeout errors", async () => {
        jest.useRealTimers();

        const handler = new RetryHandler({ retries: 2, retryDelay: 10, shouldRetry: boundIsRetryableError });
        const timeoutError = {
          isAxiosError: true,
          response: { status: 504, data: {} },
          request: {},
        };

        const operation = jest.fn()
          .mockRejectedValueOnce(timeoutError)
          .mockResolvedValueOnce("success");

        const result = await handler.execute(operation);

        expect(result).toBe("success");
        expect(operation).toHaveBeenCalledTimes(2);
      });
    });

    describe("custom shouldRetry function", () => {
      it("uses custom shouldRetry to determine retry behavior", async () => {
        const customShouldRetry = jest.fn().mockReturnValue(true);
        const handler = new RetryHandler({
          retries: 1,
          retryDelay: 10,
          shouldRetry: customShouldRetry,
        });

        jest.useRealTimers();

        const error = new Error("Custom error");
        const operation = jest.fn()
          .mockRejectedValueOnce(error)
          .mockResolvedValueOnce("success");

        const result = await handler.execute(operation);

        expect(result).toBe("success");
        expect(customShouldRetry).toHaveBeenCalled();
      });

      it("does not retry when custom shouldRetry returns false", async () => {
        const customShouldRetry = jest.fn().mockReturnValue(false);
        const handler = new RetryHandler({
          retries: 3,
          shouldRetry: customShouldRetry,
        });

        const operation = jest.fn().mockRejectedValue(new Error("Error"));

        await expect(handler.execute(operation)).rejects.toEqual({
          message: "Error",
          code: "GENERIC_ERROR",
        });

        expect(operation).toHaveBeenCalledTimes(1);
        expect(customShouldRetry).toHaveBeenCalledTimes(1);
      });
    });

    describe("zero retries configuration", () => {
      it("does not retry when retries is 0", async () => {
        const handler = new RetryHandler({ retries: 0, shouldRetry: boundIsRetryableError });
        const networkError = {
          isAxiosError: true,
          response: undefined,
          request: {},
          message: "Network Error",
        };

        const operation = jest.fn().mockRejectedValue(networkError);

        await expect(handler.execute(operation)).rejects.toEqual({
          message: "Network error - no response received",
          code: "NETWORK_ERROR",
        });

        expect(operation).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("exponential backoff", () => {
    it("increases delay exponentially between retries", async () => {
      jest.useRealTimers();

      const handler = new RetryHandler({ retries: 3, retryDelay: 100, shouldRetry: boundIsRetryableError });
      const networkError = {
        isAxiosError: true,
        response: undefined,
        request: {},
        message: "Network Error",
      };

      const timestamps: number[] = [];
      const operation = jest.fn().mockImplementation(() => {
        timestamps.push(Date.now());
        return Promise.reject(networkError);
      });

      try {
        await handler.execute(operation);
      } catch {
        // Expected to fail after all retries
      }

      expect(operation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries

      // Verify delays increase (with some tolerance for jitter)
      if (timestamps.length >= 3) {
        const delay1 = timestamps[1] - timestamps[0];
        const delay2 = timestamps[2] - timestamps[1];
        // delay2 should be roughly 2x delay1 (allowing for jitter)
        expect(delay2).toBeGreaterThan(delay1 * 1.5);
      }
    });

    it("caps delay at 30 seconds maximum", async () => {
      jest.useRealTimers();

      // With base delay of 10000 and 5 retries, the exponential delay would exceed 30s
      // 10000 * 2^4 = 160000 > 30000
      const handler = new RetryHandler({ retries: 5, retryDelay: 10000 });

      const calculateDelay = (handler as any).calculateDelay.bind(handler);

      // Attempt 4: 10000 * 2^4 = 160000 should be capped
      const delay = calculateDelay(4);
      expect(delay).toBeLessThanOrEqual(30000);
    });

    it("adds jitter to delays", async () => {
      const handler = new RetryHandler({ retries: 3, retryDelay: 1000 });

      const calculateDelay = (handler as any).calculateDelay.bind(handler);

      // Calculate delay multiple times and check for variation
      const delays: number[] = [];
      for (let i = 0; i < 10; i++) {
        delays.push(calculateDelay(1));
      }

      // With jitter, delays should vary (not all identical)
      const uniqueDelays = new Set(delays);
      // Very unlikely to have all 10 identical with 10% random jitter
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });
  });

  describe("error normalization", () => {
    it("throws normalized ApiError on final failure", async () => {
      const handler = new RetryHandler({ retries: 0 });
      const axiosError = {
        isAxiosError: true,
        response: { status: 500, data: { message: "Server error" } },
        request: {},
      };

      const operation = jest.fn().mockRejectedValue(axiosError);

      await expect(handler.execute(operation)).rejects.toEqual({
        message: "Server error",
        code: "INTERNAL_SERVER_ERROR",
        status: 500,
        details: { message: "Server error" },
      });
    });

    it("normalizes generic Error", async () => {
      const handler = new RetryHandler({ retries: 0 });
      const operation = jest.fn().mockRejectedValue(new Error("Generic failure"));

      await expect(handler.execute(operation)).rejects.toEqual({
        message: "Generic failure",
        code: "GENERIC_ERROR",
      });
    });

    it("normalizes string error", async () => {
      const handler = new RetryHandler({ retries: 0 });
      const operation = jest.fn().mockRejectedValue("String error");

      await expect(handler.execute(operation)).rejects.toEqual({
        message: "String error",
        code: "UNKNOWN_ERROR",
      });
    });
  });

  describe("integration with ErrorNormalizer", () => {
    it("uses ErrorNormalizer.isRetryableError by default", () => {
      const handler = new RetryHandler();

      // Access the private config to verify the default
      const config = (handler as any).config;
      expect(config.shouldRetry).toBe(ErrorNormalizer.isRetryableError);
    });
  });

  describe("concurrent operations", () => {
    it("handles multiple concurrent operations independently", async () => {
      jest.useRealTimers();

      const handler = new RetryHandler({ retries: 1, retryDelay: 10, shouldRetry: boundIsRetryableError });

      const op1 = jest.fn().mockResolvedValue("result1");
      const op2 = jest.fn().mockResolvedValue("result2");
      const op3 = jest.fn().mockResolvedValue("result3");

      const results = await Promise.all([
        handler.execute(op1),
        handler.execute(op2),
        handler.execute(op3),
      ]);

      expect(results).toEqual(["result1", "result2", "result3"]);
      expect(op1).toHaveBeenCalledTimes(1);
      expect(op2).toHaveBeenCalledTimes(1);
      expect(op3).toHaveBeenCalledTimes(1);
    });

    it("isolates retry state between concurrent operations", async () => {
      jest.useRealTimers();

      const handler = new RetryHandler({ retries: 2, retryDelay: 10, shouldRetry: boundIsRetryableError });

      const networkError = {
        isAxiosError: true,
        response: undefined,
        request: {},
        message: "Network Error",
      };

      const op1 = jest.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce("result1");

      const op2 = jest.fn().mockResolvedValue("result2");

      const results = await Promise.all([
        handler.execute(op1),
        handler.execute(op2),
      ]);

      expect(results).toEqual(["result1", "result2"]);
      expect(op1).toHaveBeenCalledTimes(2); // One retry
      expect(op2).toHaveBeenCalledTimes(1); // No retries needed
    });
  });

  describe("edge cases", () => {
    it("handles operation that returns undefined", async () => {
      const handler = new RetryHandler();
      const operation = jest.fn().mockResolvedValue(undefined);

      const result = await handler.execute(operation);

      expect(result).toBeUndefined();
    });

    it("handles operation that returns null", async () => {
      const handler = new RetryHandler();
      const operation = jest.fn().mockResolvedValue(null);

      const result = await handler.execute(operation);

      expect(result).toBeNull();
    });

    it("handles operation that returns 0", async () => {
      const handler = new RetryHandler();
      const operation = jest.fn().mockResolvedValue(0);

      const result = await handler.execute(operation);

      expect(result).toBe(0);
    });

    it("handles operation that returns empty string", async () => {
      const handler = new RetryHandler();
      const operation = jest.fn().mockResolvedValue("");

      const result = await handler.execute(operation);

      expect(result).toBe("");
    });

    it("handles operation that returns false", async () => {
      const handler = new RetryHandler();
      const operation = jest.fn().mockResolvedValue(false);

      const result = await handler.execute(operation);

      expect(result).toBe(false);
    });

    it("handles very fast sequential failures", async () => {
      jest.useRealTimers();

      const handler = new RetryHandler({ retries: 10, retryDelay: 1, shouldRetry: boundIsRetryableError });
      const networkError = {
        isAxiosError: true,
        response: undefined,
        request: {},
        message: "Network Error",
      };

      const operation = jest.fn().mockRejectedValue(networkError);

      await expect(handler.execute(operation)).rejects.toMatchObject({
        code: "NETWORK_ERROR",
      });

      expect(operation).toHaveBeenCalledTimes(11); // 1 initial + 10 retries
    });
  });
});
