/**
 * Token Manager Business Logic Tests - Production Coverage
 * Using DRY factory pattern for comprehensive token security testing
 */

import { tokenManager, type TokenPayload } from "../../utils/tokenManager";
import { BusinessLogicTestFactory } from "./business-logic-test-factory";

// Mock environment variables for testing
const mockEnv = {
  NEXT_PUBLIC_JWT_ISSUER: "dotmac-platform",
  NEXT_PUBLIC_JWT_AUDIENCE: "dotmac-frontend",
};

// Store original env
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, ...mockEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("SecureTokenManager Business Logic", () => {
  const testTokens = {
    validToken: createMockToken({
      sub: "user123",
      iat: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
      exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes from now
      aud: "dotmac-frontend",
      iss: "dotmac-platform",
      jti: "token123",
      portal: "admin",
      tenant: "tenant123",
      roles: ["admin"],
      permissions: ["all"],
    }),

    expiredToken: createMockToken({
      sub: "user123",
      iat: Math.floor(Date.now() / 1000) - 1800, // 30 minutes ago
      exp: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago (expired)
      aud: "dotmac-frontend",
      iss: "dotmac-platform",
      jti: "expired123",
      portal: "customer",
      tenant: "tenant123",
      roles: ["customer"],
      permissions: ["billing", "services"],
    }),

    invalidFormatToken: "invalid.token",

    invalidAlgorithmToken: createMockToken(
      {
        sub: "user123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "invalid123",
        portal: "admin",
        tenant: "tenant123",
        roles: ["admin"],
        permissions: ["all"],
      },
      "NONE", // Invalid algorithm
    ),

    invalidIssuerToken: createMockToken({
      sub: "user123",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
      aud: "dotmac-frontend",
      iss: "malicious-issuer", // Invalid issuer
      jti: "malicious123",
      portal: "admin",
      tenant: "tenant123",
      roles: ["admin"],
      permissions: ["all"],
    }),

    invalidAudienceToken: createMockToken({
      sub: "user123",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 900,
      aud: "malicious-audience", // Invalid audience
      iss: "dotmac-platform",
      jti: "malicious123",
      portal: "admin",
      tenant: "tenant123",
      roles: ["admin"],
      permissions: ["all"],
    }),
  };

  describe("Security Enforcement", () => {
    it("should throw security error when attempting to set tokens client-side", () => {
      expect(() => {
        tokenManager.setTokens({
          accessToken: testTokens.validToken,
          refreshToken: "refresh123",
          expiresAt: Date.now() + 900000,
        });
      }).toThrow("SECURITY VIOLATION: Client-side token storage is forbidden");
    });

    it("should throw security error when attempting to get access token", () => {
      expect(() => {
        tokenManager.getAccessToken();
      }).toThrow("SECURITY: Tokens are in httpOnly cookies");
    });

    it("should throw security error when attempting to get refresh token", () => {
      expect(() => {
        tokenManager.getRefreshToken();
      }).toThrow("SECURITY: Refresh tokens are in httpOnly cookies");
    });

    it("should throw security error when attempting to get CSRF token", () => {
      expect(() => {
        tokenManager.getCSRFToken();
      }).toThrow("SECURITY: CSRF tokens are in httpOnly cookies");
    });

    it("should throw security error when attempting to clear tokens", () => {
      expect(() => {
        tokenManager.clearTokens();
      }).toThrow("SECURITY: Use server actions to clear tokens");
    });

    it("should throw security error when attempting to refresh tokens client-side", async () => {
      const mockRefreshFunction = jest.fn();

      await expect(tokenManager.refreshTokens(mockRefreshFunction)).rejects.toThrow(
        "SECURITY: Token refresh must be handled by server actions",
      );
    });
  });

  describe("Token Validation Business Rules", () => {
    it("should validate correctly formatted tokens", () => {
      const result = tokenManager.validateTokenFormat(testTokens.validToken);
      expect(result).toBe(true);
    });

    it("should reject tokens with invalid format", () => {
      const result = tokenManager.validateTokenFormat(testTokens.invalidFormatToken);
      expect(result).toBe(false);
    });

    it("should reject tokens with invalid algorithm", () => {
      const result = tokenManager.validateTokenFormat(testTokens.invalidAlgorithmToken);
      expect(result).toBe(false);
    });

    it("should reject tokens with invalid issuer", () => {
      const result = tokenManager.validateTokenFormat(testTokens.invalidIssuerToken);
      expect(result).toBe(false);
    });

    it("should reject tokens with invalid audience", () => {
      const result = tokenManager.validateTokenFormat(testTokens.invalidAudienceToken);
      expect(result).toBe(false);
    });

    it("should reject null or empty tokens", () => {
      expect(tokenManager.validateTokenFormat("")).toBe(false);
      expect(tokenManager.validateTokenFormat(null as any)).toBe(false);
      expect(tokenManager.validateTokenFormat(undefined as any)).toBe(false);
    });

    it("should handle malformed token parts gracefully", () => {
      const malformedTokens = [
        "header.payload", // Missing signature
        "header.payload.signature.extra", // Too many parts
        "not-base64.payload.signature", // Invalid base64
        "header.not-json.signature", // Invalid JSON in payload
      ];

      malformedTokens.forEach((token) => {
        expect(tokenManager.validateTokenFormat(token)).toBe(false);
      });
    });
  });

  describe("Token Expiration Logic", () => {
    it("should correctly identify non-expired tokens", () => {
      const result = tokenManager.isTokenExpired(testTokens.validToken);
      expect(result).toBe(false);
    });

    it("should correctly identify expired tokens", () => {
      const result = tokenManager.isTokenExpired(testTokens.expiredToken);
      expect(result).toBe(true);
    });

    it("should treat invalid tokens as expired", () => {
      expect(tokenManager.isTokenExpired(testTokens.invalidFormatToken)).toBe(true);
      expect(tokenManager.isTokenExpired("")).toBe(true);
      expect(tokenManager.isTokenExpired(null as any)).toBe(true);
    });

    it("should handle edge case of exactly expired token", () => {
      const exactlyExpiredToken = createMockToken({
        sub: "user123",
        iat: Math.floor(Date.now() / 1000) - 900,
        exp: Math.floor(Date.now() / 1000), // Expires right now
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "edge123",
        portal: "customer",
        tenant: "tenant123",
        roles: ["customer"],
        permissions: ["billing"],
      });

      const result = tokenManager.isTokenExpired(exactlyExpiredToken);
      expect(result).toBe(true); // Should be expired (<=)
    });
  });

  describe("Token Payload Decoding", () => {
    it("should decode valid token payload correctly", () => {
      const payload = tokenManager.decodeTokenPayload(testTokens.validToken);

      expect(payload).toMatchObject({
        sub: "user123",
        portal: "admin",
        tenant: "tenant123",
        roles: ["admin"],
        permissions: ["all"],
      });
      expect(payload?.iat).toBeGreaterThan(0);
      expect(payload?.exp).toBeGreaterThan(0);
    });

    it("should return null for invalid token format", () => {
      const payload = tokenManager.decodeTokenPayload(testTokens.invalidFormatToken);
      expect(payload).toBeNull();
    });

    it("should handle base64 decoding errors gracefully", () => {
      const invalidBase64Token = "header.invalid-base64-payload!!!.signature";
      const payload = tokenManager.decodeTokenPayload(invalidBase64Token);
      expect(payload).toBeNull();
    });

    it("should handle JSON parsing errors gracefully", () => {
      // Create token with invalid JSON payload
      const header = btoa(JSON.stringify({ alg: "RS256" }));
      const invalidJsonPayload = btoa("invalid-json-content");
      const signature = "signature";
      const invalidJsonToken = `${header}.${invalidJsonPayload}.${signature}`;

      const payload = tokenManager.decodeTokenPayload(invalidJsonToken);
      expect(payload).toBeNull();
    });
  });

  describe("Token Information Retrieval", () => {
    it("should return comprehensive info for valid token", () => {
      const info = tokenManager.getTokenInfo(testTokens.validToken);

      expect(info.isValid).toBe(true);
      expect(info.isExpired).toBe(false);
      expect(info.payload).toMatchObject({
        portal: "admin",
        tenant: "tenant123",
        roles: ["admin"],
      });
      expect(info.payload?.exp).toBeGreaterThan(0);
      expect(info.payload?.iat).toBeGreaterThan(0);
    });

    it("should return appropriate info for expired token", () => {
      const info = tokenManager.getTokenInfo(testTokens.expiredToken);

      expect(info.isValid).toBe(true); // Format is valid
      expect(info.isExpired).toBe(true); // But expired
      expect(info.payload).toMatchObject({
        portal: "customer",
        tenant: "tenant123",
        roles: ["customer"],
      });
    });

    it("should return error state for invalid token", () => {
      const info = tokenManager.getTokenInfo(testTokens.invalidFormatToken);

      expect(info.isValid).toBe(false);
      expect(info.isExpired).toBe(true);
      expect(info.payload).toBeNull();
    });

    it("should return error state for missing token", () => {
      const info = tokenManager.getTokenInfo();

      expect(info.isValid).toBe(false);
      expect(info.isExpired).toBe(true);
      expect(info.payload).toBeNull();
    });

    it("should not expose sensitive information in payload", () => {
      const info = tokenManager.getTokenInfo(testTokens.validToken);

      // Should not include sensitive fields
      expect(info.payload).not.toHaveProperty("sub");
      expect(info.payload).not.toHaveProperty("jti");
      expect(info.payload).not.toHaveProperty("iss");
      expect(info.payload).not.toHaveProperty("aud");

      // Should include safe display fields only
      expect(info.payload).toHaveProperty("portal");
      expect(info.payload).toHaveProperty("tenant");
      expect(info.payload).toHaveProperty("roles");
      expect(info.payload).toHaveProperty("exp");
      expect(info.payload).toHaveProperty("iat");
    });
  });

  describe("ISP-Specific Business Rules", () => {
    it("should handle admin portal token requirements", () => {
      const adminToken = createMockToken({
        sub: "admin123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 28800, // 8 hours (admin session)
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "admin_session_123",
        portal: "admin",
        tenant: "isp_tenant_001",
        roles: ["admin", "super_admin"],
        permissions: ["all", "user_management", "billing_admin"],
      });

      const payload = tokenManager.decodeTokenPayload(adminToken);
      expect(payload?.portal).toBe("admin");
      expect(payload?.roles).toContain("admin");
      expect(payload?.permissions).toContain("all");

      const info = tokenManager.getTokenInfo(adminToken);
      expect(info.isValid).toBe(true);
      expect(info.payload?.portal).toBe("admin");
    });

    it("should handle technician portal token with extended session", () => {
      const techToken = createMockToken({
        sub: "tech123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 43200, // 12 hours (field work)
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "tech_field_123",
        portal: "technician",
        tenant: "isp_tenant_001",
        roles: ["technician", "field_ops"],
        permissions: ["field_ops", "customer_sites", "work_orders", "device_config"],
      });

      const payload = tokenManager.decodeTokenPayload(techToken);
      expect(payload?.portal).toBe("technician");
      expect(payload?.roles).toContain("field_ops");
      expect(payload?.permissions).toContain("device_config");

      const isExpired = tokenManager.isTokenExpired(techToken);
      expect(isExpired).toBe(false); // Should support long sessions
    });

    it("should handle customer portal token restrictions", () => {
      const customerToken = createMockToken({
        sub: "customer123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours (customer session)
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "customer_123",
        portal: "customer",
        tenant: "isp_tenant_001",
        roles: ["customer"],
        permissions: ["billing", "services", "support", "profile"],
      });

      const payload = tokenManager.decodeTokenPayload(customerToken);
      expect(payload?.portal).toBe("customer");
      expect(payload?.roles).toEqual(["customer"]);
      expect(payload?.permissions).not.toContain("all");
      expect(payload?.permissions).not.toContain("admin");
    });

    it("should handle multi-tenant token validation", () => {
      const multiTenantTokens = [
        { tenant: "isp_east_001", portal: "admin" },
        { tenant: "isp_west_002", portal: "customer" },
        { tenant: "isp_central_003", portal: "technician" },
      ];

      multiTenantTokens.forEach(({ tenant, portal }) => {
        const token = createMockToken({
          sub: `user_${tenant}`,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: "dotmac-frontend",
          iss: "dotmac-platform",
          jti: `${tenant}_${portal}_123`,
          portal,
          tenant,
          roles: [portal],
          permissions: ["basic"],
        });

        const payload = tokenManager.decodeTokenPayload(token);
        expect(payload?.tenant).toBe(tenant);
        expect(payload?.portal).toBe(portal);

        const info = tokenManager.getTokenInfo(token);
        expect(info.isValid).toBe(true);
        expect(info.payload?.tenant).toBe(tenant);
      });
    });
  });

  describe("Auto-refresh Setup", () => {
    it("should return cleanup function for auto-refresh setup", () => {
      const mockRefreshFn = jest.fn();
      const mockFailureFn = jest.fn();

      const cleanup = tokenManager.setupAutoRefresh(mockRefreshFn, mockFailureFn);

      expect(typeof cleanup).toBe("function");

      // Should be able to call cleanup without errors
      expect(() => cleanup()).not.toThrow();
    });

    it("should handle auto-refresh setup with different function signatures", () => {
      const scenarios = [
        {
          refreshFn: async () => ({
            accessToken: "new",
            refreshToken: "new",
            expiresAt: Date.now(),
          }),
          failureFn: async () => console.log("failure"),
        },
        {
          refreshFn: jest.fn(),
          failureFn: jest.fn(),
        },
      ];

      scenarios.forEach(({ refreshFn, failureFn }) => {
        const cleanup = tokenManager.setupAutoRefresh(refreshFn, failureFn);
        expect(typeof cleanup).toBe("function");
        cleanup();
      });
    });
  });
});

// Helper function to create mock JWT tokens for testing
function createMockToken(payload: TokenPayload, algorithm = "RS256"): string {
  const header = { alg: algorithm, typ: "JWT" };

  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(payload));
  const signature = "mock_signature";

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}
