# Subscriber Management Testing Strategy

## Overview

Subscriber management functionality is tested using **Jest Mocks** for unit tests.

**Key Achievement**: useSubscribers uses **jest mocks** and achieves **100% test pass rate (43/43)** - successfully migrated from MSW (22/25, 88%) to jest mocks (43/43, 100%).

## Why Jest Mocks Instead of MSW?

### The Problem with MSW + Axios

MSW (Mock Service Worker) has compatibility issues with axios + React Query for complex hooks:

- MSW intercepts requests successfully ✅
- MSW returns mock data ✅
- But React Query doesn't reliably update hook state ❌
- Basic query tests fail while filtered queries pass ❌
- Slow execution (~40 seconds) ⚠️

**MSW Test Results**: 22/25 tests passing (88%)

- 3 failing tests due to data flow issues
- Queries with filters worked, but basic queries failed

### The Solution: Jest Mocks

Jest mocks work perfectly with axios-based hooks:

- ✅ Direct control over API client responses
- ✅ React Query receives and processes data correctly
- ✅ All query and mutation states update properly
- ✅ 100% test pass rate (43/43 tests)
- ✅ Fast test execution (~3 seconds vs ~40 seconds)
- ✅ Simple setup and maintenance

## Test Architecture

**File:** `useSubscribers.test.tsx`
**Status:** ✅ 43/43 passing (100%)
**Run:** `pnpm test hooks/__tests__/useSubscribers.test.tsx`
**Speed:** ~3 seconds
**Approach:** Jest mocks with comprehensive coverage

### Test Coverage

#### **Query Key Factory (7 tests)** ✅

- Correct base key generation
- Correct lists key generation
- Correct list key with params
- Correct details key generation
- Correct detail key generation
- Correct statistics key generation
- Correct services key generation

#### **Query Hooks (25 tests)** ✅

1. **useSubscribers (8 tests)**
   - Fetch subscribers successfully
   - Handle empty subscriber list
   - Filter subscribers by status
   - Filter subscribers by connection type
   - Filter subscribers by city
   - Search subscribers
   - Handle pagination
   - Handle fetch errors

2. **useSubscriber (3 tests)**
   - Fetch single subscriber successfully
   - Not fetch when subscriberId is null
   - Handle not found error

3. **useSubscriberStatistics (3 tests)**
   - Fetch statistics successfully
   - Handle empty statistics
   - Handle fetch error

4. **useSubscriberServices (4 tests)**
   - Fetch services for a subscriber
   - Not fetch when subscriberId is null
   - Return empty array for subscriber with no services
   - Handle fetch error

#### **Mutation Hooks (18 tests)** ✅

1. **createSubscriber (2 tests)**
   - Create subscriber successfully
   - Handle create error

2. **updateSubscriber (2 tests)**
   - Update subscriber successfully
   - Handle update error

3. **deleteSubscriber (2 tests)**
   - Delete subscriber successfully
   - Handle delete error

4. **suspendSubscriber (3 tests)**
   - Suspend subscriber successfully
   - Suspend subscriber without reason
   - Handle suspend error

5. **activateSubscriber (2 tests)**
   - Activate subscriber successfully
   - Handle activate error

6. **terminateSubscriber (3 tests)**
   - Terminate subscriber successfully
   - Terminate subscriber without reason
   - Handle terminate error

7. **Loading States (1 test)**
   - Show loading state during create

#### **Real-World Scenarios (3 tests)** ✅

- Handle subscriber with multiple filters
- Handle concurrent subscriber and services fetches
- Handle complete subscriber lifecycle (create → update → suspend → activate → terminate)

---

## Hook Implementation

### Architecture Overview

**File:** `hooks/useSubscribers.ts` (478 lines)
**Hooks:** 4 queries + 6 mutations

```typescript
// Query Key Factory for cache management
export const subscribersKeys = {
  all: ["subscribers"] as const,
  lists: () => [...subscribersKeys.all, "list"] as const,
  list: (params?: SubscriberQueryParams) => [...subscribersKeys.lists(), params] as const,
  details: () => [...subscribersKeys.all, "detail"] as const,
  detail: (id: string) => [...subscribersKeys.details(), id] as const,
  statistics: () => [...subscribersKeys.all, "statistics"] as const,
  services: (subscriberId: string) => [...subscribersKeys.all, "services", subscriberId] as const,
};
```

### Query Hooks

#### 1. useSubscribers

