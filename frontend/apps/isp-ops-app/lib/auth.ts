/**
 * Authentication utilities
 * Provides login, registration, and permission checking functionality
 */

import { apiClient } from "./api/client";

export interface User {
  id: string;
  email: string;
  name: string;
  roles?: string[];
  permissions?: string[];
  tenantId?: string;
  tenant_id?: string;
  mfa_enabled?: boolean;
  mfa_backup_codes_remaining?: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

let currentUser: User | null = null;

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/login", credentials);
  currentUser = response.data.user;
  return response.data;
}

export async function register(data: RegisterData): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>("/auth/register", data);
  currentUser = response.data.user;
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout");
  currentUser = null;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const response = await apiClient.get<{ user?: User } | User>("/auth/me");
    const payload = (response as any).data ?? response;
    const user = (payload as any).user ?? payload;
    currentUser = (user as User) ?? null;
    return currentUser;
  } catch {
    currentUser = null;
    return null;
  }
}

export async function refreshToken(): Promise<string | null> {
  try {
    const response = await apiClient.post<{ accessToken?: string; access_token?: string }>(
      "/auth/refresh",
    );
    const token = (response.data as any)?.accessToken ?? (response.data as any)?.access_token;
    return token ?? null;
  } catch {
    return null;
  }
}

export function hasPermission(user: User | null, permission: string): boolean {
  if (!user) return false;
  const permissions = user.permissions ?? [];
  if (!permissions.length) {
    return (user.roles ?? []).includes("admin");
  }
  if (permissions.includes("*")) return true;
  if ((user.roles ?? []).includes("admin")) return true;
  return permissions.includes(permission);
}

export function hasRole(user: User | null, role: string): boolean {
  if (!user) return false;
  const roles = user.roles ?? [];
  if (roles.includes("admin")) return true;
  return roles.includes(role);
}

export function hasAnyRole(user: User | null, roles: string[]): boolean {
  if (!user) return false;
  const userRoles = user.roles ?? [];
  if (userRoles.includes("admin")) return true;
  if (!roles.length || !userRoles.length) return false;
  return roles.some((role) => userRoles.includes(role));
}
