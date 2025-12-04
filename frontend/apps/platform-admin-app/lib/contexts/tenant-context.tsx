/**
 * Tenant Context
 *
 * Provides tenant information throughout the application.
 */

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { apiClient } from "@/lib/api/client";
import { useAuth } from "@shared/lib/auth";
import { setTenantIdentifiers } from "@/lib/tenant-storage";
import { useQueryClient } from "@tanstack/react-query";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  status?: string;
  settings?: Record<string, unknown>;
}

interface TenantContextValue {
  tenant: Tenant | null;
  currentTenant: Tenant | null;
  tenantId: string | null;
  loading: boolean;
  isLoading: boolean; // Alias for loading
  error: Error | null;
  availableTenants: Tenant[];
  setTenant: (tenant: Tenant | null) => void;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export interface TenantProviderProps {
  children: ReactNode;
  initialTenant?: Tenant | null;
}

export function TenantProvider({ children, initialTenant = null }: TenantProviderProps) {
  const [tenant, setTenant] = useState<Tenant | null>(initialTenant);
  const [availableTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { isLoading: authLoading, user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const refreshTenant = useCallback(async () => {
    if (!isAuthenticated) {
      setTenant(null);
      setError(null);
      setTenantIdentifiers(null, null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // If tenant provided via props, use it and sync storage
      if (initialTenant) {
        setTenant(initialTenant);
        setTenantIdentifiers(initialTenant.id, null);
        return;
      }

      const response = await apiClient.get<Tenant>("/tenants/current");
      setTenant(response.data);
      setTenantIdentifiers(response.data.id, null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, [initialTenant, isAuthenticated]);

  // Load tenant when auth is ready or user changes
  useEffect(() => {
    if (!authLoading) {
      refreshTenant();
    }
  }, [authLoading, isAuthenticated, user?.tenant_id, refreshTenant]);

  useEffect(() => {
    if (!tenant?.id) {
      return;
    }
    queryClient.invalidateQueries();
  }, [tenant?.id, queryClient]);

  const value: TenantContextValue = useMemo(
    () => ({
      tenant,
      currentTenant: tenant,
      tenantId: tenant?.id || null,
      loading,
      isLoading: loading, // Alias for loading
      error,
      availableTenants,
      setTenant,
      refreshTenant,
    }),
    [availableTenants, error, loading, tenant, refreshTenant],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

/**
 * Hook to access tenant context
 */
export function useTenant() {
  const context = useContext(TenantContext);

  if (context === undefined) {
    throw new Error("useTenant must be used within a TenantProvider");
  }

  return context;
}

/**
 * Hook to access current tenant ID
 */
export function useTenantId(): string | null {
  const { tenant } = useTenant();
  return tenant?.id || null;
}

export default TenantContext;
