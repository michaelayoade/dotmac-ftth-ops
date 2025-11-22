/**
 * Better Auth Client Configuration
 *
 * This is the client-side configuration for Better Auth in React applications.
 * It provides hooks and utilities for authentication across all portal apps.
 */

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import type { ExtendedUser } from "./types";

// Determine the auth server URL based on environment
const getAuthURL = () => {
  // In development, use the Next.js API routes
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  // Server-side: use environment variable
  return process.env['NEXT_PUBLIC_API_URL'] || "http://localhost:3000";
};

/**
 * Better Auth client instance
 * This provides all authentication hooks and utilities
 */
export const authClient = createAuthClient({
  baseURL: getAuthURL(),
  plugins: [
    // Organization plugin for multi-tenant support
    organizationClient({
      // Enable dynamic access control for runtime role management
      dynamicAccessControl: {
        enabled: true,
      },
    }),
  ],
});

const authBypassEnabled =
  process.env["NEXT_PUBLIC_SKIP_BETTER_AUTH"] === "true" ||
  process.env["NEXT_PUBLIC_MSW_ENABLED"] === "true";

// Minimal mock session used when auth is bypassed (e2e/local dev without backend)
const mockSession = {
  data: {
    user: {
      id: "dev-user",
      email: "admin@test.com",
      role: "super_admin",
      tenant_id: "default-tenant",
      activeOrganization: {
        id: "default-tenant",
        role: "tenant_owner",
        permissions: [],
      },
    } as ExtendedUser,
  },
  error: null,
  isPending: false,
  isRefetching: false,
  refetch: async () => mockSession,
};

type UseSessionReturn = ReturnType<typeof authClient.useSession>;

/**
 * Export commonly used hooks for convenience
 */
export const useSession: () => UseSessionReturn = authBypassEnabled
  ? () => mockSession as UseSessionReturn
  : authClient.useSession;

export const signIn = authBypassEnabled
  ? {
      email: async () => ({ data: mockSession.data, error: null }),
    }
  : authClient.signIn;

export const signUp = authBypassEnabled
  ? {
      email: async () => ({ data: mockSession.data, error: null }),
    }
  : authClient.signUp;

export const signOut = authBypassEnabled
  ? async () => ({ data: null, error: null })
  : authClient.signOut;

export const useActiveOrganization = authBypassEnabled
  ? () => ({
      data: mockSession.data.user.activeOrganization,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: async () => mockSession.data.user.activeOrganization,
    })
  : authClient.useActiveOrganization;

export const useListOrganizations = authBypassEnabled
  ? () => ({
      data: mockSession.data.user.activeOrganization
        ? [mockSession.data.user.activeOrganization]
        : [],
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: async () => [],
    })
  : authClient.useListOrganizations;

// Type for inferred auth client instance
export type InferredAuthClient = typeof authClient;

/**
 * Helper function to check if user has permission
 */
export function useHasPermission(permission: string): boolean {
  const { data: session } = useSession();

  const user = session?.user as ExtendedUser | undefined;
  if (!user) return false;

  // Super admin has all permissions
  if (user.role === "super_admin") return true;

  // Check if organization context has the permission
  const activeOrg = user.activeOrganization;
  if (!activeOrg) return false;

  return activeOrg.permissions?.includes(permission) ?? false;
}

/**
 * Helper function to check if user has role
 */
export function useHasRole(role: string): boolean {
  const { data: session } = useSession();

  const user = session?.user as ExtendedUser | undefined;
  if (!user) return false;

  // Check organization role
  const activeOrg = user.activeOrganization;
  if (!activeOrg) return false;

  return activeOrg.role === role;
}

/**
 * Helper function to check if user is super admin
 */
export function useIsSuperAdmin(): boolean {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;
  return user?.role === "super_admin";
}

/**
 * Helper to get user's active organization
 */
export function useCurrentOrganization() {
  const { data: session } = useSession();
  const user = session?.user as ExtendedUser | undefined;
  return user?.activeOrganization;
}

/**
 * Portal-specific auth configuration
 */
export const PORTAL_CONFIG = {
  admin: {
    requiresOrganization: false, // Platform admin doesn't need organization
    allowedRoles: ["super_admin", "platform_admin"],
    defaultRedirect: "/dashboard",
    loginPath: "/login",
  },

  customer: {
    requiresOrganization: false, // Customers don't have organizations
    allowedRoles: ["customer"],
    defaultRedirect: "/customer-portal",
    loginPath: "/customer-portal/login",
  },

  reseller: {
    requiresOrganization: true,
    allowedRoles: ["reseller_owner", "reseller_admin", "reseller_agent"],
    defaultRedirect: "/reseller/dashboard",
    loginPath: "/reseller/login",
  },

  technician: {
    requiresOrganization: true,
    allowedRoles: ["technician", "network_admin", "support_agent"],
    defaultRedirect: "/technician/dashboard",
    loginPath: "/technician/login",
  },

  management: {
    requiresOrganization: true,
    allowedRoles: [
      "tenant_owner",
      "tenant_admin",
      "tenant_member",
      "network_admin",
      "support_agent",
      "sales_manager",
      "billing_manager",
    ],
    defaultRedirect: "/dashboard",
    loginPath: "/login",
  },
} as const;

/**
 * Type exports
 */
export type PortalType = keyof typeof PORTAL_CONFIG;
export type PortalConfig = typeof PORTAL_CONFIG[PortalType];

/**
 * Get portal configuration by type
 */
export function getPortalConfig(portal: PortalType): PortalConfig {
  return PORTAL_CONFIG[portal];
}
