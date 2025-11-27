"use client";

import { Building2, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import { usePartnerTenant } from "@/contexts/PartnerTenantContext";
import { useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";

export function TenantSelector() {
  const { user: sessionUser } = useSession();
  const user = sessionUser as UserInfo | undefined;
  const { activeTenantId, managedTenants, loading, error, setActiveTenant, isPartnerUser } =
    usePartnerTenant();

  // Don't render if not a partner user
  if (!isPartnerUser) {
    return null;
  }

  // Show loading state
  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4 animate-pulse" />
        <span>Loading tenants...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-destructive">
        <Building2 className="h-4 w-4" />
        <span>Error loading tenants</span>
      </div>
    );
  }

  // No managed tenants
  if (managedTenants.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
        <Building2 className="h-4 w-4" />
        <span>No managed tenants</span>
      </div>
    );
  }

  // Get current tenant name
  const currentTenant = activeTenantId
    ? managedTenants.find((t) => t.tenant_id === activeTenantId)
    : null;

  // Home tenant name (partner's own tenant)
  const homeTenantName = user?.tenant_id ? "Partner Home" : "Home";

  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <Select
        value={activeTenantId || "home"}
        onValueChange={(value) => setActiveTenant(value === "home" ? null : value)}
      >
        <SelectTrigger className="w-[200px] h-9 border-border/50 hover:border-border transition-colors">
          <SelectValue>{currentTenant ? currentTenant.tenant_name : homeTenantName}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {/* Home tenant option */}
          <SelectItem value="home">
            <div className="flex items-center gap-2">
              <span>{homeTenantName}</span>
              {!activeTenantId && <Check className="h-4 w-4 text-primary" />}
            </div>
          </SelectItem>

          {/* Managed tenants */}
          {managedTenants.map((tenant) => (
            <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
              <div className="flex flex-col">
                <span className="font-medium">{tenant.tenant_name}</span>
                <span className="text-xs text-muted-foreground">
                  {tenant.access_role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                </span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
