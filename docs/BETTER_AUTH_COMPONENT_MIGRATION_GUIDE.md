# Better Auth Component Migration Guide

## Overview

This guide provides systematic instructions for migrating components from legacy authentication to Better Auth hooks.

---

## ✅ Already Migrated

### Login Pages
- [x] **ISP Ops Login** - `apps/isp-ops-app/app/login/page.tsx`
- [x] **Platform Admin Login** - `apps/platform-admin-app/app/login/page.tsx`
- [x] **Customer Portal Login** - `apps/isp-ops-app/app/customer-portal/login/page.tsx` ⭐ NEW

---

## 🔄 Migration Patterns

### Pattern 1: Simple Auth Check

**Before:**
```typescript
import { useAuth } from "@dotmac/auth";

function MyComponent() {
  const { isAuthenticated, user } = useAuth();

  if (!isAuthenticated) {
    return <div>Please login</div>;
  }

  return <div>Welcome {user.email}</div>;
}
```

**After:**
```typescript
import { useSession } from "@/lib/better-auth";

function MyComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;

  if (!session) {
    return <div>Please login</div>;
  }

  return <div>Welcome {session.user.email}</div>;
}
```

### Pattern 2: Permission Check

**Before:**
```typescript
import { useAuth } from "@dotmac/auth";

function AdminPanel() {
  const { hasPermission } = useAuth();

  if (!hasPermission("users:create")) {
    return <div>Access Denied</div>;
  }

  return <div>Admin Content</div>;
}
```

**After:**
```typescript
import { useHasPermission } from "@/lib/better-auth";

function AdminPanel() {
  const canCreateUsers = useHasPermission("users:create");

  if (!canCreateUsers) {
    return <div>Access Denied</div>;
  }

  return <div>Admin Content</div>;
}
```

### Pattern 3: Role Check

**Before:**
```typescript
import { useAuth } from "@dotmac/auth";

function AdminDashboard() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.includes("admin");

  if (!isAdmin) {
    return <div>Admin only</div>;
  }

  return <div>Dashboard</div>;
}
```

**After:**
```typescript
import { useHasRole } from "@/lib/better-auth";

function AdminDashboard() {
  const isAdmin = useHasRole("tenant_admin");

  if (!isAdmin) {
    return <div>Admin only</div>;
  }

  return <div>Dashboard</div>;
}
```

### Pattern 4: Login/Logout

**Before:**
```typescript
import { useAuth } from "@dotmac/auth";

function LoginButton() {
  const { login, logout, isAuthenticated } = useAuth();

  const handleLogin = async () => {
    await login({ email, password });
  };

  const handleLogout = async () => {
    await logout();
  };

  return isAuthenticated ? (
    <button onClick={handleLogout}>Logout</button>
  ) : (
    <button onClick={handleLogin}>Login</button>
  );
}
```

**After:**
```typescript
import { signIn, signOut, useSession } from "@/lib/better-auth";

function LoginButton() {
  const { data: session } = useSession();

  const handleLogin = async () => {
    await signIn.email({ email, password });
  };

  const handleLogout = async () => {
    await signOut();
  };

  return session ? (
    <button onClick={handleLogout}>Logout</button>
  ) : (
    <button onClick={handleLogin}>Login</button>
  );
}
```

### Pattern 5: Organization/Tenant Context

**Before:**
```typescript
import { useAuth } from "@dotmac/auth";

function TenantSelector() {
  const { user } = useAuth();
  const currentTenant = user?.tenant_id;

  return <div>Tenant: {currentTenant}</div>;
}
```

**After:**
```typescript
import { useCurrentOrganization } from "@/lib/better-auth";

function TenantSelector() {
  const currentOrg = useCurrentOrganization();

  return <div>Organization: {currentOrg?.name}</div>;
}
```

---

## 🔍 Finding Components to Migrate

### Search Commands

```bash
cd frontend

# Find all useAuth usage
grep -r "useAuth" --include="*.tsx" --include="*.ts" apps/ | wc -l

# Find specific hooks
grep -r "hasPermission" --include="*.tsx" apps/
grep -r "hasRole" --include="*.tsx" apps/
grep -r "isAuthenticated" --include="*.tsx" apps/

# Find auth providers
grep -r "SimpleAuthProvider" --include="*.tsx" apps/
grep -r "SecureAuthProvider" --include="*.tsx" apps/
grep -r "CustomerAuthContext" --include="*.tsx" apps/
```

