/**
 * Authentication Service
 *
 * Service for authentication operations via API.
 */

import { apiClient } from "../client";

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  username?: string;
  tenant_id?: string;
  roles?: string[];
  permissions?: string[];
  mfa_enabled?: boolean;
  mfa_backup_codes_remaining?: number;
  // Partner multi-tenant fields
  partner_id?: string;
  managed_tenant_ids?: string[];
  active_managed_tenant_id?: string;
}

// Alias for compatibility
export type User = AuthUser;

export interface AuthResponse {
  user: AuthUser;
  access_token?: string;
  refresh_token?: string;
}

export interface TokenRefreshResponse {
  access_token: string;
  refresh_token?: string;
}

/**
 * Login with email and password
 */
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/login", credentials);
  return response.data;
}

/**
 * Register new user
 */
export async function register(data: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/register", data);
  return response.data;
}

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>("/auth/me");
  return response.data;
}

/**
 * Refresh authentication token
 */
export async function refreshToken(): Promise<TokenRefreshResponse> {
  const response = await apiClient.post<TokenRefreshResponse>("/auth/refresh");
  return response.data;
}

/**
 * Verify email address
 */
export async function verifyEmail(token: string): Promise<void> {
  await apiClient.post("/auth/verify-email", { token });
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiClient.post("/auth/password-reset/request", { email });
}

/**
 * Reset password with token
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/password-reset/confirm", {
    token,
    new_password: newPassword,
  });
}

/**
 * Change password for authenticated user
 */
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/auth/password-change", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

/**
 * Enable two-factor authentication
 */
export async function enableTwoFactor(): Promise<{
  qr_code: string;
  secret: string;
}> {
  const response = await apiClient.post<{ qr_code: string; secret: string }>("/auth/2fa/enable");
  return response.data;
}

/**
 * Verify two-factor authentication code
 */
export async function verifyTwoFactor(code: string): Promise<void> {
  await apiClient.post("/auth/2fa/verify", { code });
}

/**
 * Disable two-factor authentication
 */
export async function disableTwoFactor(code: string): Promise<void> {
  await apiClient.post("/auth/2fa/disable", { code });
}

/**
 * Update user profile
 */
export async function updateProfile(data: Partial<AuthUser>): Promise<AuthUser> {
  const response = await apiClient.patch<AuthUser>("/auth/profile", data);
  return response.data;
}

/**
 * Upload user avatar
 */
export async function uploadAvatar(file: File): Promise<{ avatar_url: string }> {
  const formData = new FormData();
  formData.append("avatar", file);

  const response = await apiClient.post<{ avatar_url: string }>("/auth/profile/avatar", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

export const authService = {
  login,
  register,
  logout,
  getCurrentUser,
  refreshToken,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  enableTwoFactor,
  verifyTwoFactor,
  disableTwoFactor,
  updateProfile,
  uploadAvatar,
};

export default authService;
