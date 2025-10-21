/**
 * ISP Framework Tenant Provider
 * Provides multi-tenant context to the entire application
 */

import { ReactNode, useEffect } from "react";
import { ISPTenantContext, useISPTenantProvider } from "../hooks/useISPTenant";
import { usePortalIdAuth } from "../hooks/usePortalIdAuth";

interface ISPTenantProviderProps {
  children: ReactNode;
  tenantId?: string; // Optional override for specific tenant
  autoLoadOnAuth?: boolean; // Auto-load tenant when user authenticates
}

export function ISPTenantProvider({
  children,
  tenantId,
  autoLoadOnAuth = true,
}: ISPTenantProviderProps) {
  const tenantHook = useISPTenantProvider();
  const { isAuthenticated, portalAccount, customerData, technicianData, resellerData } =
    usePortalIdAuth();

  // Auto-load tenant when user authenticates
  useEffect(() => {
    if (!autoLoadOnAuth || !isAuthenticated || tenantHook.session) return;

    // Determine tenant ID from authenticated user data
    let targetTenantId = tenantId;

    if (!targetTenantId) {
      // Extract tenant ID from user data based on account type
      if (customerData?.tenant_id) {
        targetTenantId = customerData.tenant_id;
      } else if (technicianData?.tenant_id) {
        targetTenantId = technicianData.tenant_id;
      } else if (resellerData?.tenant_id) {
        targetTenantId = resellerData.tenant_id;
      } else if (portalAccount?.tenant_id) {
        targetTenantId = portalAccount.tenant_id;
      }
    }

    if (targetTenantId) {
      tenantHook.loadTenant(targetTenantId).catch((err) => {
        console.error("Failed to auto-load tenant:", err);
      });
    }
  }, [
    isAuthenticated,
    tenantId,
    autoLoadOnAuth,
    tenantHook,
    tenantHook.session,
    customerData?.tenant_id,
    technicianData?.tenant_id,
    resellerData?.tenant_id,
    portalAccount?.tenant_id,
  ]);

  // Clear tenant when user logs out
  useEffect(() => {
    if (!isAuthenticated && tenantHook.session) {
      tenantHook.clearTenant();
    }
  }, [isAuthenticated, tenantHook]);

  // Apply branding when tenant session changes
  useEffect(() => {
    if (tenantHook.session) {
      tenantHook.applyBranding();
    }
  }, [tenantHook.session, tenantHook.applyBranding]);

  return <ISPTenantContext.Provider value={tenantHook}>{children}</ISPTenantContext.Provider>;
}
