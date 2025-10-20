# Frontend Production Issues - Mock Data & Type Checking

## Overview

This document details critical production issues in the frontend application related to mock data fallbacks and disabled TypeScript checking.

---

## Issue 1: Mock Data Fallback in Production ❌ CRITICAL

### Problem

Multiple frontend pages fall back to **mock data when APIs fail or return empty results**. This means production users would see fake data instead of error messages or empty states.

**Severity**: **CRITICAL** - Users see fabricated data in production

### Affected Files

| File | Line | Mock Data Type | Pattern |
|------|------|----------------|---------|
| `app/dashboard/network/faults/page.tsx` | 151 | Alarms | `apiAlarms.length > 0 ? apiAlarms : mockAlarms` |
| `app/dashboard/infrastructure/feature-flags/page.tsx` | TBD | Feature flags | Mock fallback pattern |
| `app/dashboard/settings/notifications/page.tsx` | TBD | Notifications | Mock fallback pattern |

### Dangerous Code Example

```typescript
// frontend/apps/base-app/app/dashboard/network/faults/page.tsx:151
const alarms = apiAlarms.length > 0 ? apiAlarms : mockAlarms;
```

**Why This is Dangerous**:

1. **API failure = mock data shown**: If backend is down, users see fake alarms
2. **Empty legitimate result = mock data**: If there are genuinely no alarms, users see fake alarms
3. **No error visibility**: Users don't know if they're seeing real or fake data
4. **Wrong operational decisions**: Engineers might respond to non-existent alarms
5. **Production data pollution**: Mock alarms have IDs like 'ALM-001', 'ALM-002' which don't exist

**Mock Data Includes**:
```typescript
// Lines 57-109: Mock alarm data
const mockAlarms: Alarm[] = [
  {
    id: '1',
    alarm_id: 'ALM-001',  // ← FAKE ALARM ID
    severity: 'critical',
    title: 'ONU Device Offline',
    customer_name: 'John Doe',  // ← FAKE CUSTOMER
    // ...
  },
  // More fake alarms...
];
```

### Real-World Impact Scenarios

**Scenario 1: API Outage**
```
User: "Why do we have 3 critical alarms?"
Engineer: *checks system* "Backend is down"
User: "But I can see the alarms in the dashboard!"
Engineer: "Those are fake. The dashboard shows mock data when the API is unavailable."
Result: Complete loss of trust in monitoring system
```

**Scenario 2: Legitimate Empty State**
```
Situation: Network is healthy, no active alarms
Backend returns: []
Frontend shows: 3 mock alarms (including critical ones!)
User: Panics and starts investigating non-existent issues
Result: Wasted time, false escalations
```

**Scenario 3: Partial API Failure**
```
Situation: API returns empty array due to query error
Frontend shows: Mock alarms from 2023 with fake timestamps
User: "Why haven't these alarms been cleared?"
Result: Confusion, potential SLA breaches due to chasing ghosts
```

### Recommended Fix

**Option 1: Error States (Recommended for Production)**
```typescript
// Show error when API fails, empty state when legitimately empty
const { alarms, isLoading, error } = useAlarms({ limit: 100, offset: 0 });

if (error) {
  return <ErrorState message="Unable to load alarms" onRetry={refetch} />;
}

if (!isLoading && alarms.length === 0) {
  return <EmptyState message="No active alarms" icon={CheckCircle} />;
}

// Only show real data
return <AlarmTable data={alarms} />;
```

**Option 2: Development-Only Mocks**
```typescript
// Only use mock data in development environment
const isDevelopment = process.env.NODE_ENV === 'development';
const alarms = apiAlarms.length > 0 ? apiAlarms : (isDevelopment ? mockAlarms : []);

if (!isDevelopment && apiAlarms.length === 0 && !isLoading) {
  return <EmptyState />;
}
```

**Option 3: Explicit Mock Mode**
```typescript
// Require explicit flag to enable mock data
const useMockData = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true';

if (useMockData) {
  console.warn('🔶 MOCK DATA MODE ENABLED');
}

const alarms = useMockData ? mockAlarms : apiAlarms;
```

---

## Issue 2: TypeScript Type-Checking Disabled ❌ CRITICAL

### Problem

The `type-check` script in `package.json` is a **no-op echo statement** instead of running TypeScript compiler. This means:

1. **CI never validates TypeScript safety**
2. **Type errors can be committed to main branch**
3. **Production builds might fail with type errors**
4. **No guarantee of type safety**

