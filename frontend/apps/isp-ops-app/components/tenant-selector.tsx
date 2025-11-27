/**
 * Tenant Selector Wrapper
 *
 * Wrapper that connects the shared TenantSelector to app-specific contexts.
 */

"use client";

import {
  TenantSelector as SharedTenantSelector,
  TenantBadge as SharedTenantBadge,
  type Tenant as SharedTenant,
} from "@dotmac/features/workspace";
import { useTenant, type Tenant } from "@/lib/contexts/tenant-context";

export function TenantSelector() {
  const { currentTenant, availableTenants, setTenant, isLoading } = useTenant();

  return (
    <SharedTenantSelector
      currentTenant={currentTenant as SharedTenant | null}
      availableTenants={availableTenants as SharedTenant[]}
      setTenant={setTenant as (tenant: SharedTenant | null) => void}
      isLoading={isLoading}
    />
  );
}

export function TenantBadge() {
  const { currentTenant } = useTenant();

  return <SharedTenantBadge currentTenant={currentTenant as SharedTenant | null} />;
}
