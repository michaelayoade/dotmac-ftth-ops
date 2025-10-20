# GraphQL Client Integration - Complete Setup

**Date:** 2025-10-16
**Status:** ✅ Fully Integrated
**Endpoint:** `/api/v1/graphql`

---

## Overview

The GraphQL client is now **fully integrated** into the frontend application with Apollo Client properly configured and available throughout the entire app.

---

## ✅ Integration Status

### Backend GraphQL Endpoint
- **URL:** `http://localhost:8000/api/v1/graphql`
- **Status:** ✅ Operational
- **Available Queries:** 14 wireless queries + customer/payment queries
- **Authentication:** Bearer token via Authorization header
- **Tenant Isolation:** Automatic via tenant middleware

### Frontend Apollo Client
- **Status:** ✅ Configured and Integrated
- **Provider:** Wrapped around entire app
- **Authentication:** Automatic token injection
- **Caching:** In-memory cache with type policies
- **Error Handling:** Global error link with logging
- **Dev Tools:** Enabled in development mode

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend App                             │
├─────────────────────────────────────────────────────────────┤
│  RootLayout (app/layout.tsx)                                │
│    └── ErrorBoundary                                        │
│         └── ClientProviders (providers/ClientProviders.tsx) │
│              ├── MSWProvider (testing)                      │
│              ├── ThemeProvider (dark mode)                  │
│              ├── QueryClientProvider (TanStack Query)       │
│              ├── ApolloProvider ✅ NEWLY INTEGRATED         │
│              │    └── Apollo Client (lib/graphql/client.ts)│
│              │         ├── HTTP Link → /api/v1/graphql     │
│              │         ├── Auth Link (Bearer token)        │
│              │         ├── Error Link (logging)            │
│              │         └── Cache (In-memory)               │
│              ├── TenantProvider                             │
│              ├── AuthProvider                               │
│              └── RBACProvider (conditional)                 │
│                   └── App Components                        │
│                        └── Can use GraphQL hooks!          │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
frontend/apps/base-app/
├── lib/
│   └── graphql/
│       ├── client.ts              # Apollo Client configuration
│       ├── ApolloProvider.tsx     # Provider wrapper component
│       ├── generated.ts           # Auto-generated types/hooks (8,257 lines)
│       └── queries/
│           ├── wireless.graphql   # Wireless query definitions
│           └── fiber.graphql      # Fiber query definitions (future)
│
├── hooks/
│   └── useWirelessGraphQL.ts      # Wrapper hooks for wireless queries
│
├── providers/
│   └── ClientProviders.tsx        # ✅ NOW INCLUDES ApolloProvider
│
└── app/
    └── layout.tsx                 # Root layout using ClientProviders
```

---

## 🔧 Apollo Client Configuration

### HTTP Link
```typescript
// Endpoint configuration
const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_URL
    ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/graphql`
    : 'http://localhost:8000/api/v1/graphql',
  credentials: 'include', // Include cookies
});
```

### Authentication Link
```typescript
// Automatic token injection
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});
```

### Error Handling
```typescript
// Global error handling
const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  // GraphQL errors
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      logger.error('GraphQL Error', { message, operation });

      // Handle authentication errors
      if (extensions?.code === 'UNAUTHENTICATED') {
        // Could trigger logout or token refresh
      }
    });
  }

  // Network errors
  if (networkError) {
    logger.error('GraphQL Network Error', { message, operation });
  }
});
```

### Caching Strategy
```typescript
const cache = new InMemoryCache({
  typePolicies: {
    // Subscriber caching
    Subscriber: {
      keyFields: ['id'],
    },

    // Session caching
    Session: {
      keyFields: ['radacctid'],
    },

    // Query root - always use fresh data
    Query: {
      fields: {
        subscribers: {
          merge(existing = [], incoming: any[]) {
            return incoming; // Replace existing with fresh data
          },
        },
      },
    },
  },
});
```

### Default Options
```typescript
defaultOptions: {
  watchQuery: {
    fetchPolicy: 'cache-and-network', // Show cached, fetch new
    errorPolicy: 'all',
  },
  query: {
    fetchPolicy: 'network-only',      // Always get fresh data
    errorPolicy: 'all',
  },
  mutate: {
    errorPolicy: 'all',
  },
}
```

---

## 🚀 Using GraphQL in Components

### Option 1: Auto-Generated Hooks (Direct)

```typescript
import { useAccessPointListQuery } from '@/lib/graphql/generated';

function AccessPointsPage() {
  const { data, loading, error } = useAccessPointListQuery({
    variables: {
      limit: 50,
      status: 'ONLINE',
    },
    pollInterval: 30000, // Auto-refresh every 30 seconds
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error.message} />;

  const accessPoints = data?.accessPoints?.accessPoints ?? [];

  return <AccessPointList data={accessPoints} />;
}
```

### Option 2: Wrapper Hooks (Recommended)