**Severity**: **CRITICAL** - Type safety completely bypassed in CI

### Affected File

**File**: `frontend/apps/base-app/package.json:12`

```json
{
  "scripts": {
    "type-check": "echo 'Type checking disabled - Next.js build performs type checking'"
  }
}
```

### Why This is Dangerous

**Problem 1: CI workflows don't catch type errors**

```yaml
# GitHub Actions / GitLab CI
- name: Type check
  run: pnpm type-check  # ← This does NOTHING!
```

**Result**: Type errors merged to main branch

**Problem 2: Next.js build type-checking is insufficient**

Next.js build with `next build` does type-checking, but:
- Only runs during build (not in pre-commit/CI checks)
- Can be bypassed with `--no-check` or ignored in some deployment configs
- Slow feedback loop (find errors at build time instead of commit time)

**Problem 3: No standalone type checking**

Developers expect `pnpm type-check` to validate types quickly:
```bash
# Developer workflow
pnpm type-check  # ← Should catch type errors
pnpm lint
pnpm test
git commit
```

But currently it just prints a message and exits successfully.

### Example Type Errors That Slip Through

```typescript
// This would pass CI but fail at runtime
const alarm: Alarm = {
  id: 123,  // ← Type error: should be string
  severity: 'invalid',  // ← Type error: not valid severity
  // Missing required fields...
};

// This would pass CI but break at runtime
function processAlarm(alarm: Alarm) {
  return alarm.nonExistentField;  // ← Type error: property doesn't exist
}
```

### Recommended Fix

**Option 1: Use tsc --noEmit (Recommended)**

```json
{
  "scripts": {
    "type-check": "tsc --noEmit"
  }
}
```

This runs TypeScript compiler without emitting files (fast type checking only).

**Option 2: Use Next.js built-in type check**

```json
{
  "scripts": {
    "type-check": "next lint --max-warnings=0 && tsc --noEmit"
  }
}
```

This combines Next.js linting with TypeScript checking.

**Option 3: Use turbo for monorepo type checking**

```json
{
  "scripts": {
    "type-check": "turbo run type-check --filter=@dotmac/base-app"
  }
}
```

---

## Issue 3: CI Workflows Don't Exercise Type Safety

### Problem

Even though CI runs `pnpm type-check`, it's not actually validating anything because the command is a no-op.

### Affected CI Files

**GitHub Actions**: `.github/workflows/staging-deploy.yml`

```yaml
- name: Type check frontend
  run: |
    cd frontend/apps/base-app
    pnpm type-check  # ← Does nothing!
```

**Makefile**: `Makefile` (if it exists)

```makefile
test-frontend:
    cd frontend/apps/base-app && pnpm type-check  # ← Does nothing!
```

### Impact

- Type errors can be merged to main branch
- Production deployments can fail with type errors
- No early warning of type issues
- Wastes CI/CD time and resources

---

## Comparison: Before vs After

### Before ❌

**Mock Data Fallback**:
```typescript
// API fails or returns []
const alarms = apiAlarms.length > 0 ? apiAlarms : mockAlarms;
// User sees: 3 fake critical alarms
```

**Result**: Users see fake data in production, make wrong decisions

**Type Checking**:
```bash
$ pnpm type-check
Type checking disabled - Next.js build performs type checking
# Exit code: 0 (success)
```

**Result**: Type errors not caught in CI

### After ✅

**Mock Data Fallback**:
```typescript
// API fails
if (error) {
  return <ErrorState message="Unable to load alarms" onRetry={refetch} />;
}

// API returns []
if (!isLoading && alarms.length === 0) {
  return <EmptyState message="No active alarms" />;
}

// Only show real data
return <AlarmTable data={alarms} />;
```

**Result**: Users see appropriate error/empty states, no fake data

**Type Checking**:
```bash
$ pnpm type-check
Running type checker...
✓ Found 0 errors
# Exit code: 0 (success)
```

**Result**: Type errors caught before commit/CI

---

## Recommended Implementation Plan

### Phase 1: Fix Type Checking (Immediate)

1. **Update package.json**:
   ```json
   {
     "scripts": {
       "type-check": "tsc --noEmit"
     }
   }
   ```

2. **Add tsconfig.json if missing**:
   ```json
   {
     "extends": "../../tsconfig.json",
     "compilerOptions": {
       "strict": true,
       "noEmit": true,
       "incremental": true
     },
     "include": ["**/*.ts", "**/*.tsx"],
     "exclude": ["node_modules", ".next", "dist"]
   }
   ```

