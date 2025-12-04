# Testing Guide - ISP Ops App

This guide documents the testing infrastructure and patterns used in the ISP Ops App.

> **📋 Migration Status**: See [MSW_MIGRATION_STATUS.md](./MSW_MIGRATION_STATUS.md) for the current status of MSW migration across all test suites.

## Table of Contents

- [Overview](#overview)
- [MSW (Mock Service Worker)](#msw-mock-service-worker)
- [Test Structure](#test-structure)
- [Writing Tests](#writing-tests)
- [Best Practices](#best-practices)
- [Running Tests](#running-tests)

## Overview

Our testing infrastructure uses:

- **Jest** - Test framework
- **React Testing Library** - Component and hook testing
- **MSW (Mock Service Worker) v1** - API mocking
- **@tanstack/react-query** - Data fetching (tested with custom hooks)

## MSW (Mock Service Worker)

We use MSW v1 to intercept and mock API requests. This provides realistic network behavior without hitting real servers.

### Why MSW?

- **Realistic Testing**: Tests actual fetch/axios calls instead of mocking at the module level
- **Hermetic Tests**: No network dependencies, tests run in isolation
- **Reusable Handlers**: Same handlers work across all tests
- **Type Safety**: Handlers use the same types as production code

### Architecture

```
__tests__/
├── msw/
│   ├── server.ts              # MSW server setup
│   └── handlers/
│       ├── webhooks.ts        # Webhook API handlers
│       └── notifications.ts   # Notification API handlers
├── test-utils.tsx             # Test helper functions
└── [feature]/__tests__/       # Feature-specific tests
```

### MSW Server Setup

The MSW server is configured in `__tests__/msw/server.ts`:

```typescript
import { setupServer } from "msw/node";
import { webhookHandlers } from "./handlers/webhooks";
import { notificationHandlers } from "./handlers/notifications";

export const server = setupServer(...webhookHandlers, ...notificationHandlers);
```

The server lifecycle is managed in `jest.setup.ts`:

```typescript
beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

### Creating MSW Handlers

Handlers intercept API requests and return mock responses. They must:

1. **Use wildcard URLs** to match full URLs with host: `*/api/v1/...`
2. **Match exact response format** expected by hooks
3. **Support query parameters** for filtering/pagination
4. **Handle error cases** with appropriate status codes

Example webhook handler:

```typescript
import { http, HttpResponse } from "msw";

export const webhookHandlers = [
  // GET endpoint with filtering
  http.get("*/api/v1/webhooks/subscriptions", (req) => {
    const url = new URL(req.url);
    const offset = parseInt(url.searchParams.get("offset") || "0");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const event = url.searchParams.get("event_type");

    let filtered = webhookSubscriptions;
    if (event) {
      filtered = webhookSubscriptions.filter((wh) => wh.events.includes(event));
    }

    const paginated = filtered.slice(offset, offset + limit);

    // Return array directly (not wrapped in { data: [...] })
    return HttpResponse.json(paginated);
  }),

  // POST endpoint
  http.post("*/api/v1/webhooks/subscriptions", async (req) => {
    const data = await req.json<Partial<WebhookSubscription>>();
    const newWebhook = createMockWebhook(data);
    webhookSubscriptions.push(newWebhook);
    return HttpResponse.json(newWebhook, { status: 201 });
  }),

  // DELETE endpoint
  http.delete("*/api/v1/webhooks/subscriptions/:id", (req) => {
    const { id } = req.params;
    const index = webhookSubscriptions.findIndex((wh) => wh.id === id);

    if (index === -1) {
      return HttpResponse.json({ error: "Not found", code: "NOT_FOUND" }, { status: 404 });
    }

    webhookSubscriptions.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
```

### In-Memory Storage

Each handler module maintains in-memory storage that's reset between tests:

```typescript
// In-memory storage
let webhookSubscriptions: WebhookSubscription[] = [];
let deliveries: WebhookDelivery[] = [];
let nextWebhookId = 1;

// Reset function called in beforeEach
export function resetWebhookStorage() {
  webhookSubscriptions = [];
  deliveries = [];
  nextWebhookId = 1;
}

// Helper to seed test data
export function seedWebhookData(
  webhooks: WebhookSubscription[],
  deliveriesData: WebhookDelivery[],
) {
  webhookSubscriptions = [...webhooks];
  deliveries = [...deliveriesData];
}
```

### Mock Data Factories

Create consistent mock data with factory functions:

```typescript
export function createMockWebhook(overrides?: Partial<WebhookSubscription>): WebhookSubscription {
  return {
    id: `wh-${nextWebhookId++}`,
    url: "https://example.com/webhook",
    description: "Test webhook",
    events: ["subscriber.created"],
    is_active: true,
    retry_enabled: true,
    max_retries: 3,
    timeout_seconds: 30,
    success_count: 0,
    failure_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}
```

## Test Structure

### Hook Tests with MSW

Hook tests should:

1. **Reset storage** in `beforeEach`
2. **Seed mock data** before rendering the hook
3. **Assert on custom hook API** (not React Query internals)
4. **Wait for loading states** to complete

Example test structure:

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { useWebhooks } from "../useWebhooks";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetWebhookStorage,
  createMockWebhook,
  seedWebhookData,
} from "../../__tests__/test-utils";

describe("useWebhooks (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetWebhookStorage(); // Clear MSW storage
  });

  afterEach(() => {
    queryClient.clear();
  });

  it("should fetch webhooks successfully", async () => {
    // 1. Seed test data in MSW
    const mockWebhooks = [
      createMockWebhook({ id: "wh-1", url: "https://example.com/webhook" }),
      createMockWebhook({ id: "wh-2", url: "https://example.com/webhook2" }),
    ];
    seedWebhookData(mockWebhooks, []);

    // 2. Render hook with QueryClient wrapper
    const { result } = renderHook(() => useWebhooks(), {
      wrapper: createQueryWrapper(queryClient),
    });

    // 3. Verify loading state
    expect(result.current.loading).toBe(true);

    // 4. Wait for data to load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // 5. Assert on custom hook API (NOT React Query internals)
    expect(result.current.webhooks).toHaveLength(2);
    expect(result.current.webhooks[0].id).toBe("wh-1");
    expect(result.current.error).toBeNull();
  });
});
```

### Key Differences from React Query Tests

❌ **Don't test React Query internals:**

```typescript
// WRONG - Testing React Query API
expect(result.current.isLoading).toBe(true);
expect(result.current.data?.data).toHaveLength(2);
expect(result.current.isError).toBe(false);
```

✅ **Do test custom hook API:**

```typescript
// CORRECT - Testing custom hook contract
expect(result.current.loading).toBe(true);
expect(result.current.webhooks).toHaveLength(2);
expect(result.current.error).toBeNull();
```

### Testing Filters and Pagination

```typescript
it("should filter webhooks by event", async () => {
  const webhooks = [
    createMockWebhook({ events: ["subscriber.created"] }),
    createMockWebhook({ events: ["subscriber.updated"] }),
    createMockWebhook({ events: ["subscriber.created", "subscriber.deleted"] }),
  ];

  seedWebhookData(webhooks, []);

  const { result } = renderHook(() => useWebhooks({ eventFilter: "subscriber.created" }), {
    wrapper: createQueryWrapper(queryClient),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  // Should only return webhooks with subscriber.created event
  expect(result.current.webhooks).toHaveLength(2);
  expect(result.current.webhooks.every((wh) => wh.events.includes("subscriber.created"))).toBe(
    true,
  );
});

it("should handle pagination", async () => {
  const webhooks = Array.from({ length: 25 }, (_, i) => createMockWebhook({ id: `wh-${i + 1}` }));

  seedWebhookData(webhooks, []);

  const { result } = renderHook(() => useWebhooks({ page: 2, limit: 10 }), {
    wrapper: createQueryWrapper(queryClient),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  // Page 2 with limit 10 should have webhooks 11-20
  expect(result.current.webhooks).toHaveLength(10);
  expect(result.current.webhooks[0].id).toBe("wh-11");
});
```

### Testing Error Handling

Use the `makeApiEndpointFail` helper to simulate errors:

```typescript
import { makeApiEndpointFail } from "../../__tests__/test-utils";

it("should handle fetch error", async () => {
  // Make the endpoint fail
  makeApiEndpointFail("get", "/api/v1/webhooks/subscriptions", "Server error", 500);

  const { result } = renderHook(() => useWebhooks(), {
    wrapper: createQueryWrapper(queryClient),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  expect(result.current.error).toBeTruthy();
  expect(result.current.webhooks).toHaveLength(0);
});
```

### Testing Mutations

```typescript
it("should create webhook", async () => {
  seedWebhookData([], []);

  const { result } = renderHook(() => useWebhooks(), {
    wrapper: createQueryWrapper(queryClient),
  });

  await waitFor(() => expect(result.current.loading).toBe(false));

  // Call mutation
  const newWebhook = await act(async () => {
    return await result.current.createWebhook({
      url: "https://example.com/new-webhook",
      events: ["subscriber.created"],
      description: "New webhook",
    });
  });

  // Verify mutation result
  expect(newWebhook.id).toBeDefined();
  expect(newWebhook.url).toBe("https://example.com/new-webhook");

  // Verify hook state updated
  await waitFor(() => {
    expect(result.current.webhooks).toHaveLength(1);
  });
});
```

## Best Practices

### 1. URL Patterns Must Use Wildcards

Always prefix API paths with `*` to match full URLs:

```typescript
// ✅ CORRECT - Matches http://localhost:3000/api/v1/webhooks
rest.get('*/api/v1/webhooks', ...)

// ❌ WRONG - Only matches relative path /api/v1/webhooks
rest.get('/api/v1/webhooks', ...)
```

### 2. Response Format Must Match Hook Expectations

Check what the hook expects and match exactly:

```typescript
// Hook code:
const response = await apiClient.get("/webhooks/subscriptions");
const data = (response.data || []) as any[]; // Expects array directly

// Handler should return:
return res(ctx.json(paginated)); // Array directly

// NOT:
return res(ctx.json({ data: paginated })); // ❌ Wrapped in object
```

### 3. Parameter Names Must Match

```typescript
// Hook sends: ?status=success
if (statusFilter) params.append("status", statusFilter);

// Handler must read: status (not statusFilter)
const status = url.searchParams.get("status");
```

### 4. Reset Storage Between Tests

Always reset in-memory storage in `beforeEach`:

```typescript
beforeEach(() => {
  queryClient = createTestQueryClient();
  resetWebhookStorage(); // ✅ Clear MSW data
  resetNotificationStorage(); // ✅ Clear MSW data
});
```

### 5. Use Factory Functions

Create mock data with factory functions for consistency:

```typescript
// ✅ GOOD - Using factory
const webhook = createMockWebhook({
  url: "https://example.com/webhook",
  events: ["subscriber.created"],
});

// ❌ BAD - Manual object creation (missing required fields)
const webhook = {
  id: "wh-1",
  url: "https://example.com/webhook",
  // Missing: events, is_active, created_at, etc.
};
```

### 6. Test Real-World Scenarios

Include tests that combine multiple operations:

```typescript
it("should handle webhook with mixed delivery statuses", async () => {
  const webhook = createMockWebhook({
    id: "wh-1",
    success_count: 10,
    failure_count: 3,
  });

  const deliveries = [
    ...Array.from({ length: 10 }, () => createMockDelivery("wh-1", { status: "success" })),
    ...Array.from({ length: 3 }, () => createMockDelivery("wh-1", { status: "failed" })),
  ];

  seedWebhookData([webhook], deliveries);

  // Test both hooks work together
  const { result: webhookResult } = renderHook(() => useWebhooks(), {
    wrapper: createQueryWrapper(queryClient),
  });

  const { result: deliveriesResult } = renderHook(() => useWebhookDeliveries("wh-1"), {
    wrapper: createQueryWrapper(queryClient),
  });

  await waitFor(() => {
    expect(webhookResult.current.loading).toBe(false);
    expect(deliveriesResult.current.loading).toBe(false);
  });

  // Verify both queries work correctly
  expect(webhookResult.current.webhooks[0].success_count).toBe(10);
  expect(webhookResult.current.webhooks[0].failure_count).toBe(3);
  expect(deliveriesResult.current.deliveries).toHaveLength(13);
});
```

## Running Tests

### Run all tests

```bash
pnpm test
```

### Run tests in watch mode

```bash
pnpm test:watch
```

### Run specific test file

```bash
pnpm test hooks/__tests__/useWebhooks.msw.test.tsx
```

### Run with coverage

```bash
pnpm test:coverage
```

### Coverage thresholds

We maintain 70% coverage across all metrics:

```javascript
// jest.config.js
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

## Migrating Tests to MSW

When migrating existing tests:

1. **Remove manual mocks** of `jest.mock('@/lib/api/client')`
2. **Create MSW handlers** for the API endpoints
3. **Update test assertions** to use custom hook API
4. **Add storage reset** in `beforeEach`
5. **Seed test data** with factory functions

Example migration:

```typescript
// BEFORE (jest.mock)
jest.mock("@/lib/api/client");
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
mockApiClient.get.mockResolvedValue({ data: { data: mockWebhooks } });

// AFTER (MSW)
import { seedWebhookData, createMockWebhook } from "../test-utils";

beforeEach(() => {
  resetWebhookStorage();
});

it("test", async () => {
  const mockWebhooks = [createMockWebhook()];
  seedWebhookData(mockWebhooks, []);
  // ... rest of test
});
```

## Common Issues

### Issue: Empty arrays returned despite seeding data

**Cause**: URL pattern doesn't match
**Solution**: Add wildcard prefix to URL patterns

```typescript
// ❌ Wrong
rest.get('/api/v1/webhooks', ...)

// ✅ Correct
rest.get('*/api/v1/webhooks', ...)
```

### Issue: Hook receiving undefined/null data

**Cause**: Response format mismatch
**Solution**: Check what format the hook expects by reading the hook code

### Issue: Filters not working

**Cause**: Parameter name mismatch between hook and handler
**Solution**: Verify parameter names match exactly

### Issue: Tests fail intermittently

**Cause**: Storage not reset between tests
**Solution**: Add reset functions to `beforeEach`

## Resources

- [MSW Documentation](https://mswjs.io/docs/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Query Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing)
