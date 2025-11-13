/**
 * Authentication Utilities
 *
 * Client-side authentication helpers and utilities.
 */

import { apiClient } from "./api/client";

export interface User {
  id: string;
  email: string;
  name: string;
  tenant_id?: string;
  roles?: string[];
  permissions?: string[];
  mfa_enabled?: boolean;
  mfa_backup_codes_remaining?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  full_name?: string;
  tenant_name?: string;
}

export interface AuthResponse {
  user: User;
  access_token?: string;
  refresh_token?: string;
}

/**
 * Login user
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/login", credentials);
  return response.data;
}

/**
 * Register new user
 */
export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/register", data);
  return response.data;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await apiClient.get<User>("/auth/me");
    return response.data;
  } catch (error) {
    return null;
  }
}

/**
 * Check if user has permission
 */
export function hasPermission(user: User | null, permission: string): boolean {
  if (!user || !user.permissions) {
    return false;
  }

  return user.permissions.includes(permission) || user.permissions.includes("*");
}

/**
 * Check if user has role
 */
export function hasRole(user: User | null, role: string): boolean {
  if (!user || !user.roles) {
    return false;
  }

  return user.roles.includes(role) || user.roles.includes("admin");
}

/**
 * Check if user has any of the specified roles
 */
export function hasAnyRole(user: User | null, roles: string[]): boolean {
  if (!user || !user.roles) {
    return false;
  }

  return roles.some((role) => user.roles!.includes(role)) || user.roles.includes("admin");
}

/**
 * Refresh authentication token
 */
export async function refreshToken(): Promise<string | null> {
  try {
    const response = await apiClient.post<{ access_token: string }>("/auth/refresh");
    return response.data.access_token;
  } catch (error) {
    return null;
  }
}

export const auth = {
  login,
  register,
  logout,
  getCurrentUser,
  hasPermission,
  hasRole,
  hasAnyRole,
  refreshToken,
};

export default auth;