3. **Update CI workflows** to catch failures:
   ```yaml
   - name: Type check frontend
     run: |
       cd frontend/apps/base-app
       pnpm type-check
     # This will now FAIL if there are type errors
   ```

4. **Fix any existing type errors** revealed by enabling checking

5. **Add pre-commit hook**:
   ```json
   {
     "husky": {
       "hooks": {
         "pre-commit": "pnpm type-check && pnpm lint"
       }
     }
   }
   ```

### Phase 2: Fix Mock Data Fallbacks (High Priority)

For each file with mock data fallback:

1. **Identify mock data usage**:
   ```bash
   grep -r "mockAlarms\|mockData\|mock[A-Z]" frontend/apps/base-app/app/
   ```

2. **Replace with proper error handling**:
   ```typescript
   // Remove:
   const data = apiData.length > 0 ? apiData : mockData;

   // Add:
   if (error) return <ErrorState />;
   if (!loading && data.length === 0) return <EmptyState />;
   return <DataDisplay data={data} />;
   ```

3. **Move mocks to development-only files**:
   ```typescript
   // lib/mocks/alarms.mock.ts
   export const mockAlarms = [...];  // Only imported in dev
   ```

4. **Add development mode flag**:
   ```typescript
   const isDev = process.env.NODE_ENV === 'development';
   if (isDev && !data) {
     console.warn('Using mock data in development');
     return mockData;
   }
   ```

### Phase 3: Add Production Safeguards

1. **Environment validation**:
   ```typescript
   // lib/config.ts
   export function ensureNoMocksInProduction() {
     if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_USE_MOCK_DATA) {
       throw new Error('Mock data cannot be enabled in production');
     }
   }
   ```

2. **Add linting rule**:
   ```json
   {
     "rules": {
       "no-restricted-syntax": [
         "error",
         {
           "selector": "ConditionalExpression[test.property.name='length']",
           "message": "Avoid fallback to mock data - use proper error handling"
         }
       ]
     }
   }
   ```

3. **Add E2E test**:
   ```typescript
   test('should show error state when API fails', async ({ page }) => {
     await page.route('**/api/v1/diagnostics/alarms', route => route.abort());
     await page.goto('/dashboard/network/faults');
     await expect(page.getByText('Unable to load alarms')).toBeVisible();
   });
   ```

---

## Testing Checklist

Before marking as fixed:

**Type Checking**:
- [ ] `pnpm type-check` runs tsc --noEmit
- [ ] Type errors cause command to exit with non-zero code
- [ ] CI workflows fail on type errors
- [ ] Pre-commit hook catches type errors
- [ ] All existing type errors fixed

**Mock Data**:
- [ ] No mock data shown when API returns []
- [ ] Error state shown when API fails
- [ ] Empty state shown when legitimately empty
- [ ] Mock data only available in development mode
- [ ] Production environment validation prevents mocks
- [ ] E2E tests cover error/empty states

---

## Related Files

**Mock Data Files**:
- `frontend/apps/base-app/app/dashboard/network/faults/page.tsx:57-124`
- `frontend/apps/base-app/app/dashboard/infrastructure/feature-flags/page.tsx`
- `frontend/apps/base-app/app/dashboard/settings/notifications/page.tsx`

**Configuration Files**:
- `frontend/apps/base-app/package.json:12` - type-check script
- `frontend/apps/base-app/tsconfig.json` - TypeScript config
- `.github/workflows/staging-deploy.yml` - CI workflow

**Testing Files**:
- `frontend/apps/base-app/tests/e2e/faults.spec.ts` - E2E tests
- `frontend/apps/base-app/__tests__/pages/faults.test.tsx` - Unit tests

---

## Summary

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| Mock data fallback in production | CRITICAL | Users see fake data | ❌ Not Fixed |
| Type-check script is no-op | CRITICAL | Type safety bypassed | ❌ Not Fixed |
| CI doesn't catch type errors | HIGH | Type errors reach production | ❌ Not Fixed |
| No error states for API failures | MEDIUM | Poor UX, confusion | ❌ Not Fixed |

**Next Steps**: Implement Phase 1 (Type Checking) immediately, then Phase 2 (Mock Data) as high priority.

---

**Last Updated**: 2025-10-17
**Status**: Issues documented, fixes pending implementation
