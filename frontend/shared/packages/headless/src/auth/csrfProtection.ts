/**
 * CSRF Protection
 * Handles CSRF token management for secure requests
 */

export class CSRFProtection {
  private token: string | null = null;
  private tokenExpiry: number | null = null;

  // Initialize CSRF protection by fetching token
  async initialize(): Promise<void> {
    try {
      const response = await fetch("/api/auth/csrf", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        this.token = data.csrfToken;
        this.tokenExpiry = Date.now() + (data.expiresIn || 60 * 60) * 1000; // Default 1 hour
      }
    } catch (error) {
      console.warn("Failed to initialize CSRF protection:", error);
    }
  }

  // Get current CSRF token
  getToken(): string | null {
    // Check if token is expired
    if (this.tokenExpiry && Date.now() >= this.tokenExpiry) {
      this.token = null;
      this.tokenExpiry = null;
    }

    return this.token;
  }

  // Store CSRF token (e.g., from login response)
  storeToken(token: string, expiresIn?: number): void {
    this.token = token;
    this.tokenExpiry = Date.now() + (expiresIn || 60 * 60) * 1000; // Default 1 hour
  }

  // Clear CSRF token
  clearToken(): void {
    this.token = null;
    this.tokenExpiry = null;
  }

  // Check if CSRF token is valid
  isValid(): boolean {
    return !!(this.token && (!this.tokenExpiry || Date.now() < this.tokenExpiry));
  }

  // Get headers with CSRF token
  getHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { "X-CSRF-Token": token } : {};
  }

  // Refresh CSRF token if needed
  async refreshIfNeeded(): Promise<void> {
    if (!this.isValid()) {
      await this.initialize();
    }
  }
}
