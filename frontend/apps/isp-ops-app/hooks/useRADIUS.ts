/**
 * RADIUS Hooks
 *
 * Hooks for fetching RADIUS subscriber and session data
 */

import { useQuery } from "@tanstack/react-query";
import { useAppConfig } from "@/providers/AppConfigContext";
import { buildApiUrl, parseListResponse, handleApiError } from "../../../shared/utils/api-utils";
import {
  RADIUSSubscriber,
  RADIUSSubscriberSchema,
  RADIUSSession,
  RADIUSSessionSchema,
} from "../../../shared/utils/radius-schemas";

// Re-export types for convenience
export type { RADIUSSubscriber, RADIUSSession };

interface UseRADIUSOptions {
  enabled?: boolean;
}

export function useRADIUSSubscribers(offset: number, limit: number, options?: UseRADIUSOptions) {
  const { api } = useAppConfig();

  return useQuery({
    queryKey: ["radius-subscribers", offset, limit, api.baseUrl, api.prefix],
    queryFn: async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const url = `${buildApiUrl("/radius/subscribers", api)}?offset=${offset}&limit=${limit}`;
      const response = await fetch(url, {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        await handleApiError(response, "Failed to fetch RADIUS subscribers");
      }

      return parseListResponse<RADIUSSubscriber>(response, RADIUSSubscriberSchema);
    },
    enabled: options?.enabled ?? true,
    staleTime: 30000, // 30 seconds
  });
}

export function useRADIUSSessions(offset = 0, limit = 100, options?: UseRADIUSOptions) {
  const { api } = useAppConfig();

  return useQuery({
    queryKey: ["radius-sessions", offset, limit, api.baseUrl, api.prefix],
    queryFn: async () => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const url = `${buildApiUrl("/radius/sessions", api)}?offset=${offset}&limit=${limit}`;
      const response = await fetch(url, {
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        await handleApiError(response, "Failed to fetch RADIUS sessions");
      }

      return parseListResponse<RADIUSSession>(response, RADIUSSessionSchema);
    },
    enabled: options?.enabled ?? true,
    staleTime: 10000, // 10 seconds (sessions change frequently)
  });
}
