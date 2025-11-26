/**
 * Better Auth Server Configuration
 *
 * This is the main server-side configuration for Better Auth.
 * It includes:
 * - PostgreSQL database adapter
 * - Organization plugin for multi-tenancy
 * - Custom roles and permissions for ISP operations
 * - Two-factor authentication
 */

import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { Pool } from "pg";

type AuthInstance = ReturnType<typeof betterAuth>;

const shouldBypassAuth = () =>
  process.env['NODE_ENV'] === "test" ||
  process.env['BETTER_AUTH_BYPASS'] === "true" ||
  process.env['NEXT_PUBLIC_SKIP_BETTER_AUTH'] === "true" ||
  process.env['E2E_AUTH_BYPASS'] === "true";

const resolveAuthEnvironment = () => {
  if (shouldBypassAuth()) {
    return null;
  }

  const databaseUrl = process.env['DATABASE_URL'] || process.env['DOTMAC_DATABASE_URL'];
  const authSecret = process.env['BETTER_AUTH_SECRET'] || process.env['JWT_SECRET'];
  const authUrl =
    process.env['BETTER_AUTH_URL'] || process.env['NEXT_PUBLIC_API_URL'] || "http://localhost:3000";

  if (!databaseUrl) {
    throw new Error(
      "Better Auth is not configured. Set DATABASE_URL or DOTMAC_DATABASE_URL before handling auth routes.",
    );
  }

  if (!authSecret) {
    throw new Error(
      "Better Auth is not configured. Set BETTER_AUTH_SECRET or JWT_SECRET before handling auth routes.",
    );
  }

  return { databaseUrl, authSecret, authUrl };
};

const normalizeConnectionString = (connectionString: string) =>
  connectionString.includes("+asyncpg")
    ? connectionString.replace("postgresql+asyncpg://", "postgresql://")
    : connectionString;

let cachedPool: Pool | null = null;
let cachedPoolConnectionString: string | null = null;
const getPool = (connectionString: string) => {
  const normalized = normalizeConnectionString(connectionString);

  if (cachedPool && cachedPoolConnectionString === normalized) {
    return cachedPool;
  }

  cachedPool = new Pool({ connectionString: normalized });
  cachedPoolConnectionString = normalized;

  // Log pool errors in development
  if (process.env['NODE_ENV'] !== 'production') {
    cachedPool.on('error', (err) => {
      console.error('[better-auth] Pool error:', err.message);
    });
  }

  return cachedPool;
};

/**
 * Custom roles for ISP operations
 * Maps to your existing portal types and user roles
 */
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

/**
 * Access Control Statement
 * Defines resources and their available actions for role-based access control
 */
const accessControlStatement = {
  users: ["create", "read", "update", "delete"],
  customers: ["create", "read", "update", "delete"],
  subscribers: ["create", "read", "update", "delete", "provision", "suspend", "terminate"],
  network: ["read", "configure", "monitor"],
  billing: ["read", "manage", "payments"],
  tickets: ["create", "read", "update", "assign"],
  organization: ["read", "update", "delete", "members", "billing"],
  reports: ["view", "export"],
} as const;

/**
 * Create access control instance
 */
const ac = createAccessControl(accessControlStatement);

/**
 * Define custom roles with specific permissions
 */
