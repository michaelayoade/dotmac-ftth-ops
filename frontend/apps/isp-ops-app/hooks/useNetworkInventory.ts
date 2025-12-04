import { useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";
import type { NetboxHealth, NetboxSite } from "@/types";

type NetboxHealthKey = ["netbox", "health"];
type NetboxSitesKey = ["netbox", "sites", { limit: number; offset: number }];

interface UseNetboxHealthOptions {
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<NetboxHealth, Error, NetboxHealth, NetboxHealthKey>,
    "queryKey" | "queryFn"
  >;
}

interface UseNetboxSitesOptions {
  limit?: number;
  offset?: number;
  enabled?: boolean;
  queryOptions?: Omit<
    UseQueryOptions<NetboxSite[], Error, NetboxSite[], NetboxSitesKey>,
    "queryKey" | "queryFn"
  >;
}

/**
 * Fetch NetBox health results for the current tenant.
 */
export function useNetboxHealth({
  enabled = true,
  queryOptions,
}: UseNetboxHealthOptions = {}): UseQueryResult<NetboxHealth, Error> {
  return useQuery<NetboxHealth, Error, NetboxHealth, NetboxHealthKey>({
    queryKey: ["netbox", "health"],
    queryFn: async () => {
      const response = await apiClient.get<NetboxHealth>("/netbox/health", {
        timeout: 8000, // 8 second timeout
      });
      return extractDataOrThrow(response);
    },
    enabled,
    staleTime: 60_000,
    retry: 1, // Only retry once
    ...queryOptions,
  });
}

/**
 * Fetch NetBox sites (DCIM) for the current tenant.
 */
export function useNetboxSites({
  limit = 20,
  offset = 0,
  enabled = true,
  queryOptions,
}: UseNetboxSitesOptions = {}): UseQueryResult<NetboxSite[], Error> {
  return useQuery<NetboxSite[], Error, NetboxSite[], NetboxSitesKey>({
    queryKey: ["netbox", "sites", { limit, offset }],
    queryFn: async () => {
      const response = await apiClient.get<NetboxSite[]>("/netbox/dcim/sites", {
        params: { limit, offset },
        timeout: 8000, // 8 second timeout
      });
      return extractDataOrThrow(response);
    },
    enabled,
    staleTime: 60_000,
    retry: 1, // Only retry once
    ...queryOptions,
  });
}
