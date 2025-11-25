/**
 * Better Auth configuration for CLI migrations (CommonJS).
 * Mirrors frontend/shared/lib/better-auth/auth.ts without TS/ESM.
 *
 * Used by `@better-auth/cli migrate --config ./shared/lib/better-auth/auth.config.js`
 * inside the frontend containers.
 */

const { betterAuth } = require("better-auth");
const { organization } = require("better-auth/plugins");
const { createAccessControl } = require("better-auth/plugins/access");
const { Pool } = require("pg");

const resolveAuthEnvironment = () => {
  const databaseUrl = process.env.DATABASE_URL || process.env.DOTMAC_DATABASE_URL;
  const authSecret = process.env.BETTER_AUTH_SECRET || process.env.JWT_SECRET;
  const authUrl =
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3000";

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

const accessControlStatement = {
  users: ["create", "read", "update", "delete"],
  customers: ["create", "read", "update", "delete"],
  subscribers: ["create", "read", "update", "delete", "provision", "suspend", "terminate"],
  network: ["read", "configure", "monitor"],
  billing: ["read", "manage", "payments"],
  tickets: ["create", "read", "update", "assign"],
  organization: ["read", "update", "delete", "members", "billing"],
  reports: ["view", "export"],
};

const ac = createAccessControl(accessControlStatement);

const roles = {
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
  customer: ac.newRole({
    subscribers: ["read"],
    billing: ["read"],
    tickets: ["create", "read"],
  }),
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

const createAuthInstance = () => {
  const { databaseUrl, authSecret, authUrl } = resolveAuthEnvironment();
  const pool = new Pool({ connectionString: databaseUrl });

  return betterAuth({
    database: {
      provider: "pg",
      connection: pool,
    },
    baseURL: authUrl,
    secret: authSecret,
    user: {
      additionalFields: {
        username: { type: "string", required: false },
        first_name: { type: "string", required: false },
        last_name: { type: "string", required: false },
        full_name: { type: "string", required: false },
        tenant_id: { type: "string", required: false },
        roles: { type: "string[]", required: false },
        mfa_enabled: { type: "boolean", required: false, defaultValue: false },
        mfa_backup_codes_remaining: { type: "number", required: false },
        phone: { type: "string", required: false },
        avatar_url: { type: "string", required: false },
        role: { type: "string", required: false },
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {
        console.log(`Reset password URL for ${user.email}: ${url}`);
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    plugins: [
      organization({
        enabled: true,
        organization: {
          roles: ["member", "admin", "owner", "billing"],
          defaultRole: "member",
        },
        member: {
          additionalFields: {
            status: { type: "string", required: false },
            role: { type: "string", required: false },
            role_description: { type: "string", required: false },
            title: { type: "string", required: false },
          },
        },
        allowedDomains: [],
        maxMembers: 1000,
        maxOrganizations: 100,
        sendInvitationEmail: async ({ email, organization }) => {
          console.log(`Send invitation email to ${email} for org ${organization.name}`);
        },
        onMemberAdded: async ({ user, organization }) => {
          console.log(`User ${user.email} added to ${organization.name}`);
        },
        onMemberRemoved: async ({ user, organization }) => {
          console.log(`User ${user.email} removed from ${organization.name}`);
        },
        onOrganizationCreated: async ({ organization }) => {
          console.log(`Organization created: ${organization.name}`);
        },
        onOrganizationDeleted: async ({ organization }) => {
          console.log(`Organization deleted: ${organization.name}`);
        },
      }),
    ],
    access: {
      roles,
    },
    trustedOrigins: [
      authUrl,
      process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3001",
      process.env.NEXT_PUBLIC_ISP_URL || "http://localhost:3002",
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
    ],
  });
};

const auth = createAuthInstance();

module.exports = auth;
module.exports.default = auth;
module.exports.auth = auth;
