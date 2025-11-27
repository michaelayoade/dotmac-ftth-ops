/**
 * ISP Framework Tenant Hook
 * Manages multi-tenant context for ISP operations
 * Refactored using composition pattern for better maintainability
 */

import { useContext, createContext, useMemo } from "react";
import type {
  TenantSession,
  TenantPermissions,
  TenantLimitsUsage,
  TenantBranding,
  TenantNotification,
} from "../types/tenant";

// Import focused sub-hooks
import { useTenantSession } from "./tenant/useTenantSession";
import { useTenantPermissions } from "./tenant/useTenantPermissions";
import { useTenantLimits } from "./tenant/useTenantLimits";
import { useTenantSettings } from "./tenant/useTenantSettings";
import { useTenantNotifications } from "./tenant/useTenantNotifications";

interface ISPTenantContextValue {
  // Current tenant session
  session: TenantSession | null;
  tenant: TenantSession["tenant"] | null;
  isLoading: boolean;
  error: string | null;

  // Tenant operations
  loadTenant: (tenantId: string) => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenant: () => Promise<void>;
  clearTenant: () => void;

  // Permission checking
  hasPermission: (permission: keyof TenantPermissions) => boolean;
  hasAnyPermission: (permissions: (keyof TenantPermissions)[]) => boolean;
  hasAllPermissions: (permissions: (keyof TenantPermissions)[]) => boolean;
  hasFeature: (feature: string) => boolean;
  hasModule: (module: string) => boolean;

  // Limits and usage
  getLimitsUsage: () => TenantLimitsUsage;
  isLimitReached: (limit: string) => boolean;
  getUsagePercentage: (limit: string) => number;
  isTrialExpiring: () => boolean;
  getTrialDaysLeft: () => number;
  isTenantActive: () => boolean;

  // Tenant settings
  getTenantSetting: <T = any>(key: string, defaultValue?: T) => T;
  updateTenantSetting: (key: string, value: any) => Promise<void>;
  getBranding: () => TenantBranding;
  applyBranding: () => void;

  // Notifications
  notifications: TenantNotification[];
  unreadCount: number;
  markNotificationRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  dismissNotification: (notificationId: string) => Promise<void>;
  addNotification: (notification: Omit<TenantNotification, "id" | "created_at">) => void;
}

const ISPTenantContext = createContext<ISPTenantContextValue | null>(null);

/**
 * Main ISP Tenant Hook using Composition Pattern
 * Combines focused sub-hooks for better maintainability
 */
export function useISPTenant(): ISPTenantContextValue {
  const context = useContext(ISPTenantContext);
  if (!context) {
    throw new Error("useISPTenant must be used within an ISPTenantProvider");
  }
  return context;
}

/**
 * Create ISP Tenant Context Value using Composition
 * Composes multiple focused hooks into a unified interface
 */
export function createISPTenantContextValue(): ISPTenantContextValue {
  // Core session management
  const sessionHook = useTenantSession();
  const { session, isLoading, error } = sessionHook;

  // Composed functionality using focused hooks
  const permissionsHook = useTenantPermissions(session);
  const limitsHook = useTenantLimits(session);
  const settingsHook = useTenantSettings(session);
  const notificationsHook = useTenantNotifications(session);

  // Extract tenant for convenience
  const tenant = useMemo(() => session?.tenant || null, [session?.tenant]);

  // Compose the complete interface
  return {
    // Session state
    session,
    tenant,
    isLoading,
    error,

    // Session operations
    loadTenant: sessionHook.loadTenant,
    switchTenant: sessionHook.switchTenant,
    refreshTenant: sessionHook.refreshTenant,
    clearTenant: sessionHook.clearTenant,

    // Permissions
    hasPermission: permissionsHook.hasPermission,
    hasAnyPermission: permissionsHook.hasAnyPermission,
    hasAllPermissions: permissionsHook.hasAllPermissions,
    hasFeature: permissionsHook.hasFeature,
    hasModule: permissionsHook.hasModule,

    // Limits and usage
    getLimitsUsage: limitsHook.getLimitsUsage,
    isLimitReached: limitsHook.isLimitReached,
    getUsagePercentage: limitsHook.getUsagePercentage,
    isTrialExpiring: limitsHook.isTrialExpiring,
    getTrialDaysLeft: limitsHook.getTrialDaysLeft,
    isTenantActive: limitsHook.isTenantActive,

    // Settings and branding
    getTenantSetting: settingsHook.getTenantSetting,
    updateTenantSetting: settingsHook.updateTenantSetting,
    getBranding: settingsHook.getBranding,
    applyBranding: settingsHook.applyBranding,

    // Notifications
    notifications: notificationsHook.notifications,
    unreadCount: notificationsHook.unreadCount,
    markNotificationRead: notificationsHook.markAsRead,
    markAllAsRead: notificationsHook.markAllAsRead,
    dismissNotification: notificationsHook.dismissNotification,
    addNotification: notificationsHook.addNotification,
  };
}

// Export context for provider
export { ISPTenantContext };

// Legacy support - alias for provider compatibility
export const useISPTenantProvider = createISPTenantContextValue;

// Legacy support - re-export types
export type {
  TenantSession,
  TenantPermissions,
  TenantLimitsUsage,
  TenantBranding,
  TenantNotification,
};
