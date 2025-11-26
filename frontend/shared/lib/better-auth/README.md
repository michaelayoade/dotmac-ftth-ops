# Better Auth - ISP Platform Authentication

This directory contains the Better Auth configuration for the DotMac ISP Operations Platform.

## Overview

Better Auth is a TypeScript-first authentication framework that provides:
- Multi-tenant organization support
- Role-based access control (RBAC)
- Two-factor authentication (2FA)
- Session management
- PostgreSQL integration

## Files

- `auth.ts` - Server-side configuration (for API routes)
- `client.ts` - Client-side configuration (for React hooks)
- `index.ts` - Main export file

## Usage

### In API Routes

```typescript
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/better-auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

### In React Components

```typescript
import {
  useSession,
  useHasPermission,
  signIn,
  signOut
} from "@/lib/better-auth";

function MyComponent() {
  const { data: session, isPending } = useSession();
  const canCreateUsers = useHasPermission("users:create");

  if (isPending) return <Loading />;

  if (!session) {
    return <LoginPrompt />;
  }

  return (
    <div>
      <p>Welcome, {session.user.name}!</p>
      {canCreateUsers && <CreateUserButton />}
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

## ISP Roles

The platform supports 13 different roles:

### Platform Admin
- `super_admin` - Full system access
- `platform_admin` - Platform management

### Tenant/ISP
- `tenant_owner` - Organization owner
- `tenant_admin` - Organization administrator
- `tenant_member` - Organization member

### Operations
- `network_admin` - Network operations
- `support_agent` - Customer support
- `technician` - Field technician

### Business
- `sales_manager` - Sales operations
- `billing_manager` - Billing operations

### Customer
- `customer` - End customer

### Reseller
- `reseller_owner` - Reseller organization owner
- `reseller_admin` - Reseller administrator
- `reseller_agent` - Reseller agent

## ISP Permissions

Over 30 granular permissions including:

- **User Management:** `users:create`, `users:read`, `users:update`, `users:delete`
- **Customer Management:** `customers:create`, `customers:read`, `customers:update`, `customers:delete`
- **Subscriber Operations:** `subscribers:provision`, `subscribers:suspend`, `subscribers:terminate`
- **Network Operations:** `network:configure`, `network:monitor`
- **Billing:** `billing:manage`, `billing:payments`
- **Tickets:** `tickets:assign`, `tickets:update`
- **Organization:** `organization:members`, `organization:billing`
- **Reporting:** `reports:view`, `reports:export`

## Portal Configurations

Each portal has specific settings:

```typescript
const PORTAL_CONFIG = {
  admin: {
    requiresOrganization: false,
    allowedRoles: ["super_admin", "platform_admin"],
    defaultRedirect: "/dashboard",
    loginPath: "/login",
  },

  customer: {
    requiresOrganization: false,
    allowedRoles: ["customer"],
    defaultRedirect: "/customer-portal",
    loginPath: "/customer-portal/login",
  },

  management: {
    requiresOrganization: true,
    allowedRoles: ["tenant_owner", "tenant_admin", "tenant_member"],
    defaultRedirect: "/dashboard",
    loginPath: "/login",
  },

  // ... more portals
};
```

## Environment Variables

Required environment variables:

```bash
# Better Auth Configuration
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000

# Database (uses existing DATABASE_URL)
DATABASE_URL=postgresql://user:password@localhost:5432/dotmac

# Optional Better Auth webhooks (handled by backend)
# If set, Better Auth will POST JSON payloads to these URLs:
# - BETTER_AUTH_RESET_EMAIL_WEBHOOK:
#     POST { email, url } to your backend (e.g. http://backend:8000/api/v1/auth/better-auth/reset-email)
# - BETTER_AUTH_ORG_WEBHOOK_URL:
#     POST { event: \"organization.created\" | \"organization.deleted\", organization } to your backend
#     (e.g. http://backend:8000/api/v1/auth/better-auth/org-events)
# - BETTER_AUTH_WEBHOOK_SECRET (optional):
#     Shared secret added as X-Better-Auth-Webhook-Secret header on all webhook calls.
BETTER_AUTH_RESET_EMAIL_WEBHOOK=http://backend:8000/api/v1/auth/better-auth/reset-email
BETTER_AUTH_ORG_WEBHOOK_URL=http://backend:8000/api/v1/auth/better-auth/org-events
BETTER_AUTH_WEBHOOK_SECRET=super-secure-shared-secret

# Public URLs
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001
NEXT_PUBLIC_ISP_URL=http://localhost:3002
```

## Database Setup

Run Better Auth CLI to create database tables:

```bash
cd frontend
npx @better-auth/cli generate  # Generate migrations
npx @better-auth/cli migrate   # Apply migrations
```

This creates tables for:
- users
- sessions
- organizations
- organization_members
- organization_invitations
- two_factor_auth

## Common Hooks

### useSession()
Get current session and user:
```typescript
const { data: session, isPending } = useSession();
// session.user - User object
// session.user.activeOrganization - Current organization
```

### useHasPermission(permission)
Check if user has a specific permission:
```typescript
const canEdit = useHasPermission("customers:update");
```

### useHasRole(role)
Check if user has a specific role:
```typescript
const isAdmin = useHasRole("tenant_admin");
```

### useIsSuperAdmin()
Check if user is super admin:
```typescript
const isSuperAdmin = useIsSuperAdmin();
```

### useCurrentOrganization()
Get the active organization:
```typescript
const organization = useCurrentOrganization();
// organization.id
// organization.name
// organization.role - User's role in this org
```

## Authentication Actions

### Sign In
```typescript
await signIn.email({
  email: "user@example.com",
  password: "password123",
  callbackURL: "/dashboard"
});
```

### Sign Up
```typescript
await signUp.email({
  email: "user@example.com",
  password: "password123",
  name: "John Doe",
  callbackURL: "/dashboard"
});
```

### Sign Out
```typescript
await signOut();
```

## Type Safety

Better Auth provides full TypeScript support with type inference:

```typescript
import type { Session, User } from "@/lib/better-auth";

function ProfilePage() {
  const { data: session } = useSession();

  // TypeScript knows the shape of session.user
  const userName = session?.user.name;
  const userEmail = session?.user.email;
  const userOrg = session?.user.activeOrganization;
}
```

## Testing

Better Auth makes testing much simpler than custom auth:

```typescript
import { createAuthClient } from "better-auth/react";
import { render } from "@testing-library/react";

describe("Protected Component", () => {
  it("shows content for authenticated users", async () => {
    // Easy to mock authentication
    const { session } = await createTestSession({
      user: { email: "test@example.com" },
      organization: { id: "org-1", role: "tenant_admin" }
    });

    render(<ProtectedComponent />);
    // Test assertions...
  });
});
```

## Migration from Old Auth

If migrating from the old `@dotmac/auth` package:

### Old Pattern
```typescript
import { useAuth } from "@dotmac/auth";

const { user, isAuthenticated, login, logout, hasPermission } = useAuth();
```

### New Pattern
```typescript
import {
  useSession,
  useHasPermission,
  signIn,
  signOut
} from "@/lib/better-auth";

const { data: session } = useSession();
const hasPermission = useHasPermission("users:create");
```

## Resources

- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Organization Plugin](https://www.better-auth.com/docs/plugins/organization)
- [Migration Guide](../../../../docs/BETTER_AUTH_MIGRATION.md)

## Support

For questions or issues:
1. Check the Better Auth documentation
2. Review the migration guide
3. Check this README
4. Create an issue in the project repository