const roles = {
  // Platform roles
  superAdmin: ac.newRole({
    users: ["create", "read", "update", "delete"],
    customers: ["create", "read", "update", "delete"],
    subscribers: ["create", "read", "update", "delete", "provision", "suspend", "terminate"],
    network: ["read", "configure", "monitor"],
    billing: ["read", "manage", "payments"],
    tickets: ["create", "read", "update", "assign"],
    organization: ["read", "update", "delete", "members", "billing"],
    reports: ["view", "export"],
  }),

  platformAdmin: ac.newRole({
    users: ["read", "update"],
    organization: ["read", "update"],
    reports: ["view", "export"],
  }),

  // Tenant roles
  tenantOwner: ac.newRole({
    users: ["create", "read", "update", "delete"],
    customers: ["create", "read", "update", "delete"],
    subscribers: ["create", "read", "update", "delete", "provision", "suspend", "terminate"],
    network: ["read", "configure", "monitor"],
    billing: ["read", "manage", "payments"],
    tickets: ["create", "read", "update", "assign"],
    organization: ["read", "update", "members", "billing"],
    reports: ["view", "export"],
  }),

  tenantAdmin: ac.newRole({
    users: ["create", "read", "update"],
    customers: ["create", "read", "update"],
    subscribers: ["create", "read", "update", "provision", "suspend"],
    network: ["read", "monitor"],
    billing: ["read"],
    tickets: ["create", "read", "update", "assign"],
    organization: ["read"],
    reports: ["view"],
  }),

  tenantMember: ac.newRole({
    customers: ["read"],
    subscribers: ["read"],
    network: ["read"],
    billing: ["read"],
    tickets: ["create", "read"],
    organization: ["read"],
  }),

  // Operations roles
  networkAdmin: ac.newRole({
    network: ["read", "configure", "monitor"],
    subscribers: ["read", "provision", "suspend"],
    tickets: ["read", "update"],
  }),

  supportAgent: ac.newRole({
    customers: ["read"],
    subscribers: ["read"],
    tickets: ["create", "read", "update"],
    billing: ["read"],
  }),

  technician: ac.newRole({
    network: ["read", "monitor"],
    subscribers: ["read"],
    tickets: ["read", "update"],
  }),

  // Business roles
  salesManager: ac.newRole({
    customers: ["create", "read", "update"],
    subscribers: ["create", "read"],
    reports: ["view"],
  }),

  billingManager: ac.newRole({
    billing: ["read", "manage", "payments"],
    customers: ["read"],
    subscribers: ["read"],
    reports: ["view", "export"],
  }),

  // Customer role
  customer: ac.newRole({
    subscribers: ["read"],
    billing: ["read"],
    tickets: ["create", "read"],
  }),

  // Reseller roles
  resellerOwner: ac.newRole({
    customers: ["create", "read", "update"],
    subscribers: ["create", "read", "update"],
    billing: ["read"],
    tickets: ["create", "read"],
    organization: ["read", "update", "members"],
    reports: ["view"],
  }),

  resellerAdmin: ac.newRole({
    customers: ["create", "read", "update"],
    subscribers: ["create", "read", "update"],
    billing: ["read"],
    tickets: ["create", "read"],
    organization: ["read"],
  }),

  resellerAgent: ac.newRole({
    customers: ["create", "read"],
    subscribers: ["read"],
    tickets: ["create", "read"],
  }),
};

/**
 * Better Auth instance with multi-tenant organization support
 */
const createMockAuthInstance = (): AuthInstance => {
  const noop = async () => ({ data: null, error: null });
  const mock = {
    signIn: { email: noop },
    signUp: { email: noop },
    signOut: noop,
    useSession: () => ({ data: null, error: null, isPending: false, isRefetching: false, refetch: noop }),
    useActiveOrganization: () => ({ data: null, error: null, isPending: false, isRefetching: false, refetch: noop }),
    useListOrganizations: () => ({ data: [], error: null, isPending: false, isRefetching: false, refetch: noop }),
    handlers: {},
    $Infer: { Session: { session: {}, user: {} } },
  } as unknown as AuthInstance;
  return mock;
};

