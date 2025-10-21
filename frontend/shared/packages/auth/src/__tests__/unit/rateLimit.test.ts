/**
 * Rate Limiting Unit Tests
 * Tests rate limiting logic for different thresholds and time windows
 */

import { describe, test, expect, beforeEach, vi } from "vitest";

interface RateLimitEntry {
  attempts: number;
  windowStart: number;
  blockedUntil?: number;
}

class RateLimiter {
  private attempts = new Map<string, RateLimitEntry>();

  constructor(
    private maxAttempts: number = 5,
    private windowMs: number = 15 * 60 * 1000, // 15 minutes
    private blockDurationMs: number = 30 * 60 * 1000, // 30 minutes
  ) {}

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const entry = this.attempts.get(identifier);

    // No previous attempts
    if (!entry) {
      this.attempts.set(identifier, {
        attempts: 1,
        windowStart: now,
      });
      return true;
    }

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return false;
    }

    // Check if window has expired
    if (now - entry.windowStart > this.windowMs) {
      this.attempts.set(identifier, {
        attempts: 1,
        windowStart: now,
      });
      return true;
    }

    // Increment attempts
    entry.attempts++;

    // Check if limit exceeded
    if (entry.attempts > this.maxAttempts) {
      entry.blockedUntil = now + this.blockDurationMs;
      return false;
    }

    return true;
  }

  getAttempts(identifier: string): number {
    return this.attempts.get(identifier)?.attempts || 0;
  }

  getTimeUntilReset(identifier: string): number {
    const entry = this.attempts.get(identifier);
    if (!entry) return 0;

    const now = Date.now();

    // If blocked, return time until unblocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return entry.blockedUntil - now;
    }

    // Return time until window resets
    const windowEnd = entry.windowStart + this.windowMs;
    return Math.max(0, windowEnd - now);
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  cleanup(): void {
    const now = Date.now();
    for (const [identifier, entry] of this.attempts.entries()) {
      // Clean up expired entries
      const windowExpired = now - entry.windowStart > this.windowMs;
      const blockExpired = !entry.blockedUntil || now >= entry.blockedUntil;

      if (windowExpired && blockExpired) {
        this.attempts.delete(identifier);
      }
    }
  }
}

