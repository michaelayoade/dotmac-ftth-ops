/**
 * @dotmac/graphql
 *
 * Shared GraphQL client and generated operations for TanStack Query
 */

// Client exports
export {
  GraphQLClient,
  GraphQLError,
  graphqlClient,
  createGraphQLClient,
  graphqlFetcher,
} from "./client";

export type { GraphQLRequest, GraphQLResponse, GraphQLClientConfig } from "./client";

export { handleGraphQLError } from "./error-handler";
export type {
  GraphQLToastFn,
  GraphQLToastOptions,
  GraphQLErrorHandlerOptions,
} from "./error-handler";

// Generated schema utilities
export * from "../generated/fragment-masking";
export * from "../generated/gql";
export * from "../generated/graphql";

// Generated React Query hooks (exported as namespace to avoid duplicate type conflicts)
export * as ReactQueryHooks from "../generated/react-query";

// Subscription adapter (temporary Apollo wrapper)
export { useGraphQLSubscription } from "./subscription-adapter";
export type { SubscriptionResult } from "./subscription-adapter";

// Query result helpers (Apollo compatibility layer)
export {
  mapQueryResult,
  mapQueryResultWithTransform,
  loadingHelpers,
  hasQueryData,
} from "./query-helpers";
export type { NormalizedQueryResult } from "./query-helpers";

// Normalization helpers for custom dashboard hooks
// Note: hasQueryData is re-exported in normalization-helpers but not listed here
// to avoid duplication - it's already exported from query-helpers above
export {
  normalizeDashboardHook,
  normalizeListQuery,
  normalizeDetailQuery,
  extractDashboardData,
  combineQueryResults,
} from "./normalization-helpers";
export type { DashboardHookResult } from "./normalization-helpers";

// Query boundary components
export { QueryBoundary, ListQueryBoundary } from "./query-boundary";
export type { QueryBoundaryProps } from "./query-boundary";

// Mutation helpers (for forms, updates, deletes)
export {
  useMutationWithToast,
  createOptimisticUpdate,
  invalidateQueries,
  useFormMutation,
} from "./mutation-helpers";
export type { MutationWithToastOptions } from "./mutation-helpers";
