/**
 * RADIUS Hooks
 *
 * Hooks for fetching RADIUS subscriber and session data
 */

import { useQuery } from '@tanstack/react-query';
import { getOperatorAccessToken } from '../../../shared/utils/operatorAuth';
import { useAppConfig } from '@/providers/AppConfigContext';

export interface RADIUSSubscriber {
  id: number;
  tenant_id: string;
  subscriber_id: string;
  username: string;
  enabled: boolean;
  bandwidth_profile_id?: string | null;
  framed_ipv4_address?: string | null;
  framed_ipv6_address?: string | null;
  delegated_ipv6_prefix?: string | null;
  session_timeout?: number | null;
  idle_timeout?: number | null;
  created_at: string;
}

export interface RADIUSSession {
  radacctid: number;
  tenant_id: string;
  subscriber_id: string | null;
  username: string;
  acctsessionid: string;
  nasipaddress: string;
  framedipaddress: string | null;
  framedipv6address: string | null;
  framedipv6prefix: string | null;
  delegatedipv6prefix: string | null;
  acctstarttime: string | null;
  acctsessiontime: number | null;
  acctinputoctets: number | null;
  acctoutputoctets: number | null;
}

interface UseRADIUSOptions {
  enabled?: boolean;
}

async function parseListResponse<T>(response: Response): Promise<{ data: T[]; total: number }> {
  const payload = await response.json();
  let items: T[] = [];
  let total = 0;

  if (Array.isArray(payload)) {
    items = payload;
  } else if (Array.isArray(payload?.data)) {
    items = payload.data as T[];
    total = Number(payload?.total ?? payload?.count ?? payload?.total_count ?? items.length);
  } else if (Array.isArray(payload?.items)) {
    items = payload.items as T[];
    total = Number(payload?.total ?? payload?.count ?? payload?.total_count ?? items.length);
  } else {
    items = [];
  }

  if (!Number.isFinite(total) || total <= 0) {
    const headerTotal =
      response.headers.get('x-total-count') ||
      response.headers.get('x-total') ||
      response.headers.get('x-total-results');
    if (headerTotal) {
      const parsed = Number.parseInt(headerTotal, 10);
      if (Number.isFinite(parsed)) {
        total = parsed;
      }
    }
  }

  if (!Number.isFinite(total) || total <= 0) {
    total = items.length;
  }

  return { data: items, total };
}

export function useRADIUSSubscribers(offset: number, limit: number, options?: UseRADIUSOptions) {
  const { api } = useAppConfig();
  const buildApiUrl = (path: string) => {
    if (typeof api.buildUrl === "function") {
      return api.buildUrl(path);
    }
    const base = api.baseUrl || "";
    const prefix = api.prefix || "";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${prefix}${normalizedPath}`;
  };
  return useQuery({
    queryKey: ['radius-subscribers', offset, limit, api.baseUrl, api.prefix],
    queryFn: async () => {
      const token = getOperatorAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(
        `${buildApiUrl("/radius/subscribers")}?offset=${offset}&limit=${limit}`,
        {
          credentials: 'include',
          headers,
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch RADIUS subscribers: ${response.statusText}`);
      }

      return parseListResponse<RADIUSSubscriber>(response);
    },
    enabled: options?.enabled ?? true,
    staleTime: 30000, // 30 seconds
  });
}

export function useRADIUSSessions(options?: UseRADIUSOptions) {
  const { api } = useAppConfig();
  const buildApiUrl = (path: string) => {
    if (typeof api.buildUrl === "function") {
      return api.buildUrl(path);
    }
    const base = api.baseUrl || "";
    const prefix = api.prefix || "";
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    return `${base}${prefix}${normalizedPath}`;
  };
  return useQuery({
    queryKey: ['radius-sessions', api.baseUrl, api.prefix],
    queryFn: async () => {
      const token = getOperatorAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      const response = await fetch(buildApiUrl("/radius/sessions"), {
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch RADIUS sessions: ${response.statusText}`);
      }

      return parseListResponse<RADIUSSession>(response);
    },
    enabled: options?.enabled ?? true,
    staleTime: 10000, // 10 seconds (sessions change frequently)
  });
}
