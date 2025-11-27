# MSW Testing Patterns & Best Practices

**Created**: 2025-11-14
**Based On**: 100% successful migration of 23 hooks (495 tests)

## Table of Contents

1. [Quick Start](#quick-start)
2. [Core Patterns](#core-patterns)
3. [Common Issues & Solutions](#common-issues--solutions)
4. [Advanced Patterns](#advanced-patterns)
5. [Performance Tips](#performance-tips)
6. [Debugging Guide](#debugging-guide)

---

## Quick Start

### Basic Test Structure

```typescript
/**
 * MSW-powered tests for useMyHook
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useMyHook } from "../useMyHook";
import {
  createTestQueryClient,
  createMockMyData,
  seedMyData,
  resetMyStorage,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

describe("useMyHook (MSW)", () => {
  // Helper to create wrapper with QueryClient
  const createWrapper = (queryClient?: QueryClient) => {
    const client = queryClient || createTestQueryClient();
    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };

  beforeEach(() => {
    resetMyStorage();
  });

  describe("useMyHook - fetch data", () => {
    it("should fetch data successfully", async () => {
      const mockData = [createMockMyData({ id: "1", name: "Test" })];
      seedMyData(mockData);

      const { result } = renderHook(() => useMyHook(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].name).toBe("Test");
      expect(result.current.error).toBeNull();
    });
  });
});
```

---

## Core Patterns

### Pattern 1: Basic Query Test

**Use Case**: Testing data fetching with React Query

```typescript
it("should fetch items successfully", async () => {
  // 1. Seed data into MSW storage
  const mockItems = [
    createMockItem({ id: "1", name: "Item 1" }),
    createMockItem({ id: "2", name: "Item 2" }),
  ];
  seedItemsData(mockItems);

  // 2. Render hook with QueryClient wrapper
  const { result } = renderHook(() => useItems(), {
    wrapper: createWrapper(),
  });

  // 3. Assert loading state
  expect(result.current.loading).toBe(true);

  // 4. Wait for loading to complete
  await waitFor(() => expect(result.current.loading).toBe(false));

  // 5. Assert data is correct
  expect(result.current.items).toHaveLength(2);
  expect(result.current.items[0].name).toBe("Item 1");
  expect(result.current.error).toBeNull();
});
```

**Key Points**:

- Always seed data before rendering hook
- Check loading state before and after
- Use `waitFor` for async operations
- Verify both data and error states

### Pattern 2: Mutation Test

**Use Case**: Testing create/update/delete operations

```typescript
it("should create item successfully", async () => {
  seedItemsData([]);

  const { result } = renderHook(() => useItems(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  // Perform mutation inside act()
  let createdItem;
  await act(async () => {
    createdItem = await result.current.createItem({
      name: "New Item",
      description: "Test item",
    });
  });

  // Verify mutation result
  expect(createdItem).toBeDefined();
  expect(createdItem.name).toBe("New Item");

  // Manually refresh if test QueryClient has refetchOnMount: false
  await act(async () => {
    await result.current.refreshItems();
  });

  // Verify item appears in list
  await waitFor(() => {
    expect(result.current.items).toHaveLength(1);
  });
});
```

**Key Points**:

- Wrap mutations in `act()`
- Manually refresh after mutations when using test QueryClient
- Verify both mutation result and list update

### Pattern 3: Filter/Pagination Test

**Use Case**: Testing query parameters and filtering

```typescript
it("should filter items by status", async () => {
  const mockItems = [
    createMockItem({ id: "1", status: "active" }),
    createMockItem({ id: "2", status: "active" }),
    createMockItem({ id: "3", status: "inactive" }),
  ];
  seedItemsData(mockItems);

  // Use hook with filter
  const { result } = renderHook(() => useItems({ status: "active" }), { wrapper: createWrapper() });

  await waitFor(() => expect(result.current.loading).toBe(false));

  // Should only return active items
  expect(result.current.items).toHaveLength(2);
  expect(result.current.items.every((item) => item.status === "active")).toBe(true);
});
```

**Key Points**:

- Seed diverse data for filtering
- Pass filter params to hook
- Verify filtered results

### Pattern 4: Error Handling Test

**Use Case**: Testing API error scenarios

```typescript
it("should handle fetch error gracefully", async () => {
  // Make endpoint fail with specific error
  makeApiEndpointFail("get", "/api/v1/items", "Server error", 500);

  const { result } = renderHook(() => useItems(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  // Should have error, no data
  expect(result.current.error).toBeTruthy();
  expect(result.current.items).toHaveLength(0);
});
```

**Key Points**:

- Use `makeApiEndpointFail` for controlled errors
- Verify error state is set
- Ensure data remains safe

### Pattern 5: Real-World Scenario Test

**Use Case**: Testing complex multi-step workflows

```typescript
it("should handle item lifecycle: create, update, delete", async () => {
  seedItemsData([]);

  // Use activeOnly: false to see all items including inactive
  const { result } = renderHook(() => useItems(false), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  // CREATE
  let itemId;
  await act(async () => {
    const created = await result.current.createItem({ name: "Test" });
    itemId = created.id;
  });

  await act(async () => {
    await result.current.refreshItems();
  });

  await waitFor(() => expect(result.current.items).toHaveLength(1));

  // UPDATE
  await act(async () => {
    await result.current.updateItem(itemId!, { status: "inactive" });
  });

  await act(async () => {
    await result.current.refreshItems();
  });

  await waitFor(() => {
    expect(result.current.items[0].status).toBe("inactive");
  });

  // DELETE
  await act(async () => {
    await result.current.deleteItem(itemId!);
  });

  await act(async () => {
    await result.current.refreshItems();
  });

  await waitFor(() => {
    expect(result.current.items).toHaveLength(0);
  });
});
```

**Key Points**:

- Test complete workflows, not just individual operations
- Refresh after each mutation
- Verify state at each step

---

## Common Issues & Solutions

### Issue 1: Fetch API Not Intercepted

**Symptoms**:

```
Tests fail with "Network request failed" or data is undefined
Hook uses native fetch() API
```

**Root Cause**: MSW v1 has limited support for native `fetch()` in Node/Jest environments

**Solution**: Add `whatwg-fetch` polyfill

```typescript
// jest.setup.ts
import "@testing-library/jest-dom";
import "whatwg-fetch"; // ADD THIS LINE
import { server } from "./__tests__/msw/server";
```

**Installation**:

```bash
pnpm add -D whatwg-fetch
```

**Examples**: useDunning, useRADIUS, useCreditNotes (all fixed with this solution)

---

### Issue 2: Handler URL Conflicts

**Symptoms**:

```
Multiple handlers match the same URL
Wrong handler processes the request
Tests receive unexpected data format
```

**Root Cause**: Handler registration order matters when patterns overlap

**Solution**: Use parameter-based delegation or specific route ordering

```typescript
// BAD: Both handlers match /api/v1/items/stats
rest.get('*/api/v1/items/stats', ...) // Logs stats
rest.get('*/api/v1/items/stats', ...) // Operations stats

// GOOD: Check parameter and delegate
rest.get('*/api/v1/items/stats', (req, res, ctx) => {
  const period = req.url.searchParams.get('period');

  // Different response based on parameter
  if (period) {
    return res(ctx.json(operationsStats));
  }

  return res(ctx.json(logsStats));
});
```

**Alternative**: Order handlers from specific to generic

```typescript
// server.ts
export const handlers = [
  ...specificHandlers, // Match first
  ...genericHandlers, // Fallback
];
```

**Example**: Fixed useOperations/useLogs conflict with parameter-based delegation

---

### Issue 3: Response Format Mismatch

**Symptoms**:

```
Hook expects array but receives { success, data }
normalizePlansResponse returns []
Tests fail with "Cannot read property of undefined"
```

**Root Cause**: Handler response format doesn't match hook expectations

**Solution**: Check hook code to see exact response format expected

```typescript
// HOOK CODE
function normalizePlansResponse(response: any): Plan[] {
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

// BAD HANDLER
return res(ctx.json({ success: true, data: plans }));

// GOOD HANDLER (matches hook)
return res(ctx.json(plans)); // Direct array
```

**Key**: Always read the hook's query function to understand response structure

**Example**: Fixed useBillingPlans by removing wrapper objects

---

### Issue 4: Mutation Refetch Timing

**Symptoms**:

```
After mutation, list doesn't update
waitFor times out waiting for new data
Tests fail: "Expected length: 1, Received length: 0"
```

**Root Cause**: Test QueryClient has `refetchOnMount: false`, preventing auto-refetch

**Solution**: Manually call refresh method after mutations

```typescript
// Test QueryClient config
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnMount: false,  // THIS PREVENTS AUTO-REFETCH
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}

// TEST FIX
await act(async () => {
  await result.current.createPlan(...);
});

// Manually refresh (required with test config)
await act(async () => {
  await result.current.refreshPlans();
});

await waitFor(() => {
  expect(result.current.plans).toHaveLength(1);
});
```

**Pattern**: Always call `refresh*()` method after mutations in tests

**Example**: Fixed useBillingPlans by adding manual refresh calls

---

### Issue 5: Parameter Name Mismatches

**Symptoms**:

```
Filters don't work
All data returned despite filter applied
Handler receives different param than expected
```

**Root Cause**: Test uses different parameter names than service/handler expects

**Solution**: Check service layer to see actual parameter names

```typescript
// SERVICE LAYER
export interface CampaignFilters {
  activeOnly?: boolean;  // NOT "status"
  campaignId?: string;   // NOT "campaign_id"
}

// BAD TEST
() => useCampaigns({ status: "active" })

// GOOD TEST
() => useCampaigns({ activeOnly: true })
```

**Pattern**: Always verify parameter naming in service layer

**Example**: Fixed useDunning by changing `status: "active"` to `activeOnly: true`

---

### Issue 6: ESM Dependency Issues

**Symptoms**:

```
Jest fails with "Cannot use import outside a module"
Error in nanostores or other ESM-only packages
Test suite won't even load
```

**Root Cause**: Hook imports ESM-only dependencies (e.g., BetterAuth → nanostores)

**Solution**: Mock the importing module to bypass the dependency

```typescript
// At top of test file, before imports
jest.mock("../useRealtime", () => ({
  useRealtime: jest.fn(() => ({
    connect: jest.fn(),
    disconnect: jest.fn(),
    subscribe: jest.fn(),
    isConnected: false,
  })),
}));

// Then proceed with normal imports
import { useJobs } from "../useJobs";
```

**Pattern**: Mock the immediate importing module, not the problematic dependency

**Example**: Fixed useJobs by mocking useRealtime to bypass BetterAuth

---

### Issue 7: Lifecycle Mutation Race Conditions

**Symptoms**:

```
Mutation completes but assertion fails
"Expected isSuccess to be true, received false"
Race condition between mutation and assertion
```

**Root Cause**: Not waiting for React Query's async state to settle

**Solution**: Wait for the correct state flag

```typescript
// BAD: Doesn't wait for state
await act(async () => {
  await cancelMutation.mutateAsync("job-1");
});
// State might not be updated yet!

// GOOD: Wait for state to settle
await act(async () => {
  await cancelMutation.mutateAsync("job-1");
});

await waitFor(() => {
  expect(cancelMutation.isSuccess).toBe(true);
});
```

**Pattern**: Always `waitFor` the specific state flag you need

**Example**: Fixed useJobs lifecycle test by waiting for `isSuccess`

---

## Advanced Patterns

### Pattern 1: Handler with Shared Storage

```typescript
// handlers/items.ts
import { createMockLogStats, getStoredLogStats } from "./operations";

export const itemsHandlers = [
  rest.get("*/api/v1/items/stats", (req, res, ctx) => {
    const period = req.url.searchParams.get("period");

    if (period) {
      // Get data from operations handler storage
      const stored = getStoredLogStats(period);
      return res(ctx.json(stored || createMockLogStats(period)));
    }

    // Default stats
    return res(ctx.json(createItemStats()));
  }),
];
```

**Use Case**: Multiple handlers need to share data

**Example**: useLogs and useOperations both use log stats

---

### Pattern 2: Conditional Test Skipping

```typescript
describe("useMyHook - advanced features", () => {
  const shouldRunAdvancedTests = process.env.RUN_ADVANCED_TESTS === "true";

  (shouldRunAdvancedTests ? it : it.skip)("should handle complex scenario", async () => {
    // Complex test that might be slow or fragile
  });
});
```

**Use Case**: Skip slow/experimental tests in CI

---

### Pattern 3: Custom Test Utilities

```typescript
// test-utils.tsx
export function renderHookWithQuery<TResult, TProps>(
  hook: (props: TProps) => TResult,
  props?: TProps,
  queryClient?: QueryClient
) {
  const client = queryClient || createTestQueryClient();

  return {
    ...renderHook(() => hook(props), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          {children}
        </QueryClientProvider>
      ),
    }),
    queryClient: client,
  };
}

// Usage
const { result, queryClient } = renderHookWithQuery(useItems, { status: 'active' });
```

**Use Case**: Reduce boilerplate in test files

---

### Pattern 4: Seeding Complex Relationships

```typescript
it("should handle items with related data", async () => {
  // Seed related data first
  const categories = [
    createMockCategory({ id: "cat-1", name: "Electronics" }),
    createMockCategory({ id: "cat-2", name: "Books" }),
  ];
  seedCategoriesData(categories);

  // Seed items with foreign keys
  const items = [
    createMockItem({ id: "1", categoryId: "cat-1" }),
    createMockItem({ id: "2", categoryId: "cat-2" }),
  ];
  seedItemsData(items);

  // Test hook that joins data
  const { result } = renderHook(() => useItemsWithCategories(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.items[0].category.name).toBe("Electronics");
});
```

**Use Case**: Testing hooks that join multiple data sources

---

## Performance Tips

### Tip 1: Minimize Handler Logic

```typescript
// BAD: Complex logic in handler
rest.get("*/api/v1/items", (req, res, ctx) => {
  const items = getItems();
  const filtered = items.filter(complexFilter);
  const sorted = filtered.sort(complexSort);
  const paginated = sorted.slice(start, end);
  const enriched = paginated.map(complexEnrich);
  return res(ctx.json(enriched));
});

// GOOD: Simple storage access
rest.get("*/api/v1/items", (req, res, ctx) => {
  const status = req.url.searchParams.get("status");
  const filtered = status ? items.filter((item) => item.status === status) : items;
  return res(ctx.json(filtered));
});
```

**Benefit**: Faster test execution

---

### Tip 2: Reuse Test Data

```typescript
// test-utils.tsx
export const COMMON_TEST_DATA = {
  activeItem: createMockItem({ id: "1", status: "active" }),
  inactiveItem: createMockItem({ id: "2", status: "inactive" }),
  adminUser: createMockUser({ id: "u1", role: "admin" }),
};

// In tests
seedItemsData([COMMON_TEST_DATA.activeItem]);
```

**Benefit**: Reduced setup time, consistent test data

---

### Tip 3: Parallel Test Execution

```typescript
// jest.config.js
module.exports = {
  maxWorkers: "50%", // Use half of CPU cores
  testTimeout: 10000,
};
```

**Benefit**: Faster CI/CD pipeline

---

## Debugging Guide

### Debug Step 0: Console Warnings Are NOT Suppressed

**Important**: Unlike many test setups, we do NOT suppress console warnings/errors in tests. This is intentional!

```typescript
// jest.setup.ts - NO console.error suppression
// This allows you to catch real issues:
// - useLayoutEffect warnings
// - ReactDOM.render deprecation warnings
// - Async state update warnings ("Can't perform state update on unmounted component")
```

**Why This Matters**:

- ✅ Real issues become visible immediately
- ✅ Forces fixing root causes instead of hiding symptoms
- ✅ Better test quality and reliability
- ❌ No hiding of React warnings that indicate problems

**If you see warnings**: Fix them! Don't suppress them.

### Debug Step 1: Enable MSW Logging

```typescript
// jest.setup.ts
beforeAll(() => {
  server.listen({
    onUnhandledRequest: "warn", // Log unhandled requests
  });
});
```

**Output**:

```
[MSW] Warning: captured a request without a matching request handler:
  • GET http://localhost/api/v1/items
```

---

### Debug Step 2: Log Handler Execution

```typescript
rest.get("*/api/v1/items", (req, res, ctx) => {
  console.log("[MSW] GET /api/v1/items", {
    params: Object.fromEntries(req.url.searchParams),
    storage: items.length,
  });

  return res(ctx.json(items));
});
```

---

### Debug Step 3: Inspect QueryClient State

```typescript
it("debugging test", async () => {
  const queryClient = createTestQueryClient();
  const { result } = renderHook(() => useItems(), {
    wrapper: createWrapper(queryClient),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  // Inspect cache
  const cache = queryClient.getQueryCache().getAll();
  console.log("Cache state:", cache);
});
```

---

### Debug Step 4: Verify Handler Registration

```typescript
// server.ts
console.log("Registered handlers:", handlers.length);
handlers.forEach((handler, i) => {
  console.log(`${i}: ${handler.info.path}`);
});
```

---

## Quick Reference

### Essential Imports

```typescript
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTestQueryClient, seedMyData, resetMyStorage } from "@/test-utils";
```

### Common Assertions

```typescript
// Loading states
expect(result.current.loading).toBe(true / false);

// Data presence
expect(result.current.data).toBeDefined();
expect(result.current.data).toHaveLength(n);

// Error states
expect(result.current.error).toBeNull();
expect(result.current.error).toBeTruthy();

// Specific values
expect(result.current.data[0].name).toBe("Test");
```

### Common Patterns

```typescript
// Wait for loading to complete
await waitFor(() => expect(result.current.loading).toBe(false));

// Mutation pattern
await act(async () => {
  await result.current.mutate(...);
});
await act(async () => {
  await result.current.refresh();
});

// Error simulation
makeApiEndpointFail("get", "/api/endpoint", "Error message", 500);
```

---

## Success Checklist

Before considering a test complete:

- [ ] Tests fetch data successfully
- [ ] Tests handle empty data
- [ ] Tests apply filters/pagination
- [ ] Tests handle errors gracefully
- [ ] Tests mutations (if applicable)
- [ ] Tests include real-world scenarios
- [ ] All assertions are meaningful
- [ ] No race conditions or flaky tests
- [ ] Handler matches actual API contract
- [ ] Response formats match hook expectations

---

## Resources

- **MSW Documentation**: https://mswjs.io/docs/
- **React Query Testing**: https://tanstack.com/query/latest/docs/react/guides/testing
- **Testing Library**: https://testing-library.com/docs/react-testing-library/intro/

**Last Updated**: 2025-11-14
**Based On**: 495 passing MSW tests across 23 hooks
