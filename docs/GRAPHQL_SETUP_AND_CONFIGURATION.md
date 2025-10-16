# GraphQL Setup and Configuration Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Backend Configuration](#backend-configuration)
4. [Frontend Configuration](#frontend-configuration)
5. [Common Issues and Solutions](#common-issues-and-solutions)
6. [Best Practices](#best-practices)
7. [Migration Checklist](#migration-checklist)

---

## Overview

This document describes the complete GraphQL setup for the DotMac FTTH Operations Platform, including backend (Strawberry GraphQL + FastAPI) and frontend (Apollo Client + React) configuration.

### Key Technologies
- **Backend**: Strawberry GraphQL with FastAPI integration
- **Frontend**: Apollo Client v4.0.7 with React hooks
- **Code Generation**: GraphQL Code Generator
- **Type Safety**: End-to-end TypeScript types from GraphQL schema

### Benefits
- **Performance**: 66-85% reduction in HTTP requests
- **Type Safety**: 100% type coverage from backend to frontend
- **Developer Experience**: Auto-completion and compile-time error detection
- **Efficiency**: Eliminates N+1 queries with DataLoaders

---

## Architecture

### Backend Stack
```
FastAPI Application
    ├── Strawberry GraphQL Router (/api/v1/graphql)
    ├── GraphQL Schema (strawberry.Schema)
    │   ├── Query Types (RadiusQueries, CustomerQueries, etc.)
    │   ├── Mutation Types
    │   ├── GraphQL Types (Customer, Subscriber, etc.)
    │   └── DataLoaders (batching and caching)
    └── Context (database session, user auth)
```

### Frontend Stack
```
Next.js Application
    ├── Apollo Client (GraphQL client)
    ├── Generated Types (lib/graphql/generated.ts)
    ├── GraphQL Queries (lib/graphql/queries/*.graphql)
    └── Custom Hooks (hooks/use*GraphQL.ts)
```

---

## Backend Configuration

### 1. GraphQL Router Setup

**File**: `src/dotmac/platform/routers.py`

```python
# ✅ CORRECT CONFIGURATION
from strawberry.fastapi import GraphQLRouter
from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.schema import schema

# GraphQLRouter with explicit path
graphql_app = GraphQLRouter(
    schema,
    path="/api/v1/graphql",
    # DO NOT provide context_getter - Strawberry handles it automatically
)

# Add router directly without prefix
app.include_router(graphql_app)
```

**❌ COMMON MISTAKE**: Adding `context_getter` parameter

```python
# ❌ WRONG - This causes FastAPI to treat parameters as query params
async def get_context(request: Any) -> Context:
    return await Context.get_context(request)

graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context,  # ❌ Causes validation errors
)
```

**Why This Fails:**
- FastAPI's dependency injection interprets function parameters as query parameters
- Results in error: `{"detail":[{"type":"missing","loc":["query","request"],"msg":"Field required"}]}`
- Strawberry automatically provides request/response to resolvers via `info.context`

### 2. GraphQL Schema Structure

**File**: `src/dotmac/platform/graphql/schema.py`

```python
import strawberry
from dotmac.platform.graphql.queries.radius import RadiusQueries
from dotmac.platform.graphql.queries.customer import CustomerQueries
# ... other query imports

@strawberry.type
class Query(
    RadiusQueries,
    CustomerQueries,
    # ... other query classes
):
    """Root query type combining all domain queries."""

    @strawberry.field(description="API version")
    def version(self) -> str:
        return "1.0.0"

schema = strawberry.Schema(query=Query)
```

### 3. GraphQL Context

**File**: `src/dotmac/platform/graphql/context.py`

```python
import strawberry
from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.fastapi import BaseContext

@strawberry.type
class Context(BaseContext):
    """GraphQL execution context."""

    request: Request
    db: AsyncSession
    current_user: UserInfo | None = None
    loaders: DataLoaderRegistry

    @staticmethod
    async def get_context(request: Request) -> "Context":
        """Create GraphQL context from FastAPI request."""
        db_session = AsyncSessionLocal()

        # Extract user from token if present
        current_user = None
        try:
            auth_header = request.headers.get("Authorization", "")
            token = auth_header.replace("Bearer ", "").strip()

            if token:
                payload = jwt_service.verify_token(token)
                current_user = UserInfo(
                    user_id=str(payload.get("sub")),
                    tenant_id=payload.get("tenant_id"),
                    roles=list(payload.get("roles", [])),
                )
        except Exception:
            pass  # Guest access allowed

        return Context(
            request=request,
            db=db_session,
            current_user=current_user
        )
```

### 4. Query Resolver Example

**File**: `src/dotmac/platform/graphql/queries/customer.py`

```python
import strawberry
from dotmac.platform.graphql.context import Context
from dotmac.platform.graphql.types.customer import Customer

@strawberry.type
class CustomerQueries:
    """GraphQL queries for customer management."""

    @strawberry.field(description="Get customer by ID")
    async def customer(
        self,
        info: strawberry.Info[Context],
        id: strawberry.ID,
        include_activities: bool = True,
    ) -> Optional[Customer]:
        """Fetch single customer with batched activities via DataLoaders."""
        db = info.context.db

        # Fetch customer
        stmt = select(CustomerModel).where(CustomerModel.id == UUID(id))
        result = await db.execute(stmt)
        customer_model = result.scalar_one_or_none()

        if not customer_model:
            return None

        customer = Customer.from_model(customer_model)

        # Batch load activities if requested
        if include_activities:
            activity_loader = info.context.loaders.get_customer_activity_loader()
            activities_list = await activity_loader.load_many([str(customer_model.id)])
            if activities_list and activities_list[0]:
                customer.activities = [
                    CustomerActivity.from_model(a) for a in activities_list[0]
                ]

        return customer
```

### 5. DataLoader Setup

**File**: `src/dotmac/platform/graphql/loaders.py`

```python
from strawberry.dataloader import DataLoader

class DataLoaderRegistry:
    """Central registry for all DataLoaders."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self._customer_activity_loader: Optional[DataLoader] = None

    def get_customer_activity_loader(self) -> DataLoader:
        """Get or create customer activity DataLoader."""
        if self._customer_activity_loader is None:
            self._customer_activity_loader = DataLoader(
                load_fn=self._batch_load_customer_activities
            )
        return self._customer_activity_loader

    async def _batch_load_customer_activities(
        self, customer_ids: list[str]
    ) -> list[list[CustomerActivityModel]]:
        """Batch load activities for multiple customers."""
        stmt = (
            select(CustomerActivityModel)
            .where(CustomerActivityModel.customer_id.in_(customer_ids))
            .order_by(CustomerActivityModel.created_at.desc())
        )

        result = await self.db.execute(stmt)
        activities = result.scalars().all()

        # Group by customer_id
        activities_by_customer = {cid: [] for cid in customer_ids}
        for activity in activities:
            activities_by_customer[str(activity.customer_id)].append(activity)

        return [activities_by_customer[cid] for cid in customer_ids]
```

---

## Frontend Configuration

### 1. Apollo Client Setup

**File**: `frontend/apps/base-app/lib/graphql/client.ts`

```typescript
import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// HTTP link to GraphQL endpoint
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/graphql`
    : 'http://localhost:8000/api/v1/graphql',
  credentials: 'include', // Include cookies
});

// Auth link - adds token to requests
const authLink = setContext((_, { headers }) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
      'X-Tenant-ID': localStorage.getItem('tenant_id') || 'default',
    },
  };
});