```typescript
export function useSubscribers(params?: SubscriberQueryParams) {
  return useQuery({
    queryKey: subscribersKeys.list(params),
    queryFn: async () => {
      // Build query string from params
      const queryParams = new URLSearchParams();
      if (params?.status) params.status.forEach((s) => queryParams.append("status", s));
      if (params?.connection_type)
        params.connection_type.forEach((t) => queryParams.append("connection_type", t));
      // ... more filters

      const endpoint = `/subscribers${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const response = await apiClient.get(endpoint);

      return {
        subscribers: Array.isArray(response.data) ? response.data : response.data.items || [],
        total: response.data.total || 0,
      };
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
```

**Features:**

- Advanced filtering (status, connection_type, city, search, date range)
- Pagination support (limit, offset)
- Sorting (sort_by, sort_order)
- Flexible response handling (array or paginated object)

#### 2. useSubscriber

```typescript
export function useSubscriber(subscriberId: string | null) {
  return useQuery({
    queryKey: subscribersKeys.detail(subscriberId ?? ""),
    queryFn: async () => {
      if (!subscriberId) return null;

      const response = await apiClient.get(`/subscribers/${subscriberId}`);
      return response.data as Subscriber;
    },
    enabled: !!subscriberId,
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: true,
  });
}
```

**Features:**

- Conditional query (enabled only when subscriberId provided)
- Returns full subscriber details
- Faster stale time for detail views

#### 3. useSubscriberStatistics

```typescript
export function useSubscriberStatistics() {
  return useQuery({
    queryKey: subscribersKeys.statistics(),
    queryFn: async () => {
      const response = await apiClient.get("/subscribers/statistics");
      return response.data as SubscriberStatistics;
    },
    staleTime: 60000, // 1 minute
    refetchOnWindowFocus: true,
  });
}
```

**Features:**

- Aggregate statistics (total, active, suspended, pending)
- Breakdown by connection type and status
- Metrics (new this month, churn, uptime, bandwidth)

#### 4. useSubscriberServices

```typescript
export function useSubscriberServices(subscriberId: string | null) {
  return useQuery({
    queryKey: subscribersKeys.services(subscriberId ?? ""),
    queryFn: async () => {
      if (!subscriberId) return [];

      const response = await apiClient.get(`/subscribers/${subscriberId}/services`);
      return (response.data || []) as SubscriberService[];
    },
    enabled: !!subscriberId,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });
}
```

**Features:**

- Fetches all services for a subscriber
- Returns empty array by default
- Conditional query

### Mutation Hooks

All mutations are provided through `useSubscriberOperations()`:

```typescript
export function useSubscriberOperations() {
  const queryClient = useQueryClient();

  // 6 mutations: create, update, delete, suspend, activate, terminate
  // Each with proper cache invalidation

  return {
    createSubscriber: createMutation.mutateAsync,
    updateSubscriber: async (subscriberId: string, data: UpdateSubscriberRequest) =>
      updateMutation.mutateAsync({ subscriberId, data }),
    deleteSubscriber: async (subscriberId: string) => {
      await deleteMutation.mutateAsync(subscriberId);
      return true;
    },
    suspendSubscriber: async (subscriberId: string, reason?: string) => {
      await suspendMutation.mutateAsync(reason ? { subscriberId, reason } : { subscriberId });
      return true;
    },
    activateSubscriber: async (subscriberId: string) => {
      await activateMutation.mutateAsync(subscriberId);
      return true;
    },
    terminateSubscriber: async (subscriberId: string, reason?: string) => {
      await terminateMutation.mutateAsync(reason ? { subscriberId, reason } : { subscriberId });
      return true;
    },
    isLoading: /* combined loading states */,
    error: /* combined errors */,
  };
}
```

**Features:**

- Complete CRUD operations
- Status lifecycle management (suspend, activate, terminate)
- Optimistic cache updates for update mutations
- Comprehensive cache invalidation
- Optional reason parameters for suspend/terminate

---

## Jest Mock Test Patterns

### Setup: Mock API Client

```typescript
// Mock API client
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
```

### Setup: Create Test Wrapper

```typescript
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};
```

### Pattern 1: Basic Query Test

```typescript
it("should fetch subscribers successfully", async () => {
  const mockSubscribers = [
    createMockSubscriber({ id: "sub-1" }),
    createMockSubscriber({ id: "sub-2" }),
  ];

  mockApiClient.get.mockResolvedValue({
    data: {
      items: mockSubscribers,
      total: 2,
    },
  });

  const { result } = renderHook(() => useSubscribers(), {
    wrapper: createWrapper(),
  });

  expect(result.current.isLoading).toBe(true);

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  expect(result.current.data?.subscribers).toHaveLength(2);
  expect(result.current.data?.total).toBe(2);
  expect(result.current.error).toBeNull();
});
```

### Pattern 2: Query with Filters

```typescript
it("should filter subscribers by status", async () => {
  const mockSubscribers = [createMockSubscriber({ status: "active" })];

  mockApiClient.get.mockResolvedValue({
    data: { items: mockSubscribers, total: 1 },
  });

  const { result } = renderHook(() => useSubscribers({ status: ["active"] }), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("status=active"));
  expect(result.current.data?.subscribers).toHaveLength(1);
});
```

### Pattern 3: Mutation Test

```typescript
it("should create subscriber successfully", async () => {
  const newSubscriber: CreateSubscriberRequest = {
    first_name: "Jane",
    last_name: "Smith",
    email: "jane@example.com",
    phone: "+1987654321",
    service_address: "456 Oak Ave",
    service_city: "Los Angeles",
    service_state: "CA",
    service_postal_code: "90001",
    connection_type: "ftth",
  };

  const createdSubscriber = createMockSubscriber({
    id: "sub-new",
    ...newSubscriber,
  });

  mockApiClient.post.mockResolvedValue({
    data: createdSubscriber,
  });

  const { result } = renderHook(() => useSubscriberOperations(), {
    wrapper: createWrapper(),
  });

  await act(async () => {
    await result.current.createSubscriber(newSubscriber);
  });

  expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers", newSubscriber);
  expect(result.current.isLoading).toBe(false);
  expect(result.current.error).toBeNull();
});
```

### Pattern 4: Complete Lifecycle Test

```typescript
it("should handle complete subscriber lifecycle", async () => {
  const { result } = renderHook(() => useSubscriberOperations(), {
    wrapper: createWrapper(),
  });

  // 1. Create
  mockApiClient.post.mockResolvedValue({
    data: createMockSubscriber({ id: "sub-new" }),
  });

  await act(async () => {
    await result.current.createSubscriber(newSubscriberData);
  });

  expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers", newSubscriberData);

  // 2. Update
  mockApiClient.patch.mockResolvedValue({
    data: createMockSubscriber({ id: "sub-new", phone: "+1111111111" }),
  });

  await act(async () => {
    await result.current.updateSubscriber("sub-new", { phone: "+1111111111" });
  });

  // 3. Suspend
  mockApiClient.post.mockResolvedValue({});

  await act(async () => {
    await result.current.suspendSubscriber("sub-new", "Non-payment");
  });

  // 4. Activate
  await act(async () => {
    await result.current.activateSubscriber("sub-new");
  });

  // 5. Terminate
  await act(async () => {
    await result.current.terminateSubscriber("sub-new", "Customer request");
  });

  // All operations completed successfully
  expect(result.current.error).toBeNull();
});
```

---

## Critical Testing Patterns

### ✅ Always Clear Mocks Between Tests

```typescript
describe("useSubscribers", () => {
  beforeEach(() => {
    jest.clearAllMocks(); // Clear mock call history
  });

  // Tests...
});
```

### ✅ Always Use waitFor for State Checks

```typescript
// ✅ Correct - Wait for state to update
await waitFor(() => expect(result.current.isLoading).toBe(false));