```typescript
import { useAccessPointListGraphQL } from '@/hooks/useWirelessGraphQL';

function AccessPointsPage() {
  const { accessPoints, loading, error, refetch } = useAccessPointListGraphQL({
    limit: 50,
    status: AccessPointStatus.Online,
    pollInterval: 30000,
  });

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      <RefreshButton onClick={refetch} />
      <AccessPointList data={accessPoints} />
    </div>
  );
}
```

### Option 3: Direct Apollo Client Access

```typescript
import { apolloClient } from '@/lib/graphql/client';
import { gql } from '@apollo/client';

async function fetchData() {
  const { data } = await apolloClient.query({
    query: gql`
      query {
        accessPoints(limit: 10) {
          accessPoints {
            id
            name
            status
          }
        }
      }
    `,
  });

  return data.accessPoints.accessPoints;
}
```

---

## 🔐 Authentication Flow

### 1. User Login
```typescript
// After successful login
localStorage.setItem('token', authToken);

// Token is automatically injected in all GraphQL requests
```

### 2. GraphQL Request
```typescript
// Apollo Client automatically adds Authorization header
// Headers sent:
{
  'Authorization': 'Bearer <token>',
  'Content-Type': 'application/json'
}
```

### 3. Backend Validation
```python
# Backend middleware validates token
# Sets tenant context for query
# Returns tenant-scoped data
```

### 4. Logout
```typescript
import { clearApolloCache } from '@/lib/graphql/client';

async function handleLogout() {
  localStorage.removeItem('token');
  await clearApolloCache(); // Clear all cached data
  router.push('/login');
}
```

---

## 📊 Available Queries

### Wireless Queries (14 total)
```typescript
// Access Points
useAccessPointListGraphQL()
useAccessPointDetailGraphQL({ id })
useAccessPointsBySiteGraphQL({ siteId })

// Wireless Clients
useWirelessClientListGraphQL()
useWirelessClientDetailGraphQL({ id })
useWirelessClientsByAccessPointGraphQL({ accessPointId })
useWirelessClientsByCustomerGraphQL({ customerId })

// Coverage Zones
useCoverageZoneListGraphQL()
useCoverageZoneDetailGraphQL({ id })
useCoverageZonesBySiteGraphQL({ siteId })

// RF Analytics
useRfAnalyticsGraphQL({ siteId })
useChannelUtilizationGraphQL({ siteId, band })

// Dashboard
useWirelessSiteMetricsGraphQL({ siteId })
useWirelessDashboardGraphQL()
```

### Future Queries
- Customer queries
- Payment queries
- Billing queries
- Network monitoring queries

---

## 🧪 Testing GraphQL Integration

### 1. Verify Apollo Provider
```bash
# Check browser console for Apollo DevTools
# Should see: "Apollo Client Devtools: Detected"
```

### 2. Test Query Execution
```typescript
// In any component under ClientProviders
import { useWirelessDashboardGraphQL } from '@/hooks/useWirelessGraphQL';

function TestComponent() {
  const { dashboard, loading, error } = useWirelessDashboardGraphQL();

  console.log('Dashboard data:', dashboard);
  console.log('Loading:', loading);
  console.log('Error:', error);

  return <div>Check console for GraphQL data</div>;
}
```

### 3. Check Network Requests
```
1. Open Browser DevTools → Network tab
2. Filter by "graphql"
3. Should see POST requests to /api/v1/graphql
4. Check request headers for Authorization token
5. Check response data
```

### 4. Test Cache
```typescript
// First query - fetches from network
const { data: data1 } = useWirelessDashboardGraphQL();

// Second query (same data) - uses cache then fetches
const { data: data2 } = useWirelessDashboardGraphQL();

// data1 === data2 (same cache object)
```

---

## 🐛 Troubleshooting

### Issue 1: "Cannot read property 'use' of undefined"
**Cause:** ApolloProvider not wrapped around component
**Solution:** ✅ Fixed - ApolloProvider now in ClientProviders

### Issue 2: Authentication Errors
**Cause:** Missing or invalid token

**Check:**
```typescript
// Verify token exists
const token = localStorage.getItem('token');
console.log('Token:', token);

// Check Apollo Client is sending it
// In Network tab → Headers → Authorization
```

**Fix:**
```typescript
// Re-login to get fresh token
// Or manually set for testing
localStorage.setItem('token', 'your-test-token');
```

### Issue 3: CORS Errors
**Cause:** Backend not allowing frontend origin

**Fix Backend:**
```python
# Ensure CORS middleware allows frontend origin
origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]
```

### Issue 4: GraphQL Endpoint 404
**Cause:** Backend not running or wrong URL

**Check:**
```bash
# Verify backend is running
curl http://localhost:8000/api/v1/graphql

# Check environment variable
echo $NEXT_PUBLIC_API_URL
```

