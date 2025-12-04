/**
 * CSRF (Cross-Site Request Forgery) protection utilities
 */

import { secureStorage } from "./secureStorage";
import { tokenManager } from "./tokenManager";

export interface CSRFConfig {
  headerName: string;
  tokenName: string;
  cookieName: string;
  enabledMethods: string[];
}

class CSRFProtection {
  private readonly config: CSRFConfig = {
    headerName: "X-CSRF-Token",
    tokenName: "csrf_token",
    cookieName: "__dotmac_csrf",
    enabledMethods: ["POST", "PUT", "PATCH", "DELETE"],
  };

  /**
   * Generate a cryptographically secure CSRF token
   */
  generateToken(): string {
    try {
      // Generate random bytes using crypto API
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);

      // Convert to base64url
      return btoa(String.fromCharCode(...array))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
    } catch (_error) {
      return this.generateFallbackToken();
    }
  }

  /**
   * Fallback token generation for older browsers
   */
  private generateFallbackToken(): string {
    let token = "";
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    for (let i = 0; i < 43; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return token;
  }

  /**
   * Store CSRF token securely
   */
  storeToken(token: string): void {
    try {
      // Store in secure storage
      secureStorage.setItem(this.config.tokenName, token, {
        secure: true,
        sameSite: "strict",
        maxAge: 60 * 60, // 1 hour
      });
    } catch (_error) {
      // Error handling intentionally empty
    }
  }

  /**
   * Get current CSRF token
   */
  getToken(): string | null {
    try {
      let token = tokenManager.getCSRFToken();

      if (!token) {
        token = secureStorage.getItem(this.config.tokenName);
      }

      return token;
    } catch (_error) {
      return null;
    }
  }

  /**
   * Initialize CSRF protection for the session
   */
  async initialize(): Promise<string> {
    try {
      // Check if we already have a valid token
      let token = this.getToken();

      if (!token || !this.validateTokenFormat(token)) {
        // Generate new token
        token = this.generateToken();
        this.storeToken(token);
      }

      return token;
    } catch (_error) {
      throw new Error("CSRF initialization failed");
    }
  }

  /**
   * Validate CSRF token format
   */
  validateTokenFormat(token: string): boolean {
    // Check if token is base64url format and has appropriate length
    const base64urlRegex = /^[A-Za-z0-9\-_]+$/;
    return base64urlRegex.test(token) && token.length >= 32;
  }

  /**
   * Clear CSRF token
   */
  clearToken(): void {
    try {
      secureStorage.removeItem(this.config.tokenName);
    } catch (_error) {
      // Error handling intentionally empty
    }
  }

  /**
   * Check if method requires CSRF protection
   */
  requiresProtection(method: string): boolean {
    return this.config.enabledMethods.includes(method.toUpperCase());
  }

  /**
   * Get CSRF headers for API requests
   */
  getHeaders(): Record<string, string> {
    const token = this.getToken();

    if (!token) {
      return {
        // Implementation pending
      };
    }

    return {
      [this.config.headerName]: token,
    };
  }

  /**
   * Validate CSRF token against expected value
   * Note: This is primarily for client-side validation.
   * Server-side validation is still required for security.
   */
  validateToken(providedToken: string): boolean {
    try {
      const storedToken = this.getToken();

      if (!storedToken || !providedToken) {
        return false;
      }

      // Use constant-time comparison to prevent timing attacks
      return this.constantTimeEqual(storedToken, providedToken);
    } catch (_error) {
      return false;
    }
  }

  /**
   * Constant-time string comparison to prevent timing attacks
   */
  private constantTimeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Rotate CSRF token (generate new one)
   */
  rotateToken(): string {
    try {
      this.clearToken();
      const newToken = this.generateToken();
      this.storeToken(newToken);
      return newToken;
    } catch (_error) {
      throw new Error("CSRF token rotation failed");
    }
  }

  /**
   * Get CSRF configuration
   */
  getConfig(): CSRFConfig {
    return { ...this.config };
  }

  /**
   * Update CSRF configuration
   */
  updateConfig(updates: Partial<CSRFConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Check if CSRF protection is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.headerName &&
      this.config.tokenName &&
      this.config.enabledMethods.length > 0
    );
  }

  /**
   * Get debug information about CSRF protection
   */
  getDebugInfo(): {
    hasToken: boolean;
    tokenLength: number;
    isConfigured: boolean;
    protectedMethods: string[];
  } {
    const token = this.getToken();

    return {
      hasToken: !!token,
      tokenLength: token ? token.length : 0,
      isConfigured: this.isConfigured(),
      protectedMethods: this.config.enabledMethods,
    };
  }
}

// Export singleton instance
export const csrfProtection = new CSRFProtection();

// Hook for React components
export function useCSRFProtection() {
  return {
    getToken: () => csrfProtection.getToken(),
    getHeaders: () => csrfProtection.getHeaders(),
    initialize: () => csrfProtection.initialize(),
    rotateToken: () => csrfProtection.rotateToken(),
    requiresProtection: (method: string) => csrfProtection.requiresProtection(method),
  };
}
