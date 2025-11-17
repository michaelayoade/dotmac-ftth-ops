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

const waitForHookSettled = async (loadingAccessor: () => boolean) => {
  await waitFor(() => expect(loadingAccessor()).toBe(false), { timeout: 5000 });
};

describe("Platform Admin useWebhooks (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetWebhookStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("webhooksKeys factory", () => {
    it("generates the expected query keys", () => {
      expect(webhooksKeys.all).toEqual(["webhooks"]);
      expect(webhooksKeys.subscription({ page: 1 })).toEqual(["webhooks", "subscriptions", { page: 1 }]);
      expect(webhooksKeys.events()).toEqual(["webhooks", "events"]);
      expect(webhooksKeys.deliveries("sub-1", { status: "success" })).toEqual([
        "webhooks",
        "deliveries",
        "sub-1",
        { status: "success" },
      ]);
    });
  });

  describe("useWebhooks", () => {
    it("loads webhook subscriptions", async () => {
      const mockWebhooks = [
        createMockWebhook({ id: "wh-1", success_count: 5, failure_count: 1 }),
        createMockWebhook({ id: "wh-2", is_active: false }),
      ];
      seedWebhookData(mockWebhooks, []);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.loading).toBe(true);
      await waitForHookSettled(() => result.current.loading);

      expect(result.current.webhooks).toHaveLength(2);
      expect(result.current.webhooks[0].id).toBe("wh-1");
      expect(result.current.error).toBeNull();
    });

    it("applies filters from hook options", async () => {
      const items = [
        createMockWebhook({ id: "wh-1", events: ["customer.created"] }),
        createMockWebhook({ id: "wh-2", events: ["customer.deleted"] }),
        createMockWebhook({ id: "wh-3", events: ["customer.created", "customer.updated"], is_active: false }),
      ];
      seedWebhookData(items, []);

      const { result } = renderHook(() => useWebhooks({ eventFilter: "customer.created", activeOnly: true }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHookSettled(() => result.current.loading);
      expect(result.current.webhooks).toHaveLength(1);
      expect(result.current.webhooks[0].id).toBe("wh-1");
    });

    it("supports pagination", async () => {
      const list = Array.from({ length: 25 }, (_, idx) => createMockWebhook({ id: `wh-${idx + 1}` }));
      seedWebhookData(list, []);

      const { result } = renderHook(() => useWebhooks({ page: 2, limit: 10 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHookSettled(() => result.current.loading);
      expect(result.current.webhooks).toHaveLength(10);
      expect(result.current.webhooks[0].id).toBe("wh-11");
    });

    it("surfaces fetch errors", async () => {
      makeApiEndpointFail("get", "/webhooks/subscriptions", "Server exploded");

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHookSettled(() => result.current.loading);
      expect(result.current.error).toContain("Server exploded");
      expect(result.current.webhooks).toHaveLength(0);
    });

    it("creates a webhook and prepends it", async () => {
      seedWebhookData([], []);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });
      await waitForHookSettled(() => result.current.loading);

      await act(async () => {
        await result.current.createWebhook({
          url: "https://hooks.example.com",
          events: ["customer.created"],
          name: "Ops Webhook",
          headers: { "X-Test": "yes" },
          custom_metadata: { priority: "high" },
        });
      });

      expect(result.current.webhooks.length).toBe(1);
      const created = result.current.webhooks[0];
      expect(created.custom_metadata?.name).toBe("Ops Webhook");
      expect(created.custom_metadata?.headers).toEqual({ "X-Test": "yes" });
    });

    it("updates an existing webhook", async () => {
      const initial = createMockWebhook({ id: "wh-99", description: "Original" });
      seedWebhookData([initial], []);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHookSettled(() => result.current.loading);
      expect(result.current.webhooks[0].description).toBe("Original");

      await act(async () => {
        await result.current.updateWebhook("wh-99", { description: "Updated" });
      });

      expect(result.current.webhooks[0].description).toBe("Updated");
    });

    it("deletes a webhook from cache", async () => {
      const data = [createMockWebhook({ id: "wh-1" }), createMockWebhook({ id: "wh-2" })];
      seedWebhookData(data, []);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });
      await waitForHookSettled(() => result.current.loading);
      expect(result.current.webhooks).toHaveLength(2);

      await act(async () => {
        await result.current.deleteWebhook("wh-1");
      });

      expect(result.current.webhooks).toHaveLength(1);
      expect(result.current.webhooks[0].id).toBe("wh-2");
    });

    it("returns available events", async () => {
      seedWebhookData([], []);

      const { result } = renderHook(() => useWebhooks(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHookSettled(() => result.current.loading);
      const events = await result.current.getAvailableEvents();
      expect(events["customer.created"]).toBeDefined();
    });
  });

  describe("useWebhookDeliveries", () => {
    it("loads deliveries for a subscription", async () => {
      const webhook = createMockWebhook({ id: "wh-1" });
      const deliveries = [
        createMockDelivery("wh-1", { status: "success" }),
        createMockDelivery("wh-1", { status: "failed", response_code: 500 }),
      ];
      seedWebhookData([webhook], deliveries);

      const { result } = renderHook(() => useWebhookDeliveries("wh-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHookSettled(() => result.current.loading);
      expect(result.current.deliveries).toHaveLength(2);
      expect(result.current.deliveries[0].subscription_id).toBe("wh-1");
    });

    it("filters deliveries by status", async () => {
      const webhook = createMockWebhook({ id: "wh-1" });
      const deliveries = [
        createMockDelivery("wh-1", { status: "success" }),
        createMockDelivery("wh-1", { status: "failed" }),
        createMockDelivery("wh-1", { status: "success" }),
      ];
      seedWebhookData([webhook], deliveries);

      const { result } = renderHook(() => useWebhookDeliveries("wh-1", { statusFilter: "success" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHookSettled(() => result.current.loading);
      expect(result.current.deliveries).toHaveLength(2);
      expect(result.current.deliveries.every((delivery) => delivery.status === "success")).toBe(true);
    });

    it("handles fetch errors", async () => {
      makeApiEndpointFail("get", "/webhooks/subscriptions/wh-1/deliveries", "boom");

      const { result } = renderHook(() => useWebhookDeliveries("wh-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitForHookSettled(() => result.current.loading);
      expect(result.current.error).toContain("boom");
      expect(result.current.deliveries).toHaveLength(0);
    });

    it("retries deliveries", async () => {
      const webhook = createMockWebhook({ id: "wh-1" });
      const delivery = createMockDelivery("wh-1", { id: "del-1", status: "failed", attempt_number: 1 });
      seedWebhookData([webhook], [delivery]);

      const { result } = renderHook(() => useWebhookDeliveries("wh-1"), {
        wrapper: createQueryWrapper(queryClient),
      });
      await waitForHookSettled(() => result.current.loading);

      await act(async () => {
        await result.current.retryDelivery("del-1");
      });

      await waitForHookSettled(() => result.current.loading);
      expect(result.current.deliveries[0].status).toBe("retrying");
      expect(result.current.deliveries[0].attempt_number).toBeGreaterThan(1);
    });
  });
});
