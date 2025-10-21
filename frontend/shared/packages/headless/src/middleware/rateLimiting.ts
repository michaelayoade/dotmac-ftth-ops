/**
 * Rate limiting middleware for authentication endpoints
 */

export interface RateLimitRule {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

export interface RateLimitConfig {
  // Different limits for different endpoints
  login: RateLimitRule;
  register: RateLimitRule;
  passwordReset: RateLimitRule;
  mfaVerification: RateLimitRule;
  tokenRefresh: RateLimitRule;
}

class AuthRateLimiter {
  private attempts: Map<string, { count: number; windowStart: number; blockedUntil?: number }> =
    new Map();

  private config: RateLimitConfig = {
    login: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5, // 5 attempts per 15 minutes
      skipSuccessfulRequests: true,
    },
    register: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 registrations per hour per IP
    },
    passwordReset: {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // 3 password reset attempts per hour
    },
    mfaVerification: {
      windowMs: 5 * 60 * 1000, // 5 minutes
      maxRequests: 10, // 10 MFA attempts per 5 minutes
      skipSuccessfulRequests: true,
    },
    tokenRefresh: {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 30, // 30 token refreshes per minute
    },
  };

  /**
   * Generate a unique key for rate limiting based on IP and endpoint
   */
  private generateKey(identifier: string, endpoint: string): string {
    // In a browser environment, we'll use a combination of factors
    // In production, this would be enhanced with server-side tracking
    return `${identifier}:${endpoint}`;
  }

  /**
   * Get client identifier for rate limiting
   */
  private getClientIdentifier(): string {
    // In browser environment, use a combination of available identifiers
    // Note: This is client-side only and should be complemented by server-side rate limiting
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      `${screen.width}x${screen.height}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join("|");

    // Create a simple hash of the fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash &= hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Check if a request should be rate limited
   */
  checkRateLimit(
    endpoint: keyof RateLimitConfig,
    customIdentifier?: string,
  ): {
    allowed: boolean;
    remainingRequests: number;
    resetTime: number;
    retryAfter?: number;
  } {
    const rule = this.config[endpoint];
    const identifier = customIdentifier || this.getClientIdentifier();
    const key = this.generateKey(identifier, endpoint);
    const now = Date.now();

    // Clean up old entries
    this.cleanup();

    let attemptData = this.attempts.get(key);

    // Initialize if not exists or window has expired
    if (!attemptData || now - attemptData.windowStart > rule.windowMs) {
      attemptData = {
        count: 0,
        windowStart: now,
      };
      this.attempts.set(key, attemptData);
    }

    // Check if currently blocked
    if (attemptData.blockedUntil && now < attemptData.blockedUntil) {
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime: attemptData.blockedUntil,
        retryAfter: Math.ceil((attemptData.blockedUntil - now) / 1000),
      };
    }

    // Check if within limits
    const remaining = rule.maxRequests - attemptData.count;
    const resetTime = attemptData.windowStart + rule.windowMs;

    if (remaining <= 0) {
      // Block for the remainder of the window
      attemptData.blockedUntil = resetTime;
      return {
        allowed: false,
        remainingRequests: 0,
        resetTime,
        retryAfter: Math.ceil((resetTime - now) / 1000),
      };
    }

    return {
      allowed: true,
      remainingRequests: remaining - 1, // -1 because we'll increment after this check
      resetTime,
    };
  }

  /**
   * Record an attempt (call this after making the request)
   */
  recordAttempt(
    endpoint: keyof RateLimitConfig,
    wasSuccessful: boolean = false,
    customIdentifier?: string,
  ): void {
    const rule = this.config[endpoint];
    const identifier = customIdentifier || this.getClientIdentifier();
    const key = this.generateKey(identifier, endpoint);

    // Skip recording based on rule configuration
    if (wasSuccessful && rule.skipSuccessfulRequests) {
      return;
    }
    if (!wasSuccessful && rule.skipFailedRequests) {
      return;
    }

    const attemptData = this.attempts.get(key);
    if (attemptData) {
      attemptData.count++;
    }
  }

  /**
   * Reset rate limit for a specific endpoint and identifier
   */
  resetRateLimit(endpoint: keyof RateLimitConfig, customIdentifier?: string): void {
    const identifier = customIdentifier || this.getClientIdentifier();
    const key = this.generateKey(identifier, endpoint);
    this.attempts.delete(key);
  }

  /**
   * Clean up old entries to prevent memory leaks
   */
  private cleanup(): void {
    const now = Date.now();
    const maxAge = Math.max(...Object.values(this.config).map((rule) => rule.windowMs));

    for (const [key, data] of this.attempts.entries()) {
      if (now - data.windowStart > maxAge && (!data.blockedUntil || now > data.blockedUntil)) {
        this.attempts.delete(key);
      }
    }
  }

  /**
   * Get current rate limit status for an endpoint
   */
  getStatus(
    endpoint: keyof RateLimitConfig,
    customIdentifier?: string,
  ): {
    remainingRequests: number;
    resetTime: number;
    isBlocked: boolean;
  } {
    const result = this.checkRateLimit(endpoint, customIdentifier);
    return {
      remainingRequests: result.remainingRequests,
      resetTime: result.resetTime,
      isBlocked: !result.allowed,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const authRateLimiter = new AuthRateLimiter();

// React hook for easy integration
export function useAuthRateLimit() {
  return {
    checkLimit: (endpoint: keyof RateLimitConfig) => authRateLimiter.checkRateLimit(endpoint),
    recordAttempt: (endpoint: keyof RateLimitConfig, success: boolean) =>
      authRateLimiter.recordAttempt(endpoint, success),
    getStatus: (endpoint: keyof RateLimitConfig) => authRateLimiter.getStatus(endpoint),
    resetLimit: (endpoint: keyof RateLimitConfig) => authRateLimiter.resetRateLimit(endpoint),
  };
}
