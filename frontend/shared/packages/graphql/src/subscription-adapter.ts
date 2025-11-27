/**
 * Apollo Subscription Adapter
 *
 * Temporary wrapper around Apollo's useSubscription to maintain a consistent
 * interface while we migrate queries/mutations to TanStack Query.
 *
 * This adapter:
 * 1. Wraps Apollo's useSubscription with a standardized interface
 * 2. Allows components to consume subscriptions without Apollo-specific code
 * 3. Makes it easier to swap out Apollo for graphql-ws in the future
 *
 * Usage:
 * ```tsx
 * import { useGraphQLSubscription } from '@dotmac/graphql';
 *
 * const { data, loading, error } = useGraphQLSubscription(
 *   DEVICE_UPDATES_SUBSCRIPTION,
 *   {
 *     variables: { deviceType: 'OLT' },
 *     onData: (data) => {
 *       console.log('Device updated:', data);
 *     },
 *   }
 * );
 * ```
 *
 * Future: Replace with graphql-ws client that pushes to React Query cache
 */

import { useSubscription, type DocumentNode, type OperationVariables } from "@apollo/client";

export interface SubscriptionOptions<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
> {
  /**
   * GraphQL variables for the subscription
   */
  variables?: TVariables;

  /**
   * Skip the subscription (don't connect)
   */
  skip?: boolean;

  /**
   * Callback when new data is received
   */
  onData?: (options: { data: TData | null }) => void;

  /**
   * Callback when an error occurs
   */
  onError?: (error: Error) => void;

  /**
   * Callback when subscription completes
   */
  onComplete?: () => void;
}

export interface SubscriptionResult<TData = any> {
  /**
   * Latest data from the subscription
   */
  data: TData | null;

  /**
   * Loading state (true while connecting)
   */
  loading: boolean;

  /**
   * Error if subscription failed
   */
  error?: Error;
}

/**
 * Hook that wraps Apollo's useSubscription with a standardized interface
 *
 * This adapter provides a consistent API that can be easily replaced when
 * we migrate to graphql-ws + TanStack Query.
 *
 * @param subscription - GraphQL subscription document
 * @param options - Subscription configuration
 * @returns Subscription result with data, loading, and error
 */
export function useGraphQLSubscription<
  TData = any,
  TVariables extends OperationVariables = OperationVariables,
>(
  subscription: DocumentNode,
  options: SubscriptionOptions<TData, TVariables> = {},
): SubscriptionResult<TData> {
  const { variables, skip, onData, onError, onComplete } = options;

  // Use Apollo's useSubscription under the hood
  const result = useSubscription<TData, TVariables>(subscription, {
    variables: variables as any,
    ...(skip !== undefined ? { skip } : {}),
    ...(onData
      ? {
          onData: ({ data }) => {
            // Apollo wraps the data in a nested structure
            const actualData = data?.data || null;
            onData({ data: actualData as TData | null });
          },
        }
      : {}),
    ...(onError ? { onError } : {}),
    ...(onComplete ? { onComplete } : {}),
  });

  // Normalize the result to match our interface
  return {
    data: result.data || null,
    loading: result.loading,
    ...(result.error ? { error: result.error } : {}),
  };
}

/**
 * Type guard to check if a subscription result has data
 */
export function hasSubscriptionData<TData>(
  result: SubscriptionResult<TData>,
): result is SubscriptionResult<TData> & { data: TData } {
  return result.data !== null && !result.loading && !result.error;
}

/**
 * Helper to create a subscription hook factory
 *
 * This makes it easier to create reusable subscription hooks with type safety.
 *
 * Example:
 * ```tsx
 * const useDeviceUpdates = createSubscriptionHook<
 *   DeviceUpdatesSubscription,
 *   DeviceUpdatesVariables
 * >(DEVICE_UPDATES_SUBSCRIPTION);
 * ```
 */
export function createSubscriptionHook<
  TData = any,
  TVariables extends Record<string, any> = Record<string, any>,
>(subscription: DocumentNode) {
  return (options?: SubscriptionOptions<TData, TVariables>) => {
    return useGraphQLSubscription<TData, TVariables>(subscription, options);
  };
}
