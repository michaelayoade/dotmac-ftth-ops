import { apiClient } from "../api/client";

export interface Address {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan?: string;
  billing_cycle?: string;
  contact_email?: string;
  billing_email?: string;
  contact_phone?: string;
  description?: string;
  website?: string;
  address?: Address;
  industry?: string;
  company_size?: string;
  tax_id?: string;
  created_at?: string;
  trial_ends_at?: string;
  logo_url?: string;
  settings?: Record<string, any>;
}

export interface TenantInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  invited_by?: string;
  created_at: string;
  expires_at: string;
}

export interface TenantStats {
  total_users: number;
  active_users: number;
  total_resources: number;
  storage_used: number;
  total_api_calls: number;
  features_enabled: number;
  plan: string;
  status: string;
  days_until_trial_end?: number | null;
  days_until_subscription_end?: number | null;
}

export async function getCurrentTenant(): Promise<Tenant> {
  const response = await apiClient.get<Tenant>("/tenant/current");
  return response.data;
}

export async function getTenant(id: string): Promise<Tenant> {
  const response = await apiClient.get<Tenant>(`/tenant/${id}`);
  return response.data;
}

export async function updateTenant(id: string, data: Partial<Tenant>): Promise<Tenant> {
  const response = await apiClient.patch<Tenant>(`/tenant/${id}`, data);
  return response.data;
}

export async function updateTenantSettings(settings: Record<string, any>): Promise<Tenant> {
  const response = await apiClient.patch<Tenant>("/tenant/settings", {
    settings,
  });
  return response.data;
}

export async function getStats(tenantId?: string): Promise<TenantStats> {
  const url = tenantId ? `/tenant/${tenantId}/stats` : "/tenant/stats";
  const response = await apiClient.get<TenantStats>(url);
  return response.data;
}

export async function getInvitations(tenantId?: string): Promise<TenantInvitation[]> {
  const url = tenantId ? `/tenant/${tenantId}/invitations` : "/tenant/invitations";
  const response = await apiClient.get<TenantInvitation[]>(url);
  return response.data;
}

export const listInvitations = getInvitations;

export async function createInvitation(
  tenantId: string,
  data: { email: string; role: string; expires_in_days?: number },
): Promise<TenantInvitation> {
  const response = await apiClient.post<TenantInvitation>(`/tenant/${tenantId}/invitations`, data);
  return response.data;
}

export async function deleteInvitation(invitationId: string): Promise<void> {
  await apiClient.delete(`/tenant/invitations/${invitationId}`);
}

export async function resendInvitation(invitationId: string): Promise<void> {
  await apiClient.post(`/tenant/invitations/${invitationId}/resend`);
}

export async function revokeInvitation(tenantId: string, invitationId: string): Promise<void> {
  await apiClient.delete(`/tenant/${tenantId}/invitations/${invitationId}`);
}

/**
 * Get display name for tenant status
 */
export function getStatusDisplayName(status: string): string {
  const statusMap: Record<string, string> = {
    active: "Active",
    suspended: "Suspended",
    disabled: "Disabled",
    pending: "Pending",
    inactive: "Inactive",
  };
  return statusMap[status.toLowerCase()] || status;
}

/**
 * Get display name for subscription plan
 */
export function getPlanDisplayName(plan: string): string {
  const planMap: Record<string, string> = {
    free: "Free",
    starter: "Starter",
    professional: "Professional",
    enterprise: "Enterprise",
    basic: "Basic",
    premium: "Premium",
  };
  return planMap[plan.toLowerCase()] || plan;
}

export const tenantService = {
  getCurrentTenant,
  getTenant,
  updateTenant,
  updateTenantSettings,
  getStats,
  getInvitations,
  listInvitations,
  createInvitation,
  deleteInvitation,
  resendInvitation,
  revokeInvitation,
  getStatusDisplayName,
  getPlanDisplayName,
};
export default tenantService;
