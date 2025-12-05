/**
 * Auth API Client
 * Handles authentication-related API operations
 */

import { BaseApiClient, RequestConfig } from "./BaseApiClient";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: {
    id: string;
    email: string;
    name: string;
    roles: string[];
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export class AuthApiClient extends BaseApiClient {
  constructor(baseURL: string, defaultHeaders: Record<string, string> = {}) {
    super(baseURL, defaultHeaders, "Auth");
  }

  async login(credentials: LoginRequest, config?: RequestConfig): Promise<LoginResponse> {
    return this.request<LoginResponse>("POST", "/auth/login", credentials, config);
  }

  async logout(config?: RequestConfig): Promise<void> {
    return this.request<void>("POST", "/auth/logout", undefined, config);
  }

  async refreshToken(
    data: RefreshTokenRequest,
    config?: RequestConfig,
  ): Promise<RefreshTokenResponse> {
    return this.request<RefreshTokenResponse>("POST", "/auth/refresh", data, config);
  }

  async getCurrentUser(config?: RequestConfig): Promise<LoginResponse["user"]> {
    return this.request<LoginResponse["user"]>("GET", "/auth/me", undefined, config);
  }

  async requestPasswordReset(email: string, config?: RequestConfig): Promise<void> {
    return this.request<void>("POST", "/auth/password-reset/request", { email }, config);
  }

  async resetPassword(token: string, password: string, config?: RequestConfig): Promise<void> {
    return this.request<void>("POST", "/auth/password-reset/confirm", { token, password }, config);
  }
}
