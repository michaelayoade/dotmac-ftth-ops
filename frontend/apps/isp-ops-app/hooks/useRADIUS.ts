/**
 * RADIUS Hooks
 *
 * Hooks for fetching RADIUS subscriber and session data
 */

import { useQuery } from '@tanstack/react-query';
import { platformConfig } from '@/lib/config';

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

export function useRADIUSSubscribers(offset: number, limit: number, options?: UseRADIUSOptions) {
  return useQuery({
    queryKey: ['radius-subscribers', offset, limit],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(
        `${platformConfig.api.baseUrl}/api/v1/radius/subscribers?offset=${offset}&limit=${limit}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch RADIUS subscribers: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data as RADIUSSubscriber[],
        total: data.length,
      };
    },
    enabled: options?.enabled ?? true,
    staleTime: 30000, // 30 seconds
  });
}

export function useRADIUSSessions(options?: UseRADIUSOptions) {
  return useQuery({
    queryKey: ['radius-sessions'],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${platformConfig.api.baseUrl}/api/v1/radius/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch RADIUS sessions: ${response.statusText}`);
      }

      const data = await response.json();
      return {
        data: data as RADIUSSession[],
        total: data.length,
      };
    },
    enabled: options?.enabled ?? true,
    staleTime: 10000, // 10 seconds (sessions change frequently)
  });
}
