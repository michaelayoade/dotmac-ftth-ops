"use client";

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

export interface ManagedTenantMetrics {
  total_subscribers: number;
  total_revenue_mtd: string;
  accounts_receivable: string;
  overdue_invoices_count: number;
  open_tickets_count: number;
  sla_compliance_pct: string | null;
}

export interface ManagedTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  status: string;
  access_role: string;
  relationship_type: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  is_expired: boolean;
  metrics: ManagedTenantMetrics | null;
  last_accessed: string | null;
}

export interface ManagedTenantsResponse {
  tenants: ManagedTenant[];
  total: number;
  offset: number;
  limit: number;
}

export interface UseManagedTenantsParams {
  status?: string | undefined;
  offset?: number | undefined;
  limit?: number | undefined;
}

/**
 * Hook to fetch managed tenants for the authenticated partner
 */
export function useManagedTenants(
  params: UseManagedTenantsParams = {},
): UseQueryResult<ManagedTenantsResponse, Error> {
  const { status, offset = 0, limit = 50 } = params;

  return useQuery({
    queryKey: ["partner", "managed-tenants", { status, offset, limit }],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      if (status) queryParams.set("status", status);
      queryParams.set("offset", offset.toString());
      queryParams.set("limit", limit.toString());

      const endpoint = `/partner/customers?${queryParams.toString()}`;
      const response = await apiClient.get<ManagedTenantsResponse>(endpoint);

      logger.info("Fetched managed tenants", {
        count: response.data.tenants.length,
        total: response.data.total,
      });

      return response.data;
    },
    staleTime: 30000, // 30 seconds
    retry: 2,
  });
}

export interface ManagedTenantDetail extends ManagedTenant {
  sla_response_hours: number | null;
  sla_uptime_target: string | null;
  notify_on_sla_breach: boolean;
  notify_on_billing_threshold: boolean;
  billing_alert_threshold: string | null;
  custom_permissions: Record<string, boolean>;
  notes: string | null;
  metadata: Record<string, any>;
}

/**
 * Hook to fetch detailed information for a specific managed tenant
 */
export function useManagedTenantDetail(
  tenantId: string | null,
): UseQueryResult<ManagedTenantDetail, Error> {
  return useQuery({
    queryKey: ["partner", "managed-tenant", tenantId],
    queryFn: async () => {
      if (!tenantId) {
        throw new Error("Tenant ID is required");
      }

      const response = await apiClient.get<ManagedTenantDetail>(`/partner/customers/${tenantId}`);

      logger.info("Fetched managed tenant detail", {
        tenantId,
        tenantName: response.data.tenant_name,
      });

      return response.data;
    },
    enabled: !!tenantId,
    staleTime: 60000, // 1 minute
    retry: 2,
  });
}
