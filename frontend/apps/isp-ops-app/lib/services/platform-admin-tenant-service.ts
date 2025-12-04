/**
 * Platform Admin Tenant Service
 *
 * Service for tenant-specific administrative operations by platform admins.
 */

import { apiClient } from "../api/client";

export interface TenantDetails {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "disabled";
  created_at: string;
  updated_at: string;
  settings: Record<string, any>;
  subscription: {
    plan: string;
    status: string;
    current_period_end: string;
  };
  usage: {
    users: number;
    storage_gb: number;
    api_calls_month: number;
  };
  limits: {
    max_users: number;
    max_storage_gb: number;
    max_api_calls_month: number;
  };
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  roles: string[];
  status: "active" | "disabled";
  created_at: string;
  last_login?: string;
}

export interface TenantStatistics {
  total_users: number;
  active_users: number;
  total_api_calls: number;
  storage_used_gb: number;
  created_at: string;
  last_activity: string;
}

export interface PlatformTenantListParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}

export interface PlatformTenantListResponse {
  tenants: TenantDetails[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Get tenant details
 */
export async function getTenantDetails(tenantId: string): Promise<TenantDetails> {
  const response = await apiClient.get<TenantDetails>(
    `/platform-admin/tenants/${tenantId}/details`,
  );
  return response.data;
}

/**
 * Get tenant users
 */
export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  const response = await apiClient.get<TenantUser[]>(`/platform-admin/tenants/${tenantId}/users`);
  return response.data;
}

/**
 * Get tenant statistics
 */
export async function getTenantStatistics(tenantId: string): Promise<TenantStatistics> {
  const response = await apiClient.get<TenantStatistics>(
    `/platform-admin/tenants/${tenantId}/statistics`,
  );
  return response.data;
}

/**
 * Update tenant settings
 */
export async function updateTenantSettings(
  tenantId: string,
  settings: Record<string, any>,
): Promise<TenantDetails> {
  const response = await apiClient.patch<TenantDetails>(
    `/platform-admin/tenants/${tenantId}/settings`,
    { settings },
  );
  return response.data;
}

/**
 * Update tenant limits
 */
export async function updateTenantLimits(
  tenantId: string,
  limits: Partial<TenantDetails["limits"]>,
): Promise<TenantDetails> {
  const response = await apiClient.patch<TenantDetails>(
    `/platform-admin/tenants/${tenantId}/limits`,
    { limits },
  );
  return response.data;
}

/**
 * Disable tenant user
 */
export async function disableTenantUser(tenantId: string, userId: string): Promise<void> {
  await apiClient.post(`/platform-admin/tenants/${tenantId}/users/${userId}/disable`);
}

/**
 * Enable tenant user
 */
export async function enableTenantUser(tenantId: string, userId: string): Promise<void> {
  await apiClient.post(`/platform-admin/tenants/${tenantId}/users/${userId}/enable`);
}

/**
 * Delete tenant (soft delete)
 */
export async function deleteTenant(tenantId: string, reason?: string): Promise<void> {
  await apiClient.delete(`/platform-admin/tenants/${tenantId}`, {
    data: { reason },
  });
}

/**
 * Restore deleted tenant
 */
export async function restoreTenant(tenantId: string): Promise<void> {
  await apiClient.post(`/platform-admin/tenants/${tenantId}/restore`);
}

/**
 * Impersonate tenant (get access token to view as tenant)
 */
export async function impersonateTenant(
  tenantId: string,
  duration?: number,
): Promise<{
  access_token: string;
  expires_in: number;
  refresh_token?: string;
}> {
  const response = await apiClient.post<{
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  }>(`/platform-admin/tenants/${tenantId}/impersonate`, { duration });
  return response.data;
}

/**
 * List all tenants with pagination
 */
export async function listTenants(
  params: PlatformTenantListParams,
): Promise<PlatformTenantListResponse> {
  const queryParams = new URLSearchParams();
  if (params.page) queryParams.append("page", params.page.toString());
  if (params.limit) queryParams.append("limit", params.limit.toString());
  if (params.status) queryParams.append("status", params.status);
  if (params.search) queryParams.append("search", params.search);

  const response = await apiClient.get<PlatformTenantListResponse>(
    `/platform-admin/tenants?${queryParams.toString()}`,
  );
  return response.data;
}

export const platformAdminTenantService = {
  getTenantDetails,
  getTenantUsers,
  getTenantStatistics,
  updateTenantSettings,
  updateTenantLimits,
  disableTenantUser,
  enableTenantUser,
  deleteTenant,
  restoreTenant,
  impersonateTenant,
  listTenants,
};

export default platformAdminTenantService;
