# GraphQL → TanStack Query Migration Plan

## 1. Baseline Inventory

- **Apps using GraphQL:** `apps/platform-admin-app`, `apps/isp-ops-app`
- **Generated Apollo hooks:** `lib/graphql/generated.ts`, wrappers in `hooks/use*GraphQL.ts`
- **Custom wrappers:** `useFiberGraphQL`, `useWirelessGraphQL`, `useNetworkMonitoringRealtime`, `useSubscriberDashboardGraphQL`, etc.
- **Raw operation sources:** `lib/graphql/queries/*.graphql` (≈ 3.7k LOC per app)
- **Subscriptions in use:** Network device updates and alert streams (see `useNetworkMonitoringRealtime.ts`)

### Schema Export (run from project root)

> We cannot run the backend in this environment (Python runtime unavailable). Execute the following locally:

```bash
# Ensure the API is running (make dev-host or docker)
poetry run python -m strawberry export-schema \
  dotmac.platform.graphql.schema:schema \
  --output frontend/graphql-schema.json
```

- Commit `frontend/graphql-schema.json` once generated so Codegen has a stable schema snapshot.
- Re-run the export whenever backend GraphQL changes ship.

## 2. Code Generation Strategy

| Task | Notes |
|------|-------|
| Add GraphQL Code Generator | Configure in `frontend/codegen.ts` using `@graphql-codegen/cli` |
| Target output | TanStack Query plugin (`@graphql-codegen/client-preset` + `@graphql-codegen/typescript-react-query`) |
| Shared fetcher | Implement a `graphqlClient.ts` that wraps `fetch` with auth + error handling |
| Package scripts | `pnpm graphql:codegen` at repo root, invoked in CI before builds |
| Output location | `frontend/shared/graphql/generated` - shared package imported by both apps |
| Endpoint | `/api/v1/graphql` (matches `src/dotmac/platform/routers.py:881`) |

Generated files are committed to the repository for deterministic builds.

**Endpoint Configuration:**
- Default: `/api/v1/graphql` (relative path, works with Next.js rewrites)
- Environment: `NEXT_PUBLIC_API_URL` for absolute URLs (cross-domain)
- Matches Apollo client configuration for consistency

## 3. Incremental Migration

1. **Switch Providers**
   - Remove `ApolloProvider` from both `ClientProviders.tsx`
   - Inject the shared GraphQL fetcher into TanStack Query via `queryClient.setDefaultOptions`
2. **Wrap Generated Hooks**
   - Replace Apollo wrappers (e.g. `useFiberDashboardGraphQL`) with thin layers around the new codegen hooks
   - Preserve existing return shapes to avoid immediate component churn
3. **Subscriptions**
   - Re-implement `useNetworkMonitoringRealtime` via `graphql-ws` + a custom observer that feeds React Query caches
   - For MVP: keep Apollo for subscription-only flows, but document the exception and track follow-up
4. **Testing**
   - Update MSW handlers to align with new operation names/documents
   - Refresh Playwright fixtures if GraphQL request keys change

## 4. Cleanup & Documentation

- Delete `ApolloProvider.tsx`, `lib/graphql/client.ts`, and Apollo-specific config after migration
- Remove `@apollo/client` dependencies from both app `package.json`
- Update `frontend/ARCHITECTURE_OVERVIEW.md` and `frontend/QUICK_START.md` with the single data-fetching story
- Add troubleshooting section for `pnpm graphql:codegen` (schema changes, auth errors, etc.)

## 5. Resolved Decisions

### Subscription Strategy
**Decision:** Keep Apollo temporarily for subscription flows only (`useNetworkMonitoringRealtime`, alert streams).
- Wrap Apollo's `useSubscription` in a thin adapter so components consume the same result shape
- In parallel, spike a dedicated `graphql-ws` client that pushes payloads into React Query caches
- Once the `graphql-ws` implementation is stable, drop Apollo entirely
- Track this as a follow-up milestone to maintain the long-term goal of a single client

### Generated Artifact Sharing
**Decision:** Drive code generation from the workspace root and commit generated files to a shared package.
- Location: `frontend/shared/graphql/generated`
- Both apps import from this shared package to avoid drift
- When schema changes, regenerate once and publish to both apps simultaneously
- Single source of truth prevents version skew

### Schema Source of Truth
**Decision:** Commit the JSON schema to the repository (`frontend/graphql-schema.json`).
- Keeps CI reproducible even when the backend isn't running
- Makes codegen deterministic and version-controlled
- Update via `poetry run python -m strawberry export-schema` whenever backend GraphQL changes ship
- Add a lint/check step to ensure the schema file stays in sync with backend changes