### Component Categories to Check

1. **Protected Routes** - `/dashboard/*` pages
2. **Navigation Components** - Headers, sidebars with auth checks
3. **User Menus** - Dropdowns showing user info
4. **Permission Gates** - Components that check permissions
5. **Forms** - Components that submit authenticated requests

---

## 📋 Component Migration Checklist

### ISP Ops App Components

#### Dashboard Pages
- [ ] `app/dashboard/page.tsx`
- [ ] `app/dashboard/subscribers/page.tsx`
- [ ] `app/dashboard/customers/page.tsx`
- [ ] `app/dashboard/billing-revenue/page.tsx`
- [ ] `app/dashboard/network/page.tsx`
- [ ] `app/dashboard/radius/page.tsx`
- [ ] `app/dashboard/settings/page.tsx`
- [ ] `app/dashboard/profile/page.tsx`

#### Layout Components
- [ ] `app/dashboard/layout.tsx`
- [ ] `components/navigation/*`
- [ ] `components/header/*`
- [ ] `components/sidebar/*`

#### Customer Portal
- [x] `app/customer-portal/login/page.tsx` ✅
- [ ] `app/customer-portal/page.tsx`
- [ ] `app/customer-portal/billing/page.tsx`
- [ ] `app/customer-portal/usage/page.tsx`
- [ ] `app/customer-portal/support/page.tsx`

### Platform Admin App Components

#### Dashboard Pages
- [ ] `app/dashboard/page.tsx`
- [ ] `app/dashboard/tenants/page.tsx`
- [ ] `app/dashboard/users/page.tsx`
- [ ] `app/dashboard/settings/page.tsx`

#### Tenant Portal
- [ ] `app/tenant-portal/page.tsx`
- [ ] `app/tenant-portal/layout.tsx`
- [ ] `app/tenant-portal/support/page.tsx`

---

## 🛠️ Step-by-Step Migration Process

### For Each Component:

#### Step 1: Identify Auth Usage
```bash
# Example for a specific file
grep -n "useAuth\|hasPermission\|hasRole\|isAuthenticated" \
  apps/isp-ops-app/app/dashboard/subscribers/page.tsx
```

#### Step 2: Update Imports
```typescript
// Remove
import { useAuth } from "@dotmac/auth";

// Add
import { useSession, useHasPermission, useHasRole } from "@/lib/better-auth";
```

#### Step 3: Replace Hook Usage
See migration patterns above for specific replacements.

#### Step 4: Update Type Checking
```typescript
// Before
if (user) {
  // user is defined
}

// After
if (session?.user) {
  // user is defined
}
```

#### Step 5: Test the Component
- Does it render correctly?
- Do auth checks work?
- Do permission gates work?
- Does logout work?

---

## 🎯 Priority Migration Order

### High Priority (Week 1)
1. **Dashboard Layouts** - Most visible to users
2. **Navigation Components** - Used across all pages
3. **User Profile Pages** - Common user action

### Medium Priority (Week 2)
4. **Protected Pages** - Subscriber, customer, billing pages
5. **Forms with Auth** - Components that submit data
6. **Settings Pages** - Less frequently accessed

### Low Priority (Week 3)
7. **Utility Components** - Helper components
8. **Admin-only Pages** - Less frequently used
9. **Legacy Components** - Marked for deprecation

---

## 🧪 Testing Checklist

### For Each Migrated Component:

- [ ] Component renders without errors
- [ ] Loading state displays correctly
- [ ] Unauthenticated state redirects/shows error
- [ ] Authenticated users see content
- [ ] Permission checks work correctly
- [ ] Role checks work correctly
- [ ] Organization context is correct
- [ ] No console errors
- [ ] TypeScript compiles without errors

---

## 🚨 Common Issues & Solutions

### Issue 1: `useAuth is not defined`
**Solution:** Import from Better Auth instead
```typescript
import { useSession } from "@/lib/better-auth";
```

### Issue 2: `user is undefined`
**Solution:** Check session first
```typescript
const { data: session } = useSession();
const user = session?.user;
```

