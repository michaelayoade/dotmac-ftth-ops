/**
 * Tenant Session Management Hook
 * Handles tenant loading, switching, and session state
 */

import { useState, useCallback } from "react";
import type { TenantSession, ISPTenant } from "../../types/tenant";
import { getISPApiClient } from "../../api/isp-client";

export interface UseTenantSessionReturn {
  session: TenantSession | null;
  isLoading: boolean;
  error: string | null;
  loadTenant: (tenantId: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenant: () => Promise<void>;
  clearTenant: () => void;
}

export function useTenantSession(): UseTenantSessionReturn {
  const [session, setSession] = useState<TenantSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTenant = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setError("Tenant ID is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const apiClient = getISPApiClient();
      const response = await apiClient.getTenant(tenantId);
      const tenant = response.data;

      const newSession: TenantSession = {
        tenant,
        user: null, // Will be populated by auth hook
        isActive: tenant.status === "ACTIVE",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        lastActivity: new Date().toISOString(),
        sessionId: `session_${tenantId}_${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSession(newSession);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load tenant";
      setError(errorMessage);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const switchTenant = useCallback(
    async (tenantId: string) => {
      await loadTenant(tenantId);
    },
    [loadTenant],
  );

  const refreshTenant = useCallback(async () => {
    if (session?.tenant.id) {
      await loadTenant(session.tenant.id);
    }
  }, [session?.tenant.id, loadTenant]);

  const clearTenant = useCallback(() => {
    setSession(null);
    setError(null);
  }, []);

  return {
    session,
    isLoading,
    error,
    loadTenant,
    switchTenant,
    refreshTenant,
    clearTenant,
  };
}
