/**
 * ISP Framework Tenant Provider
 * Provides multi-tenant context to the entire application
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
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
  const extractTenantId = (record: any): string | undefined =>
    record?.tenant_id ?? record?.tenantId;

  // Auto-load tenant when user authenticates
  useEffect(() => {
    if (!autoLoadOnAuth || !isAuthenticated || tenantHook.session) return;

    // Determine tenant ID from authenticated user data
    let targetTenantId = tenantId;

    if (!targetTenantId) {
      targetTenantId =
        extractTenantId(customerData) ??
        extractTenantId(technicianData) ??
        extractTenantId(resellerData) ??
        extractTenantId(portalAccount);
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
    customerData,
    technicianData,
    resellerData,
    portalAccount,
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
