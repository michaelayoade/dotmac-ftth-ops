/**
 * Rate Limiter
 * Prevents brute force attacks and excessive API calls
 */

interface RateLimitEntry {
  attempts: number;
  lastAttempt: number;
  successful: boolean;
  blockedUntil?: number;
}

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
  cleanup: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
  blocked: boolean;
}

export class RateLimiter {
  private attempts = new Map<string, RateLimitEntry>();
  private configs = new Map<string, RateLimitConfig>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Default configurations
    this.configs.set("login", {
      maxAttempts: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
      blockDurationMs: 30 * 60 * 1000, // 30 minutes
      cleanup: true,
    });

    this.configs.set("password-reset", {
      maxAttempts: 3,
      windowMs: 60 * 60 * 1000, // 1 hour
      blockDurationMs: 60 * 60 * 1000, // 1 hour
      cleanup: true,
    });

    this.configs.set("api", {
      maxAttempts: 100,
      windowMs: 60 * 1000, // 1 minute
      blockDurationMs: 5 * 60 * 1000, // 5 minutes
      cleanup: true,
    });

    // Start cleanup timer
    this.startCleanup();
  }

  // Set custom configuration for a specific action
  setConfig(action: string, config: Partial<RateLimitConfig>): void {
    const defaultConfig = this.configs.get(action) || {
      maxAttempts: 10,
      windowMs: 60 * 1000,
      blockDurationMs: 5 * 60 * 1000,
      cleanup: true,
    };

    this.configs.set(action, { ...defaultConfig, ...config });
  }

  // Check if action is allowed
  checkLimit(action: string, identifier?: string): RateLimitResult {
    const config = this.configs.get(action);
    if (!config) {
      return { allowed: true, remaining: 0, retryAfter: 0, blocked: false };
    }

    const key = this.getKey(action, identifier);
    const entry = this.attempts.get(key);
    const now = Date.now();

    // If no entry exists, allow the action
    if (!entry) {
      return {
        allowed: true,
        remaining: config.maxAttempts - 1,
        retryAfter: 0,
        blocked: false,
      };
    }

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil((entry.blockedUntil - now) / 1000),
        blocked: true,
      };
    }

    // Check if outside time window (reset counter)
    if (now - entry.lastAttempt > config.windowMs) {
      return {
        allowed: true,
        remaining: config.maxAttempts - 1,
        retryAfter: 0,
        blocked: false,
      };
    }

    // Check attempt limit
    if (entry.attempts >= config.maxAttempts) {
      // Block the identifier
      const blockedUntil = now + config.blockDurationMs;
      this.attempts.set(key, {
        ...entry,
        blockedUntil,
      });

      return {
        allowed: false,
        remaining: 0,
        retryAfter: Math.ceil(config.blockDurationMs / 1000),
        blocked: true,
      };
    }

    return {
      allowed: true,
      remaining: config.maxAttempts - entry.attempts - 1,
      retryAfter: 0,
      blocked: false,
    };
  }

  // Record an attempt
  recordAttempt(action: string, successful: boolean, identifier?: string): void {
    const config = this.configs.get(action);
    if (!config) return;

    const key = this.getKey(action, identifier);
    const entry = this.attempts.get(key);
    const now = Date.now();

    if (!entry || now - entry.lastAttempt > config.windowMs) {
      // New entry or outside window
      this.attempts.set(key, {
        attempts: 1,
        lastAttempt: now,
        successful,
      });
    } else {
      // Update existing entry
      this.attempts.set(key, {
        attempts: successful ? 0 : entry.attempts + 1, // Reset on success
        lastAttempt: now,
        successful,
        blockedUntil: entry.blockedUntil,
      });
    }
  }

  // Reset attempts for an identifier
  reset(action: string, identifier?: string): void {
    const key = this.getKey(action, identifier);
    this.attempts.delete(key);
  }

  // Get current attempt count
  getAttemptCount(action: string, identifier?: string): number {
    const key = this.getKey(action, identifier);
    const entry = this.attempts.get(key);
    return entry?.attempts || 0;
  }

  // Check if identifier is blocked
  isBlocked(action: string, identifier?: string): boolean {
    const key = this.getKey(action, identifier);
    const entry = this.attempts.get(key);
    const now = Date.now();

    return !!(entry?.blockedUntil && now < entry.blockedUntil);
  }

  // Get time until unblocked
  getTimeUntilUnblocked(action: string, identifier?: string): number {
    const key = this.getKey(action, identifier);
    const entry = this.attempts.get(key);
    const now = Date.now();

    if (!entry?.blockedUntil || now >= entry.blockedUntil) {
      return 0;
    }

    return Math.ceil((entry.blockedUntil - now) / 1000);
  }

  // Get statistics for monitoring
  getStats(): {
    totalEntries: number;
    blockedEntries: number;
    configs: string[];
  } {
    const now = Date.now();
    let blockedEntries = 0;

    for (const entry of this.attempts.values()) {
      if (entry.blockedUntil && now < entry.blockedUntil) {
        blockedEntries++;
      }
    }

    return {
      totalEntries: this.attempts.size,
      blockedEntries,
      configs: Array.from(this.configs.keys()),
    };
  }

  // Clear all rate limit data
  clear(): void {
    this.attempts.clear();
  }

  // Generate key for identifier
  private getKey(action: string, identifier?: string): string {
    // Use client IP, user ID, or session ID as identifier
    const id = identifier || this.getClientIdentifier();
    return `${action}:${id}`;
  }

  // Get client identifier (fallback to browser fingerprint)
  private getClientIdentifier(): string {
    // In a real implementation, you might use:
    // - Client IP (from server)
    // - User ID (if authenticated)
    // - Session ID
    // - Device fingerprint

    if (typeof window === "undefined") {
      return "server";
    }

    // Simple browser fingerprint
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ].join("|");

    return btoa(fingerprint).slice(0, 16);
  }

  // Start cleanup of expired entries
  private startCleanup(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(
      () => {
        const now = Date.now();
        const keysToDelete: string[] = [];

        for (const [key, entry] of this.attempts.entries()) {
          const action = key.split(":")[0];
          const config = this.configs.get(action);

          if (!config?.cleanup) continue;

          // Remove if outside window and not blocked
          if (
            now - entry.lastAttempt > config.windowMs &&
            (!entry.blockedUntil || now >= entry.blockedUntil)
          ) {
            keysToDelete.push(key);
          }
        }

        keysToDelete.forEach((key) => this.attempts.delete(key));
      },
      5 * 60 * 1000,
    ); // Cleanup every 5 minutes
  }

  // Stop cleanup timer
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.attempts.clear();
  }
}