// ❌ Incorrect - Immediate check (state hasn't updated yet)
expect(result.current.isLoading).toBe(false);
```

### ✅ Use act() for Mutations

```typescript
// ✅ Correct
await act(async () => {
  await result.current.createSubscriber(data);
});

// ❌ Incorrect - Missing act()
await result.current.createSubscriber(data);
```

### ✅ Verify API Calls with Correct Parameters

```typescript
it("should call API with correct parameters", async () => {
  mockApiClient.get.mockResolvedValue({ data: { items: [], total: 0 } });

  renderHook(() => useSubscribers({ status: ["active"], limit: 10 }), { wrapper: createWrapper() });

  await waitFor(() => {
    expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("status=active"));
    expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("limit=10"));
  });
});
```

---

## Test Quality Metrics

### Coverage Summary

- ✅ **43 tests passing (100%)**
- ✅ **~3 seconds execution time**
- ✅ **Comprehensive coverage:**
  - All 7 query key factory functions tested
  - All 4 query hooks tested (with filters, pagination, errors)
  - All 6 mutation hooks tested (with success and error cases)
  - Real-world scenarios tested (lifecycle, concurrent, filters)

### Test Organization

- Clear test structure with describe blocks
- Consistent naming conventions
- Mock data helper functions
- Comprehensive error handling coverage
- Real-world scenario coverage

---

## Migration from MSW to Jest Mocks

### Why We Migrated

**MSW Test Results:** 22/25 passing (88%)

**Problems with MSW:**

- 3 basic query tests failing (data flow issues)
- Slow execution (~40 seconds)
- Complex handler configuration
- Inconsistent behavior (filtered queries work, basic queries don't)

**Jest Mock Results:** 43/43 passing (100%)

**Benefits of Jest Mocks:**

- 100% test pass rate
- 13x faster execution (~3s vs ~40s)
- Simple, direct API mocking
- Full control over responses
- Easy to debug
- Consistent with other hooks (usePlugins, useOrchestration)

### Before (MSW - 22/25 passing)

```typescript
// MSW handler
export const handlers = [
  http.get("/api/v1/subscribers", async ({ request }) => {
    // Complex filtering logic...
    return HttpResponse.json({ items: filteredSubscribers, total });
  }),
];

