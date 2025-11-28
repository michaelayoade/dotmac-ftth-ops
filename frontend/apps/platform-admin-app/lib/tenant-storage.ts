/* eslint-disable no-restricted-globals */
// This is a low-level storage utility that intentionally wraps localStorage
// for tenant identifier management. The secureStorage utility is not appropriate
// for these specific tenant identifiers which need direct browser storage access.

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
