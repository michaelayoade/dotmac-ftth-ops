/**
 * Better Auth Library - Main Entry Point (Client-Side Only)
 *
 * This module ONLY exports client-side functionality by default.
 * For server-side auth (API routes), import from '@dotmac/better-auth/server'
 *
 * This prevents accidentally bundling server-only code (like pg database)
 * in client bundles.
 */

// Import type extensions (this ensures module augmentation is applied)
import "./types";

// Re-export ONLY client configuration (for React components)
export {
  authClient,
  useSession,
  signIn,
  signUp,
  signOut,
  useActiveOrganization,
  useListOrganizations,
  useHasPermission,
  useHasRole,
  useIsSuperAdmin,
  useCurrentOrganization,
  PORTAL_CONFIG,
  getPortalConfig,
  isAuthBypassEnabled,
} from "./client";
export type { PortalType, PortalConfig } from "./client";

// Re-export ExtendedUser and related types
export type { ExtendedUser, DotmacUserExtras, DotmacActiveOrganization } from "./types";

// For Session/User/Auth types, users should import from better-auth directly
// or from ./server in API routes where the auth instance is available

// Re-export ISP_ROLES constants (safe to export)
export const ISP_ROLES = {
  // Platform Admin Portal
  SUPER_ADMIN: "super_admin",
  PLATFORM_ADMIN: "platform_admin",

  // Tenant/ISP Portal
  TENANT_OWNER: "tenant_owner",
  TENANT_ADMIN: "tenant_admin",
  TENANT_MEMBER: "tenant_member",

  // Operations
  NETWORK_ADMIN: "network_admin",
  SUPPORT_AGENT: "support_agent",
  TECHNICIAN: "technician",

  // Business
  SALES_MANAGER: "sales_manager",
  BILLING_MANAGER: "billing_manager",

  // Customer Portal
  CUSTOMER: "customer",

  // Reseller Portal
  RESELLER_OWNER: "reseller_owner",
  RESELLER_ADMIN: "reseller_admin",
  RESELLER_AGENT: "reseller_agent",
} as const;
