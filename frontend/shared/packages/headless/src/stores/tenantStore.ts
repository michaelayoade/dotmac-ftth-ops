/**
 * Multi-tenant store for managing tenant context and switching
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { getApiClient } from "../api";
import type { Tenant, User } from "../types";

interface TenantPermissions {
  [key: string]: boolean;
}

interface TenantContext {
  tenant: Tenant | null;
  user: User | null;
  permissions: TenantPermissions;
  features: string[];
  settings: Record<string, unknown>;
}

interface TenantState {
  // Current tenant context
  currentTenant: TenantContext | null;

  // Available tenants for current user
  availableTenants: Tenant[];

  // Tenant switching
  isLoading: boolean;
  switchingTenant: boolean;

  // Actions
  setCurrentTenant: (tenant: Tenant, user: User) => void;
  switchTenant: (tenantId: string) => Promise<void>;
  loadTenantPermissions: (tenantId: string) => Promise<void>;
  updateTenantSettings: (settings: Record<string, unknown>) => void;
  clearTenant: () => void;

  // Permission helpers
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
  hasFeature: (feature: string) => boolean;

  // Multi-tenant utilities
  getTenantSetting: (key: string, defaultValue?: unknown) => any;
  isTenantActive: () => boolean;
  getTenantBranding: () => {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    companyName?: string;
  };
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set, get) => ({
      currentTenant: null,
      availableTenants: [],
      isLoading: false,
      switchingTenant: false,

      setCurrentTenant: (tenant: Tenant, user: User) => {
        set({
          currentTenant: {
            tenant,
            user,
            permissions: {
              // Implementation pending
            },
            features: [],
            settings:
              tenant.settings ||
              {
                // Implementation pending
              },
          },
        });
      },

      switchTenant: async (tenantId: string) => {
        const { availableTenants, loadTenantPermissions } = get();

        set({ switchingTenant: true });

        try {
          const targetTenant = availableTenants.find((t) => t.id === tenantId);
          if (!targetTenant) {
            throw new Error("Tenant not found");
          }

          // Load tenant-specific permissions
          await loadTenantPermissions(tenantId);

          // Update current tenant
          set((state) => ({
            currentTenant: state.currentTenant
              ? {
                  ...state.currentTenant,
                  tenant: targetTenant,
                  settings:
                    targetTenant.settings ||
                    {
                      // Implementation pending
                    },
                }
              : null,
            switchingTenant: false,
          }));

          // Trigger tenant-specific UI updates
          window.dispatchEvent(
            new CustomEvent("tenantChanged", {
              detail: { tenantId, tenant: targetTenant },
            }),
          );
        } catch (_error) {
          set({ switchingTenant: false });
          throw error;
        }
      },

      loadTenantPermissions: async (tenantId: string) => {
        set({ isLoading: true });

        try {
          const apiClient = getApiClient();
          const response = await apiClient.request(`/api/platform/v1/admin/tenants/${tenantId}/permissions`, {
            method: "GET",
          });

          const { permissions, _features } = response.data;

          set((state) => ({
            currentTenant: state.currentTenant
              ? {
                  ...state.currentTenant,
                  permissions:
                    permissions ||
                    {
                      // Implementation pending
                    },
                  features: features || [],
                }
              : null,
            isLoading: false,
          }));
        } catch (_error) {
          set({ isLoading: false });
          throw error;
        }
      },

      updateTenantSettings: (settings: Record<string, unknown>) => {
        set((state) => ({
          currentTenant: state.currentTenant
            ? {
                ...state.currentTenant,
                settings: { ...state.currentTenant.settings, ...settings },
              }
            : null,
        }));
      },

      clearTenant: () => {
        set({
          currentTenant: null,
          availableTenants: [],
          isLoading: false,
          switchingTenant: false,
        });
      },

      // Permission helpers
      hasPermission: (permission: string) => {
        const { currentTenant } = get();
        return currentTenant?.permissions[permission] || false;
      },

      hasAnyPermission: (permissions: string[]) => {
        const { hasPermission } = get();
        return permissions.some((permission) => hasPermission(permission));
      },

      hasAllPermissions: (permissions: string[]) => {
        const { hasPermission } = get();
        return permissions.every((permission) => hasPermission(permission));
      },

      hasFeature: (feature: string) => {
        const { currentTenant } = get();
        return currentTenant?.features.includes(feature) || false;
      },

      // Multi-tenant utilities
      getTenantSetting: (key: string, defaultValue?: unknown) => {
        const { currentTenant } = get();
        return currentTenant?.settings[key] ?? defaultValue;
      },

      isTenantActive: () => {
        const { currentTenant } = get();
        return currentTenant?.tenant?.status === "active";
      },

      getTenantBranding: () => {
        const { currentTenant } = get();
        const settings =
          currentTenant?.settings ||
          {
            // Implementation pending
          };

        return {
          logo: settings.branding?.logo,
          primaryColor: settings.branding?.primaryColor || "#2563eb",
          secondaryColor: settings.branding?.secondaryColor || "#64748b",
          companyName: currentTenant?.tenant?.name || "DotMac Platform",
        };
      },
    }),
    {
      name: "tenant-store",
      storage: createJSONStorage(() => localStorage),
      // Only persist essential data
      partialize: (state) => ({
        currentTenant: state.currentTenant,
        availableTenants: state.availableTenants,
      }),
    },
  ),
);