### Issue 5: Cached Old Data
**Solution:**
```typescript
import { clearApolloCache } from '@/lib/graphql/client';

// Clear all cached data
await clearApolloCache();

// Or refetch specific query
refetch();
```

---

## 🎯 Best Practices

### 1. Use Wrapper Hooks
```typescript
// ✅ Good - Consistent error handling
import { useAccessPointListGraphQL } from '@/hooks/useWirelessGraphQL';

// ❌ Avoid - Direct use of generated hooks
import { useAccessPointListQuery } from '@/lib/graphql/generated';
```

### 2. Handle Loading States
```typescript
const { accessPoints, loading, error } = useAccessPointListGraphQL();

if (loading && !accessPoints.length) {
  // First load - show skeleton
  return <Skeleton />;
}

if (loading) {
  // Refetching - show loading indicator
  return <LoadingOverlay>{children}</LoadingOverlay>;
}
```

### 3. Handle Errors Gracefully
```typescript
if (error) {
  return (
    <ErrorBoundary error={error}>
      <RetryButton onClick={refetch} />
    </ErrorBoundary>
  );
}
```

### 4. Configure Polling Wisely
```typescript
// Real-time data (detail views)
pollInterval: 10000  // 10 seconds

// Dashboard views
pollInterval: 30000  // 30 seconds

// Slowly changing data
pollInterval: 60000  // 60 seconds

// Static data
pollInterval: undefined  // No polling
```

### 5. Use Refetch for Manual Updates
```typescript
const { data, refetch } = useAccessPointListGraphQL();

// User action triggers refresh
<Button onClick={() => refetch()}>
  Refresh Data
</Button>
```

---

## 📈 Performance Optimization

### 1. Pagination
```typescript
// Always use pagination for large datasets
const { accessPoints, hasNextPage } = useAccessPointListGraphQL({
  limit: 50,  // Page size
  offset: page * 50,
});
```

### 2. Selective Field Fetching
```graphql
# Only request fields you need
query AccessPoints {
  accessPoints(limit: 10) {
    accessPoints {
      id
      name
      status
      # Don't fetch everything if not needed
    }
  }
}
```

### 3. Cache Configuration
```typescript
// Configure cache for your data patterns
fetchPolicy: 'cache-and-network'  // Show cached, fetch new
fetchPolicy: 'cache-first'        // Prefer cache
fetchPolicy: 'network-only'       // Always fresh
```

### 4. Disable Polling When Not Visible
```typescript
const { data } = useAccessPointListGraphQL({
  pollInterval: isTabVisible ? 30000 : undefined,
});
```

---

## 🚀 Next Steps

### Immediate
- [x] Apollo Client configured
- [x] ApolloProvider integrated into app
- [x] Auto-generated hooks available
- [x] Wrapper hooks created
- [x] Documentation complete

### Ready to Use
- [ ] Migrate components from REST to GraphQL
- [ ] Test GraphQL queries in production
- [ ] Monitor query performance
- [ ] Add more wrapper hooks as needed

### Future Enhancements
- [ ] Add GraphQL mutations (create, update, delete)
- [ ] Implement optimistic updates
- [ ] Add GraphQL subscriptions (WebSocket)
- [ ] Add DataLoader for N+1 optimization
- [ ] Implement query batching
- [ ] Add persisted queries
- [ ] Add query complexity limits
- [ ] Add rate limiting

---

## 📞 Support

### Documentation
- **Integration:** This file
- **API Reference:** `docs/WIRELESS_GRAPHQL_README.md`
- **Migration Guide:** `docs/WIRELESS_GRAPHQL_MIGRATION_GUIDE.md`
- **Testing:** `docs/WIRELESS_GRAPHQL_TESTING_SUMMARY.md`

### Debugging Tools
- **Apollo DevTools:** Browser extension for Chrome/Firefox
- **GraphQL Playground:** `http://localhost:8000/api/v1/graphql`
- **Network Tab:** Check requests/responses
- **Console Logs:** Apollo Client logs in development

### Getting Help
1. Check Apollo Client configuration in `lib/graphql/client.ts`
2. Verify ApolloProvider is wrapping components
3. Check browser console for errors
4. Check network tab for failed requests
5. Test with GraphQL Playground first

---

## ✅ Integration Checklist

- [x] Apollo Client configured (`lib/graphql/client.ts`)
- [x] ApolloProvider wrapper created (`lib/graphql/ApolloProvider.tsx`)
- [x] ApolloProvider integrated in ClientProviders
- [x] Auto-generated types and hooks (8,257 lines)
- [x] Wrapper hooks created (14 hooks)
- [x] Authentication link configured
- [x] Error handling configured
- [x] Cache policies configured
- [x] GraphQL endpoint operational
- [x] Backend tenant isolation working
- [x] Documentation complete

---

**🎉 GraphQL client integration is COMPLETE and ready for use!**

---

**Status:** ✅ Production Ready
**Last Updated:** 2025-10-16
**Next:** Start migrating components to use GraphQL hooks
