/**
 * RADIUS Hooks
 *
 * Hooks for fetching RADIUS subscriber and session data
 */

import { useQuery } from '@tanstack/react-query';

export interface RADIUSSubscriber {
  id: string;
  username: string;
  status: string;
  enabled: boolean;
  bandwidth_profile_id?: string | null;
  created_at?: string | null;
}

interface RADIUSSession {
  id: string;
  username: string;
  ip_address: string;
  started_at: string;
}

interface UseRADIUSOptions {
  enabled?: boolean;
}

export function useRADIUSSubscribers(offset: number, limit: number, options?: UseRADIUSOptions) {
  return useQuery({
    queryKey: ['radius-subscribers', offset, limit],
    queryFn: async () => {
      // TODO: Implement actual API call
      return {
        data: [] as RADIUSSubscriber[],
        total: 0,
      };
    },
    enabled: options?.enabled ?? true,
  });
}

export function useRADIUSSessions(options?: UseRADIUSOptions) {
  return useQuery({
    queryKey: ['radius-sessions'],
    queryFn: async () => {
      // TODO: Implement actual API call
      return {
        data: [] as RADIUSSession[],
        total: 0,
      };
    },
    enabled: options?.enabled ?? true,
  });
}