const createAuthInstance = (): AuthInstance => {
  const env = resolveAuthEnvironment();
  if (!env) {
    console.warn("[better-auth] Bypassing Better Auth initialization (test/bypass mode)");
    return createMockAuthInstance();
  }

  const { databaseUrl, authSecret, authUrl } = env;
  const pool = getPool(databaseUrl);

  return betterAuth({
    // Database configuration - pass pg Pool directly to Better Auth
    database: pool,

    // Base URL configuration
    baseURL: authUrl,

    // Secret for encryption and hashing
    secret: authSecret,

    // User schema with snake_case field mappings and additional fields
    user: {
      fields: {
        emailVerified: "email_verified",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      additionalFields: {
        username: {
          type: "string",
          required: false,
        },
        first_name: {
          type: "string",
          required: false,
        },
        last_name: {
          type: "string",
          required: false,
        },
        full_name: {
          type: "string",
          required: false,
        },
        tenant_id: {
          type: "string",
          required: false,
        },
        roles: {
          type: "string[]" as const,
          required: false,
        },
        mfa_enabled: {
          type: "boolean",
          required: false,
          defaultValue: false,
        },
        mfa_backup_codes_remaining: {
          type: "number",
          required: false,
        },
        phone: {
          type: "string",
          required: false,
        },
        avatar_url: {
          type: "string",
          required: false,
        },
        role: {
          type: "string",
          required: false,
        },
      },
    },

    // Account schema with snake_case field mappings
    account: {
      fields: {
        userId: "user_id",
        providerId: "provider",
        accountId: "provider_account_id",
        accessToken: "access_token",
        refreshToken: "refresh_token",
        idToken: "id_token",
        expiresAt: "expires_at",
        tokenType: "token_type",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
    },

    // Session schema with snake_case field mappings
    session: {
      fields: {
        userId: "user_id",
        expiresAt: "expires_at",
        ipAddress: "ip_address",
        userAgent: "user_agent",
        createdAt: "created_at",
        updatedAt: "updated_at",
      },
      expiresIn: 60 * 60 * 24 * 7, // 7 days
      updateAge: 60 * 60 * 24, // 1 day
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60, // 5 minutes
      },
    },

    // Email/Password authentication
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        const webhook = process.env['BETTER_AUTH_RESET_EMAIL_WEBHOOK'];
        const secret = process.env['BETTER_AUTH_WEBHOOK_SECRET'];

        if (webhook && typeof fetch === "function") {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (secret) {
            headers["X-Better-Auth-Webhook-Secret"] = secret;
          }

          try {
            await fetch(webhook, {
              method: "POST",
              headers,
              body: JSON.stringify({
                email: user.email,
                url,
              }),
            });
            return;
          } catch (err) {
            console.error(
              "[better-auth] Failed to send reset password email via webhook",
              err,
            );
          }
        }

        // Fallback: log the reset URL for manual use in development
        console.log(`Reset password URL for ${user.email}: ${url}`);
      },
    },

    // Advanced session security
    advanced: {
      crossSubDomainCookies: {
        enabled: false,
      },
      useSecureCookies: process.env['NODE_ENV'] === "production",
      generateId: () => {
        // Use crypto for secure ID generation
        return crypto.randomUUID();
      },
    },

    // Two-Factor Authentication
    twoFactor: {
      enabled: true,
      issuer: "DotMac ISP Platform",
    },

    // Plugins
    plugins: [
      // Organization plugin for multi-tenancy
      organization({
        // Enable async storage for role-based access control
        async: true,

        // Access control configuration
        ac,
        roles: Object.values(roles) as any,

        onCreate: async (organization: { id: string; name: string; slug?: string }) => {
          const webhook = process.env['BETTER_AUTH_ORG_WEBHOOK_URL'];
          const secret = process.env['BETTER_AUTH_WEBHOOK_SECRET'];

          if (webhook && typeof fetch === "function") {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (secret) {
              headers["X-Better-Auth-Webhook-Secret"] = secret;
            }

            try {
              await fetch(webhook, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  event: "organization.created",
                  organization,
                }),
              });
            } catch (err) {
              console.error(
                "[better-auth] Failed to send organization.created webhook",
                err,
              );
            }
          }

          console.log(`New organization created: ${organization.name}`);
        },

        onDelete: async (organization: { id: string; name: string; slug?: string }) => {
          const webhook = process.env['BETTER_AUTH_ORG_WEBHOOK_URL'];
          const secret = process.env['BETTER_AUTH_WEBHOOK_SECRET'];

          if (webhook && typeof fetch === "function") {
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
            };
            if (secret) {
              headers["X-Better-Auth-Webhook-Secret"] = secret;
            }

            try {
              await fetch(webhook, {
                method: "POST",
                headers,
                body: JSON.stringify({
                  event: "organization.deleted",
                  organization,
                }),
              });
            } catch (err) {
              console.error(
                "[better-auth] Failed to send organization.deleted webhook",
                err,
              );
            }
          }

          console.log(`Organization deleted: ${organization.name}`);
        },
      }),
    ],

    // Trust proxy headers (important for deployment)
    trustedOrigins: [
      authUrl,
      process.env['NEXT_PUBLIC_ADMIN_URL'] || "http://localhost:3001",
      process.env['NEXT_PUBLIC_ISP_URL'] || "http://localhost:3002",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
  });
};

let cachedAuth: AuthInstance | null = null;

export const getAuth = (): AuthInstance => {
  if (!cachedAuth) {
    cachedAuth = createAuthInstance();
  }

  return cachedAuth;
};

// Default export for tooling (e.g., @better-auth/cli) that expects a default auth instance
const auth = getAuth();
export default auth;

/**
 * Export type inference helpers
 */
export type Auth = AuthInstance;
export type Session = AuthInstance["$Infer"]["Session"]["session"];
export type User = AuthInstance["$Infer"]["Session"]["user"];
