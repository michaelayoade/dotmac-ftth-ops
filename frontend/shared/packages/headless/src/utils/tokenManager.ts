/**
 * SECURE Token Management - httpOnly Cookies Only
 *
 * SECURITY PRINCIPLES:
 * - Tokens are NEVER stored in localStorage/sessionStorage
 * - All tokens live in httpOnly cookies set by server actions
 * - This manager only validates and decodes tokens for client-side use
 * - No client-side token storage or management
 */

export interface TokenPayload {
  sub: string; // subject (user ID)
  iat: number; // issued at
  exp: number; // expiration
  aud: string; // audience
  iss: string; // issuer
  jti: string; // JWT ID
  portal: string; // portal type
  tenant: string; // tenant ID
  roles: string[];
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Secure Token Manager - No Client-Side Storage
 *
 * This class provides token validation and decoding utilities.
 * All actual token storage is handled by server-side httpOnly cookies.
 */
class SecureTokenManager {
  // Valid token signing algorithms (whitelist)
  private readonly VALID_ALGORITHMS = ["RS256", "ES256", "HS256"];

  /**
   * SECURITY ERROR: Client-side token storage is forbidden
   * Tokens must be stored in httpOnly cookies by server actions only
   */
  setTokens(_tokenPair: TokenPair, _csrfToken?: string): never {
    throw new Error(
      "SECURITY VIOLATION: Client-side token storage is forbidden. " +
        "Tokens must be set via server actions using httpOnly cookies.",
    );
  }

  /**
   * SECURITY: Client cannot access tokens directly
   * Use server actions for token operations
   */
  getAccessToken(): never {
    throw new Error(
      "SECURITY: Tokens are in httpOnly cookies and not accessible to client-side JavaScript. " +
        "Use server actions to perform authenticated requests.",
    );
  }

  /**
   * SECURITY: Client cannot access tokens directly
   * Use server actions for token operations
   */
  getRefreshToken(): never {
    throw new Error(
      "SECURITY: Refresh tokens are in httpOnly cookies and not accessible to client-side JavaScript. " +
        "Use server actions to refresh tokens.",
    );
  }

  /**
   * SECURITY: Client cannot access tokens directly
   * Use server actions for token operations
   */
  getCSRFToken(): never {
    throw new Error(
      "SECURITY: CSRF tokens are in httpOnly cookies and not accessible to client-side JavaScript. " +
        "Use server actions to get CSRF tokens.",
    );
  }

  /**
   * SECURITY: Client cannot clear tokens directly
   * Use server actions for logout
   */
  clearTokens(): never {
    throw new Error(
      "SECURITY: Use server actions to clear tokens (logout). " +
        "Client-side JavaScript cannot access httpOnly cookies.",
    );
  }

  /**
   * Decode JWT payload (without verification - for client-side use only)
   */
  decodeTokenPayload(token: string): TokenPayload | null {
    try {
      const parts = token.split(".");
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (base64url)
      const payload = parts[1];
      if (!payload) {
        return null;
      }
      const decoded = this.decodeBase64(payload);
      return JSON.parse(decoded) as TokenPayload;
    } catch (_error) {
      return null;
    }
  }

  private decodeBase64(value: string): string {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    if (typeof atob === "function") {
      return atob(normalized);
    }
    return Buffer.from(normalized, "base64").toString("binary");
  }

