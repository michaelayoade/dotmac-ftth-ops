/// <reference types="jest" />

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

export interface MockedApiClient {
  get: jest.Mock;
  post: jest.Mock;
  patch: jest.Mock;
  delete: jest.Mock;
}

interface UseWebhooksResult {
  webhooks: any[];
  loading: boolean;
  error: string | null;
  fetchWebhooks: (page?: number, limit?: number, eventFilter?: string, activeOnly?: boolean) => Promise<void>;
  createWebhook: (data: Record<string, any>) => Promise<any>;
  updateWebhook: (id: string, data: Record<string, any>) => Promise<any>;
  deleteWebhook: (id: string) => Promise<void>;
  testWebhook: (id: string, eventType: string, payload?: Record<string, any>) => Promise<any>;
  getAvailableEvents: () => Promise<Record<string, any>>;
}

interface UseWebhookDeliveriesResult {
  deliveries: any[];
  loading: boolean;
  error: string | null;
  fetchDeliveries: (page?: number, limit?: number, statusFilter?: string) => Promise<void>;
  retryDelivery: (deliveryId: string) => Promise<void>;
}

interface RunSuiteOptions {
  label: string;
  useWebhooks: () => UseWebhooksResult;
  useWebhookDeliveries: (subscriptionId: string) => UseWebhookDeliveriesResult;
  apiClient: MockedApiClient;
}

const createSubscription = (overrides: Record<string, any> = {}) => ({
  id: "webhook-1",
  url: "https://example.com/webhook",
  description: "Primary webhook",
  events: ["customer.created"],
  is_active: true,
  retry_enabled: true,
  max_retries: 5,
  timeout_seconds: 30,
  success_count: 12,
  failure_count: 3,
  last_triggered_at: "2024-10-10T10:00:00Z",
  last_success_at: "2024-10-10T09:59:00Z",
  last_failure_at: "2024-10-10T09:50:00Z",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: null,
  custom_metadata: {
    name: "Customer Webhook",
    headers: {
      "X-Signature": "secret",
    },
  },
  ...overrides,
});

const createDelivery = (overrides: Record<string, any> = {}) => ({
  id: "delivery-1",
  subscription_id: "webhook-1",
  event_type: "customer.created",
  event_id: "evt-1",
  status: "success",
  response_code: 200,
  error_message: null,
  attempt_number: 2,
  duration_ms: 450,
  created_at: "2024-10-10T10:00:00Z",
  next_retry_at: null,
  ...overrides,
});

const WEBHOOKS_SUBSCRIPTIONS_ENDPOINT = "/webhooks/subscriptions";
const WEBHOOK_EVENTS_ENDPOINT = "/webhooks/events";
const deliveriesEndpoint = (subscriptionId: string) =>
  `/webhooks/subscriptions/${subscriptionId}/deliveries`;

const callsMatchingPrefix = (mockFn: jest.Mock, prefix: string) =>
  mockFn.mock.calls.filter(
    ([url]) => typeof url === "string" && (url as string).startsWith(prefix),
  );

const waitForCallWithPrefix = async (mockFn: jest.Mock, prefix: string) => {
  await waitFor(() => {
    expect(callsMatchingPrefix(mockFn, prefix).length).toBeGreaterThan(0);
  });
  const calls = callsMatchingPrefix(mockFn, prefix);
  return calls[calls.length - 1];
};