// Error link - handles GraphQL and network errors
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      console.error('GraphQL Error:', message);

      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Trigger logout or token refresh
        window.location.href = '/login';
      }
    });
  }

  if (networkError) {
    console.error('GraphQL Network Error:', networkError.message);
  }
});

// Configure cache
const cache = new InMemoryCache({
  typePolicies: {
    Customer: {
      keyFields: ['id'],
    },
    Query: {
      fields: {
        customers: {
          merge(existing = [], incoming) {
            return incoming;
          },
        },
      },
    },
  },
});

// Create Apollo Client instance
export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache,
  defaultOptions: {
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
  },
});
```

### 2. Code Generation Configuration

**File**: `frontend/apps/base-app/codegen.ts`

```typescript
import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  overwrite: true,
  schema: {
    [process.env.GRAPHQL_SCHEMA_URL || 'http://localhost:8000/api/v1/graphql']: {
      headers: {
        'X-Tenant-ID': process.env.GRAPHQL_TENANT_ID || 'default',
        'Content-Type': 'application/json',
      },
    },
  },
  documents: ['app/**/*.graphql', 'lib/graphql/**/*.graphql'],
  generates: {
    'lib/graphql/generated.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-apollo',
      ],
      config: {
        withHooks: true,
        withComponent: false,
        withHOC: false,
        skipTypename: false,
        enumsAsTypes: true,
        scalars: {
          DateTime: 'string',
          BigInt: 'number',
          Decimal: 'number',
        },
      },
    },
  },
};

export default config;
```

### 3. GraphQL Query Files

**File**: `frontend/apps/base-app/lib/graphql/queries/customers.graphql`

```graphql
query CustomerList(
  $limit: Int = 50
  $offset: Int = 0
  $status: CustomerStatusEnum
  $search: String
  $includeActivities: Boolean = false
  $includeNotes: Boolean = false
) {
  customers(
    limit: $limit
    offset: $offset
    status: $status
    search: $search
    includeActivities: $includeActivities
    includeNotes: $includeNotes
  ) {
    customers {
      id
      customerNumber
      firstName
      lastName
      email
      status

      activities @include(if: $includeActivities) {
        id
        activityType
        title
        createdAt
      }

      notes @include(if: $includeNotes) {
        id
        subject
        content
        createdAt
      }
    }
    totalCount
    hasNextPage
  }
}
```

### 4. Wrapper Hook

**File**: `frontend/apps/base-app/hooks/useCustomersGraphQL.ts`

```typescript
import { useCustomerListQuery } from '@/lib/graphql/generated';

