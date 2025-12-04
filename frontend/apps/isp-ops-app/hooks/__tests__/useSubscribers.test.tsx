/**
 * Jest Mock Tests for useSubscribers
 *
 * Uses direct jest mocks for API client instead of MSW for reliable testing
 * of axios-based React Query hooks with both queries and mutations.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useSubscribers,
  useSubscriber,
  useSubscriberStatistics,
  useSubscriberServices,
  useSubscriberOperations,
  subscribersKeys,
  type Subscriber,
  type SubscriberStatistics,
  type SubscriberService,
  type CreateSubscriberRequest,
  type UpdateSubscriberRequest,
} from "../useSubscribers";

// Mock API client
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { apiClient } from "@/lib/api/client";

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Test wrapper
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock data helpers
const createMockSubscriber = (overrides?: Partial<Subscriber>): Subscriber => ({
  id: "sub-1",
  tenant_id: "tenant-1",
  subscriber_id: "SUB-001",
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@example.com",
  phone: "+1234567890",
  service_address: "123 Main St",
  service_city: "New York",
  service_state: "NY",
  service_postal_code: "10001",
  service_country: "USA",
  status: "active",
  connection_type: "ftth",
  service_plan: "Premium 1Gbps",
  bandwidth_mbps: 1000,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockService = (overrides?: Partial<SubscriberService>): SubscriberService => ({
  id: "svc-1",
  subscriber_id: "sub-1",
  service_type: "internet",
  service_name: "Premium Internet",
  status: "active",
  bandwidth_mbps: 1000,
  monthly_fee: 99.99,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  ...overrides,
});

const createMockStatistics = (overrides?: Partial<SubscriberStatistics>): SubscriberStatistics => ({
  total_subscribers: 100,
  active_subscribers: 85,
  suspended_subscribers: 10,
  pending_subscribers: 5,
  new_this_month: 12,
  churn_this_month: 3,
  average_uptime: 99.5,
  total_bandwidth_gbps: 100,
  by_connection_type: {
    ftth: 70,
    fttb: 20,
    wireless: 8,
    hybrid: 2,
  },
  by_status: {
    active: 85,
    suspended: 10,
    pending: 5,
    inactive: 0,
    terminated: 0,
  },
  ...overrides,
});

describe("useSubscribers - Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Query Key Factory", () => {
    it("should generate correct base key", () => {
      expect(subscribersKeys.all).toEqual(["subscribers"]);
    });

    it("should generate correct lists key", () => {
      expect(subscribersKeys.lists()).toEqual(["subscribers", "list"]);
    });

    it("should generate correct list key with params", () => {
      expect(subscribersKeys.list({ status: ["active"] })).toEqual([
        "subscribers",
        "list",
        { status: ["active"] },
      ]);
    });

    it("should generate correct details key", () => {
      expect(subscribersKeys.details()).toEqual(["subscribers", "detail"]);
    });

    it("should generate correct detail key", () => {
      expect(subscribersKeys.detail("sub-1")).toEqual(["subscribers", "detail", "sub-1"]);
    });

    it("should generate correct statistics key", () => {
      expect(subscribersKeys.statistics()).toEqual(["subscribers", "statistics"]);
    });

    it("should generate correct services key", () => {
      expect(subscribersKeys.services("sub-1")).toEqual(["subscribers", "services", "sub-1"]);
    });
  });

  describe("useSubscribers", () => {
    it("should fetch subscribers successfully", async () => {
      const mockSubscribers = [
        createMockSubscriber({ id: "sub-1" }),
        createMockSubscriber({ id: "sub-2" }),
      ];

      mockApiClient.get.mockResolvedValue({
        data: {
          items: mockSubscribers,
          total: 2,
        },
      });

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(result.current.data?.subscribers[0].id).toBe("sub-1");
      expect(result.current.error).toBeNull();
    });

    it("should handle empty subscriber list", async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          items: [],
          total: 0,
        },
      });

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
    });

    it("should filter subscribers by status", async () => {
      const mockSubscribers = [createMockSubscriber({ status: "active" })];

      mockApiClient.get.mockResolvedValue({
        data: {
          items: mockSubscribers,
          total: 1,
        },
      });

      const { result } = renderHook(() => useSubscribers({ status: ["active"] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("status=active"));
      expect(result.current.data?.subscribers).toHaveLength(1);
    });

    it("should filter subscribers by connection type", async () => {
      const mockSubscribers = [createMockSubscriber({ connection_type: "ftth" })];

      mockApiClient.get.mockResolvedValue({
        data: {
          items: mockSubscribers,
          total: 1,
        },
      });

      const { result } = renderHook(() => useSubscribers({ connection_type: ["ftth"] }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("connection_type=ftth"),
      );
      expect(result.current.data?.subscribers).toHaveLength(1);
    });

    it("should filter subscribers by city", async () => {
      const mockSubscribers = [createMockSubscriber({ service_city: "New York" })];

      mockApiClient.get.mockResolvedValue({
        data: {
          items: mockSubscribers,
          total: 1,
        },
      });

      const { result } = renderHook(() => useSubscribers({ city: "New York" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("city=New"));
      expect(result.current.data?.subscribers).toHaveLength(1);
    });

    it("should search subscribers", async () => {
      const mockSubscribers = [createMockSubscriber({ email: "john@example.com" })];

      mockApiClient.get.mockResolvedValue({
        data: {
          items: mockSubscribers,
          total: 1,
        },
      });

      const { result } = renderHook(() => useSubscribers({ search: "john" }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("search=john"));
      expect(result.current.data?.subscribers).toHaveLength(1);
    });

    it("should handle pagination", async () => {
      const mockSubscribers = [createMockSubscriber()];

      mockApiClient.get.mockResolvedValue({
        data: {
          items: mockSubscribers,
          total: 100,
        },
      });

      const { result } = renderHook(() => useSubscribers({ limit: 10, offset: 20 }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("limit=10"));
      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("offset=20"));
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useSubscriber", () => {
    it("should fetch single subscriber successfully", async () => {
      const mockSubscriber = createMockSubscriber({ id: "sub-1" });

      mockApiClient.get.mockResolvedValue({
        data: mockSubscriber,
      });

      const { result } = renderHook(() => useSubscriber("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/subscribers/sub-1");
      expect(result.current.data?.id).toBe("sub-1");
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when subscriberId is null", async () => {
      const { result } = renderHook(() => useSubscriber(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));

      expect(mockApiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should handle not found error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Subscriber not found"));

      const { result } = renderHook(() => useSubscriber("sub-999"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });
  });

  describe("useSubscriberStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const mockStats = createMockStatistics();

      mockApiClient.get.mockResolvedValue({
        data: mockStats,
      });

      const { result } = renderHook(() => useSubscriberStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/subscribers/statistics");
      expect(result.current.data?.total_subscribers).toBe(100);
      expect(result.current.data?.active_subscribers).toBe(85);
      expect(result.current.error).toBeNull();
    });

    it("should handle empty statistics", async () => {
      const emptyStats = createMockStatistics({
        total_subscribers: 0,
        active_subscribers: 0,
      });

      mockApiClient.get.mockResolvedValue({
        data: emptyStats,
      });

      const { result } = renderHook(() => useSubscriberStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.total_subscribers).toBe(0);
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Stats unavailable"));

      const { result } = renderHook(() => useSubscriberStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useSubscriberServices", () => {
    it("should fetch services for a subscriber", async () => {
      const mockServices = [createMockService({ id: "svc-1" }), createMockService({ id: "svc-2" })];

      mockApiClient.get.mockResolvedValue({
        data: mockServices,
      });

      const { result } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(mockApiClient.get).toHaveBeenCalledWith("/subscribers/sub-1/services");
      expect(result.current.data).toHaveLength(2);
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when subscriberId is null", async () => {
      const { result } = renderHook(() => useSubscriberServices(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));

      expect(mockApiClient.get).not.toHaveBeenCalled();
      expect(result.current.data).toBeUndefined();
    });

    it("should return empty array for subscriber with no services", async () => {
      mockApiClient.get.mockResolvedValue({
        data: [],
      });

      const { result } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toHaveLength(0);
    });

    it("should handle fetch error", async () => {
      mockApiClient.get.mockRejectedValue(new Error("Services unavailable"));

      const { result } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
    });
  });

  describe("useSubscriberOperations", () => {
    describe("createSubscriber", () => {
      it("should create subscriber successfully", async () => {
        const newSubscriber: CreateSubscriberRequest = {
          first_name: "Jane",
          last_name: "Smith",
          email: "jane@example.com",
          phone: "+1987654321",
          service_address: "456 Oak Ave",
          service_city: "Los Angeles",
          service_state: "CA",
          service_postal_code: "90001",
          connection_type: "ftth",
        };

        const createdSubscriber = createMockSubscriber({
          id: "sub-new",
          ...newSubscriber,
        });

        mockApiClient.post.mockResolvedValue({
          data: createdSubscriber,
        });

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.createSubscriber(newSubscriber);
        });

        expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers", newSubscriber);
        expect(result.current.isLoading).toBe(false);
        expect(result.current.error).toBeNull();
      });

      it("should handle create error", async () => {
        const newSubscriber: CreateSubscriberRequest = {
          first_name: "Jane",
          last_name: "Smith",
          email: "invalid-email",
          phone: "+1987654321",
          service_address: "456 Oak Ave",
          service_city: "Los Angeles",
          service_state: "CA",
          service_postal_code: "90001",
          connection_type: "ftth",
        };

        mockApiClient.post.mockRejectedValue(new Error("Invalid email"));

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await expect(result.current.createSubscriber(newSubscriber)).rejects.toThrow();

        await waitFor(() => expect(result.current.error).toBeTruthy());
      });
    });

    describe("updateSubscriber", () => {
      it("should update subscriber successfully", async () => {
        const updateData: UpdateSubscriberRequest = {
          phone: "+1111111111",
          status: "suspended",
        };

        const updatedSubscriber = createMockSubscriber({
          id: "sub-1",
          ...updateData,
        });

        mockApiClient.patch.mockResolvedValue({
          data: updatedSubscriber,
        });

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.updateSubscriber("sub-1", updateData);
        });

        expect(mockApiClient.patch).toHaveBeenCalledWith("/subscribers/sub-1", updateData);
        expect(result.current.isLoading).toBe(false);
      });

      it("should handle update error", async () => {
        const updateData: UpdateSubscriberRequest = {
          email: "invalid-email",
        };

        mockApiClient.patch.mockRejectedValue(new Error("Invalid email"));

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await expect(result.current.updateSubscriber("sub-1", updateData)).rejects.toThrow();
      });
    });

    describe("deleteSubscriber", () => {
      it("should delete subscriber successfully", async () => {
        mockApiClient.delete.mockResolvedValue({});

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          const success = await result.current.deleteSubscriber("sub-1");
          expect(success).toBe(true);
        });

        expect(mockApiClient.delete).toHaveBeenCalledWith("/subscribers/sub-1");
        expect(result.current.isLoading).toBe(false);
      });

      it("should handle delete error", async () => {
        mockApiClient.delete.mockRejectedValue(new Error("Subscriber has active services"));

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await expect(result.current.deleteSubscriber("sub-1")).rejects.toThrow();
      });
    });

    describe("suspendSubscriber", () => {
      it("should suspend subscriber successfully", async () => {
        mockApiClient.post.mockResolvedValue({});

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          const success = await result.current.suspendSubscriber("sub-1", "Non-payment");
          expect(success).toBe(true);
        });

        expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers/sub-1/suspend", {
          reason: "Non-payment",
        });
        expect(result.current.isLoading).toBe(false);
      });

      it("should suspend subscriber without reason", async () => {
        mockApiClient.post.mockResolvedValue({});

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.suspendSubscriber("sub-1");
        });

        expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers/sub-1/suspend", {});
      });

      it("should handle suspend error", async () => {
        mockApiClient.post.mockRejectedValue(new Error("Already suspended"));

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await expect(result.current.suspendSubscriber("sub-1")).rejects.toThrow();
      });
    });

    describe("activateSubscriber", () => {
      it("should activate subscriber successfully", async () => {
        mockApiClient.post.mockResolvedValue({});

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          const success = await result.current.activateSubscriber("sub-1");
          expect(success).toBe(true);
        });

        expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers/sub-1/activate", {});
        expect(result.current.isLoading).toBe(false);
      });

      it("should handle activate error", async () => {
        mockApiClient.post.mockRejectedValue(new Error("Already active"));

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await expect(result.current.activateSubscriber("sub-1")).rejects.toThrow();
      });
    });

    describe("terminateSubscriber", () => {
      it("should terminate subscriber successfully", async () => {
        mockApiClient.post.mockResolvedValue({});

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          const success = await result.current.terminateSubscriber("sub-1", "Customer request");
          expect(success).toBe(true);
        });

        expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers/sub-1/terminate", {
          reason: "Customer request",
        });
        expect(result.current.isLoading).toBe(false);
      });

      it("should terminate subscriber without reason", async () => {
        mockApiClient.post.mockResolvedValue({});

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await act(async () => {
          await result.current.terminateSubscriber("sub-1");
        });

        expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers/sub-1/terminate", {});
      });

      it("should handle terminate error", async () => {
        mockApiClient.post.mockRejectedValue(new Error("Already terminated"));

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        await expect(result.current.terminateSubscriber("sub-1")).rejects.toThrow();
      });
    });

    describe("loading states", () => {
      it("should show loading state during create", async () => {
        mockApiClient.post.mockImplementation(
          () =>
            new Promise((resolve) =>
              setTimeout(() => resolve({ data: createMockSubscriber() }), 100),
            ),
        );

        const { result } = renderHook(() => useSubscriberOperations(), {
          wrapper: createWrapper(),
        });

        const promise = result.current.createSubscriber({
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

        await waitFor(() => expect(result.current.isLoading).toBe(true));

        await promise;

        await waitFor(() => expect(result.current.isLoading).toBe(false));
      });
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle subscriber with multiple filters", async () => {
      const mockSubscribers = [
        createMockSubscriber({
          status: "active",
          connection_type: "ftth",
          service_city: "New York",
        }),
      ];

      mockApiClient.get.mockResolvedValue({
        data: {
          items: mockSubscribers,
          total: 1,
        },
      });

      const { result } = renderHook(
        () =>
          useSubscribers({
            status: ["active"],
            connection_type: ["ftth"],
            city: "New York",
            search: "john",
            limit: 10,
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toHaveLength(1);
      expect(mockApiClient.get).toHaveBeenCalledWith(expect.stringContaining("status=active"));
      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining("connection_type=ftth"),
      );
    });

    it("should handle concurrent subscriber and services fetches", async () => {
      const mockSubscriber = createMockSubscriber({ id: "sub-1" });
      const mockServices = [createMockService()];

      mockApiClient.get.mockImplementation((url: string) => {
        if (url.includes("/services")) {
          return Promise.resolve({ data: mockServices });
        }
        return Promise.resolve({ data: mockSubscriber });
      });

      const { result: subscriberResult } = renderHook(() => useSubscriber("sub-1"), {
        wrapper: createWrapper(),
      });

      const { result: servicesResult } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(subscriberResult.current.isLoading).toBe(false);
        expect(servicesResult.current.isLoading).toBe(false);
      });

      expect(subscriberResult.current.data?.id).toBe("sub-1");
      expect(servicesResult.current.data).toHaveLength(1);
    });

    it("should handle complete subscriber lifecycle", async () => {
      // 1. Create subscriber
      const newSubscriber: CreateSubscriberRequest = {
        first_name: "Test",
        last_name: "User",
        email: "test@example.com",
        phone: "+1234567890",
        service_address: "123 Test St",
        service_city: "Test City",
        service_state: "TS",
        service_postal_code: "12345",
        connection_type: "ftth",
      };

      mockApiClient.post.mockResolvedValue({
        data: createMockSubscriber({ id: "sub-new", ...newSubscriber }),
      });

      const { result: opsResult } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        await opsResult.current.createSubscriber(newSubscriber);
      });

      expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers", newSubscriber);

      // 2. Update subscriber
      mockApiClient.patch.mockResolvedValue({
        data: createMockSubscriber({ id: "sub-new", phone: "+1111111111" }),
      });

      await act(async () => {
        await opsResult.current.updateSubscriber("sub-new", { phone: "+1111111111" });
      });

      expect(mockApiClient.patch).toHaveBeenCalledWith("/subscribers/sub-new", {
        phone: "+1111111111",
      });

      // 3. Suspend subscriber
      mockApiClient.post.mockResolvedValue({});

      await act(async () => {
        await opsResult.current.suspendSubscriber("sub-new", "Non-payment");
      });

      expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers/sub-new/suspend", {
        reason: "Non-payment",
      });

      // 4. Activate subscriber
      await act(async () => {
        await opsResult.current.activateSubscriber("sub-new");
      });

      expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers/sub-new/activate", {});

      // 5. Terminate subscriber
      await act(async () => {
        await opsResult.current.terminateSubscriber("sub-new", "Customer request");
      });

      expect(mockApiClient.post).toHaveBeenCalledWith("/subscribers/sub-new/terminate", {
        reason: "Customer request",
      });
    });
  });
});
