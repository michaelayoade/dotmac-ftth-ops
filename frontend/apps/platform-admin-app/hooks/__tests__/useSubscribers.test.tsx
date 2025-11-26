/**
 * Tests for useSubscribers hooks
 * Tests subscriber management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useSubscribers,
  useSubscriber,
  useSubscriberStatistics,
  useSubscriberServices,
  useSubscriberOperations,
  Subscriber,
  SubscriberStatistics,
  SubscriberService,
  CreateSubscriberRequest,
  UpdateSubscriberRequest,
} from "../useSubscribers";
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

describe("useSubscribers", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
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

  describe("useSubscribers - list subscribers", () => {
    it("should fetch subscribers successfully", async () => {
      const mockSubscribers: Subscriber[] = [
        {
          id: "sub-1",
          tenant_id: "tenant-1",
          subscriber_id: "SUB-001",
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
          service_address: "123 Main St",
          service_city: "City",
          service_state: "State",
          service_postal_code: "12345",
          service_country: "Country",
          status: "active",
          connection_type: "ftth",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { items: mockSubscribers, total: 1 },
      });

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toEqual(mockSubscribers);
      expect(result.current.data?.total).toBe(1);
      expect(apiClient.get).toHaveBeenCalledWith("/subscribers");
    });

    it("should build query params correctly", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { items: [], total: 0 },
      });

      const params = {
        status: ["active" as const, "suspended" as const],
        connection_type: ["ftth" as const],
        service_plan: "premium",
        city: "New York",
        search: "john",
        from_date: "2024-01-01",
        to_date: "2024-12-31",
        limit: 50,
        offset: 10,
        sort_by: "created_at",
        sort_order: "desc" as const,
      };

      const { result } = renderHook(() => useSubscribers(params), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const callArg = (apiClient.get as jest.Mock).mock.calls[0][0];
      expect(callArg).toContain("status=active");
      expect(callArg).toContain("status=suspended");
      expect(callArg).toContain("connection_type=ftth");
      expect(callArg).toContain("service_plan=premium");
      expect(callArg).toContain("city=New+York");
      expect(callArg).toContain("search=john");
      expect(callArg).toContain("limit=50");
      expect(callArg).toContain("offset=10");
    });

    it("should handle array response format", async () => {
      const mockSubscribers: Subscriber[] = [
        {
          id: "sub-1",
          tenant_id: "tenant-1",
          subscriber_id: "SUB-001",
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
          service_address: "123 Main St",
          service_city: "City",
          service_state: "State",
          service_postal_code: "12345",
          service_country: "Country",
          status: "active",
          connection_type: "ftth",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockSubscribers,
      });

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.subscribers).toEqual(mockSubscribers);
      expect(result.current.data?.total).toBe(1);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSubscribers(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch subscribers", error);
    });
  });

  describe("useSubscriber - single subscriber", () => {
    it("should fetch single subscriber successfully", async () => {
      const mockSubscriber: Subscriber = {
        id: "sub-1",
        tenant_id: "tenant-1",
        subscriber_id: "SUB-001",
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        service_address: "123 Main St",
        service_city: "City",
        service_state: "State",
        service_postal_code: "12345",
        service_country: "Country",
        status: "active",
        connection_type: "ftth",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockSubscriber });

      const { result } = renderHook(() => useSubscriber("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockSubscriber);
      expect(apiClient.get).toHaveBeenCalledWith("/subscribers/sub-1");
    });

    it("should not fetch when subscriberId is null", async () => {
      const { result } = renderHook(() => useSubscriber(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Subscriber not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSubscriber("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch subscriber", error);
    });
  });

  describe("useSubscriberStatistics", () => {
    it("should fetch statistics successfully", async () => {
      const mockStats: SubscriberStatistics = {
        total_subscribers: 100,
        active_subscribers: 85,
        suspended_subscribers: 10,
        pending_subscribers: 5,
        new_this_month: 12,
        churn_this_month: 3,
        average_uptime: 99.5,
        total_bandwidth_gbps: 1000,
        by_connection_type: {
          ftth: 70,
          fttb: 20,
          wireless: 10,
          hybrid: 0,
        },
        by_status: {
          active: 85,
          suspended: 10,
          pending: 5,
          inactive: 0,
          terminated: 0,
        },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockStats });

      const { result } = renderHook(() => useSubscriberStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockStats);
      expect(apiClient.get).toHaveBeenCalledWith("/subscribers/statistics");
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch stats");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSubscriberStatistics(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch subscriber statistics", error);
    });
  });

  describe("useSubscriberServices", () => {
    it("should fetch services successfully", async () => {
      const mockServices: SubscriberService[] = [
        {
          id: "svc-1",
          subscriber_id: "sub-1",
          service_type: "internet",
          service_name: "Fiber 1000",
          status: "active",
          bandwidth_mbps: 1000,
          monthly_fee: 99.99,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({ data: mockServices });

      const { result } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockServices);
      expect(apiClient.get).toHaveBeenCalledWith("/subscribers/sub-1/services");
    });

    it("should not fetch when subscriberId is null", async () => {
      const { result } = renderHook(() => useSubscriberServices(null), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle empty services array", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });

      const { result } = renderHook(() => useSubscriberServices("sub-1"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual([]);
    });
  });

  describe("useSubscriberOperations", () => {
    it("should create subscriber successfully", async () => {
      const mockSubscriber: Subscriber = {
        id: "sub-1",
        tenant_id: "tenant-1",
        subscriber_id: "SUB-001",
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        service_address: "123 Main St",
        service_city: "City",
        service_state: "State",
        service_postal_code: "12345",
        service_country: "Country",
        status: "active",
        connection_type: "ftth",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      };

      (apiClient.post as jest.Mock).mockResolvedValue({ data: mockSubscriber });

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      const createData: CreateSubscriberRequest = {
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        service_address: "123 Main St",
        service_city: "City",
        service_state: "State",
        service_postal_code: "12345",
        connection_type: "ftth",
      };

      await act(async () => {
        const created = await result.current.createSubscriber(createData);
        expect(created).toEqual(mockSubscriber);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/subscribers", createData);
    });

    it("should update subscriber successfully", async () => {
      const mockUpdatedSubscriber: Subscriber = {
        id: "sub-1",
        tenant_id: "tenant-1",
        subscriber_id: "SUB-001",
        first_name: "Jane",
        last_name: "Doe",
        email: "jane@example.com",
        phone: "+1234567890",
        service_address: "123 Main St",
        service_city: "City",
        service_state: "State",
        service_postal_code: "12345",
        service_country: "Country",
        status: "active",
        connection_type: "ftth",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-02T00:00:00Z",
      };

      (apiClient.patch as jest.Mock).mockResolvedValue({ data: mockUpdatedSubscriber });

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      const updateData: UpdateSubscriberRequest = {
        first_name: "Jane",
        email: "jane@example.com",
      };

      await act(async () => {
        const updated = await result.current.updateSubscriber("sub-1", updateData);
        expect(updated).toEqual(mockUpdatedSubscriber);
      });

      expect(apiClient.patch).toHaveBeenCalledWith("/subscribers/sub-1", updateData);
    });

    it("should delete subscriber successfully", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.deleteSubscriber("sub-1");
        expect(success).toBe(true);
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/subscribers/sub-1");
    });

    it("should suspend subscriber successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.suspendSubscriber("sub-1", "Non-payment");
        expect(success).toBe(true);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/subscribers/sub-1/suspend", {
        reason: "Non-payment",
      });
    });

    it("should activate subscriber successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.activateSubscriber("sub-1");
        expect(success).toBe(true);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/subscribers/sub-1/activate", {});
    });

    it("should terminate subscriber successfully", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const success = await result.current.terminateSubscriber("sub-1", "Customer request");
        expect(success).toBe(true);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/subscribers/sub-1/terminate", {
        reason: "Customer request",
      });
    });

    it("should handle create error", async () => {
      const error = new Error("Failed to create");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      const createData: CreateSubscriberRequest = {
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        phone: "+1234567890",
        service_address: "123 Main St",
        service_city: "City",
        service_state: "State",
        service_postal_code: "12345",
        connection_type: "ftth",
      };

      await expect(result.current.createSubscriber(createData)).rejects.toThrow("Failed to create");
      expect(logger.error).toHaveBeenCalledWith("Failed to create subscriber", error);
    });

    it("should set isLoading correctly during mutation", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100)),
      );

      const { result } = renderHook(() => useSubscriberOperations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);

      act(() => {
        result.current.createSubscriber({
          first_name: "John",
          last_name: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
          service_address: "123 Main St",
          service_city: "City",
          service_state: "State",
          service_postal_code: "12345",
          connection_type: "ftth",
        });
      });

      await waitFor(() => expect(result.current.isLoading).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 200 });
    });
  });
});