export interface UseCustomerListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  includeActivities?: boolean;
  includeNotes?: boolean;
  enabled?: boolean;
}

export function useCustomerListGraphQL(options: UseCustomerListOptions = {}) {
  const {
    page = 1,
    pageSize = 20,
    search,
    status,
    includeActivities = false,
    includeNotes = false,
    enabled = true,
  } = options;

  const offset = (page - 1) * pageSize;

  const { data, loading, error, refetch } = useCustomerListQuery({
    variables: {
      limit: pageSize,
      offset,
      search: search || undefined,
      status: status as any || undefined,
      includeActivities,
      includeNotes,
    },
    skip: !enabled,
    pollInterval: 30000, // Refresh every 30 seconds
  });

  // Transform to match component expectations
  const customers = data?.customers?.customers ?? [];
  const totalCount = data?.customers?.totalCount ?? 0;
  const hasNextPage = data?.customers?.hasNextPage ?? false;

  return {
    customers,
    total: totalCount,
    hasNextPage,
    isLoading: loading,
    error: error?.message,
    refetch,
  };
}
```

### 5. Component Usage

**File**: `frontend/apps/base-app/app/dashboard/customers/page.tsx`

```typescript
'use client';

import { useCustomerListGraphQL } from '@/hooks/useCustomersGraphQL';