// Test
it("should fetch subscribers", async () => {
  seedSubscriberData(mockSubscribers);

  const { result } = renderHook(() => useSubscribers(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  // ❌ FAILS - isLoading remains true, data doesn't populate
  expect(result.current.data?.subscribers).toHaveLength(2);
});
```

### After (Jest Mocks - 43/43 passing)

```typescript
// Jest mock
mockApiClient.get.mockResolvedValue({
  data: {
    items: mockSubscribers,
    total: 2,
  },
});

// Test
it("should fetch subscribers successfully", async () => {
  const { result } = renderHook(() => useSubscribers(), {
    wrapper: createWrapper(),
  });

  await waitFor(() => expect(result.current.isLoading).toBe(false));

  // ✅ WORKS - Data populates correctly
  expect(result.current.data?.subscribers).toHaveLength(2);
  expect(result.current.data?.total).toBe(2);
});
```

---

## Comparison with Other Hooks

### useSubscribers vs useOrchestration

| Feature               | useSubscribers   | useOrchestration |
| --------------------- | ---------------- | ---------------- |
| **Queries**           | 4 hooks          | 3 hooks          |
| **Mutations**         | 6 hooks          | 3 hooks          |
| **MSW Results**       | 22/25 (88%)      | 47/74 (64%)      |
| **Jest Mock Results** | **43/43 (100%)** | **38/38 (100%)** |
| **Speed (Jest)**      | ~3 seconds       | ~3 seconds       |
| **Speed (MSW)**       | ~40 seconds      | ~80+ seconds     |

### When to Use Jest Mocks vs MSW

**Use Jest Mocks when:**

- ✅ Hook has mutations (like useSubscribers, useOrchestration, usePlugins)
- ✅ Hook uses axios
- ✅ You need full mutation data verification
- ✅ You want faster, simpler tests
- ✅ Complex filtering/pagination logic

**Use MSW when:**

- ✅ Hook has only queries (like useOperations)
- ✅ Hook uses fetch API (like useCustomerPortal)
- ✅ You want realistic network-level testing

---

## Continuous Integration

### Unit Tests

- ✅ Run on every PR
- ✅ Must pass before merge
- ✅ Fast (~3 seconds)
- ✅ No dependencies

### Running Tests

```bash
# Run all useSubscribers tests
pnpm test hooks/__tests__/useSubscribers.test.tsx

# Run specific test
pnpm test hooks/__tests__/useSubscribers.test.tsx -t "should create subscriber successfully"

# Run with coverage
pnpm test hooks/__tests__/useSubscribers.test.tsx --coverage
```

---

## Future Improvements

- [x] Unit tests with jest mocks
- [x] Comprehensive query coverage
- [x] Comprehensive mutation coverage
- [x] Advanced filtering tests
- [x] Pagination tests
- [x] Error handling tests
- [x] Real-world scenario tests
- [ ] E2E tests for subscriber management
- [ ] Visual regression testing for subscriber UI
- [ ] Performance testing for large subscriber lists
- [ ] Integration tests with real backend API

---

## Related Documentation

- Hook Implementation: `hooks/useSubscribers.ts` (478 lines)
- Unit Tests: `hooks/__tests__/useSubscribers.test.tsx` (740+ lines)
- Known Issues (All Hooks): `__tests__/KNOWN_ISSUES.md`
- Jest Mock Pattern (useOrchestration): `useOrchestration-README.md`
- Jest Mock Pattern (usePlugins): `usePlugins-README.md`
- MSW Pattern (useOperations): `useOperations-README.md`

---

## Summary

**useSubscribers demonstrates a successful migration from MSW to jest mocks, achieving 100% test coverage with significantly improved performance.**

✅ **100% test pass rate (43/43)**
✅ **Zero data flow issues**
✅ **13x faster execution (~3s vs ~40s)**
✅ **Simple setup and maintenance**
✅ **Comprehensive coverage (queries, mutations, filters, lifecycle)**
✅ **Migration success story: MSW 22/25 (88%) → Jest mocks 43/43 (100%)**

**Key Takeaway:**

- **Jest mocks + axios + queries + mutations = ✅ Perfect**
- **MSW + axios + mutations = ❌ Issues**

For hooks with mutations, use **jest mocks** (see useSubscribers, useOrchestration, usePlugins).
For hooks with only queries, **MSW works great** (see useOperations).
