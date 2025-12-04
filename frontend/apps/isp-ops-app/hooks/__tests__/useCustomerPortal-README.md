# Customer Portal Testing Strategy

## Overview

Customer Portal functionality is tested using a **hybrid testing approach**:

- **Unit Tests (Jest + MSW)** - All hooks, mutations, queries, and real-world scenarios
- **E2E Tests (Playwright)** - Full integration testing with real UI and user workflows

## Why Customer Portal Tests Are Perfect

Unlike `useApiKeys` and `useDunning`, **useCustomerPortal tests work flawlessly** because:

✅ **Uses Native Fetch API** - Not axios!
✅ **MSW Data Flow Works Perfectly** - All mutations populate correctly
✅ **100% Test Pass Rate** - 22/22 tests passing
✅ **Real-world Scenarios** - Complex multi-hook workflows

This proves that the MSW + React Query issues in other hooks are **axios-specific**.

---

## Unit Tests

**File:** `useCustomerPortal.msw.test.tsx`
**Status:** ✅ 22/22 passing (100%)
**Run:** `pnpm test hooks/__tests__/useCustomerPortal.msw.test.tsx`
**Speed:** ~6 seconds

### What's Tested

#### **8 Hooks - Full Coverage**

1. **useCustomerProfile** ✅
   - Fetch profile
   - Update profile (with optimistic updates)

2. **useCustomerService** ✅
   - Fetch service details
   - Upgrade plan (full mutation verification)

3. **useCustomerInvoices** ✅
   - Fetch invoices list

4. **useCustomerPayments** ✅
   - Fetch payments history
   - Make payment (full mutation verification)

5. **useCustomerUsage** ✅
   - Fetch usage statistics

6. **useCustomerTickets** ✅
   - Fetch tickets list
   - Create ticket (full mutation verification)

7. **useCustomerSettings** ✅
   - Fetch settings
   - Update settings (with optimistic updates)
   - Change password

8. **useCustomerPaymentMethods** ✅
   - Fetch payment methods
   - Add payment method
   - Set default payment method
   - Remove payment method
   - Toggle auto-pay

#### **Real-World Scenarios** ✅

1. **Complete Customer Journey**
   - Profile update → Add payment method → Make payment
   - Tests multi-hook state synchronization

2. **Service Upgrade Workflow**
   - Upgrade service → Enable notifications
   - Tests service changes triggering settings updates

3. **Support Ticket Lifecycle**
   - Create multiple tickets sequentially
   - Tests ticket accumulation in list

4. **Payment Method Management**
   - Add → Set as default → Enable auto-pay → Remove old method
   - Tests complex CRUD workflow

### Technical Highlights

✅ **Optimistic Updates Tested**

```typescript
// Profile update shows immediate UI feedback
await act(async () => {
  await result.current.updateProfile({ phone: "+9998887777" });
});
// Optimistic update verified, then server response
```

✅ **Query Invalidation Tested**

```typescript
// Making a payment invalidates both payments AND invoices queries
onSettled: () => {
  queryClient.invalidateQueries({ queryKey });
  queryClient.invalidateQueries({ queryKey: invoicesQueryKey });
};
```

✅ **Shared State Across Hooks**

```typescript
// Multiple hooks share same QueryClient in real-world tests
const wrapper = createWrapper(); // Shared client
const { result: profileResult } = renderHook(() => useCustomerProfile(), { wrapper });
const { result: paymentsResult } = renderHook(() => useCustomerPayments(), { wrapper });
```

---

## E2E Tests

**File:** `frontend/e2e/tests/customer-portal.spec.ts`
**Run:** `pnpm --filter @dotmac/e2e test:e2e customer-portal`

### What's Tested

✅ **Profile Management** (3 tests)

- Display profile information
- Update profile
- Display service address

✅ **Service Management** (3 tests)

- Display current plan
- Display available upgrades
- Upgrade service plan

✅ **Invoices and Billing** (3 tests)

- Display invoice list
- Display invoice details
- Download invoice PDF

✅ **Payment Processing** (5 tests)

- Display payment methods
- Add payment method
- Set default payment method
- Make payment
- Enable auto-pay

✅ **Usage Monitoring** (3 tests)

- Display usage statistics
- Display usage chart
- Display usage limit warnings

✅ **Support Tickets** (4 tests)

- Display tickets list
- Create support ticket
- View ticket details
- Filter tickets by status