  // Token validation composition helpers
  private static TokenValidationHelpers = {
    validateTokenParts: (token: string): boolean => {
      const parts = token.split(".");
      return parts.length === 3;
    },

    decodeTokenHeader: (token: string): { alg: string } | null => {
      try {
        const parts = token.split(".");
        const header = parts[0];
        if (!header) {
          return null;
        }
        const headerB64 = header.replace(/-/g, "+").replace(/_/g, "/");
        const decoded =
          typeof atob === "function"
            ? atob(headerB64)
            : Buffer.from(headerB64, "base64").toString("binary");
        return JSON.parse(decoded);
      } catch {
        return null;
      }
    },

    validateAlgorithm: (algorithm: string, validAlgorithms: string[]): boolean => {
      if (!validAlgorithms.includes(algorithm)) {
        return false;
      }
      return true;
    },

    validateRequiredFields: (payload: TokenPayload): boolean => {
      const requiredFields = ["sub", "iat", "exp", "aud", "iss"];
      const hasAllFields = requiredFields.every((field) => payload[field as keyof TokenPayload]);

      if (!hasAllFields) {
        return false;
      }
      return true;
    },

    validateIssuer: (issuer: string): boolean => {
      const expectedIssuer = process.env["NEXT_PUBLIC_JWT_ISSUER"] || "dotmac-platform";
      if (issuer !== expectedIssuer) {
        return false;
      }
      return true;
    },

    validateAudience: (audience: string): boolean => {
      const expectedAudience = process.env["NEXT_PUBLIC_JWT_AUDIENCE"] || "dotmac-frontend";
      if (audience !== expectedAudience) {
        return false;
      }
      return true;
    },
  };

  /**
   * Validate token format and basic security checks
   */
  validateTokenFormat(token: string): boolean {
    try {
      // Validate token structure
      if (!SecureTokenManager.TokenValidationHelpers.validateTokenParts(token)) {
        return false;
      }

      // Validate algorithm
      const header = SecureTokenManager.TokenValidationHelpers.decodeTokenHeader(token);
      if (
        !header ||
        !SecureTokenManager.TokenValidationHelpers.validateAlgorithm(
          header.alg,
          this.VALID_ALGORITHMS,
        )
      ) {
        return false;
      }

      // Decode and validate payload
      const payload = this.decodeTokenPayload(token);
      if (!payload) {
        return false;
      }

      // Run all payload validations
      return (
        SecureTokenManager.TokenValidationHelpers.validateRequiredFields(payload) &&
        SecureTokenManager.TokenValidationHelpers.validateIssuer(payload.iss) &&
        SecureTokenManager.TokenValidationHelpers.validateAudience(payload.aud)
      );
    } catch (_error) {
      return false;
    }
  }

  /**
   * Check if provided token is expired
   * @param token - JWT token to check
   */
  isTokenExpired(token: string): boolean {
    try {
      if (!token) {
        return true;
      }

      const payload = this.decodeTokenPayload(token);
      if (!payload) {
        return true;
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      return payload.exp <= now;
    } catch (_error) {
      return true;
    }
  }

  /**
   * SECURITY: Token refresh must be handled by server actions
   */
  async refreshTokens(
    _apiRefreshFunction: (refreshToken: string) => Promise<TokenPair>,
  ): Promise<never> {
    throw new Error(
      "SECURITY: Token refresh must be handled by server actions. " +
        "Use refreshTokenAction() from server actions instead.",
    );
  }

  /**
   * Get safe token info for provided token (debugging/display only)
   * @param token - JWT token to analyze
   */
  getTokenInfo(token?: string): {
    isValid: boolean;
    isExpired: boolean;
    payload: Partial<TokenPayload> | null;
  } {
    if (!token) {
      return {
        isValid: false,
        isExpired: true,
        payload: null,
      };
    }

    const isValid = this.validateTokenFormat(token);
    const isExpired = this.isTokenExpired(token);

    let payload: Partial<TokenPayload> | null = null;
    if (isValid) {
      const fullPayload = this.decodeTokenPayload(token);
      if (fullPayload) {
        // Return only non-sensitive fields for display
        payload = {
          portal: fullPayload.portal,
          tenant: fullPayload.tenant,
          roles: fullPayload.roles,
          exp: fullPayload.exp,
          iat: fullPayload.iat,
        };
      }
    }

    return {
      isValid,
      isExpired,
      payload,
    };
  }

  /**
   * Stub for auto-refresh setup - in production, this would be handled by server actions
   */
  setupAutoRefresh(
    _refreshFn: (token: string) => Promise<TokenPair>,
    _onAuthFailure: () => Promise<void>,
  ): () => void {
    // Return a cleanup function (no-op for stub)
    return () => {};
  }
}

// Export singleton instance
export const tokenManager = new SecureTokenManager();
