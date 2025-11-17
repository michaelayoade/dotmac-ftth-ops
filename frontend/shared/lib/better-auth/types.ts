import type { User } from "./auth";

export type DotmacActiveOrganization = {
  id: string;
  name?: string;
  slug?: string;
  role?: string;
  permissions?: string[];
  tenantId?: string;
};

export type DotmacUserExtras = {
  username?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  tenant_id?: string;
  technician_id?: string;
  partner_id?: string;
  managed_tenant_ids?: string[];
  roles?: string[];
  role?: string;
  phone?: string;
  avatar_url?: string;
  mfa_enabled?: boolean;
  mfa_backup_codes_remaining?: number;
  activeOrganization?: DotmacActiveOrganization | null;
};

/**
 * Extended User type inferred directly from the Better Auth server config plus Dotmac extras.
 */
export type ExtendedUser = User & DotmacUserExtras;
