# API Keys Testing Strategy

## Overview

API key management functionality is tested using a **hybrid testing approach**:

- **Unit Tests (Jest + MSW)** - Error handling, edge cases, and state management
- **E2E Tests (Playwright)** - Full integration testing with real UI and data flow

## Unit Tests

**File:** `useApiKeys.msw.test.tsx`
**Status:** ✅ 9/9 passing
**Run:** `pnpm test hooks/__tests__/useApiKeys.msw.test.tsx`

### What's Tested

✅ **Query Key Factory**

- Proper query key generation for caching

✅ **Error Handling**

- Empty API keys list
- Network errors (500, 404, etc.)
- Invalid create requests
- Non-existent key updates
- Non-existent key revocations

✅ **React Query Behavior**

- Concurrent create operations
- Mutation loading states (isCreating, isUpdating, isRevoking)

✅ **Real-World Scenarios**

- Creating multiple API keys sequentially

### What's NOT Tested (Covered by E2E)

Due to a known technical limitation with axios + MSW + React Query data flow in jsdom:

- ⚠️ Data population from MSW responses
- ⚠️ Pagination with actual data
- ⚠️ Update/revoke operations with state verification
- ⚠️ Query invalidation across hook instances

See `KNOWN_ISSUES.md` for technical details.

## E2E Tests

**File:** `frontend/e2e/tests/api-keys.spec.ts`
**Run:** `pnpm --filter @dotmac/e2e test:e2e api-keys`

### What's Tested

✅ **Viewing API Keys**

- Display API keys list
- Empty state handling
- Key properties (name, scopes, status, dates)

✅ **Creating API Keys**

- Successful creation flow
- Form validation
- One-time API key display
- Copy to clipboard

✅ **Updating API Keys**

- Update name and description
- Toggle active/inactive status
- Save changes

✅ **Revoking API Keys**

- Revoke with confirmation
- Cancel revocation
- Verify removal from list

✅ **Pagination**

- Navigate through pages
- Correct data display per page

✅ **Error Handling**

- Network failures
- Duplicate name handling
- Validation errors

✅ **Search & Filter**

- Filter keys by name
- Real-time search results

## Running Tests

### Unit Tests Only

```bash
cd frontend/apps/isp-ops-app
pnpm test hooks/__tests__/useApiKeys.msw.test.tsx
```

### E2E Tests Only

```bash
cd frontend/e2e
pnpm test:e2e api-keys
```

### All Tests

```bash
cd frontend/apps/isp-ops-app
pnpm test  # Unit tests

cd ../../e2e
pnpm test:e2e  # All E2E tests
```

## Test Environment Setup

### Unit Tests

- No setup required
- MSW handles all API mocking
- Tests run in jsdom environment

### E2E Tests

Requires:

1. Backend API running on `http://localhost:3000`
2. Frontend dev server running
3. Test user credentials in environment:
   ```bash
   export TEST_ADMIN_EMAIL=admin@test.com
   export TEST_ADMIN_PASSWORD=password
   ```

Or configure in `frontend/e2e/.env`:

```
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=password
```

## Coverage Summary

| Scenario              | Unit Test | E2E Test |
| --------------------- | --------- | -------- |
| Error Handling        | ✅        | ✅       |
| Empty States          | ✅        | ✅       |
| Create API Key        | ⚠️        | ✅       |
| Update API Key        | ⚠️        | ✅       |
| Revoke API Key        | ⚠️        | ✅       |
| Pagination            | ⚠️        | ✅       |
| Loading States        | ✅        | ✅       |
| Concurrent Operations | ✅        | -        |
| Query Invalidation    | ⚠️        | ✅       |
| UI Interactions       | -         | ✅       |

**Legend:**
✅ = Fully tested
⚠️ = Partially tested (see E2E for complete coverage)

- = Not applicable

## Continuous Integration

### Unit Tests

- Run on every PR
- Must pass before merge
- Fast (~2-3 seconds)

### E2E Tests

- Run on main branch commits
- Run nightly
- Slower (~30-60 seconds per test)
- Require deployed environment

## Troubleshooting

### Unit Tests Failing

1. Clear Jest cache: `pnpm jest --clearCache`
2. Ensure MSW server is set up correctly in `jest.setup.ts`
3. Check `KNOWN_ISSUES.md` for known limitations

### E2E Tests Failing

1. Ensure backend is running: `curl http://localhost:3000/api/v1/health`
2. Verify test credentials are correct
3. Check browser console for errors: `pnpm test:e2e --debug api-keys`
4. Update selectors if UI has changed

## Future Improvements

- [ ] Add visual regression testing for UI components
- [ ] Add performance testing for large API key lists
- [ ] Add accessibility testing with axe-core
- [ ] Consider migrating from axios to fetch to resolve MSW data flow issue