✅ **Settings Management** (4 tests)

- Display settings page
- Update notification settings
- Change password
- Update privacy preferences

✅ **Dashboard and Navigation** (3 tests)

- Display dashboard with metrics
- Navigate between sections
- Logout successfully

✅ **Error Handling** (3 tests)

- Handle network errors
- Handle invalid payment information
- Handle session expiration

✅ **Responsive Design** (2 tests)

- Mobile viewport
- Tablet viewport

**Total:** 30+ test scenarios

---

## Running Tests

### Unit Tests Only

```bash
cd frontend/apps/isp-ops-app
pnpm test hooks/__tests__/useCustomerPortal.msw.test.tsx
```

### E2E Tests Only

```bash
cd frontend/e2e
pnpm test:e2e customer-portal
```

### All Tests

```bash
cd frontend/apps/isp-ops-app
pnpm test  # Unit tests

cd ../../e2e
pnpm test:e2e  # All E2E tests
```

---

## Test Environment Setup

### Unit Tests

- ✅ No setup required
- ✅ MSW handles all API mocking
- ✅ Tests run in jsdom environment
- ✅ All mutations work perfectly (uses fetch, not axios!)

### E2E Tests

Requires:

1. Backend API running on `http://localhost:3000`
2. Frontend dev server running
3. Test customer credentials in environment:
   ```bash
   export TEST_CUSTOMER_EMAIL=customer@test.com
   export TEST_CUSTOMER_PASSWORD=password
   ```

Or configure in `frontend/e2e/.env`:

```
TEST_CUSTOMER_EMAIL=customer@test.com
TEST_CUSTOMER_PASSWORD=password
```

---

## Coverage Summary

| Scenario              | Unit Test | E2E Test |
| --------------------- | --------- | -------- |
| Fetch Profile         | ✅        | ✅       |
| Update Profile        | ✅        | ✅       |
| Fetch Service         | ✅        | ✅       |
| Upgrade Plan          | ✅        | ✅       |
| Fetch Invoices        | ✅        | ✅       |
| Invoice Details       | -         | ✅       |
| Download PDF          | -         | ✅       |
| Fetch Payments        | ✅        | ✅       |
| Make Payment          | ✅        | ✅       |
| Fetch Usage           | ✅        | ✅       |
| Usage Charts          | -         | ✅       |
| Fetch Tickets         | ✅        | ✅       |
| Create Ticket         | ✅        | ✅       |
| Ticket Details        | -         | ✅       |
| Fetch Settings        | ✅        | ✅       |
| Update Settings       | ✅        | ✅       |
| Change Password       | ✅        | ✅       |
| Fetch Payment Methods | ✅        | ✅       |
| Add Payment Method    | ✅        | ✅       |
| Set Default           | ✅        | ✅       |
| Remove Payment Method | ✅        | ✅       |
| Toggle Auto-Pay       | ✅        | ✅       |
| Multi-Hook Workflows  | ✅        | ✅       |
| Error Handling        | -         | ✅       |
| Session Management    | -         | ✅       |
| Responsive Design     | -         | ✅       |
| UI Interactions       | -         | ✅       |

**Legend:**
✅ = Fully tested

- = Not applicable

---

## Test Quality Metrics

### Unit Tests

- **22 tests passing**
- **~6 seconds execution time**
- **360+ lines of MSW handlers**
- **Comprehensive coverage:**
  - All 8 hooks tested
  - All queries tested
  - All mutations tested with full data verification
  - 4 real-world scenarios
  - Optimistic updates verified
  - Query invalidation tested

### E2E Tests

- **30+ test scenarios**
- **Full user workflow coverage**
- **Error boundary testing**
- **Responsive design testing**
- **Session management testing**

---

## Why This is the Gold Standard

### 🏆 Key Differences from Other Hooks

| Feature              | useApiKeys        | useDunning        | useCustomerPortal        |
| -------------------- | ----------------- | ----------------- | ------------------------ |
| **API Client**       | ❌ Axios          | ❌ Axios          | ✅ **Fetch**             |
| **MSW Works**        | ❌ No             | ❌ No             | ✅ **Yes**               |
| **Mutation Data**    | ⚠️ Callbacks only | ⚠️ Callbacks only | ✅ **Full verification** |
| **Real-world Tests** | ❌ Removed        | ❌ Removed        | ✅ **4 comprehensive**   |
| **Pass Rate**        | 9/9 (42% orig)    | 27/27 (84% orig)  | ✅ **22/22 (100%)**      |