### Issue 3: `hasPermission is not a function`
**Solution:** Use Better Auth permission hook
```typescript
const hasPermission = useHasPermission("users:create");
```

### Issue 4: TypeScript errors on session
**Solution:** Proper null checking
```typescript
if (!session || !session.user) return null;
// Now session.user is defined
```

### Issue 5: Organization context missing
**Solution:** Use organization hook
```typescript
const currentOrg = useCurrentOrganization();
```

---

## 📊 Migration Progress Tracking

Create a spreadsheet or issue tracker with:

| Component | File Path | Status | Tested | Notes |
|-----------|-----------|--------|--------|-------|
| ISP Ops Login | `apps/isp-ops-app/app/login/page.tsx` | ✅ Done | ✅ Yes | Hybrid auth |
| Platform Admin Login | `apps/platform-admin-app/app/login/page.tsx` | ✅ Done | ✅ Yes | Hybrid auth |
| Customer Portal Login | `apps/isp-ops-app/app/customer-portal/login/page.tsx` | ✅ Done | ⏳ Pending | Just migrated |
| Dashboard Layout | `apps/isp-ops-app/app/dashboard/layout.tsx` | ⏳ Pending | ⏳ Pending | - |
| ... | ... | ... | ... | ... |

---

## 🔄 Automated Migration Script (Optional)

For bulk updates, create a script:

```bash
#!/bin/bash
# migrate-auth-hooks.sh

find apps/ -name "*.tsx" -type f | while read file; do
  if grep -q "useAuth" "$file"; then
    echo "Migrating: $file"

    # Backup
    cp "$file" "$file.bak"

    # Replace imports
    sed -i '' 's/import { useAuth } from "@dotmac\/auth"/import { useSession, useHasPermission } from "@\/lib\/better-auth"/g' "$file"

    # Replace hook usage
    sed -i '' 's/const { isAuthenticated } = useAuth()/const { data: session } = useSession()/g' "$file"
    sed -i '' 's/isAuthenticated/!!session/g' "$file"

    echo "  ✓ Migrated"
  fi
done
```

**⚠️ Warning:** Always review automated changes manually!

---

## 📚 Better Auth Hook Reference

### Session Hooks
```typescript
import { useSession } from "@/lib/better-auth";

const {
  data: session,    // Session object or null
  isPending,        // Loading state
  error             // Error object if failed
} = useSession();
```

### User Hooks
```typescript
import { useUser } from "@/lib/better-auth";

const { data: user } = useUser(); // Current user or null
```

### Permission Hooks
```typescript
import { useHasPermission } from "@/lib/better-auth";

const canCreate = useHasPermission("users:create");
const canDelete = useHasPermission("users:delete");
```

### Role Hooks
```typescript
import { useHasRole } from "@/lib/better-auth";

const isAdmin = useHasRole("tenant_admin");
const isSuperAdmin = useIsSuperAdmin();
```

### Organization Hooks
```typescript
import { useCurrentOrganization } from "@/lib/better-auth";

const currentOrg = useCurrentOrganization();
// Returns: { id, name, slug, ... } or null
```

### Auth Actions
```typescript
import { signIn, signOut, signUp } from "@/lib/better-auth";

// Sign in
await signIn.email({ email, password, callbackURL: "/dashboard" });

// Sign up
await signUp.email({ email, password, name });

// Sign out
await signOut();
```

---

## 🎯 Success Criteria

Component migration is complete when:

- ✅ No references to `@dotmac/auth` package
- ✅ All auth checks use Better Auth hooks
- ✅ All pages render correctly
- ✅ All permission checks work
- ✅ All role checks work
- ✅ TypeScript compiles without errors
- ✅ No console errors during runtime
- ✅ All tests pass
- ✅ User workflows tested end-to-end

---

## 📖 Additional Resources

- **Better Auth Docs:** https://www.better-auth.com/docs
- **React Hooks:** https://www.better-auth.com/docs/concepts/client
- **Organization Plugin:** https://www.better-auth.com/docs/plugins/organization
- **Testing Guide:** `docs/BETTER_AUTH_TESTING_GUIDE.md`
- **Migration Guide:** `docs/BETTER_AUTH_MIGRATION.md`

---

**Last Updated:** 2025-11-09
**Status:** Customer Portal Login Migrated ✅ | Component Migration In Progress 🔄
