/**
 * Tenant Context
 *
 * Provides tenant information throughout the application.
 */

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { apiClient } from "@/lib/api/client";
import { useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";
import { setTenantIdentifiers } from "@/lib/tenant-storage";
import { useQueryClient } from "@tanstack/react-query";
import { usePartnerTenant } from "@/contexts/PartnerTenantContext";
import { useToast } from "@dotmac/ui";

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
  const { user: sessionUser, isLoading: authLoading } = useSession();
  const user = sessionUser as UserInfo | undefined;
  const queryClient = useQueryClient();
  const { activeTenantId: activeManagedTenantId } = usePartnerTenant();
  const { toast } = useToast();

  const hasTenantAssociation = Boolean(
    activeManagedTenantId || user?.tenant_id || user?.activeOrganization?.id,
  );

  const refreshTenant = async () => {
    if (!hasTenantAssociation) {
      setTenant(null);
      setAvailableTenants([]);
      setError(null);
      setLoading(false);
      setTenantIdentifiers(null, null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // If initial tenant was provided, sync it immediately
      if (initialTenant) {
        setTenant(initialTenant);
        setTenantIdentifiers(initialTenant.id, activeManagedTenantId ?? null);
        return;
      }

      // Fetch tenant from API
      const response = await apiClient.get<Tenant>("/tenants/current");
      setTenant(response.data);
      setTenantIdentifiers(response.data.id, activeManagedTenantId ?? null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      setTenant(null);
    } finally {
      setLoading(false);
    }
  };

  // Load tenant when auth is ready and when auth user or managed tenant changes
  useEffect(() => {
    if (!authLoading) {
      refreshTenant();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.tenant_id, activeManagedTenantId]);

  // Invalidate tenant-dependent caches when tenant changes
  useEffect(() => {
    if (!tenant?.id) {
      return;
    }
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes("tenant") });
    queryClient.invalidateQueries({ queryKey: ["rbac", "my-permissions", tenant.id] });
    queryClient.invalidateQueries({ queryKey: ["rbac", "roles", tenant.id] });
  }, [tenant?.id, queryClient]);

  useEffect(() => {
    if (error && !loading) {
      toast({
        title: "Tenant unavailable",
        description: "We could not load the current tenant. Some data may be missing.",
        variant: "destructive",
      });
    }
  }, [error, loading, toast]);

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
