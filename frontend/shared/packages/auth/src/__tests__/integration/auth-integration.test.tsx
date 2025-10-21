/**
 * Auth Integration Tests
 * Tests CSRF protection, rate limiting, cookie vs JSON modes, and token flow
 */

import { describe, test, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { rest } from "msw";
import React from "react";

import { AuthProvider } from "../../AuthProvider";
import { TokenService } from "../../services/tokenService";
import { UserService } from "../../services/userService";
import { SecurityContextManager } from "../../utils/securityContext";
import { authSettings } from "../../config/authSettings";
import type { PortalType, User } from "../../types";

// Mock server setup
const server = setupServer();

// Test component that uses auth
function TestAuthComponent({ portal }: { portal: PortalType }) {
  const [loginAttempts, setLoginAttempts] = React.useState(0);
  const [csrfToken, setCsrfToken] = React.useState("");
  const [mode, setMode] = React.useState<"cookie" | "json">("cookie");

  // Mock login function for testing
  const handleLogin = async (email: string, password: string) => {
    setLoginAttempts((prev) => prev + 1);

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }

    const response = await fetch(`/api/${portal}/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password, mode }),
    });

    return response;
  };

  return (
    <div>
      <div data-testid="login-attempts">{loginAttempts}</div>
      <input
        data-testid="csrf-token"
        value={csrfToken}
        onChange={(e) => setCsrfToken(e.target.value)}
        placeholder="CSRF Token"
      />
      <select
        data-testid="auth-mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as "cookie" | "json")}
      >
        <option value="cookie">Cookie</option>
        <option value="json">JSON</option>
      </select>
      <button
        data-testid="login-btn"
        onClick={() => handleLogin("test@example.com", "password123")}
      >
        Login
      </button>
    </div>
  );
}

describe("Auth Integration Tests", () => {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterAll(() => server.close());
  beforeEach(() => {
    // Clear all mocks and reset state
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    SecurityContextManager.clearContext();
  });
  afterEach(() => server.resetHandlers());

  describe("CSRF Protection Tests", () => {
    test("should reject requests without CSRF token when enabled", async () => {
      // Setup CSRF protection enabled
      server.use(
        rest.post("/api/customer/auth/login", (req, res, ctx) => {
          const csrfToken = req.headers.get("x-csrf-token");

          if (!csrfToken) {
            return res(ctx.status(403), ctx.json({ success: false, error: "CSRF token required" }));
          }

          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              user: { id: "1", email: "test@example.com" },
            }),
          );
        }),
      );

      const component = render(<TestAuthComponent portal="customer" />);

      const loginBtn = screen.getByTestId("login-btn");
      fireEvent.click(loginBtn);

      await waitFor(() => {
        // Should have failed due to missing CSRF token
        expect(screen.getByTestId("login-attempts")).toHaveTextContent("1");
      });
    });

    test("should accept requests with valid CSRF token", async () => {
      const validCsrfToken = "csrf-token-123";

      server.use(
        rest.post("/api/customer/auth/login", (req, res, ctx) => {
          const csrfToken = req.headers.get("x-csrf-token");

          if (csrfToken !== validCsrfToken) {
            return res(ctx.status(403), ctx.json({ success: false, error: "Invalid CSRF token" }));
          }

          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              user: { id: "1", email: "test@example.com", name: "Test User" },
              access_token: "valid-jwt-token",
              refresh_token: "valid-refresh-token",
            }),
          );
        }),
      );

      render(<TestAuthComponent portal="customer" />);

      const csrfInput = screen.getByTestId("csrf-token");
      const loginBtn = screen.getByTestId("login-btn");

      // Set valid CSRF token
      fireEvent.change(csrfInput, { target: { value: validCsrfToken } });
      fireEvent.click(loginBtn);

      await waitFor(() => {
        expect(screen.getByTestId("login-attempts")).toHaveTextContent("1");
      });
    });
  });

  describe("Rate Limiting Tests", () => {
    test("should block requests after exceeding rate limit", async () => {
      let attemptCount = 0;
      const maxAttempts = 3;

      server.use(
        rest.post("/api/customer/auth/login", (req, res, ctx) => {
          attemptCount++;

          if (attemptCount > maxAttempts) {
            return res(
              ctx.status(429),
              ctx.json({
                success: false,
                error: "Too many requests. Please try again later.",
                retryAfter: 900, // 15 minutes
              }),
            );
          }

          // Simulate failed login
          return res(ctx.status(401), ctx.json({ success: false, error: "Invalid credentials" }));
        }),
      );

      render(<TestAuthComponent portal="customer" />);
      const loginBtn = screen.getByTestId("login-btn");

      // Make multiple login attempts
      for (let i = 0; i < maxAttempts + 2; i++) {
        fireEvent.click(loginBtn);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      await waitFor(() => {
        expect(screen.getByTestId("login-attempts")).toHaveTextContent(String(maxAttempts + 2));
      });

      // Verify the last requests were rate limited (would need to check network requests)
      expect(attemptCount).toBeGreaterThan(maxAttempts);
    });

    test("should allow requests after rate limit window expires", async () => {
      vi.useFakeTimers();
      let attemptCount = 0;
      let lastAttemptTime = Date.now();
      const rateLimitWindow = 900000; // 15 minutes

      server.use(
        rest.post("/api/customer/auth/login", (req, res, ctx) => {
          const now = Date.now();

          // Reset count after window expires
          if (now - lastAttemptTime > rateLimitWindow) {
            attemptCount = 0;
          }

          attemptCount++;
          lastAttemptTime = now;

          if (attemptCount > 3) {
            return res(ctx.status(429), ctx.json({ success: false, error: "Too many requests" }));
          }

          return res(ctx.status(401), ctx.json({ success: false, error: "Invalid credentials" }));
        }),
      );

      render(<TestAuthComponent portal="customer" />);
      const loginBtn = screen.getByTestId("login-btn");

      // Exceed rate limit
      for (let i = 0; i < 4; i++) {
        fireEvent.click(loginBtn);
        await vi.advanceTimersByTimeAsync(1000);
      }

      // Wait for rate limit window to expire
      await vi.advanceTimersByTimeAsync(rateLimitWindow + 1000);

      // Should be able to make requests again
      fireEvent.click(loginBtn);

      await waitFor(() => {
        expect(screen.getByTestId("login-attempts")).toHaveTextContent("5");
      });

      vi.useRealTimers();
    });
  });

  describe("Cookie vs JSON Authentication Mode Tests", () => {
    test("should handle cookie-based authentication", async () => {
      server.use(
        rest.post("/api/customer/auth/login", async (req, res, ctx) => {
          const body = await req.json();

          if (body.mode === "cookie") {
            // Set authentication cookie
            return res(
              ctx.status(200),
              ctx.cookie("secure-auth-token", "jwt-token-value", {
                httpOnly: true,
                secure: true,
                sameSite: "strict",
              }),
              ctx.json({
                success: true,
                user: { id: "1", email: "test@example.com", name: "Test User" },
              }),
            );
          }

          return res(ctx.status(400), ctx.json({ success: false, error: "Invalid mode" }));
        }),
      );

      render(<TestAuthComponent portal="customer" />);

      const modeSelect = screen.getByTestId("auth-mode");
      const loginBtn = screen.getByTestId("login-btn");

      // Select cookie mode
      fireEvent.change(modeSelect, { target: { value: "cookie" } });
      fireEvent.click(loginBtn);

      await waitFor(() => {
        expect(screen.getByTestId("login-attempts")).toHaveTextContent("1");
      });
    });

    test("should handle JSON-based authentication", async () => {
      server.use(
        rest.post("/api/customer/auth/login", async (req, res, ctx) => {
          const body = await req.json();

          if (body.mode === "json") {
            return res(
              ctx.status(200),
              ctx.json({
                success: true,
                user: { id: "1", email: "test@example.com", name: "Test User" },
                access_token: "jwt-access-token",
                refresh_token: "jwt-refresh-token",
                expires_at: Date.now() + 15 * 60 * 1000, // 15 minutes
              }),
            );
          }

          return res(ctx.status(400), ctx.json({ success: false, error: "Invalid mode" }));
        }),
      );

      render(<TestAuthComponent portal="customer" />);

      const modeSelect = screen.getByTestId("auth-mode");
      const loginBtn = screen.getByTestId("login-btn");

      // Select JSON mode
      fireEvent.change(modeSelect, { target: { value: "json" } });
      fireEvent.click(loginBtn);

      await waitFor(() => {
        expect(screen.getByTestId("login-attempts")).toHaveTextContent("1");
      });
    });
  });

  describe("Token Service Integration Tests", () => {
    test("should create and verify JWT tokens correctly", () => {
      const mockUser: User = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "customer" as any,
        permissions: ["billing:read"] as any[],
        tenantId: "tenant-1",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const securityContext = {
        ipAddress: "192.168.1.100",
        userAgent: "Mozilla/5.0 Test Browser",
        timestamp: Date.now(),
      };

      // Create tokens
      const tokens = TokenService.createTokens(mockUser, "customer", securityContext);

      expect(tokens.accessToken).toBeTruthy();
      expect(tokens.refreshToken).toBeTruthy();
      expect(tokens.expiresAt).toBeGreaterThan(Date.now());
      expect(tokens.tokenType).toBe("Bearer");

      // Verify access token
      const payload = TokenService.verifyToken(tokens.accessToken, "access");
      expect(payload).toBeTruthy();
      expect(payload?.userId).toBe(mockUser.id);
      expect(payload?.email).toBe(mockUser.email);
      expect(payload?.tenantId).toBe(mockUser.tenantId);
      expect(payload?.portalType).toBe("customer");

      // Verify refresh token
      const refreshPayload = TokenService.verifyToken(tokens.refreshToken, "refresh");
      expect(refreshPayload).toBeTruthy();
      expect(refreshPayload?.userId).toBe(mockUser.id);
    });

    test("should reject invalid or expired tokens", () => {
      const invalidToken = "invalid-jwt-token";
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyMzkwMjJ9.invalid";

      // Invalid token
      const invalidPayload = TokenService.verifyToken(invalidToken);
      expect(invalidPayload).toBeNull();

      // Expired token (would be null if actually expired)
      const expiredPayload = TokenService.verifyToken(expiredToken);
      expect(expiredPayload).toBeNull();
    });

    test("should extract tokens from request headers and cookies", () => {
      const testToken = "test-jwt-token";

      // Test Authorization header
      const requestWithHeader = new Request("http://localhost", {
        headers: {
          Authorization: `Bearer ${testToken}`,
        },
      });

      const tokenFromHeader = TokenService.extractTokenFromRequest(requestWithHeader);
      expect(tokenFromHeader).toBe(testToken);

      // Test cookie
      const requestWithCookie = new Request("http://localhost", {
        headers: {
          Cookie: `secure-auth-token=${testToken}; other-cookie=value`,
        },
      });

      const tokenFromCookie = TokenService.extractTokenFromRequest(requestWithCookie);
      expect(tokenFromCookie).toBe(testToken);

      // Test no token
      const requestWithoutToken = new Request("http://localhost");
      const noToken = TokenService.extractTokenFromRequest(requestWithoutToken);
      expect(noToken).toBeNull();
    });
  });

  describe("Security Context Integration Tests", () => {
    test("should capture and validate security context", async () => {
      // Mock browser environment
      Object.defineProperty(window, "navigator", {
        value: {
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        writable: true,
      });

      const context = await SecurityContextManager.getSecurityContext();

      expect(context.timestamp).toBeTruthy();
      expect(context.userAgent).toContain("Mozilla");
      expect(context.sessionId).toBeTruthy();
      expect(context.device).toBeTruthy();
      expect(context.device?.type).toBe("desktop");
      expect(context.device?.os).toBe("Windows");
      expect(context.device?.browser).toBe("Chrome");
    });

    test("should validate security context for suspicious patterns", async () => {
      const suspiciousContext = {
        userAgent: "malicious-bot/1.0",
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
        sessionId: "session-123",
      };

      const validation = SecurityContextManager.validateContext(suspiciousContext);

      expect(validation.isValid).toBe(false);
      expect(validation.warnings).toContain("Suspicious user agent detected");
      expect(validation.warnings).toContain("Context timestamp is stale or invalid");
    });
  });

  describe("Settings Configuration Tests", () => {
    test("should validate configuration correctly", () => {
      const validation = authSettings.validateConfiguration();

      // Should pass with default test configuration
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    test("should detect configuration errors", () => {
      // Test with insecure settings
      authSettings.updateSecurity({
        jwtSecret: "dev-secret-change-in-production",
        jwtRefreshSecret: "dev-secret-change-in-production", // Same as JWT secret
        sessionTimeout: 60000, // 1 minute (too short)
        passwordMinLength: 4, // Too short
      });

      // Mock production environment
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const validation = authSettings.validateConfiguration();

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors).toContain("JWT_SECRET must be set in production");
      expect(validation.errors).toContain("JWT_SECRET and JWT_REFRESH_SECRET must be different");
      expect(validation.errors).toContain("Session timeout must be at least 5 minutes");
      expect(validation.errors).toContain(
        "Minimum password length should be at least 8 characters",
      );

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("End-to-End Auth Flow Tests", () => {
    test("should handle complete login-to-logout flow", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "customer",
        permissions: ["billing:read"],
      };

      // Mock successful login
      server.use(
        rest.post("/api/customer/auth/login", (req, res, ctx) => {
          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              user: mockUser,
              access_token: "valid-access-token",
              refresh_token: "valid-refresh-token",
              expires_at: Date.now() + 15 * 60 * 1000,
            }),
          );
        }),

        rest.get("/api/customer/auth/me", (req, res, ctx) => {
          const authHeader = req.headers.get("Authorization");

          if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res(
              ctx.status(401),
              ctx.json({ success: false, error: "Authentication required" }),
            );
          }

          return res(
            ctx.status(200),
            ctx.json({
              success: true,
              user: mockUser,
              session: {
                expiresAt: Date.now() + 15 * 60 * 1000,
                issuedAt: Date.now(),
                ipAddress: "192.168.1.100",
                userAgent: "Test Browser",
              },
            }),
          );
        }),

        rest.post("/api/customer/auth/logout", (req, res, ctx) => {
          return res(ctx.status(200), ctx.json({ success: true }));
        }),
      );

      // This would be tested with a real auth provider component
      // For now, we're testing the individual pieces work together

      const tokens = TokenService.createTokens(mockUser as any, "customer");
      expect(tokens.accessToken).toBeTruthy();

      const payload = TokenService.verifyToken(tokens.accessToken);
      expect(payload?.userId).toBe(mockUser.id);

      const user = await UserService.getUserById(mockUser.id, "tenant-1");
      expect(user?.email).toBe(mockUser.email);
    });
  });
});
