/**
 * Tenant Context
 *
 * Provides tenant information throughout the application.
 */

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@dotmac/better-auth";
import type { ExtendedUser } from "@dotmac/better-auth";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan?: string;
  status?: string;
  settings?: Record<string, any>;
}

interface TenantContextValue {
  tenant: Tenant | null;
  currentTenant: Tenant | null;
  tenantId: string | null;
  hasTenantContext: boolean;
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
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { data: session, isPending: authLoading } = useSession();
  const user = session?.user as ExtendedUser | undefined;

  const hasTenantAssociation = Boolean(user?.tenant_id || user?.activeOrganization?.id);

  const refreshTenant = async () => {
    if (!hasTenantAssociation) {
      setTenant(null);
      setAvailableTenants([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch tenant from API
      const response = await apiClient.get<Tenant>("/tenants/current");
      setTenant(response.data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  // Load tenant on mount if not provided
  useEffect(() => {
    if (!authLoading && !initialTenant) {
      refreshTenant();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTenant, authLoading, user?.tenant_id]);

  const value: TenantContextValue = {
    tenant,
    currentTenant: tenant,
    tenantId: tenant?.id || null,
    hasTenantContext: hasTenantAssociation,
    loading,
    isLoading: loading, // Alias for loading
    error,
    availableTenants,
    setTenant,
    refreshTenant,
  };

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
