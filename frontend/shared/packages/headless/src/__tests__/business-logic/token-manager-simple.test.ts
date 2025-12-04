/**
 * Token Manager Business Logic Tests - Production Coverage
 * Testing security enforcement and token validation
 */

import { tokenManager, type TokenPayload } from "../../utils/tokenManager";

// Mock environment variables for testing
const mockEnv = {
  NEXT_PUBLIC_JWT_ISSUER: "dotmac-platform",
  NEXT_PUBLIC_JWT_AUDIENCE: "dotmac-frontend",
};

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, ...mockEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

describe("SecureTokenManager Business Logic", () => {
  describe("Security Enforcement - Client-Side Storage Prevention", () => {
    it("should throw security error when attempting to set tokens client-side", () => {
      expect(() => {
        tokenManager.setTokens({
          accessToken: "test-token",
          refreshToken: "refresh-token",
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

  describe("Token Payload Decoding", () => {
    it("should decode valid JWT payload correctly", () => {
      // Create a valid JWT token structure for testing
      const mockPayload: TokenPayload = {
        sub: "user123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "token123",
        portal: "admin",
        tenant: "tenant123",
        roles: ["admin"],
        permissions: ["all"],
      };

      const header = { alg: "RS256", typ: "JWT" };
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(mockPayload));
      const mockToken = `${encodedHeader}.${encodedPayload}.mock_signature`;

      const decodedPayload = tokenManager.decodeTokenPayload(mockToken);

      expect(decodedPayload).toMatchObject({
        sub: "user123",
        portal: "admin",
        tenant: "tenant123",
        roles: ["admin"],
        permissions: ["all"],
      });
      expect(decodedPayload?.iat).toBeGreaterThan(0);
      expect(decodedPayload?.exp).toBeGreaterThan(0);
    });

    it("should return null for invalid token format", () => {
      const invalidToken = "invalid.token";
      const payload = tokenManager.decodeTokenPayload(invalidToken);
      expect(payload).toBeNull();
    });

    it("should handle malformed token parts gracefully", () => {
      const malformedTokens = [
        "header.payload", // Missing signature
        "header.payload.signature.extra", // Too many parts
        "", // Empty string
      ];

      malformedTokens.forEach((token) => {
        const payload = tokenManager.decodeTokenPayload(token);
        expect(payload).toBeNull();
      });
    });

    it("should handle base64 decoding errors gracefully", () => {
      const invalidBase64Token = "header.invalid-base64-payload!!!.signature";
      const payload = tokenManager.decodeTokenPayload(invalidBase64Token);
      expect(payload).toBeNull();
    });
  });

  describe("Token Expiration Logic", () => {
    it("should correctly identify non-expired tokens", () => {
      const futureTime = Math.floor(Date.now() / 1000) + 900; // 15 minutes from now
      const mockPayload: TokenPayload = {
        sub: "user123",
        iat: Math.floor(Date.now() / 1000) - 300,
        exp: futureTime,
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "token123",
        portal: "admin",
        tenant: "tenant123",
        roles: ["admin"],
        permissions: ["all"],
      };

      const header = { alg: "RS256", typ: "JWT" };
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(mockPayload));
      const validToken = `${encodedHeader}.${encodedPayload}.signature`;

      const isExpired = tokenManager.isTokenExpired(validToken);
      expect(isExpired).toBe(false);
    });

    it("should correctly identify expired tokens", () => {
      const pastTime = Math.floor(Date.now() / 1000) - 300; // 5 minutes ago
      const mockPayload: TokenPayload = {
        sub: "user123",
        iat: Math.floor(Date.now() / 1000) - 1800,
        exp: pastTime,
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "token123",
        portal: "customer",
        tenant: "tenant123",
        roles: ["customer"],
        permissions: ["billing"],
      };

      const header = { alg: "RS256", typ: "JWT" };
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(mockPayload));
      const expiredToken = `${encodedHeader}.${encodedPayload}.signature`;

      const isExpired = tokenManager.isTokenExpired(expiredToken);
      expect(isExpired).toBe(true);
    });

    it("should treat invalid tokens as expired", () => {
      expect(tokenManager.isTokenExpired("invalid.token")).toBe(true);
      expect(tokenManager.isTokenExpired("")).toBe(true);
      expect(tokenManager.isTokenExpired(null as any)).toBe(true);
    });
  });

  describe("Token Information Retrieval", () => {
    it("should return error state for missing token", () => {
      const info = tokenManager.getTokenInfo();

      expect(info.isValid).toBe(false);
      expect(info.isExpired).toBe(true);
      expect(info.payload).toBeNull();
    });

    it("should return error state for invalid token", () => {
      const info = tokenManager.getTokenInfo("invalid.token");

      expect(info.isValid).toBe(false);
      expect(info.isExpired).toBe(true);
      expect(info.payload).toBeNull();
    });

    it("should not expose sensitive information in payload", () => {
      const mockPayload: TokenPayload = {
        sub: "user123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 900,
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "token123",
        portal: "admin",
        tenant: "tenant123",
        roles: ["admin"],
        permissions: ["all"],
      };

      const header = { alg: "RS256", typ: "JWT" };
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(mockPayload));
      const validToken = `${encodedHeader}.${encodedPayload}.signature`;

      const info = tokenManager.getTokenInfo(validToken);

      // Should include safe display fields only
      expect(info.payload).toHaveProperty("portal");
      expect(info.payload).toHaveProperty("tenant");
      expect(info.payload).toHaveProperty("roles");
      expect(info.payload).toHaveProperty("exp");
      expect(info.payload).toHaveProperty("iat");

      // Should not include sensitive fields (if properly filtered)
      if (info.payload) {
        // These would be filtered out in a properly implemented version
        const sensitiveFields = ["sub", "jti"];
        sensitiveFields.forEach((field) => {
          expect(info.payload).not.toHaveProperty(field);
        });
      }
    });
  });

  describe("ISP-Specific Token Scenarios", () => {
    it("should handle admin portal tokens with appropriate permissions", () => {
      const adminPayload: TokenPayload = {
        sub: "admin123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 28800, // 8 hours
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "admin_token",
        portal: "admin",
        tenant: "isp_tenant_001",
        roles: ["admin", "super_admin"],
        permissions: ["all", "user_management", "billing_admin"],
      };

      const header = { alg: "RS256", typ: "JWT" };
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(adminPayload));
      const adminToken = `${encodedHeader}.${encodedPayload}.signature`;

      const payload = tokenManager.decodeTokenPayload(adminToken);
      expect(payload?.portal).toBe("admin");
      expect(payload?.roles).toContain("admin");
      expect(payload?.permissions).toContain("all");

      const isExpired = tokenManager.isTokenExpired(adminToken);
      expect(isExpired).toBe(false);
    });

    it("should handle technician portal tokens with extended sessions", () => {
      const techPayload: TokenPayload = {
        sub: "tech123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 43200, // 12 hours for field work
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "tech_field_token",
        portal: "technician",
        tenant: "isp_tenant_001",
        roles: ["technician", "field_ops"],
        permissions: ["field_ops", "device_config", "customer_sites"],
      };

      const header = { alg: "RS256", typ: "JWT" };
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(techPayload));
      const techToken = `${encodedHeader}.${encodedPayload}.signature`;

      const payload = tokenManager.decodeTokenPayload(techToken);
      expect(payload?.portal).toBe("technician");
      expect(payload?.roles).toContain("field_ops");
      expect(payload?.permissions).toContain("device_config");

      const isExpired = tokenManager.isTokenExpired(techToken);
      expect(isExpired).toBe(false); // Should support long field work sessions
    });

    it("should handle customer portal tokens with restricted permissions", () => {
      const customerPayload: TokenPayload = {
        sub: "customer123",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7200, // 2 hours
        aud: "dotmac-frontend",
        iss: "dotmac-platform",
        jti: "customer_token",
        portal: "customer",
        tenant: "isp_tenant_001",
        roles: ["customer"],
        permissions: ["billing", "services", "support"],
      };

      const header = { alg: "RS256", typ: "JWT" };
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedPayload = btoa(JSON.stringify(customerPayload));
      const customerToken = `${encodedHeader}.${encodedPayload}.signature`;

      const payload = tokenManager.decodeTokenPayload(customerToken);
      expect(payload?.portal).toBe("customer");
      expect(payload?.roles).toEqual(["customer"]);
      expect(payload?.permissions).not.toContain("all");
      expect(payload?.permissions).not.toContain("admin");
      expect(payload?.permissions).toContain("billing");
    });

    it("should handle multi-tenant token scenarios", () => {
      const tenants = ["isp_east_001", "isp_west_002", "isp_central_003"];

      tenants.forEach((tenant) => {
        const payload: TokenPayload = {
          sub: `user_${tenant}`,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          aud: "dotmac-frontend",
          iss: "dotmac-platform",
          jti: `token_${tenant}`,
          portal: "admin",
          tenant,
          roles: ["admin"],
          permissions: ["tenant_admin"],
        };

        const header = { alg: "RS256", typ: "JWT" };
        const encodedHeader = btoa(JSON.stringify(header));
        const encodedPayload = btoa(JSON.stringify(payload));
        const token = `${encodedHeader}.${encodedPayload}.signature`;

        const decodedPayload = tokenManager.decodeTokenPayload(token);
        expect(decodedPayload?.tenant).toBe(tenant);
        expect(decodedPayload?.portal).toBe("admin");

        const info = tokenManager.getTokenInfo(token);
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
  });
});
