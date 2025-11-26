# GraphQL Testing Guide with MSW

This guide explains how to test GraphQL hooks using MSW (Mock Service Worker) in this project.

## Overview

GraphQL testing in this project uses MSW v1.3.5 with specialized handler files organized by domain:

- **`graphql-fiber.ts`** - Fiber infrastructure queries (cables, distribution points, splice points, service areas)
- **`graphql-subscriber.ts`** - Subscriber dashboard queries (subscribers, sessions, metrics)
- **`graphql.ts`** - General-purpose GraphQL handlers (wireless, shared utilities)

## GraphQL Handler Structure

### How GraphQL Handlers Work

Unlike REST endpoints that match URLs, GraphQL handlers match by:

1. **Operation name** (e.g., "FiberCableList", "SubscriberDashboard")
2. **Operation type** (query vs mutation)

```typescript
import { graphql } from 'msw';

export const myHandlers = [
  // Query handler
  graphql.query('MyQueryName', (req, res, ctx) => {
    const variables = req.variables;

    return res(
      ctx.data({
        myQueryName: {
          // Your data here
        }
      })
    );
  }),

  // Mutation handler
  graphql.mutation('MyMutationName', (req, res, ctx) => {
    const input = req.variables.input;

    return res(
      ctx.data({
        myMutation: {
          success: true,
          result: { ... }
        }
      })
    );
  }),
];
```

### GraphQL Response Format

All GraphQL responses follow this structure:

```typescript
{
  data: {
    queryOrMutationName: {
      // Actual result data
    }
  },
  errors?: [{
    message: string,
    extensions?: {
      code: string
    }
  }]
}
```

## Testing GraphQL Hooks

### 1. Import the Handler and Utilities

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { createQueryWrapper } from "@/__tests__/test-utils";
import {
  seedFiberData,
  clearFiberData,
  createMockFiberCable,
} from "@/__tests__/msw/handlers/graphql-fiber";
```

### 2. Set Up Test Data

```typescript
describe("useFiberGraphQL", () => {
  beforeEach(() => {
    clearFiberData();

    // Seed with mock data
    seedFiberData({
      cables: [
        createMockFiberCable({
          id: "cable-1",
          name: "Test Cable",
          status: "ACTIVE",
        }),
      ],
    });
  });
});
```

### 3. Test the Hook

```typescript
it("should fetch fiber cables", async () => {
  const { result } = renderHook(() => useFiberCablesQuery({ limit: 10 }), {
    wrapper: createQueryWrapper(),
  });

  await waitFor(() => {
    expect(result.current.data?.fiberCables.cables).toHaveLength(1);
  });

  expect(result.current.data?.fiberCables.cables[0]).toMatchObject({
    id: "cable-1",
    name: "Test Cable",
    status: "ACTIVE",
  });
});
```

### 4. Test Error Scenarios

```typescript
import { server } from "@/__tests__/msw/server";
import { graphql } from "msw";
import { createGraphQLError } from "@/__tests__/msw/handlers/graphql";

it("should handle GraphQL errors", async () => {
  // Override the handler for this test
  server.use(
    graphql.query("FiberCableList", (req, res, ctx) => {
      return res(ctx.errors([createGraphQLError("Network unavailable", "NETWORK_ERROR")]));
    }),
  );

  const { result } = renderHook(() => useFiberCablesQuery({ limit: 10 }), {
    wrapper: createQueryWrapper(),
  });

  await waitFor(() => {
    expect(result.current.error).toBeDefined();
  });
});
```

## Available Helper Functions

### Fiber Infrastructure (`graphql-fiber.ts`)

```typescript
// Factory functions
createMockFiberCable(overrides?: Partial<FiberCable>): FiberCable
createMockSplicePoint(overrides?: Partial<SplicePoint>): SplicePoint
createMockDistributionPoint(overrides?: Partial<DistributionPoint>): DistributionPoint
createMockServiceArea(overrides?: Partial<ServiceArea>): ServiceArea

// Seed data
seedFiberData(data: {
  cables?: Partial<FiberCable>[];
  splicePoints?: Partial<SplicePoint>[];
  distributionPoints?: Partial<DistributionPoint>[];
  serviceAreas?: Partial<ServiceArea>[];
})

// Clear data
resetFiberData()
```

### Subscriber Dashboard (`graphql-subscriber.ts`)

```typescript
// Factory functions
createMockSubscriber(overrides?: Partial<Subscriber>): Subscriber
createMockSession(overrides?: Partial<Session>): Session

// Seed data
seedSubscribers(subscribers: Partial<Subscriber>[])

// Clear data
clearSubscribers()
```

### General Utilities (`graphql.ts`)

```typescript
// Response helpers
createMockGraphQLResponse<T>(data: T): { data: T }
createGraphQLError(message: string, code?: string): GraphQLError
createPaginatedResponse<T>(items: T[], totalCount: number, limit: number, offset: number)

// Seed functions
seedFiberData({ cables, distributionPoints, serviceAreas })
seedWirelessData({ accessPoints, clients })
seedSubscriberData({ subscribers })

