/**
 * Tests for useWebhooks and useWebhookDeliveries hooks
 * Tests webhook management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useWebhooks,
  useWebhookDeliveries,
  webhooksKeys,
  WebhookSubscription,
  WebhookDelivery,
  WebhookSubscriptionCreate,
  WebhookSubscriptionUpdate,
  WebhookTestResult,
  AvailableEvents,
} from "../useWebhooks";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe("useWebhooks", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("webhooksKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(webhooksKeys.all).toEqual(["webhooks"]);
      expect(webhooksKeys.subscriptions()).toEqual(["webhooks", "subscriptions"]);
      expect(webhooksKeys.subscription({ page: 1 })).toEqual([
        "webhooks",
        "subscriptions",
        { page: 1 },
      ]);
      expect(webhooksKeys.events()).toEqual(["webhooks", "events"]);
      expect(webhooksKeys.deliveries("sub-1", { page: 1 })).toEqual([
        "webhooks",
        "deliveries",
        "sub-1",
        { page: 1 },
      ]);
    });
  });

  describe("fetchWebhooks", () => {
    it("should fetch webhooks successfully", async () => {
      const mockWebhooks = [
        {
          id: "wh-1",
          url: "https://example.com/webhook",
          description: "Test webhook",
          events: ["subscriber.created"],
          is_active: true,
          retry_enabled: true,
          max_retries: 3,
          timeout_seconds: 30,
          success_count: 10,
          failure_count: 2,
          last_triggered_at: "2024-01-01T00:00:00Z",
          last_success_at: "2024-01-01T00:00:00Z",
          last_failure_at: null,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          custom_metadata: { name: "My Webhook" },
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockWebhooks });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.webhooks).toHaveLength(1);
      expect(result.current.webhooks[0].id).toBe("wh-1");
      expect(result.current.webhooks[0].url).toBe("https://example.com/webhook");
      expect(result.current.webhooks[0].name).toBe("My Webhook");
      expect(result.current.webhooks[0].total_deliveries).toBe(12); // success + failure
      expect(apiClient.get).toHaveBeenCalledWith(
        "/webhooks/subscriptions?limit=50&offset=0"
      );
    });

    it("should build query params correctly with filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(
        () =>
          useWebhooks({
            page: 2,
            limit: 25,
            eventFilter: "subscriber.created",
            activeOnly: true,
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("limit=25");
        expect(callArg).toContain("offset=25"); // (page - 1) * limit
        expect(callArg).toContain("event_type=subscriber.created");
        expect(callArg).toContain("is_active=true");
      });
    });

    it("should handle empty webhooks array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.webhooks).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch webhooks");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Error: Failed to fetch webhooks");
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch webhooks", error);
    });

    it("should enrich subscription with legacy fields", async () => {
      const mockWebhook = {
        id: "wh-1",
        url: "https://example.com/webhook",
        description: "Test",
        events: ["test.event"],
        is_active: true,
        retry_enabled: true,
        max_retries: 3,
        timeout_seconds: 30,
        success_count: 5,
        failure_count: 1,
        last_triggered_at: "2024-01-01T00:00:00Z",
        last_success_at: null,
        last_failure_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: null,
        custom_metadata: {
          name: "Custom Name",
          headers: { "X-Custom": "value" },
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockWebhook] });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const webhook = result.current.webhooks[0];
      expect(webhook.name).toBe("Custom Name");
      expect(webhook.user_id).toBe("current-user");
      expect(webhook.headers).toEqual({ "X-Custom": "value" });
      expect(webhook.total_deliveries).toBe(6);
      expect(webhook.failed_deliveries).toBe(1);
      expect(webhook.has_secret).toBe(true);
      expect(webhook.last_delivery_at).toBe("2024-01-01T00:00:00Z");
    });

    it("should use description as name fallback", async () => {
      const mockWebhook = {
        id: "wh-1",
        url: "https://example.com/webhook",
        description: "Description Name",
        events: ["test.event"],
        is_active: true,
        retry_enabled: true,
        max_retries: 3,
        timeout_seconds: 30,
        success_count: 0,
        failure_count: 0,
        last_triggered_at: null,
        last_success_at: null,
        last_failure_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: null,
        custom_metadata: {},
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockWebhook] });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.webhooks[0].name).toBe("Description Name");
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ data: [] }), 100)
          )
      );

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => expect(result.current.loading).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("fetchAvailableEvents", () => {
    it("should fetch available events successfully", async () => {
      const mockEventsResponse = {
        events: [
          {
            event_type: "subscriber.created",
            description: "Fired when a subscriber is created",
          },
          {
            event_type: "subscriber.updated",
            description: "Fired when a subscriber is updated",
          },
        ],
      };

      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/webhooks/events")) {
          return Promise.resolve({ data: mockEventsResponse });
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const events = await result.current.getAvailableEvents();

      expect(events).toEqual({
        "subscriber.created": {
          name: "Subscriber Created",
          description: "Fired when a subscriber is created",
        },
        "subscriber.updated": {
          name: "Subscriber Updated",
          description: "Fired when a subscriber is updated",
        },
      });
      expect(apiClient.get).toHaveBeenCalledWith("/webhooks/events");
    });

    it("should handle events fetch error gracefully", async () => {
      const error = new Error("Events error");
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/webhooks/events")) {
          return Promise.reject(error);
        }
        return Promise.resolve({ data: [] });
      });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const events = await result.current.getAvailableEvents();

      expect(events).toEqual({});
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch events", error);
    });
  });

  describe("createWebhook", () => {
    it("should create webhook successfully", async () => {
      const mockNewWebhook = {
        id: "wh-new",
        url: "https://example.com/webhook",
        description: "New webhook",
        events: ["subscriber.created"],
        is_active: true,
        retry_enabled: true,
        max_retries: 3,
        timeout_seconds: 30,
        success_count: 0,
        failure_count: 0,
        last_triggered_at: null,
        last_success_at: null,
        last_failure_at: null,
        created_at: "2024-01-02T00:00:00Z",
        updated_at: null,
        custom_metadata: { name: "New Webhook" },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockNewWebhook });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const createData: WebhookSubscriptionCreate = {
        url: "https://example.com/webhook",
        events: ["subscriber.created"],
        name: "New Webhook",
        description: "New webhook",
      };

      let createdWebhook: WebhookSubscription | undefined;
      await act(async () => {
        createdWebhook = await result.current.createWebhook(createData);
      });

      expect(createdWebhook?.id).toBe("wh-new");
      expect(apiClient.post).toHaveBeenCalledWith("/webhooks/subscriptions", {
        url: "https://example.com/webhook",
        events: ["subscriber.created"],
        description: "New webhook",
        custom_metadata: {
          name: "New Webhook",
          headers: undefined,
        },
      });
    });

    it("should store name and headers in custom_metadata", async () => {
      const mockNewWebhook = {
        id: "wh-new",
        url: "https://example.com/webhook",
        description: null,
        events: ["test.event"],
        is_active: true,
        retry_enabled: false,
        max_retries: 0,
        timeout_seconds: 30,
        success_count: 0,
        failure_count: 0,
        last_triggered_at: null,
        last_success_at: null,
        last_failure_at: null,
        created_at: "2024-01-02T00:00:00Z",
        updated_at: null,
        custom_metadata: {},
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockNewWebhook });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.createWebhook({
          url: "https://example.com/webhook",
          events: ["test.event"],
          name: "Test Name",
          headers: { Authorization: "Bearer token" },
        });
      });

      const callPayload = (apiClient.post as jest.Mock).mock.calls[0][1];
      expect(callPayload.custom_metadata.name).toBe("Test Name");
      expect(callPayload.custom_metadata.headers).toEqual({
        Authorization: "Bearer token",
      });
      expect(callPayload.name).toBeUndefined(); // Should be removed from root
    });

    it("should invalidate queries after successful creation", async () => {
      const mockNewWebhook = {
        id: "wh-new",
        url: "https://example.com/webhook",
        description: null,
        events: ["test.event"],
        is_active: true,
        retry_enabled: true,
        max_retries: 3,
        timeout_seconds: 30,
        success_count: 0,
        failure_count: 0,
        last_triggered_at: null,
        last_success_at: null,
        last_failure_at: null,
        created_at: "2024-01-02T00:00:00Z",
        updated_at: null,
        custom_metadata: {},
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockNewWebhook });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.createWebhook({
          url: "https://example.com/webhook",
          events: ["test.event"],
        });
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should handle create error", async () => {
      const error = new Error("Create failed");
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/webhooks/events")) {
          return Promise.resolve({ data: { events: [] } });
        }
        return Promise.resolve({ data: [] });
      });
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let errorThrown = false;
      await act(async () => {
        try {
          await result.current.createWebhook({
            url: "https://example.com/webhook",
            events: ["test.event"],
          });
        } catch (err) {
          errorThrown = true;
        }
      });

      expect(errorThrown).toBe(true);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to create webhook", error);
      });
    });
  });

  describe("updateWebhook", () => {
    it("should update webhook successfully", async () => {
      const mockUpdatedWebhook = {
        id: "wh-1",
        url: "https://example.com/updated",
        description: "Updated",
        events: ["subscriber.updated"],
        is_active: false,
        retry_enabled: true,
        max_retries: 5,
        timeout_seconds: 60,
        success_count: 10,
        failure_count: 2,
        last_triggered_at: null,
        last_success_at: null,
        last_failure_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        custom_metadata: {},
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: mockUpdatedWebhook,
      });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const updateData: WebhookSubscriptionUpdate = {
        url: "https://example.com/updated",
        is_active: false,
      };

      let updatedWebhook: WebhookSubscription | undefined;
      await act(async () => {
        updatedWebhook = await result.current.updateWebhook("wh-1", updateData);
      });

      expect(updatedWebhook?.url).toBe("https://example.com/updated");
      expect(apiClient.patch).toHaveBeenCalledWith(
        "/webhooks/subscriptions/wh-1",
        updateData
      );
    });

    it("should invalidate queries after successful update", async () => {
      const mockUpdatedWebhook = {
        id: "wh-1",
        url: "https://example.com/webhook",
        description: null,
        events: ["test.event"],
        is_active: true,
        retry_enabled: true,
        max_retries: 3,
        timeout_seconds: 30,
        success_count: 0,
        failure_count: 0,
        last_triggered_at: null,
        last_success_at: null,
        last_failure_at: null,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
        custom_metadata: {},
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.patch as jest.Mock).mockResolvedValue({
        data: mockUpdatedWebhook,
      });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.updateWebhook("wh-1", { is_active: false });
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should handle update error", async () => {
      const error = new Error("Update failed");
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/webhooks/events")) {
          return Promise.resolve({ data: { events: [] } });
        }
        return Promise.resolve({ data: [] });
      });
      (apiClient.patch as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let errorThrown = false;
      await act(async () => {
        try {
          await result.current.updateWebhook("wh-1", { is_active: false });
        } catch (err) {
          errorThrown = true;
        }
      });

      expect(errorThrown).toBe(true);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to update webhook", error);
      });
    });
  });

  describe("deleteWebhook", () => {
    it("should delete webhook successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.deleteWebhook("wh-1");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/webhooks/subscriptions/wh-1");
    });

    it("should invalidate queries after successful deletion", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.deleteWebhook("wh-1");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should handle delete error", async () => {
      const error = new Error("Delete failed");
      (apiClient.get as jest.Mock).mockImplementation((url) => {
        if (url.includes("/webhooks/events")) {
          return Promise.resolve({ data: { events: [] } });
        }
        return Promise.resolve({ data: [] });
      });
      (apiClient.delete as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let errorThrown = false;
      await act(async () => {
        try {
          await result.current.deleteWebhook("wh-1");
        } catch (err) {
          errorThrown = true;
        }
      });

      expect(errorThrown).toBe(true);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith("Failed to delete webhook", error);
      });
    });
  });

  describe("testWebhook", () => {
    it("should test webhook successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      let testResult: WebhookTestResult | undefined;
      await act(async () => {
        testResult = await result.current.testWebhook(
          "wh-1",
          "subscriber.created",
          { test: "data" }
        );
      });

      expect(testResult).toBeDefined();
      expect(testResult?.delivery_time_ms).toBeGreaterThan(0);
      expect(typeof testResult?.success).toBe("boolean");
    });

    it("should handle successful test response", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Mock Math.random to guarantee success
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.9);

      let testResult: WebhookTestResult | undefined;
      await act(async () => {
        testResult = await result.current.testWebhook("wh-1", "test.event");
      });

      expect(testResult?.success).toBe(true);
      expect(testResult?.status_code).toBe(200);
      expect(testResult?.response_body).toBe("OK");

      Math.random = originalRandom;
    });

    it("should handle failed test response", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Mock Math.random to guarantee failure
      const originalRandom = Math.random;
      Math.random = jest.fn(() => 0.1);

      let testResult: WebhookTestResult | undefined;
      await act(async () => {
        testResult = await result.current.testWebhook("wh-1", "test.event");
      });

      expect(testResult?.success).toBe(false);
      expect(testResult?.status_code).toBe(500);
      expect(testResult?.error_message).toBe("Internal Server Error");

      Math.random = originalRandom;
    });
  });

  describe("refetch function", () => {
    it("should expose fetchWebhooks refetch function", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Clear previous calls
      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.fetchWebhooks();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/webhooks/subscriptions?limit=50&offset=0"
        );
      });
    });
  });

  describe("combined loading state", () => {
    it("should show loading during mutation", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.createWebhook({
          url: "https://example.com/webhook",
          events: ["test.event"],
        });
      });

      // Wait for mutation to start
      await waitFor(() => expect(result.current.loading).toBe(true), {
        timeout: 100,
      });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.loading).toBe(false), {
        timeout: 200,
      });
    });
  });
});

describe("useWebhookDeliveries", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("fetchDeliveries", () => {
    it("should fetch deliveries successfully", async () => {
      const mockDeliveries = [
        {
          id: "del-1",
          subscription_id: "sub-1",
          event_type: "subscriber.created",
          event_id: "evt-1",
          status: "success" as const,
          response_code: 200,
          error_message: null,
          attempt_number: 1,
          duration_ms: 150,
          created_at: "2024-01-01T00:00:00Z",
          next_retry_at: null,
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockDeliveries });

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.deliveries).toHaveLength(1);
      expect(result.current.deliveries[0].id).toBe("del-1");
      expect(result.current.deliveries[0].status).toBe("success");
      expect(apiClient.get).toHaveBeenCalledWith(
        "/webhooks/subscriptions/sub-1/deliveries?limit=50&offset=0"
      );
    });

    it("should build query params correctly with filters", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      renderHook(
        () =>
          useWebhookDeliveries("sub-1", {
            page: 2,
            limit: 25,
            statusFilter: "failed",
          }),
        { wrapper: createWrapper() }
      );

      await waitFor(() => {
        const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
        expect(callArg).toContain("limit=25");
        expect(callArg).toContain("offset=25");
        expect(callArg).toContain("status=failed");
      });
    });

    it("should enrich delivery with legacy fields", async () => {
      const mockDelivery = {
        id: "del-1",
        subscription_id: "sub-1",
        event_type: "test.event",
        event_id: "evt-1",
        status: "success" as const,
        response_code: 201,
        error_message: null,
        attempt_number: 2,
        duration_ms: 200,
        created_at: "2024-01-01T00:00:00Z",
        next_retry_at: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: [mockDelivery] });

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const delivery = result.current.deliveries[0];
      expect(delivery.response_status).toBe(201);
      expect(delivery.delivered_at).toBe("2024-01-01T00:00:00Z");
      expect(delivery.retry_count).toBe(1); // attempt_number - 1
    });

    it("should handle empty deliveries array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.deliveries).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when subscriptionId is empty", async () => {
      const { result } = renderHook(() => useWebhookDeliveries(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.deliveries).toEqual([]);
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch deliveries");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.error).toBe("Error: Failed to fetch deliveries");
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch deliveries",
        error
      );
    });

    it("should handle all delivery statuses", async () => {
      const statuses: Array<
        "pending" | "success" | "failed" | "retrying" | "disabled"
      > = ["pending", "success", "failed", "retrying", "disabled"];

      for (const status of statuses) {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [
            {
              id: "del-1",
              subscription_id: "sub-1",
              event_type: "test.event",
              event_id: "evt-1",
              status,
              response_code: 200,
              error_message: null,
              attempt_number: 1,
              duration_ms: 100,
              created_at: "2024-01-01T00:00:00Z",
              next_retry_at: null,
            },
          ],
        });

        const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
          wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.deliveries[0].status).toBe(status);

        // Cleanup for next iteration
        jest.clearAllMocks();
      }
    });
  });

  describe("retryDelivery", () => {
    it("should retry delivery successfully", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.retryDelivery("del-1");
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        "/webhooks/deliveries/del-1/retry"
      );
    });

    it("should invalidate queries after successful retry", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      await act(async () => {
        await result.current.retryDelivery("del-1");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should handle retry error", async () => {
      const error = new Error("Retry failed");
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      (apiClient.post as jest.Mock).mockRejectedValue(error);

      let errorThrown = false;
      await act(async () => {
        try {
          await result.current.retryDelivery("del-1");
        } catch (err) {
          errorThrown = true;
        }
      });

      expect(errorThrown).toBe(true);
      await waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          "Failed to retry delivery",
          error
        );
      });
    });

    it("should set loading state correctly during retry", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100))
      );

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      act(() => {
        result.current.retryDelivery("del-1");
      });

      // Wait for mutation to start
      await waitFor(() => expect(result.current.loading).toBe(true), {
        timeout: 100,
      });

      // Wait for mutation to complete
      await waitFor(() => expect(result.current.loading).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("refetch function", () => {
    it("should expose fetchDeliveries refetch function", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      const { result } = renderHook(() => useWebhookDeliveries("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Clear previous calls
      (apiClient.get as jest.Mock).mockClear();

      await act(async () => {
        await result.current.fetchDeliveries();
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          "/webhooks/subscriptions/sub-1/deliveries?limit=50&offset=0"
        );
      });
    });
  });
});
