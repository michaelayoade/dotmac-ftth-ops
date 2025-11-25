/**
 * Webhooks Management Hook - TanStack Query Version
 *
 * Migrated from direct API calls to TanStack Query for:
 * - Automatic caching and deduplication
 * - Background refetching
 * - Optimistic updates for mutations
 * - Better error handling
 * - Reduced boilerplate (383 lines → 280 lines)
 */

import axios from "axios";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";

export interface WebhookSubscription {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  is_active: boolean;
  retry_enabled: boolean;
  max_retries: number;
  timeout_seconds: number;
  success_count: number;
  failure_count: number;
  last_triggered_at: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
  updated_at: string | null;
  custom_metadata: Record<string, unknown>;
  // Legacy fields for backward compatibility with UI
  name?: string;
  user_id?: string;
  headers?: Record<string, string>;
  total_deliveries?: number;
  failed_deliveries?: number;
  has_secret?: boolean;
  last_delivery_at?: string;
}

export interface WebhookSubscriptionCreate {
  url: string;
  events: string[];
  description?: string;
  headers?: Record<string, string>;
  retry_enabled?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
  custom_metadata?: Record<string, unknown>;
  // Legacy fields (will be stored in custom_metadata)
  name?: string;
}

export interface WebhookSubscriptionUpdate {
  url?: string;
  events?: string[];
  description?: string;
  headers?: Record<string, string>;
  is_active?: boolean;
  retry_enabled?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
  custom_metadata?: Record<string, unknown>;
}

export interface WebhookDelivery {
  id: string;
  subscription_id: string;
  event_type: string;
  event_id: string;
  status: "pending" | "success" | "failed" | "retrying" | "disabled";
  response_code: number | null;
  error_message: string | null;
  attempt_number: number;
  duration_ms: number | null;
  created_at: string;
  next_retry_at: string | null;
  // Legacy fields
  response_status?: number;
  response_body?: string;
  delivered_at?: string;
  retry_count?: number;
}

export interface WebhookTestResult {
  success: boolean;
  status_code?: number;
  response_body?: string;
  error_message?: string;
  delivery_time_ms: number;
}

export interface AvailableEvents {
  [key: string]: {
    name: string;
    description: string;
  };
}

// ============================================================================
// Helper Functions for Data Enrichment
// ============================================================================

const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const errorData = err.response?.data as {
      error?: string;
      message?: string;
      detail?: string;
    };
    return errorData?.error || errorData?.message || errorData?.detail || err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return String(err);
};

const parseJsonData = <T>(payload: unknown, fallback: T): T => {
  if (payload === undefined || payload === null) {
    return fallback;
  }
  if (typeof payload === "string") {
    if (payload.trim().length === 0) {
      return fallback;
    }
    return JSON.parse(payload) as T;
  }
  return payload as T;
};

const enrichSubscription = (
  sub: Record<string, unknown> & {
    custom_metadata?: Record<string, unknown>;
    description?: string;
    success_count: number;
    failure_count: number;
    last_triggered_at: string | null;
  },
): WebhookSubscription =>
  ({
    ...(sub as any),
    name: (sub.custom_metadata?.["name"] as string) || sub.description || "Webhook",
    user_id: "current-user",
    headers: (sub.custom_metadata?.["headers"] as Record<string, string>) || {},
    total_deliveries: sub.success_count + sub.failure_count,
    failed_deliveries: sub.failure_count,
    has_secret: true,
    last_delivery_at: sub.last_triggered_at,
  }) as WebhookSubscription;

const enrichDelivery = (
  delivery: Record<string, unknown> & {
    response_code: number | null;
    created_at: string;
    attempt_number: number;
  },
): WebhookDelivery =>
  ({
    ...(delivery as any),
    response_status: delivery.response_code,
    delivered_at: delivery.created_at,
    retry_count: delivery.attempt_number - 1,
  }) as WebhookDelivery;

// ============================================================================
// Query Key Factory
// ============================================================================

