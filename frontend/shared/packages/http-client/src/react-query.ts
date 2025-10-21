import {
  QueryKey,
  UseMutationOptions,
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { httpClient } from "./index";
import type { ApiError, HttpClientConfig } from "./types";
import { HttpClient } from "./http-client";

interface RequestDescriptor<TResponse> {
  execute: () => Promise<TResponse>;
}

export function createApiQuery<TResponse>(
  request: () => Promise<TResponse>,
): RequestDescriptor<TResponse> {
  return {
    execute: request,
  };
}

export function useApiQuery<TResponse>(
  key: QueryKey,
  descriptor: RequestDescriptor<TResponse>,
  options?: Omit<UseQueryOptions<TResponse, ApiError>, "queryKey" | "queryFn">,
) {
  return useQuery<TResponse, ApiError>({
    queryKey: key,
    queryFn: descriptor.execute,
    ...options,
  });
}

export function useApiMutation<TResponse, TVariables = void>(
  descriptor: (variables: TVariables) => Promise<TResponse>,
  options?: Omit<UseMutationOptions<TResponse, ApiError, TVariables>, "mutationFn">,
) {
  const queryClient = useQueryClient();

  return useMutation<TResponse, ApiError, TVariables>({
    mutationFn: descriptor,
    onError: (error, variables, context) => {
      options?.onError?.(error, variables, context);
    },
    onSuccess: (data, variables, context) => {
      options?.onSuccess?.(data, variables, context);
    },
    onSettled: async (data, error, variables, context) => {
      if (options?.onSettled) {
        await options.onSettled(data, error, variables, context);
      }
      if (options?.invalidateQueries) {
        await Promise.all(
          options.invalidateQueries.map((invalidateKey) =>
            queryClient.invalidateQueries({ queryKey: invalidateKey }),
          ),
        );
      }
    },
    ...options,
  });
}

export function createHttpClientForQuery(config?: Partial<HttpClientConfig>): HttpClient {
  return HttpClient.create({ ...config }).enableAuth();
}