export default function CustomersPage() {
  const { customers, isLoading, error } = useCustomerListGraphQL({
    status: 'active',
    includeActivities: false, // Only load when needed
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {customers.map(customer => (
        <div key={customer.id}>
          {customer.firstName} {customer.lastName}
        </div>
      ))}
    </div>
  );
}
```

---

## Common Issues and Solutions

### Issue 1: Query Parameter Validation Error

**Error:**
```json
{"detail":[{"type":"missing","loc":["query","request"],"msg":"Field required"}]}
```

**Root Cause:**
- Custom `context_getter` function parameters are interpreted as FastAPI query parameters
- FastAPI's dependency injection system treats ANY parameter as a dependency

**Solution:**
```python
# ❌ WRONG
async def get_context(request: Any) -> Context:
    return await Context.get_context(request)

graphql_app = GraphQLRouter(
    schema,
    context_getter=get_context,  # ❌ Remove this
)

# ✅ CORRECT
graphql_app = GraphQLRouter(
    schema,
    # No context_getter - Strawberry handles it automatically
)
```

### Issue 2: GraphQL Endpoint Returns 404

**Possible Causes:**
1. **Wrong prefix usage:**
   ```python
   # ❌ WRONG - GraphQL router doesn't need prefix
   app.include_router(graphql_app, prefix="/api/v1/graphql")

   # ✅ CORRECT - Use path parameter instead
   graphql_app = GraphQLRouter(schema, path="/api/v1/graphql")
   app.include_router(graphql_app)
   ```

2. **Import errors preventing registration:**
   - Check server logs for `⚠️ GraphQL endpoint not available: ...`
   - Common causes: missing modules, circular imports, type errors

### Issue 3: Code Generation Fails

**Error:**
```
Failed to load schema from http://localhost:8000/api/v1/graphql
```

**Solutions:**
1. **Verify endpoint is accessible:**
   ```bash
   curl -X POST http://localhost:8000/api/v1/graphql \
     -H "Content-Type: application/json" \
     -H "X-Tenant-ID: test-tenant" \
     -d '{"query": "{ version }"}'
   ```

2. **Check codegen configuration:**
   ```typescript
   // Ensure headers are set correctly
   schema: {
     'http://localhost:8000/api/v1/graphql': {
       headers: {
         'X-Tenant-ID': 'default',
         'Content-Type': 'application/json',
       },
     },
   }
   ```

3. **Backend must be running:**
   ```bash
   poetry run uvicorn dotmac.platform.main:app --reload
   ```

### Issue 4: Field Name Mismatches

**Error:**
```
Cannot query field "prospectCustomers" on type "CustomerMetrics"
```

**Solution:**
- Update query to match backend schema
- Run introspection query to see available fields:
  ```graphql
  {
    __type(name: "CustomerMetrics") {
      fields {
        name
        type {
          name
        }
      }
    }
  }
  ```

### Issue 5: N+1 Query Problem

**Symptom:** Multiple database queries for related data

**Solution:** Use DataLoaders
```python
# ❌ WRONG - Causes N+1 queries
for customer in customers:
    activities = await db.query(Activity).filter_by(customer_id=customer.id).all()

# ✅ CORRECT - Uses DataLoader for batching
activity_loader = info.context.loaders.get_customer_activity_loader()
activities_list = await activity_loader.load_many([c.id for c in customers])
```

---

## Best Practices

### 1. Schema Design

**✅ DO:**
- Use descriptive field names and types
- Add descriptions to all fields and types
- Use enums for fixed value sets
- Implement pagination for list queries
- Use conditional loading with `@include` directive

**❌ DON'T:**
- Expose internal IDs or sensitive data
- Return entire database models
- Create deeply nested queries (max 3-4 levels)
- Use generic names like `data`, `info`, `result`

### 2. Query Optimization

**✅ DO:**
- Use DataLoaders for batching
- Implement field-level caching
- Add database indexes for filtered fields
- Use `@include` for optional fields
- Limit query depth and complexity

**❌ DON'T:**
- Load all related data by default
- Perform expensive operations in resolvers
- Return unbounded lists
- Execute sequential database queries

### 3. Error Handling

**✅ DO:**
- Return user-friendly error messages
- Log detailed errors server-side
- Use GraphQL error extensions
- Handle authentication/authorization properly
- Validate input data

**❌ DON'T:**
- Expose stack traces to clients
- Return database errors directly
- Silently fail and return null
- Mix business logic errors with system errors

### 4. Type Safety

**✅ DO:**
- Generate types from schema
- Use strict TypeScript mode
- Validate query variables
- Type all resolver functions
- Use Strawberry's type annotations

**❌ DON'T:**
- Use `any` types
- Skip type generation
- Manually maintain types
- Ignore TypeScript errors

---

## Migration Checklist

### Phase 1: Backend Setup
- [ ] Install Strawberry GraphQL: `poetry add strawberry-graphql`
- [ ] Create GraphQL schema structure
- [ ] Implement query resolvers
- [ ] Set up DataLoaders for batching
- [ ] Configure GraphQL router in FastAPI
- [ ] Test endpoint with curl/Postman

### Phase 2: Frontend Setup
- [ ] Install Apollo Client: `pnpm add @apollo/client graphql`
- [ ] Configure Apollo Client with auth
- [ ] Install code generator: `pnpm add -D @graphql-codegen/cli @graphql-codegen/typescript @graphql-codegen/typescript-operations @graphql-codegen/typescript-react-apollo`
- [ ] Create codegen configuration
- [ ] Set up code generation script in package.json

### Phase 3: Query Development
- [ ] Write GraphQL query files (`.graphql`)
- [ ] Run code generation: `pnpm generate:graphql`
- [ ] Create wrapper hooks
- [ ] Test queries with real data

### Phase 4: Component Migration
- [ ] Identify components using REST APIs
- [ ] Replace REST hooks with GraphQL hooks
- [ ] Test loading states and error handling
- [ ] Verify data transformations
- [ ] Check performance improvements

### Phase 5: Testing & Validation
- [ ] Unit test GraphQL resolvers
- [ ] Integration test full queries
- [ ] Load test with realistic data
- [ ] Verify no N+1 queries
- [ ] Measure performance improvements

### Phase 6: Documentation
- [ ] Document GraphQL schema
- [ ] Create query examples
- [ ] Update API documentation
- [ ] Add troubleshooting guide

---

## Performance Metrics

### Expected Improvements

| Metric | Before (REST) | After (GraphQL) | Improvement |
|--------|--------------|-----------------|-------------|
| HTTP Requests | 14 calls | 1-2 queries | 85% reduction |
| Payload Size | ~200 KB | ~60 KB | 70% smaller |
| Page Load Time | 2.5s | 1.2s | 52% faster |
| Database Queries | 50+ queries | 5-10 queries | 80% reduction |

---

## Additional Resources

### Official Documentation
- [Strawberry GraphQL](https://strawberry.rocks/)
- [Apollo Client](https://www.apollographql.com/docs/react/)
- [GraphQL Code Generator](https://the-guild.dev/graphql/codegen)

### Internal Documentation
- [GraphQL Frontend Adoption Strategy](./GRAPHQL_FRONTEND_ADOPTION_STRATEGY.md)
- [Customer GraphQL Migration Status](./CUSTOMER_GRAPHQL_MIGRATION_STATUS.md)

### Troubleshooting
- Check server logs: `tail -f logs/app.log | grep GraphQL`
- Enable GraphQL debugging: Set `graphiql=True` in GraphQLRouter
- Monitor queries: Use Apollo DevTools browser extension
- Profile performance: Enable query logging in development

---

**Last Updated:** 2025-10-16
**Status:** Production Ready
**Version:** 1.0.0
