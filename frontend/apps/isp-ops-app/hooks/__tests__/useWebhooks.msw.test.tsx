/**
 * MSW-powered tests for useWebhooks
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 *
 * Tests the actual hook contract: { webhooks, loading, error, createWebhook, ... }
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useWebhooks, useWebhookDeliveries, webhooksKeys } from "../useWebhooks";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetWebhookStorage,
  createMockWebhook,
  createMockDelivery,
  seedWebhookData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

const waitForWebhooksLoading = async (getLoading: () => boolean) => {
  await waitFor(() => expect(getLoading()).toBe(false), { timeout: 5000 });
};

describe("useWebhooks (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetWebhookStorage(); // Clear MSW storage
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("webhooksKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(webhooksKeys.all).toEqual(["webhooks"]);
      expect(webhooksKeys.subscription()).toEqual(["webhooks", "subscriptions"]);
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

  describe("useWebhooks - fetch webhooks", () => {
    it("should fetch webhooks successfully", async () => {
      // Seed MSW with test data
      const mockWebhooks = [
        createMockWebhook({
          id: "wh-1",
          url: "https://example.com/webhook",
          events: ["subscriber.created"],
          success_count: 10,
          failure_count: 2,
        }),
        createMockWebhook({
          id: "wh-2",
          url: "https://example.com/webhook2",
          events: ["subscriber.updated"],
          is_active: false,
        }),
      ];

      seedWebhookData(mockWebhooks, []);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.loading).toBe(true);

      // Wait for data to load
      await waitForWebhooksLoading(() => result.current.loading);

      // Verify data matches actual hook API
      expect(result.current.webhooks).toBeDefined();
      expect(result.current.webhooks).toHaveLength(2);
      expect(result.current.webhooks[0].id).toBe("wh-1");
      expect(result.current.webhooks[0].url).toBe("https://example.com/webhook");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty webhook list", async () => {
      seedWebhookData([], []);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForWebhooksLoading(() => result.current.loading);

      expect(result.current.webhooks).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter webhooks by event", async () => {
      const webhooks = [
        createMockWebhook({ events: ["subscriber.created"] }),
        createMockWebhook({ events: ["subscriber.updated"] }),
        createMockWebhook({ events: ["subscriber.created", "subscriber.deleted"] }),
      ];

      seedWebhookData(webhooks, []);

      const { result } = renderHook(
        () => useWebhooks({ eventFilter: "subscriber.created" }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitForWebhooksLoading(() => result.current.loading);

      // Should only return webhooks with subscriber.created event
      expect(result.current.webhooks).toHaveLength(2);
      expect(result.current.webhooks.every((wh) =>
        wh.events.includes("subscriber.created")
      )).toBe(true);
    });

    it("should handle pagination", async () => {
      const webhooks = Array.from({ length: 25 }, (_, i) =>
        createMockWebhook({ id: `wh-${i + 1}` })
      );

      seedWebhookData(webhooks, []);

      const { result } = renderHook(
        () => useWebhooks({ page: 2, limit: 10 }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitForWebhooksLoading(() => result.current.loading);

      expect(result.current.webhooks).toHaveLength(10);
      // Page 2 should have webhooks 11-20
      expect(result.current.webhooks[0].id).toBe("wh-11");
    });

    it("should handle fetch error", async () => {
      // Make the endpoint fail
      makeApiEndpointFail('get', '/api/v1/webhooks/subscriptions', 'Server error');

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForWebhooksLoading(() => result.current.loading);

      expect(result.current.error).toBeTruthy();
      expect(result.current.webhooks).toHaveLength(0);
    });
  });

  describe("useWebhookDeliveries - fetch deliveries", () => {
    it("should fetch webhook deliveries successfully", async () => {
      const webhook = createMockWebhook({ id: "wh-1" });
      const deliveries = [
        createMockDelivery("wh-1", { status: "success", response_code: 200 }),
        createMockDelivery("wh-1", { status: "failed", response_code: 500 }),
        createMockDelivery("wh-1", { status: "retrying", attempt_number: 2 }),
      ];

      seedWebhookData([webhook], deliveries);

      const { result } = renderHook(() => useWebhookDeliveries("wh-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForWebhooksLoading(() => result.current.loading);

      expect(result.current.deliveries).toBeDefined();
      expect(result.current.deliveries).toHaveLength(3);
      expect(result.current.deliveries[0].subscription_id).toBe("wh-1");
    });

    it("should filter deliveries by status", async () => {
      const webhook = createMockWebhook({ id: "wh-1" });
      const deliveries = [
        createMockDelivery("wh-1", { status: "success" }),
        createMockDelivery("wh-1", { status: "failed" }),
        createMockDelivery("wh-1", { status: "success" }),
      ];

      seedWebhookData([webhook], deliveries);

      const { result } = renderHook(
        () => useWebhookDeliveries("wh-1", { statusFilter: "success" }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitForWebhooksLoading(() => result.current.loading);

      expect(result.current.deliveries).toHaveLength(2);
      expect(result.current.deliveries.every((d) => d.status === "success")).toBe(true);
    });

    it("should return empty array for webhook with no deliveries", async () => {
      const webhook = createMockWebhook({ id: "wh-1" });
      seedWebhookData([webhook], []);

      const { result } = renderHook(() => useWebhookDeliveries("wh-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForWebhooksLoading(() => result.current.loading);

      expect(result.current.deliveries).toHaveLength(0);
    });

    it("should not fetch when subscriptionId is null", () => {
      const { result } = renderHook(() => useWebhookDeliveries(null as any), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Query should not execute with null ID
      expect(result.current.loading).toBe(false);
      expect(result.current.deliveries).toHaveLength(0);
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle webhook with mixed delivery statuses", async () => {
      const webhook = createMockWebhook({
        id: "wh-1",
        success_count: 10,
        failure_count: 3,
      });

      const deliveries = [
        ...Array.from({ length: 10 }, () =>
          createMockDelivery("wh-1", { status: "success" })
        ),
        ...Array.from({ length: 3 }, () =>
          createMockDelivery("wh-1", { status: "failed" })
        ),
      ];

      seedWebhookData([webhook], deliveries);

      const { result: webhookResult } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      const { result: deliveriesResult } = renderHook(
        () => useWebhookDeliveries("wh-1"),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitFor(() => {
        expect(webhookResult.current.loading).toBe(false);
        expect(deliveriesResult.current.loading).toBe(false);
      });

      expect(webhookResult.current.webhooks[0].success_count).toBe(10);
      expect(webhookResult.current.webhooks[0].failure_count).toBe(3);
      expect(deliveriesResult.current.deliveries).toHaveLength(13);
    });

    it("should handle concurrent webhook and delivery fetches", async () => {
      const webhook = createMockWebhook({ id: "wh-1" });
      const deliveries = [createMockDelivery("wh-1")];

      seedWebhookData([webhook], deliveries);

      const { result: webhookResult } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      const { result: deliveriesResult } = renderHook(
        () => useWebhookDeliveries("wh-1"),
        { wrapper: createQueryWrapper(queryClient) }
      );

      // Both should load independently
      await waitFor(() => {
        expect(webhookResult.current.loading).toBe(false);
        expect(deliveriesResult.current.loading).toBe(false);
      });

      expect(webhookResult.current.webhooks).toBeDefined();
      expect(deliveriesResult.current.deliveries).toBeDefined();
    });
  });
});