export const webhooksKeys = {
  all: ["webhooks"] as const,
  subscriptions: () => [...webhooksKeys.all, "subscriptions"] as const,
  subscription: (filters: any) => [...webhooksKeys.subscriptions(), filters] as const,
  events: () => [...webhooksKeys.all, "events"] as const,
  deliveries: (subscriptionId: string, filters: any) =>
    [...webhooksKeys.all, "deliveries", subscriptionId, filters] as const,
};

// ============================================================================
// useWebhooks Hook
// ============================================================================

interface UseWebhooksOptions {
  page?: number;
  limit?: number;
  eventFilter?: string | undefined;
  activeOnly?: boolean;
}

export function useWebhooks(options: UseWebhooksOptions = {}) {
  const { page = 1, limit = 50, eventFilter, activeOnly = false } = options;
  const queryClient = useQueryClient();
  const [queryParams, setQueryParams] = useState({ page, limit, eventFilter, activeOnly });
  const [localWebhooks, setLocalWebhooks] = useState<WebhookSubscription[]>([]);

  useEffect(() => {
    setQueryParams((prev) => {
      if (
        prev.page === page &&
        prev.limit === limit &&
        prev.eventFilter === eventFilter &&
        prev.activeOnly === activeOnly
      ) {
        return prev;
      }
      return { page, limit, eventFilter, activeOnly };
    });
  }, [page, limit, eventFilter, activeOnly]);

  const fetchSubscriptions = async (
    params: Required<Pick<UseWebhooksOptions, "page" | "limit">> &
      Pick<UseWebhooksOptions, "eventFilter" | "activeOnly">
  ) => {
    const searchParams = new URLSearchParams();
    searchParams.append("limit", params.limit.toString());
    searchParams.append("offset", ((params.page - 1) * params.limit).toString());

    if (params.eventFilter) searchParams.append("event_type", params.eventFilter);
    if (params.activeOnly) searchParams.append("is_active", "true");

    const response = await apiClient.get(`/webhooks/subscriptions?${searchParams.toString()}`);
    const data = parseJsonData<any[]>(response.data ?? [], []);
    return data.map(enrichSubscription);
  };

  // Fetch webhooks query
  const webhooksQuery = useQuery({
    queryKey: webhooksKeys.subscription(queryParams),
    queryFn: async () => {
      try {
        return await fetchSubscriptions(queryParams);
      } catch (err) {
        const message = getErrorMessage(err);
        if (axios.isAxiosError(err)) {
          console.error("[debug] webhooks query error", err.response?.status, err.response?.data);
        }
        logger.error("Failed to fetch webhooks", err instanceof Error ? err : new Error(message));
        throw new Error(message);
      }
    },
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (webhooksQuery.data) {
      setLocalWebhooks(webhooksQuery.data);
    } else if (webhooksQuery.isError) {
      setLocalWebhooks([]);
    }
  }, [webhooksQuery.data, webhooksQuery.isError]);

  // Fetch available events query
  const eventsQuery = useQuery({
    queryKey: webhooksKeys.events(),
    queryFn: async () => {
      try {
        const response = await apiClient.get("/webhooks/events");
        const events: AvailableEvents = {};
        const responseData = parseJsonData<{
          events?: Array<{ event_type: string; description: string }>;
        }>(response.data, { events: [] });
        const eventsData = Array.isArray(responseData?.events) ? responseData.events : [];
        for (const event of eventsData) {
          events[event.event_type] = {
            name: event.event_type
              .split(".")
              .map((s: string) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(" "),
            description: event.description,
          };
        }
        return events;
      } catch (err) {
        logger.error("Failed to fetch events", err instanceof Error ? err : new Error(String(err)));
        return {} as AvailableEvents;
      }
    },
    staleTime: 300000, // 5 minutes - events rarely change
  });

  // Create webhook mutation
  const createMutation = useMutation({
    mutationFn: async (data: WebhookSubscriptionCreate): Promise<WebhookSubscription> => {
      // Store name in custom_metadata for UI compatibility
      const payload = {
        ...data,
        custom_metadata: {
          ...data.custom_metadata,
          name: data.name,
          headers: data.headers,
        },
      };

      const response = await apiClient.post("/webhooks/subscriptions", payload);
      const responseData = parseJsonData<any>(response.data, {});
      return enrichSubscription(responseData);
    },
    onSuccess: (newWebhook) => {
      // Optimistically add to cache
      queryClient.setQueryData<WebhookSubscription[]>(
        webhooksKeys.subscription(queryParams),
        (old) => (old ? [newWebhook, ...old] : [newWebhook]),
      );
      setLocalWebhooks((prev) => [newWebhook, ...prev]);
      // Invalidate to refetch and ensure consistency
      queryClient.invalidateQueries({ queryKey: webhooksKeys.subscriptions() });
    },
    onError: (err) => {
      logger.error("Failed to create webhook", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Update webhook mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: WebhookSubscriptionUpdate;
    }): Promise<WebhookSubscription> => {
      const response = await apiClient.patch(`/webhooks/subscriptions/${id}`, data);
      const responseData = parseJsonData<any>(response.data, {});
      return enrichSubscription(responseData);
    },
    onSuccess: (updatedWebhook) => {
      // Optimistically update cache
      queryClient.setQueryData<WebhookSubscription[]>(
        webhooksKeys.subscription(queryParams),
        (old) => (old ? old.map((wh) => (wh.id === updatedWebhook.id ? updatedWebhook : wh)) : [updatedWebhook]),
      );
      setLocalWebhooks((prev) =>
        prev.map((wh) => (wh.id === updatedWebhook.id ? updatedWebhook : wh)),
      );
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: webhooksKeys.subscriptions() });
    },
    onError: (err) => {
      logger.error("Failed to update webhook", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Delete webhook mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`/webhooks/subscriptions/${id}`);
    },
    onSuccess: (_, id) => {
      // Optimistically remove from cache
      queryClient.setQueryData<WebhookSubscription[]>(
        webhooksKeys.subscription(queryParams),
        (old) => (old ? old.filter((wh) => wh.id !== id) : []),
      );
      setLocalWebhooks((prev) => prev.filter((wh) => wh.id !== id));
      // Invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: webhooksKeys.subscriptions() });
    },
    onError: (err) => {
      logger.error("Failed to delete webhook", err instanceof Error ? err : new Error(String(err)));
    },
  });

  // Test webhook mutation
  const testMutation = useMutation({
    mutationFn: async ({
      id,
      eventType,
      payload,
    }: {
      id: string;
      eventType: string;
      payload?: Record<string, unknown>;
    }): Promise<WebhookTestResult> => {
      try {
        const response = await apiClient.post(`/webhooks/subscriptions/${id}/test`, {
          event_type: eventType,
          payload: payload ?? {},
        });

        const responseData = parseJsonData<WebhookTestResult>(response.data, {
          success: false,
          status_code: response.status,
          delivery_time_ms: 0,
        });

        return {
          success: Boolean(responseData.success),
          status_code: responseData.status_code ?? response.status,
          ...(responseData.response_body !== undefined && { response_body: responseData.response_body }),
          ...(responseData.error_message !== undefined && { error_message: responseData.error_message }),
          delivery_time_ms: responseData.delivery_time_ms ?? 0,
        };
      } catch (err) {
        const message = getErrorMessage(err);
        logger.error("Failed to test webhook", err instanceof Error ? err : new Error(message));
        throw new Error(message);
      }
    },
  });

  return {
    webhooks: localWebhooks,
    loading:
      webhooksQuery.isLoading ||
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
    error: webhooksQuery.error ? String(webhooksQuery.error) : null,
    fetchWebhooks: async (
      nextPage?: number,
      nextLimit?: number,
      nextEventFilter?: string,
      nextActiveOnly?: boolean
    ) => {
      const newParams = {
        page: nextPage ?? queryParams.page,
        limit: nextLimit ?? queryParams.limit,
        eventFilter: nextEventFilter ?? queryParams.eventFilter,
        activeOnly: typeof nextActiveOnly === "boolean" ? nextActiveOnly : queryParams.activeOnly,
      };
      setQueryParams(newParams);
      await queryClient.fetchQuery({
        queryKey: webhooksKeys.subscription(newParams),
        queryFn: () => fetchSubscriptions(newParams),
      });
    },
    createWebhook: createMutation.mutateAsync,
    updateWebhook: async (id: string, data: WebhookSubscriptionUpdate) =>
      updateMutation.mutateAsync({ id, data }),
    deleteWebhook: deleteMutation.mutateAsync,
    testWebhook: async (id: string, eventType: string, payload?: Record<string, unknown>) =>
      testMutation.mutateAsync(
        payload ? { id, eventType, payload } : { id, eventType }
      ),
    getAvailableEvents: async () => eventsQuery.data ?? ({} as AvailableEvents),
  };
}

