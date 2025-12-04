/**
 * Platform Admin Service
 *
 * Service for platform-level administrative operations.
 */

import { apiClient } from "../api/client";

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  user_id: string;
  user_email: string;
  tenant_id?: string;
  action: string;
  resource_type: string;
  resource_id: string;
  changes?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  status: "success" | "failure";
  error_message?: string;
}

export interface AuditLogFilters {
  user_id?: string;
  tenant_id?: string;
  action?: string;
  resource_type?: string;
  start_date?: string;
  end_date?: string;
  status?: "success" | "failure";
  page?: number;
  page_size?: number;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "disabled";
  created_at: string;
  updated_at: string;
  user_count: number;
  subscription_plan?: string;
}

export interface SystemMetrics {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  active_users: number;
  database_size: number;
  storage_used: number;
  api_requests_today: number;
  error_rate: number;
  average_response_time: number;
}

export interface PlatformStats {
  total_tenants: number;
  active_tenants: number;
  total_users: number;
  total_resources: number;
  system_health: string;
}

export interface SystemConfig {
  environment: string;
  multi_tenant_mode: boolean;
  features_enabled: Record<string, boolean>;
}

export interface PlatformAdminHealth {
  status: string;
  user_id: string;
  is_platform_admin: boolean;
  permissions: string[];
  version?: string;
  timestamp?: string;
}

/**
 * Fetch audit logs with filters
 */
export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });

  const response = await apiClient.get<AuditLogResponse>(
    `/platform-admin/audit-logs?${params.toString()}`,
  );
  return response.data;
}

/**
 * Get audit log entry by ID
 */
export async function getAuditLogEntry(id: string): Promise<AuditLogEntry> {
  const response = await apiClient.get<AuditLogEntry>(`/platform-admin/audit-logs/${id}`);
  return response.data;
}

/**
 * Get all tenants
 */
export async function getAllTenants(): Promise<TenantInfo[]> {
  const response = await apiClient.get<TenantInfo[]>("/platform-admin/tenants");
  return response.data;
}

/**
 * Get tenant by ID
 */
export async function getTenant(id: string): Promise<TenantInfo> {
  const response = await apiClient.get<TenantInfo>(`/platform-admin/tenants/${id}`);
  return response.data;
}

/**
 * Create new tenant
 */
export async function createTenant(data: {
  name: string;
  slug: string;
  admin_email: string;
  admin_password: string;
}): Promise<TenantInfo> {
  const response = await apiClient.post<TenantInfo>("/platform-admin/tenants", data);
  return response.data;
}

/**
 * Update tenant
 */
export async function updateTenant(id: string, data: Partial<TenantInfo>): Promise<TenantInfo> {
  const response = await apiClient.patch<TenantInfo>(`/platform-admin/tenants/${id}`, data);
  return response.data;
}

/**
 * Suspend tenant
 */
export async function suspendTenant(id: string, reason?: string): Promise<void> {
  await apiClient.post(`/platform-admin/tenants/${id}/suspend`, { reason });
}

/**
 * Reactivate tenant
 */
export async function reactivateTenant(id: string): Promise<void> {
  await apiClient.post(`/platform-admin/tenants/${id}/reactivate`);
}

/**
 * Get system metrics
 */
export async function getSystemMetrics(): Promise<SystemMetrics> {
  const response = await apiClient.get<SystemMetrics>("/platform-admin/metrics");
  return response.data;
}

/**
 * Get platform statistics
 */
export async function getStats(): Promise<PlatformStats> {
  const response = await apiClient.get<PlatformStats>("/platform-admin/stats");
  return response.data;
}

/**
 * Clear platform cache
 */
export async function clearCache(
  cacheType: string = "all",
): Promise<{ cache_type: string; success: boolean }> {
  const response = await apiClient.post<{
    cache_type: string;
    success: boolean;
  }>("/platform-admin/cache/clear", { cache_type: cacheType });
  return response.data;
}

/**
 * Get system configuration
 */
export async function getSystemConfig(): Promise<SystemConfig> {
  const response = await apiClient.get<SystemConfig>("/platform-admin/config");
  return response.data;
}

/**
 * Get platform admin health check
 */
export async function getHealth(): Promise<PlatformAdminHealth> {
  const response = await apiClient.get<PlatformAdminHealth>("/platform-admin/health");
  return response.data;
}

/**
 * Export audit logs
 */
export async function exportAuditLogs(
  format: "csv" | "json" = "csv",
  filters: AuditLogFilters = {},
): Promise<Blob> {
  const params = new URLSearchParams();

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });

  params.append("format", format);

  const response = await apiClient.get(`/platform-admin/audit-logs/export?${params.toString()}`, {
    responseType: "blob",
  });

  return response.data;
}

export interface CrossTenantSearchParams {
  query: string;
  resource_type?: string | null;
  tenant_id?: string;
  limit?: number;
  offset?: number;
}

export interface CrossTenantSearchResult {
  id: string;
  type: string;
  tenant_id: string;
  resource_id?: string;
  score?: number;
  data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CrossTenantSearchResponse {
  total: number;
  results: CrossTenantSearchResult[];
}

export async function searchPlatformResources(
  params: CrossTenantSearchParams,
): Promise<CrossTenantSearchResponse> {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const response = await apiClient.get<CrossTenantSearchResponse>(
    `/platform-admin/search?${searchParams.toString()}`,
  );
  return response.data;
}

export const platformAdminService = {
  getAuditLogs,
  getAuditLogEntry,
  getAllTenants,
  getTenant,
  createTenant,
  updateTenant,
  suspendTenant,
  reactivateTenant,
  getSystemMetrics,
  getStats,
  getSystemConfig,
  getHealth,
  clearCache,
  exportAuditLogs,
  search: searchPlatformResources,
};

export default platformAdminService;