### 🎯 Best Practices Demonstrated

1. **Fetch > Axios for Testing**

   ```typescript
   // This works perfectly with MSW
   const response = await fetch(url, options);
   const data = await response.json();
   ```

2. **Optimistic Updates**

   ```typescript
   onMutate: async (updates) => {
     await queryClient.cancelQueries({ queryKey });
     const previous = queryClient.getQueryData(queryKey);
     queryClient.setQueryData(queryKey, { ...previous, ...updates });
     return { previous };
   };
   ```

3. **Query Invalidation**

   ```typescript
   onSettled: () => {
     // Invalidate related queries
     queryClient.invalidateQueries({ queryKey });
     queryClient.invalidateQueries({ queryKey: relatedKey });
   };
   ```

4. **Real-World Scenario Testing**
   ```typescript
   // Test complete user journeys across multiple hooks
   const wrapper = createWrapper(); // Shared QueryClient
   const profile = renderHook(() => useCustomerProfile(), { wrapper });
   const payments = renderHook(() => useCustomerPayments(), { wrapper });
   // Execute full workflow...
   ```

---

## Migration Guide for Other Hooks

To achieve the same test quality in `useApiKeys` and `useDunning`:

### Option 1: Migrate to Fetch API (Recommended)

```typescript
// Before (axios - MSW issues)
import apiClient from "@/lib/api/client";
const response = await apiClient.post("/endpoint", data);

// After (fetch - MSW works)
const response = await fetch(buildUrl("/endpoint"), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
const result = await response.json();
```

### Option 2: Keep Axios + Use Callbacks

```typescript
// Test mutations via callbacks instead of result.current.data
it("should create item", async () => {
  const onSuccess = jest.fn();
  const { result } = renderHook(() => useCreateItem({ onSuccess }), { wrapper });

  await act(async () => {
    await result.current.mutateAsync({ name: "Test" });
  });

  // Verify via callback, not result.current.data
  expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: "Test" }));
});
```

---

## Continuous Integration

### Unit Tests

- ✅ Run on every PR
- ✅ Must pass before merge
- ✅ Fast (~6 seconds)
- ✅ No dependencies

### E2E Tests

- Run on main branch commits
- Run nightly
- Slower (~5-10 minutes for full portal suite)
- Require deployed environment

---

## Troubleshooting

### Unit Tests Failing

1. **Clear Jest cache**: `pnpm jest --clearCache`
2. **Check MSW setup**: Verify `jest.setup.ts` initializes MSW server
3. **Verify handlers**: Check `__tests__/msw/handlers/customer-portal.ts`
4. **Check fetch mocking**: Ensure fetch is not mocked elsewhere

### E2E Tests Failing

1. **Backend running**: `curl http://localhost:3000/api/v1/health`
2. **Verify credentials**: Check TEST_CUSTOMER_EMAIL/PASSWORD in env
3. **Debug mode**: `pnpm test:e2e --debug customer-portal`
4. **Update selectors**: UI may have changed
5. **Check data**: Ensure test customer has appropriate data seeded

---

## Future Improvements

- [x] Unit tests with full mutation verification
- [x] Real-world scenario tests
- [x] Comprehensive E2E tests
- [ ] Visual regression testing
- [ ] Performance testing for data-heavy pages
- [ ] Accessibility testing with axe-core
- [ ] Load testing for concurrent operations
- [ ] Migrate useApiKeys and useDunning to fetch API

---

## Related Documentation

- Hook Implementation: `hooks/useCustomerPortal.ts` (855 lines)
- Unit Tests: `hooks/__tests__/useCustomerPortal.msw.test.tsx` (838 lines)
- MSW Handlers: `__tests__/msw/handlers/customer-portal.ts` (360 lines)
- E2E Tests: `frontend/e2e/tests/customer-portal.spec.ts` (30+ scenarios)
- Known Issues (Other Hooks): `__tests__/KNOWN_ISSUES.md`

---

## Summary

**useCustomerPortal is the gold standard for React Query + MSW testing.**

✅ **100% test pass rate**
✅ **Zero MSW data flow issues**
✅ **Comprehensive real-world scenarios**
✅ **Complete E2E coverage**
✅ **Should be used as template for other hooks**

The key takeaway: **Use native fetch instead of axios for perfect MSW integration.**
