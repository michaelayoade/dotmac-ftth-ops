import { useMutation, useQuery, useQueryClient, type UseMutationResult, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { extractDataOrThrow } from '@/lib/api/response-helpers';
import type { RadiusSession, RadiusSubscriber } from '@/types';

type SubscribersQueryKey = ['radius', 'subscribers', { limit: number; skip: number }];
type SessionsQueryKey = ['radius', 'sessions', { username?: string | null }];

interface UseRadiusSubscribersOptions {
  limit?: number;
  skip?: number;
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<RadiusSubscriber[], Error, RadiusSubscriber[], SubscribersQueryKey>, 'queryKey' | 'queryFn'>;
}

interface UseRadiusSessionsOptions {
  username?: string;
  enabled?: boolean;
  queryOptions?: Omit<UseQueryOptions<RadiusSession[], Error, RadiusSession[], SessionsQueryKey>, 'queryKey' | 'queryFn'>;
}

/**
 * Fetch RADIUS subscribers with optional pagination.
 */
export function useRadiusSubscribers({
  limit = 25,
  skip = 0,
  enabled = true,
  queryOptions,
}: UseRadiusSubscribersOptions = {}): UseQueryResult<RadiusSubscriber[], Error> {
  return useQuery<RadiusSubscriber[], Error, RadiusSubscriber[], SubscribersQueryKey>({
    queryKey: ['radius', 'subscribers', { limit, skip }],
    queryFn: async () => {
      const response = await apiClient.get<RadiusSubscriber[]>('/api/v1/radius/subscribers', {
        params: { limit, skip },
      });
      return extractDataOrThrow(response);
    },
    enabled,
    staleTime: 30_000,
    ...queryOptions,
  });
}

/**
 * Fetch active RADIUS sessions (optionally filtered by username).
 */
export function useRadiusSessions({
  username,
  enabled = true,
  queryOptions,
}: UseRadiusSessionsOptions = {}): UseQueryResult<RadiusSession[], Error> {
  return useQuery<RadiusSession[], Error, RadiusSession[], SessionsQueryKey>({
    queryKey: ['radius', 'sessions', { username: username ?? null }],
    queryFn: async () => {
      const response = await apiClient.get<RadiusSession[]>('/api/v1/radius/sessions', {
        params: username ? { username } : undefined,
      });
      return extractDataOrThrow(response);
    },
    enabled,
    refetchInterval: 15_000,
    ...queryOptions,
  });
}

interface ToggleSubscriberVariables {
  username: string;
  action: 'enable' | 'disable';
}

export function useToggleSubscriber(): UseMutationResult<RadiusSubscriber, Error, ToggleSubscriberVariables> {
  const queryClient = useQueryClient();
  return useMutation<RadiusSubscriber, Error, ToggleSubscriberVariables>({
    mutationFn: async ({ username, action }) => {
      const response = await apiClient.post<RadiusSubscriber>(`/api/v1/radius/subscribers/${username}/${action}`);
      return extractDataOrThrow(response);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['radius', 'subscribers'] }),
        queryClient.invalidateQueries({ queryKey: ['radius', 'sessions'] }),
      ]);
    },
  });
}
