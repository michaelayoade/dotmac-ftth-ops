import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';

export interface FeatureFlag {
  name: string;
  enabled: boolean;
  context: Record<string, any>;
  description?: string;
  updated_at: number;
  created_at?: number;
}

export interface FlagStatus {
  total_flags: number;
  enabled_flags: number;
  disabled_flags: number;
  cache_hits: number;
  cache_misses: number;
  last_sync?: string;
}

export const useFeatureFlags = () => {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [status, setStatus] = useState<FlagStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async (enabledOnly = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<FeatureFlag[]>(
        `/api/v1/feature-flags/flags${enabledOnly ? '?enabled_only=true' : ''}`
      );

      // Check if wrapped response
      if ('success' in response && (response as any).success && (response as any).data) {
        setFlags((response as any).data);
      } else if ('error' in response && (response as any).error) {
        setError((response as any).error.message);
      } else if (Array.isArray(response.data)) {
        // Direct axios response
        setFlags(response.data);
      }
    } catch (err) {
      logger.error('Failed to fetch feature flags', err instanceof Error ? err : new Error(String(err)));
      setError('Failed to fetch feature flags');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await apiClient.get<FlagStatus>('/api/v1/feature-flags/status');

      if ('success' in response && (response as any).success && (response as any).data) {
        setStatus((response as any).data);
      } else if (response.data) {
        setStatus(response.data);
      }
    } catch (err) {
      logger.error('Failed to fetch flag status', err instanceof Error ? err : new Error(String(err)));
    }
  }, []);

  const toggleFlag = useCallback(async (flagName: string, enabled: boolean) => {
    try {
      const response = await apiClient.put(`/api/v1/feature-flags/flags/${flagName}`, {
        enabled,
      });

      const success = response.status >= 200 && response.status < 300;
      if (success) {
        // Update local state
        setFlags(prev =>
          prev.map(flag =>
            flag.name === flagName ? { ...flag, enabled } : flag
          )
        );
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Failed to toggle flag', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  const createFlag = useCallback(async (flagName: string, data: Partial<FeatureFlag>) => {
    try {
      const response = await apiClient.post(`/api/v1/feature-flags/flags/${flagName}`, data);

      if ('success' in response && (response as any).success && (response as any).data) {
        await fetchFlags(); // Refresh list
        return (response as any).data;
      } else if (response.data) {
        await fetchFlags();
        return response.data;
      }
      return null;
    } catch (err) {
      logger.error('Failed to create flag', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, [fetchFlags]);

  const deleteFlag = useCallback(async (flagName: string) => {
    try {
      const response = await apiClient.delete(`/api/v1/feature-flags/flags/${flagName}`);

      const success = response.status >= 200 && response.status < 300;
      if (success) {
        setFlags(prev => prev.filter(flag => flag.name !== flagName));
        return true;
      }
      return false;
    } catch (err) {
      logger.error('Failed to delete flag', err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchFlags();
    fetchStatus();
  }, [fetchFlags, fetchStatus]);

  return {
    flags,
    status,
    loading,
    error,
    fetchFlags,
    toggleFlag,
    createFlag,
    deleteFlag,
    refreshFlags: fetchFlags,
  };
};