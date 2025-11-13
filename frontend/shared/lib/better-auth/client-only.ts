/**
 * Better Auth - Client-Only Entry Point
 *
 * This module ONLY exports client-side functionality.
 * Use this in React components and client-side code.
 *
 * For server-side code (API routes), import from './auth' or './server' instead.
 */

// Import type extensions
import "./types";

// Re-export ONLY client-side code (no database, no server config)
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
} from "./client";

// Re-export types only (these are safe to export)
export type { PortalType, PortalConfig } from "./client";
export type { ExtendedUser } from "./types";

// Types imported via type-only imports (tree-shaken, won't pull in implementation)
import type { Session, User } from "./auth";
export type { Session, User };

// ISP_ROLES constants (duplicated here to avoid importing server code)
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
