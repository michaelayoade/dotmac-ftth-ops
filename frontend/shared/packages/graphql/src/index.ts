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
