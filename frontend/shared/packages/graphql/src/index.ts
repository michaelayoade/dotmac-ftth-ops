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
} from './client';

export type {
  GraphQLRequest,
  GraphQLResponse,
  GraphQLClientConfig,
} from './client';

// Generated types and hooks (available after codegen runs)
export * from '../generated';
export * from '../generated/react-query';

// Subscription adapter (temporary Apollo wrapper)
export { useGraphQLSubscription } from './subscription-adapter';
export type { SubscriptionResult } from './subscription-adapter';

// Query result helpers (Apollo compatibility layer)
export {
  mapQueryResult,
  mapQueryResultWithTransform,
  loadingHelpers,
  hasQueryData,
} from './query-helpers';
export type { NormalizedQueryResult } from './query-helpers';

// Error handling utilities
export {
  handleGraphQLError,
  handleGraphQLErrorWithFriendlyMessage,
  useErrorHandler,
  getUserFriendlyMessage,
  ErrorSeverity,
  ERROR_MESSAGES,
} from './error-handler';
export type { ErrorHandlerContext, ErrorHandlerResult } from './error-handler';

// Query boundary components
export { QueryBoundary, ListQueryBoundary } from './query-boundary';
export type { QueryBoundaryProps } from './query-boundary';
