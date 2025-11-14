/**
 * MSW-powered tests for useSubscribers
 *
 * This test file uses MSW for API mocking instead of jest.mock.
 * MSW provides more realistic network mocking and better test isolation.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useSubscribers,
  useSubscriber,
  useSubscriberStatistics,
  useSubscriberServices,
  useSubscriberOperations,
  subscribersKeys,
} from "../useSubscribers";
import {
  createTestQueryClient,
  createQueryWrapper,
  resetSubscriberStorage,
  createMockSubscriber,
  createMockService,
  seedSubscriberData,
  makeApiEndpointFail,
} from "../../__tests__/test-utils";

describe("useSubscribers (MSW)", () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    resetSubscriberStorage();
  });

  afterEach(() => {
    queryClient.clear();
  });

  describe("subscribersKeys query key factory", () => {
    it("should generate correct query keys", () => {
      expect(subscribersKeys.all).toEqual(["subscribers"]);
      expect(subscribersKeys.lists()).toEqual(["subscribers", "list"]);
      expect(subscribersKeys.list({ status: ["active"] })).toEqual([
        "subscribers",
        "list",
        { status: ["active"] },
      ]);
      expect(subscribersKeys.details()).toEqual(["subscribers", "detail"]);
      expect(subscribersKeys.detail("sub-1")).toEqual(["subscribers", "detail", "sub-1"]);
      expect(subscribersKeys.statistics()).toEqual(["subscribers", "statistics"]);
      expect(subscribersKeys.services("sub-1")).toEqual(["subscribers", "services", "sub-1"]);
    });
  });

  describe("useSubscribers - fetch subscribers", () => {
    it("should fetch subscribers successfully", async () => {
      const mockSubscribers = [
        createMockSubscriber({
          id: "sub-1",
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
        }),
        createMockSubscriber({
          id: "sub-2",
          first_name: "Jane",
          last_name: "Smith",
          email: "jane@example.com",
        }),
      ];

      seedSubscriberData(mockSubscribers, []);

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Should start in loading state
      expect(result.current.isLoading).toBe(true);

      // Wait for data to load
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Verify data matches
      expect(result.current.data?.subscribers).toHaveLength(2);
      expect(result.current.data?.subscribers[0].id).toBe("sub-1");
      expect(result.current.data?.total).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty subscriber list", async () => {
      seedSubscriberData([], []);

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should filter subscribers by status", async () => {
      const subscribers = [
        createMockSubscriber({ status: "active" }),
        createMockSubscriber({ status: "suspended" }),
        createMockSubscriber({ status: "active" }),
      ];

      seedSubscriberData(subscribers, []);

      const { result } = renderHook(() => useSubscribers({ status: ["active"] }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(2);
      expect(result.current.data?.subscribers.every((s) => s.status === "active")).toBe(true);
    });

    it("should filter subscribers by connection type", async () => {
      const subscribers = [
        createMockSubscriber({ connection_type: "ftth" }),
        createMockSubscriber({ connection_type: "wireless" }),
        createMockSubscriber({ connection_type: "ftth" }),
      ];

      seedSubscriberData(subscribers, []);

      const { result } = renderHook(
        () => useSubscribers({ connection_type: ["ftth"] }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(2);
      expect(
        result.current.data?.subscribers.every((s) => s.connection_type === "ftth")
      ).toBe(true);
    });

    it("should filter subscribers by city", async () => {
      const subscribers = [
        createMockSubscriber({ service_city: "New York" }),
        createMockSubscriber({ service_city: "Los Angeles" }),
        createMockSubscriber({ service_city: "New York" }),
      ];

      seedSubscriberData(subscribers, []);

      const { result } = renderHook(() => useSubscribers({ city: "New York" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(2);
      expect(
        result.current.data?.subscribers.every((s) => s.service_city === "New York")
      ).toBe(true);
    });

    it("should search subscribers by name or email", async () => {
      const subscribers = [
        createMockSubscriber({ first_name: "John", email: "john@example.com" }),
        createMockSubscriber({ first_name: "Jane", email: "jane@example.com" }),
        createMockSubscriber({ first_name: "Bob", email: "bob@example.com" }),
      ];

      seedSubscriberData(subscribers, []);

      const { result } = renderHook(() => useSubscribers({ search: "john" }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(1);
      expect(result.current.data?.subscribers[0].first_name).toBe("John");
    });

    it("should handle pagination", async () => {
      const subscribers = Array.from({ length: 25 }, (_, i) =>
        createMockSubscriber({ id: `sub-${String(i + 1).padStart(2, '0')}` })
      );

      seedSubscriberData(subscribers, []);

      const { result } = renderHook(() => useSubscribers({ offset: 10, limit: 10 }), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(10);
      // Should have subscribers 11-20
      expect(result.current.data?.subscribers[0].id).toBe("sub-11");
    });

    it("should handle fetch error", async () => {
      makeApiEndpointFail("get", "/subscribers", "Server error");

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useSubscriber - fetch single subscriber", () => {
    it("should fetch single subscriber successfully", async () => {
      const subscriber = createMockSubscriber({
        id: "sub-1",
        first_name: "John",
        last_name: "Doe",
      });

      seedSubscriberData([subscriber], []);

      const { result } = renderHook(() => useSubscriber("sub-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.id).toBe("sub-1");
      expect(result.current.data?.first_name).toBe("John");
    });

    it("should not fetch when subscriberId is null", () => {
      const { result } = renderHook(() => useSubscriber(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should handle not found error", async () => {
      seedSubscriberData([], []);

      const { result } = renderHook(() => useSubscriber("non-existent"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useSubscriberStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const subscribers = [
        createMockSubscriber({ status: "active", connection_type: "ftth" }),
        createMockSubscriber({ status: "active", connection_type: "ftth" }),
        createMockSubscriber({ status: "suspended", connection_type: "wireless" }),
      ];

      seedSubscriberData(subscribers, []);

      const { result } = renderHook(() => useSubscriberStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeDefined();
      expect(result.current.data?.total_subscribers).toBe(3);
      expect(result.current.data?.active_subscribers).toBe(2);
      expect(result.current.data?.suspended_subscribers).toBe(1);
    });

    it("should handle empty statistics", async () => {
      seedSubscriberData([], []);

      const { result } = renderHook(() => useSubscriberStatistics(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_subscribers).toBe(0);
    });
  });

  describe("useSubscriberServices", () => {
    it("should fetch services for a subscriber", async () => {
      const subscriber = createMockSubscriber({ id: "sub-1" });
      const services = [
        createMockService("sub-1", { service_name: "Fiber 1000" }),
        createMockService("sub-1", { service_name: "IPTV" }),
      ];

      seedSubscriberData([subscriber], services);

      const { result } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data?.[0].subscriber_id).toBe("sub-1");
    });

    it("should not fetch when subscriberId is null", () => {
      const { result } = renderHook(() => useSubscriberServices(null), {
        wrapper: createQueryWrapper(queryClient),
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it("should return empty array for subscriber with no services", async () => {
      const subscriber = createMockSubscriber({ id: "sub-1" });
      seedSubscriberData([subscriber], []);

      const { result } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });
  });

  describe("useSubscriberOperations", () => {
    it("should create subscriber successfully", async () => {
      seedSubscriberData([], []);

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let createdSubscriber;
      await act(async () => {
        createdSubscriber = await result.current.createSubscriber({
          first_name: "New",
          last_name: "Subscriber",
          email: "new@example.com",
          phone: "+1234567890",
          service_address: "456 Elm St",
          service_city: "Boston",
          service_state: "MA",
          service_postal_code: "02101",
          connection_type: "ftth",
        });
      });

      expect(createdSubscriber).toBeDefined();
      expect((createdSubscriber as any).first_name).toBe("New");
    });

    it("should update subscriber successfully", async () => {
      const subscriber = createMockSubscriber({ id: "sub-1", first_name: "John" });
      seedSubscriberData([subscriber], []);

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let updatedSubscriber;
      await act(async () => {
        updatedSubscriber = await result.current.updateSubscriber("sub-1", {
          first_name: "Jane",
        });
      });

      expect(updatedSubscriber).toBeDefined();
      expect((updatedSubscriber as any).first_name).toBe("Jane");
    });

    it("should delete subscriber successfully", async () => {
      const subscriber = createMockSubscriber({ id: "sub-1" });
      seedSubscriberData([subscriber], []);

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let deleteResult;
      await act(async () => {
        deleteResult = await result.current.deleteSubscriber("sub-1");
      });

      expect(deleteResult).toBe(true);
    });

    it("should suspend subscriber successfully", async () => {
      const subscriber = createMockSubscriber({ id: "sub-1", status: "active" });
      seedSubscriberData([subscriber], []);

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let suspendResult;
      await act(async () => {
        suspendResult = await result.current.suspendSubscriber("sub-1", "Non-payment");
      });

      expect(suspendResult).toBe(true);
    });

    it("should activate subscriber successfully", async () => {
      const subscriber = createMockSubscriber({ id: "sub-1", status: "suspended" });
      seedSubscriberData([subscriber], []);

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let activateResult;
      await act(async () => {
        activateResult = await result.current.activateSubscriber("sub-1");
      });

      expect(activateResult).toBe(true);
    });

    it("should terminate subscriber successfully", async () => {
      const subscriber = createMockSubscriber({ id: "sub-1", status: "active" });
      seedSubscriberData([subscriber], []);

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      let terminateResult;
      await act(async () => {
        terminateResult = await result.current.terminateSubscriber("sub-1", "Customer request");
      });

      expect(terminateResult).toBe(true);
    });

    it("should handle create error", async () => {
      makeApiEndpointFail("post", "/subscribers", "Validation error", 400);

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createQueryWrapper(queryClient),
      });

      await expect(
        act(async () => {
          await result.current.createSubscriber({
            first_name: "Test",
            last_name: "User",
            email: "test@example.com",
            phone: "+1234567890",
            service_address: "123 Test St",
            service_city: "Test City",
            service_state: "TS",
            service_postal_code: "12345",
            connection_type: "ftth",
          });
        })
      ).rejects.toBeTruthy();
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle subscriber with multiple filters", async () => {
      const subscribers = [
        createMockSubscriber({
          status: "active",
          connection_type: "ftth",
          service_city: "New York",
        }),
        createMockSubscriber({
          status: "active",
          connection_type: "wireless",
          service_city: "New York",
        }),
        createMockSubscriber({
          status: "suspended",
          connection_type: "ftth",
          service_city: "Boston",
        }),
      ];

      seedSubscriberData(subscribers, []);

      const { result } = renderHook(
        () =>
          useSubscribers({
            status: ["active"],
            connection_type: ["ftth"],
            city: "New York",
          }),
        { wrapper: createQueryWrapper(queryClient) }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(1);
      expect(result.current.data?.subscribers[0].status).toBe("active");
      expect(result.current.data?.subscribers[0].connection_type).toBe("ftth");
      expect(result.current.data?.subscribers[0].service_city).toBe("New York");
    });

    it("should handle concurrent subscriber and services fetches", async () => {
      const subscriber = createMockSubscriber({ id: "sub-1" });
      const services = [createMockService("sub-1")];

      seedSubscriberData([subscriber], services);

      const { result: subscriberResult } = renderHook(() => useSubscriber("sub-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      const { result: servicesResult } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createQueryWrapper(queryClient),
      });

      // Both should load independently
      await waitFor(() => {
        expect(subscriberResult.current.isLoading).toBe(false);
        expect(servicesResult.current.isLoading).toBe(false);
      });

      expect(subscriberResult.current.data).toBeDefined();
      expect(servicesResult.current.data).toHaveLength(1);
    });
  });
});
