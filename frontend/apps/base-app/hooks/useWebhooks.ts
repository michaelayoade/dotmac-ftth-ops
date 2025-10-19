import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

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
  status: 'pending' | 'success' | 'failed' | 'retrying' | 'disabled';
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

// Helper to enrich backend data with UI-compatible fields
const enrichSubscription = (sub: Record<string, unknown> & { custom_metadata?: Record<string, unknown>; description?: string; success_count: number; failure_count: number; last_triggered_at: string | null }): WebhookSubscription => ({
  ...(sub as any),
  name: (sub.custom_metadata?.name as string) || sub.description || 'Webhook',
  user_id: 'current-user',
  headers: (sub.custom_metadata?.headers as Record<string, string>) || {},
  total_deliveries: sub.success_count + sub.failure_count,
  failed_deliveries: sub.failure_count,
  has_secret: true,
  last_delivery_at: sub.last_triggered_at,
} as WebhookSubscription);

// Helper to enrich delivery data
const enrichDelivery = (delivery: Record<string, unknown> & { response_code: number | null; created_at: string; attempt_number: number }): WebhookDelivery => ({
  ...(delivery as any),
  response_status: delivery.response_code,
  delivered_at: delivery.created_at,
  retry_count: delivery.attempt_number - 1,
} as WebhookDelivery);

export function useWebhooks() {
  const [webhooks, setWebhooks] = useState<WebhookSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWebhooks = useCallback(async (
    page = 1,
    limit = 50,
    eventFilter?: string,
    activeOnly = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', ((page - 1) * limit).toString());

      if (eventFilter) {
        params.append('event_type', eventFilter);
      }
      if (activeOnly) {
        params.append('is_active', 'true');
      }

      const response = await apiClient.get(`/webhooks/subscriptions?${params.toString()}`);
      const data = (response.data || []) as any[];
      const enriched = data.map(enrichSubscription);
      setWebhooks(enriched);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch webhooks';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createWebhook = useCallback(async (data: WebhookSubscriptionCreate): Promise<WebhookSubscription> => {
    setLoading(true);
    setError(null);

    try {
      // Store name in custom_metadata for UI compatibility
      const payload = {
        ...data,
        custom_metadata: {
          ...data.custom_metadata,
          name: data.name,
          headers: data.headers,
        },
      };

      delete (payload as Record<string, unknown>).name; // Remove from root level

      const response = await apiClient.post('/webhooks/subscriptions', payload);
      const enriched = enrichSubscription(response.data as any);

      setWebhooks(prev => [enriched, ...prev]);
      return enriched;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create webhook';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateWebhook = useCallback(async (
    id: string,
    data: WebhookSubscriptionUpdate
  ): Promise<WebhookSubscription> => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.patch(`/webhooks/subscriptions/${id}`, data);
      const enriched = enrichSubscription(response.data as any);

      setWebhooks(prev => prev.map(webhook => webhook.id === id ? enriched : webhook));
      return enriched;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update webhook';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteWebhook = useCallback(async (id: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.delete(`/webhooks/subscriptions/${id}`);
      setWebhooks(prev => prev.filter(webhook => webhook.id !== id));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete webhook';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const testWebhook = useCallback(async (
    id: string,
    eventType: string,
    payload?: Record<string, unknown>
  ): Promise<WebhookTestResult> => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));

      // Simulate random success/failure
      const success = Math.random() > 0.3;

      if (success) {
        return {
          success: true,
          status_code: 200,
          response_body: 'OK',
          delivery_time_ms: Math.floor(Math.random() * 500 + 100),
        };
      } else {
        return {
          success: false,
          status_code: 500,
          error_message: 'Internal Server Error',
          delivery_time_ms: Math.floor(Math.random() * 1000 + 200),
        };
      }
    } catch (err) {
      return {
        success: false,
        error_message: err instanceof Error ? err.message : 'Test failed',
        delivery_time_ms: 0,
      };
    }
  }, []);

  const getAvailableEvents = useCallback(async (): Promise<AvailableEvents> => {
    try {
      const response = await apiClient.get('/webhooks/events');
      // Transform backend format to UI format
      const events: AvailableEvents = {};
      const responseData = response.data as { events: Array<{ event_type: string; description: string }> };
      const eventsData = responseData.events;
      eventsData.forEach((event) => {
        events[event.event_type] = {
          name: event.event_type.split('.').map((s: string) =>
            s.charAt(0).toUpperCase() + s.slice(1)
          ).join(' '),
          description: event.description,
        };
      });
      return events;
    } catch (err) {
      console.error('Failed to fetch events:', err);
      return {};
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  return {
    webhooks,
    loading,
    error,
    fetchWebhooks,
    createWebhook,
    updateWebhook,
    deleteWebhook,
    testWebhook,
    getAvailableEvents,
  };
}

export function useWebhookDeliveries(subscriptionId: string) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDeliveries = useCallback(async (
    page = 1,
    limit = 50,
    statusFilter?: string
  ) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      params.append('offset', ((page - 1) * limit).toString());

      if (statusFilter) {
        params.append('status', statusFilter);
      }

      const response = await apiClient.get(
        `/webhooks/subscriptions/${subscriptionId}/deliveries?${params.toString()}`
      );
      const deliveryData = (response.data || []) as any[];
      const enriched = deliveryData.map(enrichDelivery);
      setDeliveries(enriched);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch deliveries';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId]);

  const retryDelivery = useCallback(async (deliveryId: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      await apiClient.post(`/webhooks/deliveries/${deliveryId}/retry`);
      await fetchDeliveries();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to retry delivery';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [fetchDeliveries]);

  useEffect(() => {
    if (subscriptionId) {
      fetchDeliveries();
    }
  }, [subscriptionId, fetchDeliveries]);

  return {
    deliveries,
    loading,
    error,
    fetchDeliveries,
    retryDelivery,
  };
}