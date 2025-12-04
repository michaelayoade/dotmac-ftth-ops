# @dotmac/graphql

Shared GraphQL client and generated operations for TanStack Query.

## Features

- **Unified GraphQL Client**: Built on `@dotmac/http-client` for consistent auth, tenant resolution, retries, and error handling
- **TanStack Query Integration**: Generated hooks that work seamlessly with React Query
- **Type Safety**: Fully typed operations generated from GraphQL schema
- **Subscription Support**: Temporary Apollo adapter with plan to migrate to `graphql-ws`

## Installation

This is a workspace package and should be used via workspace protocol:

```json
{
  "dependencies": {
    "@dotmac/graphql": "workspace:*"
  }
}
```

## Usage

### GraphQL Client

The package exports a default client configured with auth and tenant resolution:

```tsx
import { graphqlClient } from "@dotmac/graphql";

// Make a raw GraphQL request
const data = await graphqlClient.request(
  `query GetUser($id: ID!) {
    user(id: $id) {
      id
      name
      email
    }
  }`,
  { id: "123" },
);
```

**Endpoint Configuration:**

- Default: `/api/platform/v1/admin/graphql` (matches backend route at `src/dotmac/platform/routers.py:881`)
- Environment variable: `NEXT_PUBLIC_API_URL` for absolute URLs (cross-domain deployments)
- Works in both browser and server (SSR/build) contexts
- Custom endpoint: Pass `endpoint` in config

```tsx
// Custom endpoint
const client = createGraphQLClient({
  endpoint: "/custom/graphql",
});

// Absolute URL (cross-domain)
// Set NEXT_PUBLIC_API_URL=https://api.example.com
// Client will use: https://api.example.com/api/platform/v1/admin/graphql
// Works during SSR, build-time, and browser runtime
```

**Environment Variable Behavior:**

- `NEXT_PUBLIC_API_URL` is checked in all contexts (browser, SSR, build-time)
- Next.js inlines `NEXT_PUBLIC_*` vars at build time for browser bundles
- Server-side code accesses `process.env` directly
- No special handling needed for cross-domain SSR scenarios

### TanStack Query Integration (Post-Codegen)

After running `pnpm graphql:codegen`, generated hooks will be available:

```tsx
import { useGetUserQuery } from "@dotmac/graphql/generated";

function UserProfile({ userId }: { userId: string }) {
  const { data, isLoading, error } = useGetUserQuery({
    variables: { id: userId },
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{data.user.name}</div>;
}
```

### Subscriptions (Temporary Apollo Adapter)

While migrating to TanStack Query, subscriptions use an Apollo adapter:

```tsx
import { useGraphQLSubscription } from "@dotmac/graphql";
import { DEVICE_UPDATES_SUBSCRIPTION } from "./subscriptions";

function DeviceMonitor() {
  const { data, loading, error } = useGraphQLSubscription(DEVICE_UPDATES_SUBSCRIPTION, {
    variables: { deviceType: "OLT" },
    onData: ({ data }) => {
      console.log("Device updated:", data);
    },
  });

  // Handle subscription data...
}
```

## Code Generation

Generate TypeScript types and React Query hooks from GraphQL operations:

```bash
# From project root
pnpm graphql:codegen
```

This generates:

- TypeScript types from schema
- TanStack Query hooks from operation documents
- Type-safe fetcher functions

Generated files are output to `frontend/shared/packages/graphql/generated/`.

## Migration Path

1. ✅ **Phase 1**: Set up infrastructure (client, codegen, shared package)
2. **Phase 2**: Generate types and hooks, migrate queries/mutations to TanStack Query
3. **Phase 3**: Keep Apollo for subscriptions with adapter
4. **Phase 4**: Spike `graphql-ws` client that feeds React Query cache
5. **Phase 5**: Remove Apollo entirely

See `frontend/PRODUCTION_GUIDE.md` for the latest schema/codegen workflow.

## Architecture

- **Client Layer**: `GraphQLClient` wraps `@dotmac/http-client` for GraphQL requests
- **Codegen Layer**: GraphQL Code Generator produces TypeScript + React Query hooks
- **Subscription Layer**: Temporary Apollo adapter, planned migration to `graphql-ws`
- **Auth/Tenant**: Automatic injection via underlying HTTP client

## Development

```bash
# Build the package
pnpm build

# Watch mode
pnpm dev

# Type check
pnpm type-check

# Lint
pnpm lint
```

## Dependencies

- `@shared/lib/auth`: Authentication hooks and session management
- `@dotmac/http-client`: HTTP client with auth, tenant resolution, retries
- `@tanstack/react-query`: React Query integration
- `graphql`: GraphQL core library
- `@apollo/client`: Temporary dependency for subscriptions (to be removed)
