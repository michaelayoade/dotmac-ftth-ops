/**
 * Token Manager
 * Handles secure token storage and auto-refresh
 */

import type { AuthTokens } from "./types";
import type { SecureStorage } from "./storage";

export class TokenManager {
  private storage: SecureStorage;
  private refreshTimer: NodeJS.Timeout | null = null;
  private refreshThreshold: number = 5 * 60 * 1000; // 5 minutes

  constructor(storage: SecureStorage, refreshThreshold?: number) {
    this.storage = storage;
    if (refreshThreshold) {
      this.refreshThreshold = refreshThreshold;
    }
  }

  // Set tokens in secure storage
  setTokens(tokens: AuthTokens): void {
    this.storage.setObject("tokens", {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    });

    // Store CSRF token separately if provided
    if (tokens.csrfToken) {
      this.storage.setItem("csrf_token", tokens.csrfToken);
    }
  }

  // Get access token
  getAccessToken(): string | null {
    const tokens = this.storage.getObject<AuthTokens>("tokens");
    return tokens?.accessToken || null;
  }

  // Get refresh token
  getRefreshToken(): string | null {
    const tokens = this.storage.getObject<AuthTokens>("tokens");
    return tokens?.refreshToken || null;
  }

  // Get CSRF token
  getCSRFToken(): string | null {
    return this.storage.getItem("csrf_token");
  }

  // Check if token is expired or about to expire
  isTokenExpired(threshold: number = this.refreshThreshold): boolean {
    const tokens = this.storage.getObject<AuthTokens>("tokens");
    if (!tokens?.expiresAt) return true;

    return Date.now() >= tokens.expiresAt - threshold;
  }

  // Get time until token expires
  getTimeUntilExpiry(): number {
    const tokens = this.storage.getObject<AuthTokens>("tokens");
    if (!tokens?.expiresAt) return 0;

    return Math.max(0, tokens.expiresAt - Date.now());
  }

  // Clear all tokens
  clearTokens(): void {
    this.storage.removeItem("tokens");
    this.storage.removeItem("csrf_token");
    this.stopAutoRefresh();
  }

  // Setup automatic token refresh
  setupAutoRefresh(refreshFn: () => Promise<boolean>, onError: () => void): () => void {
    this.stopAutoRefresh();

    const scheduleRefresh = () => {
      const timeUntilExpiry = this.getTimeUntilExpiry();
      const refreshTime = Math.max(1000, timeUntilExpiry - this.refreshThreshold);

      this.refreshTimer = setTimeout(async () => {
        try {
          const success = await refreshFn();
          if (success) {
            // Schedule next refresh
            scheduleRefresh();
          } else {
            onError();
          }
        } catch (error) {
          console.error("Auto-refresh failed:", error);
          onError();
        }
      }, refreshTime);
    };

    // Only setup refresh if we have tokens
    if (this.getAccessToken()) {
      scheduleRefresh();
    }

    return () => this.stopAutoRefresh();
  }

  // Stop automatic refresh
  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // Check if we have valid tokens
  hasValidTokens(): boolean {
    const accessToken = this.getAccessToken();
    const refreshToken = this.getRefreshToken();
    return !!(accessToken && refreshToken && !this.isTokenExpired());
  }

  // Get token for Authorization header
  getAuthHeader(): string | null {
    const token = this.getAccessToken();
    return token ? `Bearer ${token}` : null;
  }
}
