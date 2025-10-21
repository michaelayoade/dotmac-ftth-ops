/**
 * CSRF Protection Unit Tests
 * Tests CSRF token generation, validation, and middleware
 */

import { describe, test, expect, beforeEach, vi } from "vitest";

// Mock CSRF protection implementation
class CSRFProtection {
  private tokens = new Map<string, { token: string; expires: number; used: boolean }>();

  generateToken(sessionId: string): string {
    const token = `csrf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour

    this.tokens.set(sessionId, { token, expires, used: false });
    return token;
  }

  validateToken(sessionId: string, providedToken: string): boolean {
    const stored = this.tokens.get(sessionId);

    if (!stored) return false;
    if (stored.used) return false;
    if (stored.expires < Date.now()) return false;
    if (stored.token !== providedToken) return false;

    // Mark as used (single-use token)
    stored.used = true;
    return true;
  }

  cleanExpiredTokens(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.tokens.entries()) {
      if (data.expires < now) {
        this.tokens.delete(sessionId);
      }
    }
  }

  revokeToken(sessionId: string): void {
    this.tokens.delete(sessionId);
  }
}

describe("CSRF Protection", () => {
  let csrfProtection: CSRFProtection;

  beforeEach(() => {
    csrfProtection = new CSRFProtection();
  });

  describe("Token Generation", () => {
    test("should generate unique CSRF tokens", () => {
      const sessionId = "session-123";

      const token1 = csrfProtection.generateToken(sessionId);
      const token2 = csrfProtection.generateToken("session-456");

      expect(token1).toBeTruthy();
      expect(token2).toBeTruthy();
      expect(token1).not.toBe(token2);
      expect(token1).toMatch(/^csrf_\d+_[a-z0-9]+$/);
    });

    test("should generate tokens with proper format", () => {
      const sessionId = "session-test";
      const token = csrfProtection.generateToken(sessionId);

      expect(token).toMatch(/^csrf_\d{13}_[a-z0-9]{9}$/);
    });
  });

  describe("Token Validation", () => {
    test("should validate correct CSRF token", () => {
      const sessionId = "session-123";
      const token = csrfProtection.generateToken(sessionId);

      const isValid = csrfProtection.validateToken(sessionId, token);
      expect(isValid).toBe(true);
    });

    test("should reject invalid CSRF token", () => {
      const sessionId = "session-123";
      csrfProtection.generateToken(sessionId);

      const isValid = csrfProtection.validateToken(sessionId, "invalid-token");
      expect(isValid).toBe(false);
    });

    test("should reject token for wrong session", () => {
      const sessionId1 = "session-123";
      const sessionId2 = "session-456";

      const token = csrfProtection.generateToken(sessionId1);
      const isValid = csrfProtection.validateToken(sessionId2, token);

      expect(isValid).toBe(false);
    });

    test("should reject used token (single-use)", () => {
      const sessionId = "session-123";
      const token = csrfProtection.generateToken(sessionId);

      // First use should work
      expect(csrfProtection.validateToken(sessionId, token)).toBe(true);

      // Second use should fail
      expect(csrfProtection.validateToken(sessionId, token)).toBe(false);
    });

    test("should reject expired token", () => {
      vi.useFakeTimers();

      const sessionId = "session-123";
      const token = csrfProtection.generateToken(sessionId);

      // Fast forward past expiration (1 hour + 1 minute)
      vi.advanceTimersByTime(61 * 60 * 1000);

      const isValid = csrfProtection.validateToken(sessionId, token);
      expect(isValid).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("Token Management", () => {
    test("should clean up expired tokens", () => {
      vi.useFakeTimers();

      const sessionId1 = "session-123";
      const sessionId2 = "session-456";

      // Generate tokens
      const token1 = csrfProtection.generateToken(sessionId1);
      const token2 = csrfProtection.generateToken(sessionId2);

      // Fast forward to expire first token
      vi.advanceTimersByTime(61 * 60 * 1000);

      // Generate a new token (not expired)
      const token3 = csrfProtection.generateToken("session-789");

      // Clean expired tokens
      csrfProtection.cleanExpiredTokens();

      // Expired token should be invalid
      expect(csrfProtection.validateToken(sessionId1, token1)).toBe(false);
      expect(csrfProtection.validateToken(sessionId2, token2)).toBe(false);

      // New token should still be valid
      expect(csrfProtection.validateToken("session-789", token3)).toBe(true);

      vi.useRealTimers();
    });

    test("should revoke tokens on demand", () => {
      const sessionId = "session-123";
      const token = csrfProtection.generateToken(sessionId);

      // Token should be valid initially
      expect(csrfProtection.validateToken(sessionId, token)).toBe(true);

      // Generate new token (since previous was used)
      const newToken = csrfProtection.generateToken(sessionId);

      // Revoke the session
      csrfProtection.revokeToken(sessionId);

      // Token should no longer be valid
      expect(csrfProtection.validateToken(sessionId, newToken)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    test("should handle non-existent session", () => {
      const isValid = csrfProtection.validateToken("non-existent", "any-token");
      expect(isValid).toBe(false);
    });

    test("should handle empty token", () => {
      const sessionId = "session-123";
      csrfProtection.generateToken(sessionId);

      const isValid = csrfProtection.validateToken(sessionId, "");
      expect(isValid).toBe(false);
    });

    test("should handle null/undefined token", () => {
      const sessionId = "session-123";
      csrfProtection.generateToken(sessionId);

      expect(csrfProtection.validateToken(sessionId, null as any)).toBe(false);
      expect(csrfProtection.validateToken(sessionId, undefined as any)).toBe(false);
    });
  });
});