export function runUseWebhooksTestSuite({
  label,
  useWebhooks,
  useWebhookDeliveries,
  apiClient,
}: RunSuiteOptions) {
  const createWrapper = (customQueryClient?: QueryClient) => {
    const queryClient = customQueryClient || new QueryClient({
      defaultOptions: {
        queries: { retry: false, cacheTime: 0, staleTime: 0 },
        mutations: { retry: false },
      },
    });
    return ({ children }: { children: React.ReactNode }) => (
      React.createElement(QueryClientProvider, { client: queryClient }, children)
    );
  };

  describe(`${label} - useWebhooks`, () => {
    let testQueryClient: QueryClient;
    let createTestWrapper: () => ({ children }: { children: React.ReactNode }) => React.ReactElement;

    beforeEach(() => {
      jest.clearAllMocks();
      jest.useRealTimers();
      testQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, cacheTime: 0, staleTime: 0 },
          mutations: { retry: false },
        },
      });
      createTestWrapper = () => createWrapper(testQueryClient);
      apiClient.get.mockImplementation((url: string) => {
        if (typeof url === "string" && url.startsWith(WEBHOOK_EVENTS_ENDPOINT)) {
          return Promise.resolve({
            data: {
              events: [
                { event_type: "customer.created", description: "Customer created" },
                { event_type: "customer.deleted", description: "Customer deleted" },
              ],
            },
          });
        }
        if (typeof url === "string" && url.startsWith(WEBHOOKS_SUBSCRIPTIONS_ENDPOINT)) {
          return Promise.resolve({ data: [] });
        }
        if (typeof url === "string" && url.includes("/deliveries")) {
          return Promise.resolve({ data: [] });
        }
        return Promise.resolve({ data: [] });
      });
    });

    afterEach(() => {
      testQueryClient.clear();
    });

    it("loads webhooks on mount and enriches fields", async () => {
      const rawSubscription = createSubscription({
        success_count: 5,
        failure_count: 1,
        custom_metadata: {
          name: "Provisioning Webhook",
          headers: { "X-Test": "yes" },
        },
      });

      apiClient.get.mockResolvedValueOnce({ data: [rawSubscription] });

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });

      await waitFor(() => expect(result.current.webhooks).toHaveLength(1));

      const webhook = result.current.webhooks[0];
      expect(webhook.name).toBe("Provisioning Webhook");
      expect(webhook.total_deliveries).toBe(6);
      expect(webhook.failed_deliveries).toBe(1);
      expect(webhook.headers).toEqual({ "X-Test": "yes" });
      expect(result.current.error).toBeNull();
    });

    it("handles fetch errors gracefully", async () => {
      const fetchError = new Error("Failed to fetch webhooks");
      apiClient.get.mockRejectedValueOnce(fetchError);

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });

      await waitFor(() =>
        expect(result.current.error?.includes(fetchError.message)).toBe(true),
      );
      expect(result.current.webhooks).toHaveLength(0);
    });

    it("supports pagination and filters when fetching webhooks", async () => {
      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitForCallWithPrefix(apiClient.get, WEBHOOKS_SUBSCRIPTIONS_ENDPOINT);

      await act(async () => {
        await result.current.fetchWebhooks(2, 25, "customer.created", true);
      });

      const lastCallArgs = await waitForCallWithPrefix(
        apiClient.get,
        WEBHOOKS_SUBSCRIPTIONS_ENDPOINT,
      );
      expect(lastCallArgs).toBeDefined();
      const [url] = lastCallArgs!;
      expect(url).toContain("limit=25");
      expect(url).toContain("offset=25");
      expect(url).toContain("event_type=customer.created");
      expect(url).toContain("is_active=true");
    });

    it("creates a webhook, merges metadata, and prepends result", async () => {
      const createdSubscription = createSubscription({ id: "webhook-2" });
      apiClient.post.mockResolvedValueOnce({ data: createdSubscription });

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
      apiClient.get.mockClear();

      const payload = {
        url: "https://hooks.example.com/created",
        events: ["customer.created"],
        name: "Alert Webhook",
        headers: { "X-Auth": "token" },
        custom_metadata: { channel: "ops" },
      };

      await act(async () => {
        await result.current.createWebhook(payload);
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/webhooks/subscriptions",
        expect.objectContaining({
          url: payload.url,
          events: payload.events,
          custom_metadata: expect.objectContaining({
            channel: "ops",
            name: "Alert Webhook",
            headers: payload.headers,
          }),
        }),
      );
      const postPayload = apiClient.post.mock.calls[0][1];
      expect(postPayload.name).toBe(payload.name);
    });

    it("updates an existing webhook in place", async () => {
      const existing = createSubscription({ id: "webhook-3", description: "Original" });
      const updated = { ...existing, description: "Updated description" };

      apiClient.get.mockResolvedValueOnce({ data: [existing] });
      apiClient.patch.mockResolvedValueOnce({ data: updated });

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.webhooks).toHaveLength(1));
      expect(result.current.webhooks[0].description).toBe("Original");

      await act(async () => {
        await result.current.updateWebhook(existing.id, { description: "Updated description" });
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        `/webhooks/subscriptions/${existing.id}`,
        expect.objectContaining({ description: "Updated description" }),
      );
    });

    it("deletes a webhook and removes it from state", async () => {
      const existing = createSubscription({ id: "webhook-4" });

      apiClient.get.mockResolvedValueOnce({ data: [existing] });
      apiClient.delete.mockResolvedValueOnce({});

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.webhooks).toHaveLength(1));

      await act(async () => {
        await result.current.deleteWebhook(existing.id);
      });

      expect(apiClient.delete).toHaveBeenCalledWith(`/webhooks/subscriptions/${existing.id}`);
      expect(result.current.webhooks).toHaveLength(0);
    });

    it("transforms available events into UI-friendly labels", async () => {
      apiClient.get
        .mockResolvedValueOnce({ data: [] })
        .mockResolvedValueOnce({
          data: {
            events: [
              { event_type: "customer.created", description: "Customer created event" },
              { event_type: "subscription.paused", description: "Subscription paused" },
            ],
          },
        });

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
      apiClient.get.mockClear();

      let events: Record<string, any> = {};
      await waitFor(async () => {
        events = await result.current.getAvailableEvents();
        expect(Object.keys(events).length).toBeGreaterThan(0);
      });

      expect(events["customer.created"]).toEqual({
        name: "Customer Created",
        description: "Customer created event",
      });
      expect(events["subscription.paused"]).toEqual({
        name: "Subscription Paused",
        description: "Subscription paused",
      });
    });

    it("falls back to description or default name when metadata is missing", async () => {
      apiClient.get.mockResolvedValueOnce({
        data: [
          createSubscription({
            id: "webhook-desc",
            custom_metadata: undefined,
            description: "Fallback Description",
          }),
          createSubscription({
            id: "webhook-generic",
            custom_metadata: undefined,
            description: null,
          }),
        ],
      });

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });

      await waitFor(() => expect(result.current.webhooks).toHaveLength(2));
      const [withDescription, withoutDescription] = result.current.webhooks;
      expect(withDescription.name).toBe("Fallback Description");
      expect(withoutDescription.name).toBe("Webhook");
    });

    it("clears previous errors after a successful refetch", async () => {
      apiClient.get
        .mockRejectedValueOnce(new Error("Initial failure"))
        .mockResolvedValueOnce({ data: [createSubscription({ id: "webhook-success" })] });

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitFor(() =>
        expect(result.current.error?.includes("Initial failure")).toBe(true),
      );

      await act(async () => {
        await expect(result.current.fetchWebhooks()).resolves.not.toThrow();
      });

      await waitFor(() => expect(result.current.error).toBeNull());
    });

    it("surfaces create errors and keeps state stable", async () => {
      apiClient.post.mockRejectedValueOnce(new Error("Create failed"));
      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
      apiClient.get.mockClear();

      await act(async () => {
        await expect(
          result.current.createWebhook({
            url: "https://hooks.example.com/error",
            events: ["customer.created"],
            name: "Broken",
          }),
        ).rejects.toThrow("Create failed");
      });

      expect(result.current.webhooks).toHaveLength(0);
    });

    it("surfaces update errors without mutating original webhook", async () => {
      const existing = createSubscription({ id: "webhook-update", description: "Original" });
      apiClient.get.mockResolvedValueOnce({ data: [existing] });
      apiClient.patch.mockRejectedValueOnce(new Error("Update failed"));

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.webhooks).toHaveLength(1));

      await act(async () => {
        await expect(
          result.current.updateWebhook(existing.id, { description: "Updated" }),
        ).rejects.toThrow("Update failed");
      });

      expect(result.current.webhooks[0].description).toBe("Original");
    });

    it("surfaces delete errors and keeps list intact", async () => {
      const existing = createSubscription({ id: "webhook-delete" });
      apiClient.get.mockResolvedValueOnce({ data: [existing] });
      apiClient.delete.mockRejectedValueOnce(new Error("Delete failed"));

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.webhooks).toHaveLength(1));

      await act(async () => {
        await expect(result.current.deleteWebhook(existing.id)).rejects.toThrow(
          "Delete failed",
        );
      });

      expect(result.current.webhooks).toHaveLength(1);
    });

    it("returns an empty map when available events cannot be fetched", async () => {
      apiClient.get
        .mockResolvedValueOnce({ data: [] })
        .mockRejectedValueOnce(new Error("Events failed"));

      const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });
      await waitForCallWithPrefix(apiClient.get, WEBHOOKS_SUBSCRIPTIONS_ENDPOINT);
      await waitForCallWithPrefix(apiClient.get, WEBHOOK_EVENTS_ENDPOINT);

      const events = await result.current.getAvailableEvents();

      expect(events).toEqual({});
    });

    describe("testWebhook behaviour", () => {
      it("posts to the backend and returns the parsed response", async () => {
        const mockPayload = { sample: true };
        apiClient.post.mockResolvedValueOnce({
          status: 202,
          data: {
            success: true,
            status_code: 202,
            response_body: "Queued",
            delivery_time_ms: 120,
          },
        });

        const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });

        const response = await result.current.testWebhook(
          "webhook-1",
          "customer.created",
          mockPayload,
        );

        expect(apiClient.post).toHaveBeenCalledWith(
          "/webhooks/subscriptions/webhook-1/test",
          { event_type: "customer.created", payload: mockPayload },
        );
        expect(response).toEqual({
          success: true,
          status_code: 202,
          response_body: "Queued",
          error_message: undefined,
          delivery_time_ms: 120,
        });
      });

      it("falls back to response status when optional fields are missing", async () => {
        apiClient.post.mockResolvedValueOnce({
          status: 500,
          data: { success: false, error_message: "Endpoint error" },
        });

        const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });

        const response = await result.current.testWebhook("webhook-2", "customer.updated");

        expect(response).toMatchObject({
          success: false,
          status_code: 500,
          error_message: "Endpoint error",
          delivery_time_ms: 0,
        });
      });

      it("surfaces backend errors during testWebhook", async () => {
        apiClient.post.mockRejectedValueOnce(new Error("random failure"));

        const { result } = renderHook(() => useWebhooks(), { wrapper: createTestWrapper() });

        await expect(
          result.current.testWebhook("webhook-1", "customer.created"),
        ).rejects.toThrow("random failure");
      });
    });
  });

  describe(`${label} - useWebhookDeliveries`, () => {
    let testQueryClient: QueryClient;
    let createTestWrapper: () => ({ children }: { children: React.ReactNode }) => React.ReactElement;

    beforeEach(() => {
      jest.clearAllMocks();
      testQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, cacheTime: 0, staleTime: 0 },
          mutations: { retry: false },
        },
      });
      createTestWrapper = () => createWrapper(testQueryClient);
      apiClient.get.mockResolvedValue({ data: [] });
    });

    afterEach(() => {
      testQueryClient.clear();
    });

    it("fetches deliveries on mount and enriches records", async () => {
      const rawDelivery = createDelivery({ attempt_number: 3 });
      apiClient.get.mockResolvedValueOnce({ data: [rawDelivery] });

      const { result } = renderHook(() => useWebhookDeliveries("webhook-1"), { wrapper: createTestWrapper() });

      await waitForCallWithPrefix(apiClient.get, deliveriesEndpoint("webhook-1"));
      await waitFor(() => expect(result.current.deliveries).toHaveLength(1));
      const delivery = result.current.deliveries[0];
      expect(delivery.retry_count).toBe(2);
      expect(delivery.response_status).toBe(200);
      expect(delivery.delivered_at).toBe(rawDelivery.created_at);
    });

    it("handles delivery fetch failures", async () => {
      apiClient.get.mockRejectedValueOnce(new Error("Failed to fetch deliveries"));

      const { result } = renderHook(() => useWebhookDeliveries("webhook-1"), { wrapper: createTestWrapper() });

      await waitFor(() =>
        expect(result.current.error?.includes("Failed to fetch deliveries")).toBe(true),
      );
      expect(result.current.deliveries).toHaveLength(0);
    });

    it("retries a delivery and refetches the list", async () => {
      apiClient.post.mockResolvedValueOnce({});
      const { result } = renderHook(() => useWebhookDeliveries("webhook-1"), { wrapper: createTestWrapper() });

      await waitForCallWithPrefix(apiClient.get, deliveriesEndpoint("webhook-1"));
      apiClient.get.mockClear();

      await act(async () => {
        await result.current.retryDelivery("delivery-1");
      });

      expect(apiClient.post).toHaveBeenCalledWith("/webhooks/deliveries/delivery-1/retry");
      await waitForCallWithPrefix(apiClient.get, deliveriesEndpoint("webhook-1"));
    });

    it("supports pagination and status filters when fetching deliveries manually", async () => {
      const { result } = renderHook(() => useWebhookDeliveries("webhook-1"), { wrapper: createTestWrapper() });
      await waitForCallWithPrefix(apiClient.get, deliveriesEndpoint("webhook-1"));
      apiClient.get.mockClear();

      await act(async () => {
        await result.current.fetchDeliveries(3, 20, "failed");
      });

      const callArgs = await waitForCallWithPrefix(
        apiClient.get,
        deliveriesEndpoint("webhook-1"),
      );
      expect(callArgs).toBeDefined();
      const [url] = callArgs!;
      expect(url).toContain("limit=20");
      expect(url).toContain("offset=40");
      expect(url).toContain("status=failed");
    });

    it("does not auto-fetch deliveries when subscriptionId is empty", async () => {
      renderHook(() => useWebhookDeliveries(""), { wrapper: createTestWrapper() });
      await waitFor(() =>
        expect(callsMatchingPrefix(apiClient.get, "/webhooks/subscriptions/")).toHaveLength(0),
      );
    });

    it("surfaces retry errors and keeps existing deliveries", async () => {
      const rawDelivery = createDelivery();
      apiClient.get.mockResolvedValueOnce({ data: [rawDelivery] });
      apiClient.post.mockRejectedValueOnce(new Error("Retry failed"));

      const { result } = renderHook(() => useWebhookDeliveries("webhook-1"), { wrapper: createTestWrapper() });
      await waitFor(() => expect(result.current.deliveries).toHaveLength(1));

      await act(async () => {
        await expect(result.current.retryDelivery("delivery-1")).rejects.toThrow(
          "Retry failed",
        );
      });

      expect(result.current.deliveries).toHaveLength(1);
    });
  });
}
