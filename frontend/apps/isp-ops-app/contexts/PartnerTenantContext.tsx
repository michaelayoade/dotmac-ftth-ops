"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";
import { logger } from "@/lib/logger";
import { setTenantIdentifiers } from "@/lib/tenant-storage";
import { useQueryClient } from "@tanstack/react-query";

interface ManagedTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  access_role: string;
}

interface PartnerTenantContextType {
  activeTenantId: string | null;
  managedTenants: ManagedTenant[];
  loading: boolean;
  error: string | null;
  setActiveTenant: (tenantId: string | null) => void;
  isPartnerUser: boolean;
  effectiveTenantId: string | null;
}

const PartnerTenantContext = createContext<PartnerTenantContextType | undefined>(undefined);

export function PartnerTenantProvider({ children }: { children: ReactNode }) {
  const { user: sessionUser } = useSession();
  const user = sessionUser as UserInfo | undefined;
  const queryClient = useQueryClient();
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);
  const [managedTenants, setManagedTenants] = useState<ManagedTenant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPartnerUser = Boolean(user?.partner_id && user?.managed_tenant_ids?.length);

  // Fetch managed tenants when user is a partner
  useEffect(() => {
    if (!isPartnerUser || !user?.partner_id) {
      setManagedTenants([]);
      setActiveTenantId(null);
      return;
    }

    const fetchManagedTenants = async () => {
      try {
        setLoading(true);
        setError(null);

        // Dynamically import to avoid circular dependency
        const { apiClient } = await import("@/lib/api/client");

        const response = await apiClient.get<{ tenants: ManagedTenant[]; total: number }>(
          "/partner/customers",
        );

        setManagedTenants(response.data.tenants || []);

        // Restore active tenant from localStorage
        const savedTenantId = localStorage.getItem("active_managed_tenant_id");
        if (savedTenantId && response.data.tenants.some((t) => t.tenant_id === savedTenantId)) {
          setActiveTenantId(savedTenantId);
        }

        logger.info("Loaded managed tenants for partner", {
          partnerId: user.partner_id,
          count: response.data.tenants.length,
        });
      } catch (err) {
        logger.error("Failed to fetch managed tenants", { error: err });
        setError("Failed to load managed tenants");
      } finally {
        setLoading(false);
      }
    };

    void fetchManagedTenants();
  }, [isPartnerUser, user?.partner_id]);

  const setActiveTenant = (tenantId: string | null) => {
    setActiveTenantId(tenantId);

    // Persist to localStorage
    if (tenantId) {
      setTenantIdentifiers(user?.tenant_id ?? null, tenantId);
      logger.info("Switched to managed tenant", {
        partnerId: user?.partner_id,
        activeTenantId: tenantId,
      });
    } else {
      setTenantIdentifiers(user?.tenant_id ?? null, null);
      logger.info("Switched back to partner home tenant", {
        partnerId: user?.partner_id,
      });
    }

    // Targeted invalidations instead of full reload
    queryClient.invalidateQueries({ queryKey: ["rbac"] });
    queryClient.invalidateQueries({ queryKey: ["tenant-branding"] });
    queryClient.invalidateQueries({ queryKey: ["tenant-branding", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["rbac", "roles"] });
    queryClient.invalidateQueries({ queryKey: ["rbac", "my-permissions"] });
    queryClient.invalidateQueries({ predicate: (q) => q.queryKey.includes("tenants") });
    queryClient.invalidateQueries({ queryKey: ["tenant", "current"] });
  };

  // Effective tenant ID is active managed tenant or user's home tenant
  const effectiveTenantId = activeTenantId || user?.tenant_id || null;

  return (
    <PartnerTenantContext.Provider
      value={{
        activeTenantId,
        managedTenants,
        loading,
        error,
        setActiveTenant,
        isPartnerUser,
        effectiveTenantId,
      }}
    >
      {children}
    </PartnerTenantContext.Provider>
  );
}

export function usePartnerTenant() {
  const context = useContext(PartnerTenantContext);
  if (context === undefined) {
    throw new Error("usePartnerTenant must be used within a PartnerTenantProvider");
  }
  return context;
}
