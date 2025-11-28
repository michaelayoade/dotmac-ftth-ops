export function setTenantIdentifiers(tenantId: string | null, activeManagedTenantId: string | null) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (tenantId) {
      localStorage.setItem("tenant_id", tenantId);
    } else {
      localStorage.removeItem("tenant_id");
    }

    if (activeManagedTenantId) {
      localStorage.setItem("active_managed_tenant_id", activeManagedTenantId);
    } else {
      localStorage.removeItem("active_managed_tenant_id");
    }
  } catch {
    /* ignore storage errors */
  }
}