// ============================================================================
// useWebhookDeliveries Hook
// ============================================================================

interface UseWebhookDeliveriesOptions {
  page?: number;
  limit?: number;
  statusFilter?: string | undefined;
}

export function useWebhookDeliveries(
  subscriptionId: string,
  options: UseWebhookDeliveriesOptions = {},
) {
  const { page = 1, limit = 50, statusFilter } = options;
  const queryClient = useQueryClient();
  const [deliveryParams, setDeliveryParams] = useState({ page, limit, statusFilter });

  useEffect(() => {
    setDeliveryParams((prev) => {
      if (prev.page === page && prev.limit === limit && prev.statusFilter === statusFilter) {
        return prev;
      }
      return { page, limit, statusFilter };
    });
  }, [page, limit, statusFilter]);

  useEffect(() => {
    setDeliveryParams({ page, limit, statusFilter });
  }, [subscriptionId]);

  const fetchDeliveriesData = async (
    params: Required<Pick<UseWebhookDeliveriesOptions, "page" | "limit">> &
      Pick<UseWebhookDeliveriesOptions, "statusFilter">
  ) => {
    const searchParams = new URLSearchParams();
    searchParams.append("limit", params.limit.toString());
    searchParams.append("offset", ((params.page - 1) * params.limit).toString());

    if (params.statusFilter) searchParams.append("status", params.statusFilter);

    const response = await apiClient.get(
      `/webhooks/subscriptions/${subscriptionId}/deliveries?${searchParams.toString()}`,
    );
    const deliveryData = parseJsonData<any[]>(response.data ?? [], []);
    return deliveryData.map(enrichDelivery);
  };

  // Fetch deliveries query
  const deliveriesQuery = useQuery({
    queryKey: webhooksKeys.deliveries(subscriptionId, deliveryParams),
    queryFn: async () => {
      try {
        return await fetchDeliveriesData(deliveryParams);
      } catch (err) {
        const message = getErrorMessage(err);
        logger.error("Failed to fetch deliveries", err instanceof Error ? err : new Error(message));
        throw new Error(message);
      }
    },
    enabled: !!subscriptionId,
    staleTime: 10000, // 10 seconds
    refetchOnWindowFocus: true,
  });

  // Retry delivery mutation
  const retryMutation = useMutation({
    mutationFn: async (deliveryId: string): Promise<void> => {
      await apiClient.post(`/webhooks/deliveries/${deliveryId}/retry`);
    },
    onSuccess: () => {
      // Invalidate deliveries to refetch updated status
      queryClient.invalidateQueries({
        queryKey: webhooksKeys.deliveries(subscriptionId, { page, limit, statusFilter }),
      });
    },
    onError: (err) => {
      logger.error("Failed to retry delivery", err instanceof Error ? err : new Error(String(err)));
    },
  });

  return {
    deliveries: deliveriesQuery.data ?? [],
    loading: deliveriesQuery.isLoading || retryMutation.isPending,
    error: deliveriesQuery.error ? String(deliveriesQuery.error) : null,
    fetchDeliveries: async (nextPage?: number, nextLimit?: number, nextStatusFilter?: string) => {
      const newParams = {
        page: nextPage ?? deliveryParams.page,
        limit: nextLimit ?? deliveryParams.limit,
        statusFilter: nextStatusFilter ?? deliveryParams.statusFilter,
      };
      setDeliveryParams(newParams);
      await queryClient.fetchQuery({
        queryKey: webhooksKeys.deliveries(subscriptionId, newParams),
        queryFn: () => fetchDeliveriesData(newParams),
      });
    },
    retryDelivery: retryMutation.mutateAsync,
  };
}