// Clear functions
clearFiberData()
clearWirelessData()
clearSubscriberData()
clearAllGraphQLData()
```

## Common Patterns

### Pattern 1: Testing Pagination

```typescript
it("should paginate results", async () => {
  // Seed 100 cables
  seedFiberData({
    cables: Array.from({ length: 100 }, (_, i) => createMockFiberCable({ id: `cable-${i}` })),
  });

  const { result } = renderHook(() => useFiberCablesQuery({ limit: 10, offset: 0 }), {
    wrapper: createQueryWrapper(),
  });

  await waitFor(() => {
    expect(result.current.data?.fiberCables.cables).toHaveLength(10);
    expect(result.current.data?.fiberCables.totalCount).toBe(100);
    expect(result.current.data?.fiberCables.hasNextPage).toBe(true);
  });
});
```

### Pattern 2: Testing Filters

```typescript
it("should filter by status", async () => {
  seedFiberData({
    cables: [
      createMockFiberCable({ id: "cable-1", status: "ACTIVE" }),
      createMockFiberCable({ id: "cable-2", status: "INACTIVE" }),
    ],
  });

  const { result } = renderHook(() => useFiberCablesQuery({ status: "ACTIVE" }), {
    wrapper: createQueryWrapper(),
  });

  await waitFor(() => {
    expect(result.current.data?.fiberCables.cables).toHaveLength(1);
    expect(result.current.data?.fiberCables.cables[0].status).toBe("ACTIVE");
  });
});
```

### Pattern 3: Testing Search

```typescript
it("should search cables", async () => {
  seedFiberData({
    cables: [
      createMockFiberCable({ id: "cable-1", name: "Main Trunk Cable" }),
      createMockFiberCable({ id: "cable-2", name: "Secondary Feed" }),
    ],
  });

  const { result } = renderHook(() => useFiberCablesQuery({ search: "trunk" }), {
    wrapper: createQueryWrapper(),
  });

  await waitFor(() => {
    expect(result.current.data?.fiberCables.cables).toHaveLength(1);
    expect(result.current.data?.fiberCables.cables[0].name).toContain("Trunk");
  });
});
```

### Pattern 4: Testing Mutations

```typescript
it("should create a fiber cable", async () => {
  const { result } = renderHook(() => useCreateFiberCableMutation(), {
    wrapper: createQueryWrapper(),
  });

  act(() => {
    result.current.mutate({
      name: "New Cable",
      fiberType: "SINGLE_MODE",
      totalStrands: 12,
    });
  });

  await waitFor(() => {
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data?.createFiberCable.name).toBe("New Cable");
  });
});
```

## Adding New GraphQL Handlers

### Step 1: Choose the Right File

- **Domain-specific queries** → Add to existing domain file (fiber, subscriber)
- **New domain** → Create a new `graphql-{domain}.ts` file
- **General/shared** → Add to `graphql.ts`

### Step 2: Create the Handler

```typescript
// In graphql-fiber.ts or your new file
graphql.query('YourQueryName', (req, res, ctx) => {
  const { limit = 50, offset = 0, ...filters } = req.variables;

  // Filter your data
  let results = Array.from(yourDataMap.values());

  // Apply filters...

  // Paginate
  const paginatedResults = results.slice(offset, offset + limit);
  const hasNextPage = offset + limit < results.length;

  return res(
    ctx.data({
      yourQueryName: {
        items: paginatedResults,
        totalCount: results.length,
        hasNextPage,
      },
    })
  );
}),
```

### Step 3: Export the Handler

```typescript
export const graphqlYourDomainHandlers = [
  // ... your handlers
];
```

### Step 4: Register in Server

```typescript
// In __tests__/msw/server.ts
import { graphqlYourDomainHandlers } from "./handlers/graphql-your-domain";

export const handlers = [
  // ... other handlers
  ...graphqlYourDomainHandlers,
];
```

## Best Practices

1. **Use Factory Functions** - Create reusable mock data factories
2. **Clear Between Tests** - Always clear data in `beforeEach`
3. **Realistic Data** - Use realistic IDs, timestamps, and values
4. **Test Edge Cases** - Empty results, errors, pagination boundaries
5. **Isolation** - Each test should be independent
6. **Descriptive Names** - Use clear, descriptive test names

## Troubleshooting

### Handler Not Matching

**Problem**: MSW not intercepting GraphQL request

**Solutions**:

1. Check operation name matches exactly (case-sensitive)
2. Verify handler is added to server.ts
3. Check if handler is registered before test runs
4. Use `server.printHandlers()` to debug

### Data Not Updating

**Problem**: Test sees old data from previous test

**Solutions**:

1. Call clear function in `beforeEach`
2. Use `jest.clearAllMocks()`
3. Reset server handlers: `server.resetHandlers()`

### Type Mismatches

**Problem**: TypeScript errors on mock data

**Solutions**:

1. Use factory functions with proper types
2. Add `as const` for literal types
3. Check generated types match schema

## References

- [MSW Documentation](https://mswjs.io/docs/)
- [MSW GraphQL](https://mswjs.io/docs/api/graphql)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- Project handlers: `__tests__/msw/handlers/graphql-*.ts`
