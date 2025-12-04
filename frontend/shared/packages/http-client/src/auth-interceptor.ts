import Cookies from "js-cookie";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

export interface AuthConfig {
  tokenSource: "cookie" | "localStorage" | "sessionStorage";
  tokenKey: string;
  refreshTokenKey?: string;
  headerName: string;
  headerPrefix: string;
  refreshEndpoint?: string;
}

type RefreshResponse = {
  access_token?: string;
  refresh_token?: string;
};

export class AuthInterceptor {
  private config: AuthConfig;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      tokenSource: "cookie",
      tokenKey: "access_token",
      refreshTokenKey: "refresh_token",
      headerName: "Authorization",
      headerPrefix: "Bearer",
      refreshEndpoint: "/api/auth/refresh",
      ...config,
    };
  }

  requestInterceptor = (
    config: InternalAxiosRequestConfig & { skipAuth?: boolean },
  ): InternalAxiosRequestConfig => {
    const token = this.getToken();

    if (token && !this.isSkipAuth(config)) {
      config.headers = config.headers || {};
      config.headers[this.config.headerName] = `${this.config.headerPrefix} ${token}`;
    }

    return config;
  };

  responseInterceptor = {
    onFulfilled: (response: AxiosResponse) => response,
    onRejected: async (error: any) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          const newToken = await this.refreshToken();
          if (newToken) {
            originalRequest.headers[this.config.headerName] =
              `${this.config.headerPrefix} ${newToken}`;
            return await this.retryRequest(originalRequest);
          }
        } catch (refreshError) {
          this.clearTokens();
          // Redirect to login or dispatch logout action
          this.handleAuthFailure();
        }
      }

      return Promise.reject(error);
    },
  };

  private getToken(): string | null {
    switch (this.config.tokenSource) {
      case "cookie":
        return Cookies.get(this.config.tokenKey) || null;

      case "localStorage":
        if (typeof window !== "undefined") {
          return localStorage.getItem(this.config.tokenKey);
        }
        return null;

      case "sessionStorage":
        if (typeof window !== "undefined") {
          return sessionStorage.getItem(this.config.tokenKey);
        }
        return null;

      default:
        return null;
    }
  }

  private async refreshToken(): Promise<string | null> {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken || !this.config.refreshEndpoint) {
      return null;
    }

    try {
      // Note: This would need the actual axios instance, but we'll handle this
      // in the main HttpClient class to avoid circular dependencies
      const response = await fetch(this.config.refreshEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const data: unknown = await response.json();

      if (!data || typeof data !== "object") {
        return null;
      }

      const { access_token, refresh_token } = data as RefreshResponse;
      const newToken = typeof access_token === "string" ? access_token : null;
      const newRefreshToken = typeof refresh_token === "string" ? refresh_token : null;

      if (newToken) {
        this.setToken(newToken);
        if (newRefreshToken) {
          this.setRefreshToken(newRefreshToken);
        }
        return newToken;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
    }

    return null;
  }

  private getRefreshToken(): string | null {
    if (!this.config.refreshTokenKey) return null;

    switch (this.config.tokenSource) {
      case "cookie":
        return Cookies.get(this.config.refreshTokenKey) || null;

      case "localStorage":
        if (typeof window !== "undefined") {
          return localStorage.getItem(this.config.refreshTokenKey);
        }
        return null;

      case "sessionStorage":
        if (typeof window !== "undefined") {
          return sessionStorage.getItem(this.config.refreshTokenKey);
        }
        return null;

      default:
        return null;
    }
  }

  private setToken(token: string): void {
    switch (this.config.tokenSource) {
      case "cookie":
        Cookies.set(this.config.tokenKey, token, {
          secure: true,
          sameSite: "strict",
          expires: 7, // 7 days
        });
        break;

      case "localStorage":
        if (typeof window !== "undefined") {
          localStorage.setItem(this.config.tokenKey, token);
        }
        break;

      case "sessionStorage":
        if (typeof window !== "undefined") {
          sessionStorage.setItem(this.config.tokenKey, token);
        }
        break;
    }
  }

  private setRefreshToken(token: string): void {
    if (!this.config.refreshTokenKey) return;

    switch (this.config.tokenSource) {
      case "cookie":
        Cookies.set(this.config.refreshTokenKey, token, {
          secure: true,
          sameSite: "strict",
          expires: 30, // 30 days
        });
        break;

      case "localStorage":
        if (typeof window !== "undefined") {
          localStorage.setItem(this.config.refreshTokenKey, token);
        }
        break;

      case "sessionStorage":
        if (typeof window !== "undefined") {
          sessionStorage.setItem(this.config.refreshTokenKey, token);
        }
        break;
    }
  }

  private clearTokens(): void {
    // Clear access token
    switch (this.config.tokenSource) {
      case "cookie":
        Cookies.remove(this.config.tokenKey);
        if (this.config.refreshTokenKey) {
          Cookies.remove(this.config.refreshTokenKey);
        }
        break;

      case "localStorage":
        if (typeof window !== "undefined") {
          localStorage.removeItem(this.config.tokenKey);
          if (this.config.refreshTokenKey) {
            localStorage.removeItem(this.config.refreshTokenKey);
          }
        }
        break;

      case "sessionStorage":
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(this.config.tokenKey);
          if (this.config.refreshTokenKey) {
            sessionStorage.removeItem(this.config.refreshTokenKey);
          }
        }
        break;
    }
  }

  private async retryRequest(config: InternalAxiosRequestConfig): Promise<any> {
    // This would need to be handled by the main HttpClient instance
    throw new Error("Retry request needs to be handled by HttpClient");
  }

  private handleAuthFailure(): void {
    // Emit custom event for auth failure
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("auth:failure", {
          detail: { reason: "token_refresh_failed" },
        }),
      );
    }
  }

  private isSkipAuth(config: { skipAuth?: boolean } | undefined): boolean {
    return config?.skipAuth === true;
  }
}
