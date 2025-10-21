/**
 * Secure Authentication Client
 * Universal cookie-only authentication for all DotMac frontend applications
 *
 * SECURITY FEATURES:
 * - No client-side token storage
 * - HttpOnly cookies only
 * - CSRF protection on all requests
 * - Automatic session refresh
 * - Secure logout with cleanup
 */

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  permissions: string[];
  tenantId?: string;
  portalType: "admin" | "customer" | "reseller" | "technician" | "management";
}

export interface LoginCredentials {
  email: string;
  username?: string;
  password: string;
  portal?: string;
  rememberMe?: boolean;
}

export interface AuthResponse {
  success: boolean;
  user?: AuthUser;
  message?: string;
  error?: string;
}

export interface SessionInfo {
  isValid: boolean;
  user?: AuthUser;
  expiresAt?: string;
  csrfToken?: string;
}

class SecureAuthClient {
  private static instance: SecureAuthClient;
  private baseUrl: string;
  private csrfToken: string | null = null;
  private sessionRefreshTimer: NodeJS.Timeout | null = null;

  private constructor() {
    this.baseUrl = this.getApiBaseUrl();
    this.setupSessionRefresh();
  }

  static getInstance(): SecureAuthClient {
    if (!SecureAuthClient.instance) {
      SecureAuthClient.instance = new SecureAuthClient();
    }
    return SecureAuthClient.instance;
  }

  private getApiBaseUrl(): string {
    if (typeof window !== "undefined") {
      // Client-side: detect from current URL
      const { protocol, hostname, port } = window.location;
      const apiPort = this.detectApiPort(port);
      return `${protocol}//${hostname}${apiPort ? `:${apiPort}` : ""}`;
    }

    // Server-side: use environment variable
    return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  }

  private detectApiPort(currentPort: string): string | null {
    // Map frontend ports to API ports
    const portMap: { [key: string]: string } = {
      "3000": "8000", // admin -> management platform
      "3001": "8001", // customer -> ISP framework
      "3002": "8000", // reseller -> management platform
      "3003": "8001", // technician -> ISP framework
    };

    return portMap[currentPort] || null;
  }

  /**
   * SECURITY: Get CSRF token for state-changing requests
   */
  private async getCSRFToken(): Promise<string> {
    if (this.csrfToken) {
      return this.csrfToken;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/auth/csrf`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to get CSRF token");
      }

      const data = await response.json();
      this.csrfToken = data.csrfToken;
      return this.csrfToken;
    } catch (error) {
      console.error("CSRF token fetch failed:", error);
      throw new Error("Security token unavailable");
    }
  }

  /**
   * SECURITY: Make authenticated request with automatic CSRF protection
   */
  async authenticatedRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;

    const requestOptions: RequestInit = {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...options.headers,
      },
    };

    // Add CSRF token for state-changing requests
    if (["POST", "PUT", "PATCH", "DELETE"].includes(options.method?.toUpperCase() || "GET")) {
      try {
        const csrfToken = await this.getCSRFToken();
        requestOptions.headers = {
          ...requestOptions.headers,
          "X-CSRF-Token": csrfToken,
        };
      } catch (error) {
        console.error("Failed to add CSRF protection:", error);
        // Continue without CSRF token - server will reject if required
      }
    }

    const response = await fetch(url, requestOptions);

    // Handle authentication failures
    if (response.status === 401) {
      // Clear stale CSRF token
      this.csrfToken = null;

      // Try to refresh session
      const refreshed = await this.refreshSession();
      if (refreshed) {
        // Retry original request once
        return this.authenticatedRequest(endpoint, options);
      } else {
        // Redirect to login
        this.handleAuthenticationFailure();
      }
    }

    // Clear CSRF token on forbidden responses
    if (response.status === 403) {
      this.csrfToken = null;
    }

    return response;
  }

  /**
   * Login with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Clear any existing CSRF token
      this.csrfToken = null;

      const response = await fetch(`${this.baseUrl}/api/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": await this.getCSRFToken(),
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || "Login failed",
        };
      }

      const data = await response.json();

      // Start session refresh timer
      this.setupSessionRefresh();

      return {
        success: true,
        user: data.user,
        message: "Login successful",
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Login failed",
      };
    }
  }

  /**
   * Secure logout with complete cleanup
   */
  async logout(): Promise<void> {
    try {
      // Clear session refresh timer
      this.stopSessionRefresh();

      // Call server logout endpoint
      await fetch(`${this.baseUrl}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": this.csrfToken || "",
        },
      });
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      // Always clear local state
      this.csrfToken = null;

      // Redirect to login page
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<SessionInfo> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/validate`, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          isValid: true,
          user: data.user,
          expiresAt: data.expiresAt,
          csrfToken: data.csrfToken,
        };
      }

      return { isValid: false };
    } catch (error) {
      console.error("Session validation failed:", error);
      return { isValid: false };
    }
  }

  /**
   * Refresh session/tokens
   */
  private async refreshSession(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Update CSRF token if provided
        if (data.csrfToken) {
          this.csrfToken = data.csrfToken;
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error("Session refresh failed:", error);
      return false;
    }
  }

  /**
   * Setup automatic session refresh
   */
  private setupSessionRefresh(): void {
    if (this.sessionRefreshTimer) {
      return; // Already setup
    }

    // Refresh every 25 minutes (before 30-minute typical expiry)
    this.sessionRefreshTimer = setInterval(
      async () => {
        const refreshed = await this.refreshSession();
        if (!refreshed) {
          this.handleAuthenticationFailure();
        }
      },
      25 * 60 * 1000,
    );
  }

  /**
   * Stop session refresh timer
   */
  private stopSessionRefresh(): void {
    if (this.sessionRefreshTimer) {
      clearInterval(this.sessionRefreshTimer);
      this.sessionRefreshTimer = null;
    }
  }

  /**
   * Handle authentication failure
   */
  private handleAuthenticationFailure(): void {
    this.stopSessionRefresh();
    this.csrfToken = null;

    if (typeof window !== "undefined") {
      // Store current URL for post-login redirect
      const currentPath = window.location.pathname + window.location.search;
      if (currentPath !== "/login") {
        sessionStorage.setItem("login_redirect", currentPath);
      }

      // Redirect to login
      window.location.href = "/login";
    }
  }

  /**
   * Get current authentication status
   */
  async getAuthStatus(): Promise<{ authenticated: boolean; user?: AuthUser }> {
    const session = await this.validateSession();
    return {
      authenticated: session.isValid,
      user: session.user,
    };
  }

  /**
   * Check if user has specific permission
   */
  async hasPermission(permission: string): Promise<boolean> {
    const { authenticated, user } = await this.getAuthStatus();
    return (authenticated && user?.permissions.includes(permission)) || false;
  }

  /**
   * Check if user has specific role
   */
  async hasRole(role: string): Promise<boolean> {
    const { authenticated, user } = await this.getAuthStatus();
    return (authenticated && user?.role === role) || false;
  }
}

// Export singleton instance
export const secureAuthClient = SecureAuthClient.getInstance();

// Legacy compatibility exports
export const authClient = secureAuthClient;
export default secureAuthClient;
