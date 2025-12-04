/**
 * Mutation Helpers for GraphQL Operations
 *
 * Provides consistent patterns for mutations with:
 * - Automatic toast notifications
 * - Error handling via handleGraphQLError
 * - Loading states
 * - Optimistic updates
 * - Form integration
 *
 * @example Basic mutation with toast
 * ```tsx
 * const updateCustomer = useMutationWithToast(
 *   useUpdateCustomerMutation(),
 *   {
 *     successMessage: (data) => `Customer ${data.displayName} updated!`,
 *     errorMessage: "Failed to update customer",
 *   }
 * );
 *
 * // In component
 * <Button
 *   onClick={() => updateCustomer.mutate({ id, data })}
 *   disabled={updateCustomer.isPending}
 * >
 *   {updateCustomer.isPending ? "Saving..." : "Save"}
 * </Button>
 * ```
 */

import {
  useMutation,
  type UseMutationResult,
  type UseMutationOptions,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

import { handleGraphQLError } from "./error-handler";
import type { GraphQLToastFn } from "./error-handler";

/**
 * Options for useMutationWithToast
 */
export interface MutationWithToastOptions<TData, TError, TVariables, TContext> {
  /** Success toast message (string or function) */
  successMessage?: string | ((data: TData, variables: TVariables) => string);

  /** Error toast message (string or function) - defaults to error from server */
  errorMessage?: string | ((error: TError, variables: TVariables) => string);

  /** Show success toast (default: true) */
  showSuccessToast?: boolean;

  /** Show error toast (default: true) */
  showErrorToast?: boolean;

  /** Optional callback on success */
  onSuccess?: (
    data: TData,
    variables: TVariables,
    context: TContext | undefined,
  ) => void | Promise<void>;

  /** Optional callback on error */
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;

  /** Optional callback on settled (success or error) */
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => void;

  /** Toast function from useToast() */
  toast: GraphQLToastFn;

  /** Logger instance */
  logger?: {
    error: (message: string, error: Error) => void;
    info?: (message: string, data?: any) => void;
  };

  /** Operation name for logging */
  operationName?: string;
}

/**
 * Wraps a TanStack Query mutation with automatic toast notifications and error handling
 *
 * @example
 * ```tsx
 * import { useMutationWithToast } from '@dotmac/graphql';
 * import { useToast } from '@dotmac/ui';
 * import { logger } from '@/lib/logger';
 *
 * function CustomerForm({ customerId }) {
 *   const { toast } = useToast();
 *
 *   const updateMutation = useMutationWithToast(
 *     {
 *       mutationFn: async (data) => {
 *         const result = await graphqlClient.request(UpdateCustomerDocument, {
 *           id: customerId,
 *           input: data,
 *         });
 *         return result.updateCustomer;
 *       },
 *     },
 *     {
 *       toast,
 *       logger,
 *       successMessage: (data) => `Customer ${data.displayName} updated successfully!`,
 *       errorMessage: "Failed to update customer",
 *       operationName: "UpdateCustomer",
 *       onSuccess: (data) => {
 *         // Invalidate queries, close modal, etc.
 *       },
 *     }
 *   );
 *
 *   return (
 *     <form onSubmit={(e) => {
 *       e.preventDefault();
 *       updateMutation.mutate(formData);
 *     }}>
 *       <Button
 *         type="submit"
 *         disabled={updateMutation.isPending}
 *       >
 *         {updateMutation.isPending ? "Saving..." : "Save"}
 *       </Button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useMutationWithToast<
  TData = unknown,
  TError = Error,
  TVariables = void,
  TContext = unknown,
>(
  mutationOptions: UseMutationOptions<TData, TError, TVariables, TContext>,
  toastOptions: MutationWithToastOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const {
    successMessage,
    errorMessage,
    showSuccessToast = true,
    showErrorToast = true,
    onSuccess: userOnSuccess,
    onError: userOnError,
    onSettled: userOnSettled,
    toast,
    logger,
    operationName = "Mutation",
  } = toastOptions;

  return useMutation<TData, TError, TVariables, TContext>({
    ...mutationOptions,
    onSuccess: async (data, variables, context) => {
      // Show success toast
      if (showSuccessToast && successMessage) {
        const message =
          typeof successMessage === "function" ? successMessage(data, variables) : successMessage;

        toast({
          title: "Success",
          description: message,
          variant: "default",
        });
      }

      // Log success if logger provided
      if (logger?.info) {
        logger.info(`${operationName} succeeded`, { data, variables });
      }

      // Call user's onSuccess callback
      if (userOnSuccess) {
        await userOnSuccess(data, variables, context);
      }

      // Call original mutation's onSuccess if it exists
      if (mutationOptions.onSuccess) {
        await (mutationOptions.onSuccess as any)(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Handle error with our standard error handler
      if (showErrorToast) {
        const customMessage =
          typeof errorMessage === "function" ? errorMessage(error, variables) : errorMessage;

        handleGraphQLError(error, {
          toast,
          ...(logger
            ? {
                logger: {
                  error: (message: string, err?: unknown, ctx?: Record<string, unknown>) => {
                    logger.error(message, err as Error);
                  },
                },
              }
            : {}),
          operationName,
          ...(customMessage ? { customMessage } : {}),
          context: { variables },
        });
      }

      // Call user's onError callback
      if (userOnError) {
        userOnError(error, variables, context);
      }

      // Call original mutation's onError if it exists
      if (mutationOptions.onError) {
        (mutationOptions.onError as any)(error, variables, context);
      }
    },
    onSettled: (data, error, variables, context) => {
      // Call user's onSettled callback
      if (userOnSettled) {
        userOnSettled(data, error, variables, context);
      }

      // Call original mutation's onSettled if it exists
      if (mutationOptions.onSettled) {
        (mutationOptions.onSettled as any)(data, error, variables, context);
      }
    },
  });
}

/**
 * Helper to create optimistic update configuration for mutations
 *
 * @example
 * ```tsx
 * const { mutate } = useMutationWithToast(
 *   {
 *     mutationFn: toggleFavorite,
 *     ...createOptimisticUpdate(
 *       queryClient,
 *       ['customer', customerId],
 *       (oldData: Customer, variables: { isFavorite: boolean }) => ({
 *         ...oldData,
 *         isFavorite: variables.isFavorite,
 *       })
 *     ),
 *   },
 *   { toast, successMessage: "Updated!" }
 * );
 * ```
 */
export function createOptimisticUpdate<TData, TVariables>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (oldData: TData, variables: TVariables) => TData,
) {
  return {
    onMutate: async (variables: TVariables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey });

      // Snapshot the previous value
      const previousData = queryClient.getQueryData<TData>(queryKey);

      // Optimistically update when we have existing data
      if (previousData !== undefined) {
        const optimistic = updater(previousData, variables);
        queryClient.setQueryData<TData>(queryKey, optimistic);
      }

      // Return context with previous value
      return { previousData } as { previousData: TData | undefined };
    },
    onError: (_err: unknown, _variables: TVariables, context?: { previousData?: TData }) => {
      // Rollback on error
      if (context?.previousData !== undefined) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey });
    },
  };
}