describe("Rate Limiting", () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter(3, 60000, 120000); // 3 attempts, 1 min window, 2 min block
  });

  describe("Basic Rate Limiting", () => {
    test("should allow requests within limit", () => {
      const identifier = "user-123";

      expect(rateLimiter.isAllowed(identifier)).toBe(true);
      expect(rateLimiter.isAllowed(identifier)).toBe(true);
      expect(rateLimiter.isAllowed(identifier)).toBe(true);

      expect(rateLimiter.getAttempts(identifier)).toBe(3);
    });

    test("should block requests after exceeding limit", () => {
      const identifier = "user-456";

      // Make maximum allowed attempts
      for (let i = 0; i < 3; i++) {
        expect(rateLimiter.isAllowed(identifier)).toBe(true);
      }

      // Next attempt should be blocked
      expect(rateLimiter.isAllowed(identifier)).toBe(false);
      expect(rateLimiter.getAttempts(identifier)).toBe(4);
    });

    test("should track attempts per identifier separately", () => {
      const user1 = "user-111";
      const user2 = "user-222";

      // User 1 exceeds limit
      for (let i = 0; i < 4; i++) {
        rateLimiter.isAllowed(user1);
      }

      // User 2 should still be allowed
      expect(rateLimiter.isAllowed(user2)).toBe(true);
      expect(rateLimiter.isAllowed(user2)).toBe(true);

      // User 1 should be blocked, User 2 should not
      expect(rateLimiter.isAllowed(user1)).toBe(false);
      expect(rateLimiter.isAllowed(user2)).toBe(true);
    });
  });

  describe("Time Window Behavior", () => {
    test("should reset attempts after window expires", () => {
      vi.useFakeTimers();

      const identifier = "user-789";

      // Make maximum attempts
      for (let i = 0; i < 3; i++) {
        expect(rateLimiter.isAllowed(identifier)).toBe(true);
      }

      // Should be blocked
      expect(rateLimiter.isAllowed(identifier)).toBe(false);

      // Fast forward past window (1 minute + 1 second)
      vi.advanceTimersByTime(61000);

      // Should be allowed again (new window)
      expect(rateLimiter.isAllowed(identifier)).toBe(true);
      expect(rateLimiter.getAttempts(identifier)).toBe(1);

      vi.useRealTimers();
    });

    test("should maintain block duration separately from window", () => {
      vi.useFakeTimers();

      const identifier = "user-blocked";

      // Exceed limit to trigger block
      for (let i = 0; i < 4; i++) {
        rateLimiter.isAllowed(identifier);
      }

      // Should be blocked
      expect(rateLimiter.isAllowed(identifier)).toBe(false);

      // Fast forward past window but not past block duration
      vi.advanceTimersByTime(90000); // 1.5 minutes

      // Should still be blocked (block duration is 2 minutes)
      expect(rateLimiter.isAllowed(identifier)).toBe(false);

      // Fast forward past block duration
      vi.advanceTimersByTime(60000); // Additional 1 minute (total 2.5 minutes)

      // Should now be allowed
      expect(rateLimiter.isAllowed(identifier)).toBe(true);

      vi.useRealTimers();
    });
  });

  describe("Time Until Reset", () => {
    test("should return correct time until window reset", () => {
      vi.useFakeTimers();

      const identifier = "user-time";

      rateLimiter.isAllowed(identifier);

      // Should return close to full window time
      const timeUntilReset = rateLimiter.getTimeUntilReset(identifier);
      expect(timeUntilReset).toBeGreaterThan(59000); // Almost 1 minute
      expect(timeUntilReset).toBeLessThanOrEqual(60000);

      // Fast forward halfway
      vi.advanceTimersByTime(30000);

      const timeUntilResetHalf = rateLimiter.getTimeUntilReset(identifier);
      expect(timeUntilResetHalf).toBeGreaterThan(29000);
      expect(timeUntilResetHalf).toBeLessThanOrEqual(30000);

      vi.useRealTimers();
    });

    test("should return block time when user is blocked", () => {
      vi.useFakeTimers();

      const identifier = "user-blocked-time";

      // Trigger block
      for (let i = 0; i < 4; i++) {
        rateLimiter.isAllowed(identifier);
      }

      // Should return block duration time
      const blockTime = rateLimiter.getTimeUntilReset(identifier);
      expect(blockTime).toBeGreaterThan(119000); // Almost 2 minutes
      expect(blockTime).toBeLessThanOrEqual(120000);

      vi.useRealTimers();
    });
  });

  describe("Management Operations", () => {
    test("should reset specific identifier", () => {
      const identifier = "user-reset";

      // Make some attempts
      rateLimiter.isAllowed(identifier);
      rateLimiter.isAllowed(identifier);

      expect(rateLimiter.getAttempts(identifier)).toBe(2);

      // Reset
      rateLimiter.reset(identifier);

      expect(rateLimiter.getAttempts(identifier)).toBe(0);
      expect(rateLimiter.isAllowed(identifier)).toBe(true);
      expect(rateLimiter.getAttempts(identifier)).toBe(1);
    });

    test("should cleanup expired entries", () => {
      vi.useFakeTimers();

      const identifier1 = "user-cleanup-1";
      const identifier2 = "user-cleanup-2";

      // Make attempts for both users
      rateLimiter.isAllowed(identifier1);

      // Fast forward halfway
      vi.advanceTimersByTime(30000);

      rateLimiter.isAllowed(identifier2);

      // Fast forward past first user's window
      vi.advanceTimersByTime(40000); // Total 70 seconds

      // Both should still have entries
      expect(rateLimiter.getAttempts(identifier1)).toBe(1);
      expect(rateLimiter.getAttempts(identifier2)).toBe(1);

      // Cleanup
      rateLimiter.cleanup();

      // First user should be cleaned up, second should remain
      expect(rateLimiter.getAttempts(identifier1)).toBe(0);
      expect(rateLimiter.getAttempts(identifier2)).toBe(1);

      vi.useRealTimers();
    });
  });

  describe("Different Rate Limit Configurations", () => {
    test("should work with different limits", () => {
      // Very strict limit
      const strictLimiter = new RateLimiter(1, 60000, 120000);

      const identifier = "strict-user";

      expect(strictLimiter.isAllowed(identifier)).toBe(true);
      expect(strictLimiter.isAllowed(identifier)).toBe(false); // Immediately blocked
    });

    test("should work with very permissive limits", () => {
      const permissiveLimiter = new RateLimiter(100, 60000, 120000);

      const identifier = "permissive-user";

      // Should allow many attempts
      for (let i = 0; i < 50; i++) {
        expect(permissiveLimiter.isAllowed(identifier)).toBe(true);
      }

      expect(permissiveLimiter.getAttempts(identifier)).toBe(50);
    });
  });

  describe("Edge Cases", () => {
    test("should handle rapid successive calls", () => {
      const identifier = "rapid-user";

      // Make rapid calls
      const results = [];
      for (let i = 0; i < 10; i++) {
        results.push(rateLimiter.isAllowed(identifier));
      }

      // First 3 should be true, rest false
      expect(results.slice(0, 3)).toEqual([true, true, true]);
      expect(results.slice(3)).toEqual([false, false, false, false, false, false, false]);
    });

    test("should handle zero time scenarios", () => {
      const identifier = "zero-time";

      // Multiple calls at exactly the same time
      const start = Date.now();
      vi.setSystemTime(start);

      expect(rateLimiter.isAllowed(identifier)).toBe(true);
      expect(rateLimiter.isAllowed(identifier)).toBe(true);

      expect(rateLimiter.getAttempts(identifier)).toBe(2);
    });
  });
});
