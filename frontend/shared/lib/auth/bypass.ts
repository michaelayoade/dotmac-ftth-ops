/**
 * Auth Bypass Utilities
 *
 * Provides bypass functionality for E2E tests and local development.
 *
 * SECURITY: Bypass is ONLY enabled when BOTH conditions are met:
 * 1. NEXT_PUBLIC_AUTH_BYPASS_ENABLED=true at BUILD TIME
 * 2. NODE_ENV is NOT "production"
 *
 * If bypass is attempted in production, the app will throw an error at build time.
 * Window flags are NOT checked to prevent XSS-based bypass attacks.
 */

import type { UserInfo, ActiveOrganization } from "./types";

/**
 * Build-time check: Bypass flag requested
 */
const BYPASS_FLAG_SET = process.env["NEXT_PUBLIC_AUTH_BYPASS_ENABLED"] === "true";

/**
 * Build-time check: Running in production
 */
const IS_PRODUCTION = process.env["NODE_ENV"] === "production";

/**
 * SECURITY: Hard fail if bypass is enabled in production builds.
 * This error will occur at build/bundle time, preventing deployment.
 */
if (BYPASS_FLAG_SET && IS_PRODUCTION) {
  throw new Error(
    "SECURITY ERROR: NEXT_PUBLIC_AUTH_BYPASS_ENABLED=true is set in a production build. " +
    "This is a critical security vulnerability. Remove this flag for production deployments."
  );
}

/**
 * Build-time constant for auth bypass. Cannot be changed at runtime.
 * Only enabled in non-production environments with explicit flag.
 */
const AUTH_BYPASS_ENABLED = BYPASS_FLAG_SET && !IS_PRODUCTION;

/**
 * Check if auth bypass is enabled.
 *
 * SECURITY NOTES:
 * - Only enabled via explicit build-time flag NEXT_PUBLIC_AUTH_BYPASS_ENABLED=true
 * - NEVER enabled in production (throws error at build time if attempted)
 * - Window flags are NOT checked (prevents XSS bypass injection)
 */
export function isAuthBypassEnabled(): boolean {
  return AUTH_BYPASS_ENABLED;
}

/**
 * Mock active organization for bypass mode.
 */
export const MOCK_ACTIVE_ORGANIZATION: ActiveOrganization = {
  id: "default-tenant",
  name: "Default Tenant",
  slug: "default",
  role: "tenant_owner",
  permissions: [],
};

/**
 * Mock user for bypass mode.
 */
export const MOCK_USER: UserInfo = {
  id: "dev-user",
  username: "admin",
  email: "admin@test.com",
  first_name: "Admin",
  last_name: "User",
  full_name: "Admin User",
  phone: null,
  location: null,
  timezone: null,
  language: "en",
  bio: null,
  website: null,
  avatar_url: null,
  roles: ["super_admin"],
  permissions: [],
  is_active: true,
  is_platform_admin: true,
  tenant_id: "default-tenant",
  partner_id: null,
  managed_tenant_ids: null,
  mfa_enabled: false,
  mfa_backup_codes_remaining: 0,
  activeOrganization: MOCK_ACTIVE_ORGANIZATION,
};

/**
 * Get mock user with optional overrides.
 */
export function getMockUser(overrides?: Partial<UserInfo>): UserInfo {
  return {
    ...MOCK_USER,
    ...overrides,
  };
}