/**
 * Creates a mutation configuration that invalidates multiple queries on success
 *
 * @example
 * ```tsx
 * const createCustomer = useMutationWithToast(
 *   {
 *     mutationFn: createCustomerFn,
 *     ...invalidateQueries(queryClient, [
 *       ['customers'],
 *       ['customer-metrics'],
 *       ['dashboard']
 *     ]),
 *   },
 *   { toast, successMessage: "Customer created!" }
 * );
 * ```
 */
export function invalidateQueries(queryClient: QueryClient, queryKeys: QueryKey[]) {
  return {
    onSuccess: () => {
      queryKeys.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
    },
  };
}

/**
 * Helper for form submissions with mutations
 * Provides common form handling patterns
 *
 * @example With react-hook-form
 * ```tsx
 * import { useForm } from 'react-hook-form';
 * import { useFormMutation } from '@dotmac/graphql';
 *
 * function CustomerForm() {
 *   const form = useForm();
 *   const { toast } = useToast();
 *
 *   const { mutate, isPending } = useFormMutation(
 *     form,
 *     {
 *       mutationFn: updateCustomer,
 *       onSuccess: () => {
 *         onClose();
 *       },
 *     },
 *     {
 *       toast,
 *       successMessage: "Customer updated!",
 *     }
 *   );
 *
 *   return (
 *     <form onSubmit={form.handleSubmit((data) => mutate(data))}>
 *       <Input {...form.register('name')} />
 *       <Button type="submit" disabled={isPending}>
 *         {isPending ? "Saving..." : "Save"}
 *       </Button>
 *     </form>
 *   );
 * }
 * ```
 */
export function useFormMutation<TData, TError, TVariables, TContext = unknown>(
  form: {
    reset?: (data?: any) => void;
    setError?: (field: string, error: { type: string; message: string }) => void;
  },
  mutationOptions: UseMutationOptions<TData, TError, TVariables, TContext>,
  toastOptions: MutationWithToastOptions<TData, TError, TVariables, TContext> & {
    resetOnSuccess?: boolean;
  },
) {
  const { resetOnSuccess = false, ...restToastOptions } = toastOptions;

  return useMutationWithToast<TData, TError, TVariables, TContext>(mutationOptions, {
    ...restToastOptions,
    onSuccess: async (data, variables, context) => {
      // Reset form on success if configured
      if (resetOnSuccess && form.reset) {
        form.reset();
      }

      // Call user's onSuccess
      if (restToastOptions.onSuccess) {
        await restToastOptions.onSuccess(data, variables, context);
      }
    },
    onError: (error, variables, context) => {
      // Try to extract field errors from GraphQL error
      // This is a common pattern for validation errors
      if (form.setError && error && typeof error === "object" && "graphQLErrors" in error) {
        const graphQLErrors = (error as any).graphQLErrors;
        if (Array.isArray(graphQLErrors)) {
          graphQLErrors.forEach((gqlError: any) => {
            if (gqlError.extensions?.field && form.setError) {
              form.setError(gqlError.extensions.field, {
                type: "server",
                message: gqlError.message,
              });
            }
          });
        }
      }

      // Call user's onError
      if (restToastOptions.onError) {
        restToastOptions.onError(error, variables, context);
      }
    },
  });
}
