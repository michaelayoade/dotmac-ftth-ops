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

// Environment variables
const DATABASE_URL = process.env['DATABASE_URL'] || process.env['DOTMAC_DATABASE_URL'];
const AUTH_SECRET = process.env['BETTER_AUTH_SECRET'] || process.env['JWT_SECRET'];
const AUTH_URL = process.env['BETTER_AUTH_URL'] || process.env['NEXT_PUBLIC_API_URL'] || "http://localhost:3000";

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL or DOTMAC_DATABASE_URL must be defined");
}

if (!AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET or JWT_SECRET must be defined");
}

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  // Convert async URL to sync if needed
  ...(DATABASE_URL.includes("+asyncpg") ? {
    connectionString: DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")
  } : {})
});

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
export const auth = betterAuth({
  // Database configuration
  database: {
    provider: "pg",
    connection: pool,
  },

  // Base URL configuration
  baseURL: AUTH_URL,

  // Secret for encryption and hashing
  secret: AUTH_SECRET,

  // User schema with additional fields
  user: {
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

  // Email/Password authentication
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // TODO: Implement email sending via your email service
      console.log(`Reset password URL for ${user.email}: ${url}`);
    },
  },

  // Session configuration
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
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

      // Organization creation callback
      onCreate: async (organization: { id: string; name: string; slug?: string }) => {
        console.log(`New organization created: ${organization.name}`);
        // TODO: Initialize organization-specific resources
        // - Create default roles
        // - Set up billing account
        // - Configure initial settings
      },

      // Organization deletion callback
      onDelete: async (organization: { id: string; name: string; slug?: string }) => {
        console.log(`Organization deleted: ${organization.name}`);
        // TODO: Cleanup organization resources
        // - Archive data
        // - Cancel subscriptions
        // - Notify members
      },
    }),
  ],

  // Trust proxy headers (important for deployment)
  trustedOrigins: [
    AUTH_URL,
    process.env['NEXT_PUBLIC_ADMIN_URL'] || "http://localhost:3001",
    process.env['NEXT_PUBLIC_ISP_URL'] || "http://localhost:3002",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
  ],
});

/**
 * Export type inference helpers
 */
export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
