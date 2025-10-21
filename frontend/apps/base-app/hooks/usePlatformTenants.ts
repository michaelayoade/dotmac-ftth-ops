"use client";

import { useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  platformAdminTenantService,
  PlatformTenantListParams,
  PlatformTenantListResponse,
} from "@/lib/services/platform-admin-tenant-service";

export const platformTenantsQueryKey = (params: PlatformTenantListParams) => [
  "platform-tenants",
  params,
];

type PlatformTenantsQueryKey = ReturnType<typeof platformTenantsQueryKey>;

export function usePlatformTenants(
  params: PlatformTenantListParams,
): UseQueryResult<PlatformTenantListResponse, Error> {
  return useQuery<
    PlatformTenantListResponse,
    Error,
    PlatformTenantListResponse,
    PlatformTenantsQueryKey
  >({
    queryKey: platformTenantsQueryKey(params),
    queryFn: () => platformAdminTenantService.listTenants(params),
    meta: {
      feature: "platform-tenants",
    },
  });
}
