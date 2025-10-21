/**
 * Comprehensive Auth Store Business Logic Tests
 * Targets 80% coverage using DRY factory pattern
 */

import { BusinessLogicTestFactory } from "./business-logic-test-factory";
import { useAuth } from "@dotmac/headless/auth/store";
import type { AuthStore, AuthProviderConfig } from "@dotmac/headless/auth/types";

// Initialize test factory
BusinessLogicTestFactory.initialize();

// Mock dependencies
jest.mock("@dotmac/headless/auth/storage");
jest.mock("@dotmac/headless/auth/tokenManager");
jest.mock("@dotmac/headless/auth/csrfProtection");
jest.mock("@dotmac/headless/auth/rateLimiter");

describe("Auth Store Critical Business Logic", () => {
  const testPortalTypes = ["admin", "customer", "technician", "reseller"];

  testPortalTypes.forEach((portalType) => {
    describe(`${portalType.toUpperCase()} Portal Authentication`, () => {
      let authConfig: AuthProviderConfig;
      let mockFetch: jest.Mock;

      beforeEach(() => {
        authConfig = BusinessLogicTestFactory.createAuthConfig(portalType);

        // Setup mock scenarios
        mockFetch = BusinessLogicTestFactory.createMockFetch({
          "POST /api/auth/login": {
            status: 200,
            data: {
              user: BusinessLogicTestFactory.createUser(
                portalType === "admin" ? "admin" : portalType,
              ),
              token: "valid_access_token",
              refreshToken: "valid_refresh_token",
              expiresIn: 900,
              sessionId: "session_123",
              csrfToken: "csrf_token_123",
            },
          },
          "POST /api/auth/refresh": {
            status: 200,
            data: {
              token: "new_access_token",
              refreshToken: "new_refresh_token",
              expiresIn: 900,
              csrfToken: "new_csrf_token",
            },
          },
          "GET /api/auth/validate": {
            status: 200,
            data: {
              user: BusinessLogicTestFactory.createUser(
                portalType === "admin" ? "admin" : portalType,
              ),
            },
          },
          "POST /api/auth/logout": {
            status: 200,
            data: { success: true },
          },
        });

        global.fetch = mockFetch;
      });

      // Test successful login flow
      BusinessLogicTestFactory.createBusinessLogicTestSuite(
        `${portalType} Auth Store`,
        () => useAuth(authConfig),
        {
          initialState: {
            isAuthenticated: false,
            isLoading: false,
            user: null,
            session: null,
            error: null,
            mfaRequired: false,
            requiresPasswordChange: false,
            sessionValid: false,
          },

          successScenarios: [
            {
              name: "successful login",
              action: async (auth: AuthStore) => {
                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);
              },
              expectations: (auth: AuthStore) => {
                expect(auth.isAuthenticated).toBe(true);
                expect(auth.user).not.toBeNull();
                expect(auth.session).not.toBeNull();
                expect(auth.error).toBeNull();
                expect(auth.sessionValid).toBe(true);
              },
            },
            {
              name: "token refresh",
              action: async (auth: AuthStore) => {
                // First login
                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);

                // Then refresh
                await auth.refreshToken();
              },
              expectations: (auth: AuthStore) => {
                expect(auth.isAuthenticated).toBe(true);
                expect(auth.sessionValid).toBe(true);
                expect(auth.session?.tokens.accessToken).toBe("new_access_token");
              },
            },
            {
              name: "session validation",
              action: async (auth: AuthStore) => {
                // Login first
                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);

                // Validate session
                await auth.validateSession();
              },
              expectations: (auth: AuthStore) => {
                expect(auth.sessionValid).toBe(true);
                expect(auth.lastActivity).toBeGreaterThan(Date.now() - 1000);
              },
            },
            {
              name: "logout",
              action: async (auth: AuthStore) => {
                // Login first
                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);

                // Then logout
                await auth.logout();
              },
              expectations: (auth: AuthStore) => {
                expect(auth.isAuthenticated).toBe(false);
                expect(auth.user).toBeNull();
                expect(auth.session).toBeNull();
                expect(auth.sessionValid).toBe(false);
              },
            },
          ],

          errorScenarios: [
            {
              name: "invalid credentials",
              action: async (auth: AuthStore) => {
                // Override mock for this test
                global.fetch = BusinessLogicTestFactory.createMockFetch({
                  "POST /api/auth/login": {
                    status: 401,
                    data: BusinessLogicTestFactory.createAuthError("INVALID_CREDENTIALS"),
                  },
                });

                const credentials = BusinessLogicTestFactory.createCredentials("invalid");
                await auth.login(credentials);
              },
              expectations: (auth: AuthStore) => {
                expect(auth.isAuthenticated).toBe(false);
                expect(auth.error?.code).toBe("INVALID_CREDENTIALS");
                expect(auth.user).toBeNull();
              },
            },
            {
              name: "rate limited login",
              action: async (auth: AuthStore) => {
                global.fetch = BusinessLogicTestFactory.createMockFetch({
                  "POST /api/auth/login": {
                    status: 429,
                    data: BusinessLogicTestFactory.createAuthError("RATE_LIMITED"),
                  },
                });

                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);
              },
              expectations: (auth: AuthStore) => {
                expect(auth.isAuthenticated).toBe(false);
                expect(auth.error?.code).toBe("RATE_LIMITED");
                expect(auth.error?.retryAfter).toBe(60);
              },
            },
            {
              name: "network error during login",
              action: async (auth: AuthStore) => {
                global.fetch = BusinessLogicTestFactory.createMockFetch({
                  "POST /api/auth/login": {
                    error: new Error("Network connection failed"),
                  },
                });

                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);
              },
              expectations: (auth: AuthStore) => {
                expect(auth.isAuthenticated).toBe(false);
                expect(auth.error?.message).toContain("Network connection failed");
              },
            },
            {
              name: "token refresh failure",
              action: async (auth: AuthStore) => {
                // First successful login
                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);

                // Then simulate refresh failure
                global.fetch = BusinessLogicTestFactory.createMockFetch({
                  "POST /api/auth/refresh": {
                    status: 401,
                    data: { error: "Invalid refresh token" },
                  },
                  "POST /api/auth/logout": {
                    status: 200,
                    data: { success: true },
                  },
                });

                await auth.refreshToken();
              },
              expectations: (auth: AuthStore) => {
                // Should auto-logout on refresh failure
                expect(auth.isAuthenticated).toBe(false);
                expect(auth.user).toBeNull();
              },
            },
          ],

          businessRules: [
            {
              description: "MFA requirement for admin/technician portals",
              setup: async (auth: AuthStore) => {
                if (["admin", "technician"].includes(portalType)) {
                  global.fetch = BusinessLogicTestFactory.createMockFetch({
                    "POST /api/auth/login": {
                      status: 200,
                      data: {
                        ...mockFetch.mock.results[0]?.value?.json(),
                        requires_2fa: true,
                      },
                    },
                  });

                  const credentials = BusinessLogicTestFactory.createCredentials("mfa_required");
                  await auth.login(credentials);
                }
              },
              test: (auth: AuthStore) => {
                if (["admin", "technician"].includes(portalType)) {
                  expect(auth.mfaRequired).toBe(true);
                } else {
                  // Customer and reseller portals don't require MFA by default
                  expect(auth.mfaRequired).toBe(false);
                }
              },
            },
            {
              description: "device verification for secure portals",
              setup: async (auth: AuthStore) => {
                // Admin and technician require device verification
                const requiresDeviceVerification = ["admin", "technician"].includes(portalType);
                expect(authConfig.portal.security.requireDeviceVerification).toBe(
                  requiresDeviceVerification,
                );
              },
              test: (auth: AuthStore) => {
                // Test passes if setup completes without error
                expect(true).toBe(true);
              },
            },
            {
              description: "session timeout based on portal type",
              setup: async (auth: AuthStore) => {
                const sessionTimeouts = {
                  admin: 8 * 60 * 60 * 1000, // 8 hours
                  customer: 2 * 60 * 60 * 1000, // 2 hours
                  technician: 12 * 60 * 60 * 1000, // 12 hours (field work)
                  reseller: 4 * 60 * 60 * 1000, // 4 hours
                };

                expect(authConfig.portal.security.maxSessionDuration).toBe(
                  sessionTimeouts[portalType as keyof typeof sessionTimeouts],
                );
              },
              test: (auth: AuthStore) => {
                expect(true).toBe(true);
              },
            },
            {
              description: "password policy enforcement",
              setup: async (auth: AuthStore) => {
                const policies = {
                  admin: {
                    minLength: 12,
                    requireSpecialChars: true,
                    requireNumbers: true,
                  },
                  customer: {
                    minLength: 8,
                    requireSpecialChars: false,
                    requireNumbers: true,
                  },
                  technician: {
                    minLength: 10,
                    requireSpecialChars: true,
                    requireNumbers: true,
                  },
                  reseller: {
                    minLength: 8,
                    requireSpecialChars: true,
                    requireNumbers: true,
                  },
                };

                const policy = policies[portalType as keyof typeof policies];
                expect(authConfig.portal.features.passwordPolicy).toMatchObject(policy);
              },
              test: (auth: AuthStore) => {
                expect(true).toBe(true);
              },
            },
          ],

          edgeCases: [
            {
              description: "simultaneous login attempts",
              setup: async (auth: AuthStore) => {
                const credentials = BusinessLogicTestFactory.createCredentials("valid");

                // Trigger multiple simultaneous login attempts
                const promises = [
                  auth.login(credentials),
                  auth.login(credentials),
                  auth.login(credentials),
                ];

                await Promise.allSettled(promises);
              },
              test: (auth: AuthStore) => {
                // Should handle concurrent calls gracefully
                expect(auth.isAuthenticated).toBe(true);
                expect(auth.user).not.toBeNull();
              },
            },
            {
              description: "expired session recovery",
              setup: async (auth: AuthStore) => {
                // Login first
                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);

                // Simulate expired session
                global.fetch = BusinessLogicTestFactory.createMockFetch({
                  "GET /api/auth/validate": {
                    status: 401,
                    data: BusinessLogicTestFactory.createAuthError("SESSION_EXPIRED"),
                  },
                  "POST /api/auth/refresh": {
                    status: 200,
                    data: {
                      token: "refreshed_token",
                      refreshToken: "new_refresh_token",
                      expiresIn: 900,
                      csrfToken: "new_csrf_token",
                    },
                  },
                });

                await auth.validateSession();
              },
              test: (auth: AuthStore) => {
                expect(auth.sessionValid).toBe(false);
              },
            },
            {
              description: "activity tracking updates",
              setup: async (auth: AuthStore) => {
                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);

                const beforeActivity = auth.lastActivity;

                // Wait a moment then update activity
                await new Promise((resolve) => setTimeout(resolve, 10));
                auth.updateActivity();
              },
              test: (auth: AuthStore) => {
                expect(auth.lastActivity).toBeGreaterThan(Date.now() - 1000);
                expect(auth.session?.lastActivity).toEqual(auth.lastActivity);
              },
            },
            {
              description: "user profile updates",
              setup: async (auth: AuthStore) => {
                const credentials = BusinessLogicTestFactory.createCredentials("valid");
                await auth.login(credentials);

                const updates = {
                  name: "Updated Name",
                  avatar: "new-avatar-url",
                };
                auth.updateUser(updates);
              },
              test: (auth: AuthStore) => {
                expect(auth.user?.name).toBe("Updated Name");
                expect(auth.user?.avatar).toBe("new-avatar-url");
                expect(auth.session?.user?.name).toBe("Updated Name");
              },
            },
          ],
        },
      );
    });
  });

  // Cross-portal integration tests
  describe("Cross-Portal Business Logic", () => {
    it("should maintain portal isolation", async () => {
      const adminConfig = BusinessLogicTestFactory.createAuthConfig("admin");
      const customerConfig = BusinessLogicTestFactory.createAuthConfig("customer");

      const adminAuth = useAuth(adminConfig);
      const customerAuth = useAuth(customerConfig);

      // Login to both portals
      const adminCreds = BusinessLogicTestFactory.createCredentials("valid", {
        email: "admin@test.com",
      });
      const customerCreds = BusinessLogicTestFactory.createCredentials("valid", {
        email: "customer@test.com",
      });

      await adminAuth.login(adminCreds);
      await customerAuth.login(customerCreds);

      // Verify isolation
      expect(adminAuth.portal?.type).toBe("admin");
      expect(customerAuth.portal?.type).toBe("customer");
      expect(adminAuth.user?.role).toBe("admin");
      expect(customerAuth.user?.role).toBe("customer");
    });

    it("should handle tenant-specific authentication", async () => {
      const tenant1Config = BusinessLogicTestFactory.createAuthConfig("admin", {
        portal: BusinessLogicTestFactory.createPortalConfig("admin", {
          tenantId: "tenant_1",
        }),
      });

      const tenant2Config = BusinessLogicTestFactory.createAuthConfig("admin", {
        portal: BusinessLogicTestFactory.createPortalConfig("admin", {
          tenantId: "tenant_2",
        }),
      });

      const auth1 = useAuth(tenant1Config);
      const auth2 = useAuth(tenant2Config);

      const credentials = BusinessLogicTestFactory.createCredentials("valid");

      await auth1.login(credentials);
      await auth2.login(credentials);

      expect(auth1.user?.tenantId).toBe("tenant_1");
      expect(auth2.user?.tenantId).toBe("tenant_2");
    });
  });

  // ISP-specific business logic tests
  describe("ISP-Specific Business Logic", () => {
    it("should handle field technician offline capabilities", async () => {
      const techConfig = BusinessLogicTestFactory.createAuthConfig("technician", {
        portal: BusinessLogicTestFactory.createPortalConfig("technician", {
          security: {
            requireDeviceVerification: true,
            maxSessionDuration: 12 * 60 * 60 * 1000, // 12 hours for field work
            sessionWarningThreshold: 30 * 60 * 1000, // 30 minutes
          },
        }),
      });

      const auth = useAuth(techConfig);
      const credentials = BusinessLogicTestFactory.createCredentials("valid");

      await auth.login(credentials);

      // Technician should have extended session for field work
      expect(auth.portal?.security.maxSessionDuration).toBe(12 * 60 * 60 * 1000);
      expect(auth.session?.tokens.expiresAt).toBeGreaterThan(Date.now() + 10 * 60 * 60 * 1000);
    });

    it("should enforce customer portal security restrictions", async () => {
      const customerConfig = BusinessLogicTestFactory.createAuthConfig("customer", {
        portal: BusinessLogicTestFactory.createPortalConfig("customer", {
          security: {
            requireDeviceVerification: false,
            maxSessionDuration: 2 * 60 * 60 * 1000, // 2 hours only
            sessionWarningThreshold: 10 * 60 * 1000, // 10 minutes
          },
        }),
      });

      const auth = useAuth(customerConfig);

      // Customer portals should have more restrictive security
      expect(auth.portal?.security.maxSessionDuration).toBe(2 * 60 * 60 * 1000);
      expect(auth.portal?.security.requireDeviceVerification).toBe(false);
      expect(auth.portal?.features.mfaRequired).toBe(false);
    });

    it("should handle reseller commission access controls", async () => {
      const resellerConfig = BusinessLogicTestFactory.createAuthConfig("reseller");
      const auth = useAuth(resellerConfig);

      const credentials = BusinessLogicTestFactory.createCredentials("valid");
      await auth.login(credentials);

      // Reseller should have specific permissions
      expect(auth.user?.role).toBe("reseller");
      expect(auth.user?.permissions).toContain("territory");
      expect(auth.user?.permissions).toContain("commission");
      expect(auth.user?.permissions).not.toContain("all"); // No admin access
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle rapid successive operations", async () => {
      const config = BusinessLogicTestFactory.createAuthConfig("admin");
      const auth = useAuth(config);
      const credentials = BusinessLogicTestFactory.createCredentials("valid");

      // Rapid operations
      const operations = Array(10)
        .fill(null)
        .map(async () => {
          auth.updateActivity();
          auth.clearError();
          return auth.validateSession();
        });

      await Promise.all(operations);

      // Should handle all operations without errors
      expect(auth.error).toBeNull();
    });

    it("should maintain consistent state during network failures", async () => {
      const config = BusinessLogicTestFactory.createAuthConfig("admin");
      const auth = useAuth(config);
      const credentials = BusinessLogicTestFactory.createCredentials("valid");

      // Successful login
      await auth.login(credentials);
      expect(auth.isAuthenticated).toBe(true);

      // Network failure during validation
      global.fetch = BusinessLogicTestFactory.createMockFetch({
        "GET /api/auth/validate": {
          error: new Error("Network error"),
        },
      });

      await auth.validateSession();

      // Should maintain authenticated state but flag session as potentially invalid
      expect(auth.isAuthenticated).toBe(true);
      expect(auth.sessionValid).toBe(false);
    });
  });
});
