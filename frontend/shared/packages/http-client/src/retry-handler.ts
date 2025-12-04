import type { RetryConfig, ApiError } from "./types";
import { ErrorNormalizer } from "./error-normalizer";

export class RetryHandler {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      retries: 3,
      retryDelay: 1000,
      shouldRetry: ErrorNormalizer.isRetryableError,
      ...config,
    };
  }

  async execute<T>(operation: () => Promise<T>, currentAttempt: number = 0): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const normalizedError = ErrorNormalizer.normalize(error);

      if (this.shouldRetry(normalizedError, currentAttempt)) {
        await this.delay(currentAttempt);
        return this.execute(operation, currentAttempt + 1);
      }

      throw normalizedError;
    }
  }

  private shouldRetry(error: ApiError, currentAttempt: number): boolean {
    if (currentAttempt >= this.config.retries) {
      return false;
    }

    return this.config.shouldRetry(error);
  }

  private delay(attempt: number): Promise<void> {
    const delay = this.calculateDelay(attempt);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.config.retryDelay;
    const exponentialDelay = baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay;

    return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
  }

  static create(config?: Partial<RetryConfig>): RetryHandler {
    return new RetryHandler(config);
  }
}
