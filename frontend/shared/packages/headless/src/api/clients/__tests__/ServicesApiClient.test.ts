/**
 * ServicesApiClient Tests
 * Comprehensive test suite for service provisioning and lifecycle management
 */

import { ServicesApiClient } from "../ServicesApiClient";
import type { ServiceOrder, ServiceProvisioning } from "../ServicesApiClient";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("ServicesApiClient", () => {
  let client: ServicesApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new ServicesApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: async () => data,
    } as Response);
  };

  const mockErrorResponse = (status: number, message: string) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      statusText: message,
      json: async () => ({
        error: { code: "ERROR", message, details: {} },
      }),
    } as Response);
  };

  describe("Service Plans Management", () => {
    const mockServicePlan = {
      id: "plan_123",
      name: "Fiber Pro 1000",
      description: "High-speed fiber internet service",
      download_speed: 1000,
      upload_speed: 1000,
      data_limit: null,
      monthly_price: 89.99,
      setup_fee: 99.0,
    };

    it("should get service plans", async () => {
      mockResponse({
        data: [mockServicePlan],
        pagination: expect.any(Object),
      });

      const result = await client.getServicePlans({ limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/plans?limit=10",
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining(defaultHeaders),
        }),
      );

      expect(result.data).toContain(mockServicePlan);
    });

    it("should get single service plan", async () => {
      mockResponse({ data: mockServicePlan });

      const result = await client.getServicePlan("plan_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/plans/plan_123",
        expect.any(Object),
      );

      expect(result.data.id).toBe("plan_123");
    });

    it("should create service plan", async () => {
      const newPlan = {
        name: "Fiber Basic 100",
        description: "Entry-level fiber service",
        download_speed: 100,
        upload_speed: 100,
        data_limit: null,
        monthly_price: 49.99,
        setup_fee: 50.0,
      };

      mockResponse({ data: { ...newPlan, id: "plan_456" } });

      const result = await client.createServicePlan(newPlan);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/plans",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(newPlan),
        }),
      );

      expect(result.data.name).toBe("Fiber Basic 100");
    });

    it("should update service plan", async () => {
      const updates = { monthly_price: 79.99 };
      mockResponse({ data: { ...mockServicePlan, ...updates } });

      const result = await client.updateServicePlan("plan_123", updates);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/plans/plan_123",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(updates),
        }),
      );

      expect(result.data.monthly_price).toBe(79.99);
    });
  });

  describe("Customer Services Management", () => {
    const mockService = {
      id: "service_123",
      customer_id: "cust_123",
      plan_id: "plan_123",
      status: "ACTIVE",
      installation_date: "2024-01-15T00:00:00Z",
      configuration: {
        static_ip: "192.168.1.100",
        vlan_id: 100,
      },
    };

    it("should get customer services", async () => {
      mockResponse({
        data: [mockService],
        pagination: expect.any(Object),
      });

      const result = await client.getCustomerServices("cust_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/customers/cust_123/services",
        expect.any(Object),
      );

      expect(result.data).toContain(mockService);
    });

    it("should activate service", async () => {
      mockResponse({ data: { ...mockService, status: "ACTIVE" } });

      const result = await client.activateService("cust_123", "service_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/customers/cust_123/services/service_123/activate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({}),
        }),
      );

      expect(result.data.status).toBe("ACTIVE");
    });

    it("should suspend service", async () => {
      const reason = "Non-payment";
      mockResponse({ data: { ...mockService, status: "SUSPENDED" } });

      const result = await client.suspendService("cust_123", "service_123", reason);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/customers/cust_123/services/service_123/suspend",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason }),
        }),
      );

      expect(result.data.status).toBe("SUSPENDED");
    });

    it("should terminate service", async () => {
      const terminationDate = "2024-02-01T00:00:00Z";
      mockResponse({ success: true });

      const result = await client.terminateService("cust_123", "service_123", terminationDate);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/customers/cust_123/services/service_123/terminate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ termination_date: terminationDate }),
        }),
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Service Orders Management", () => {
    const mockServiceOrder: ServiceOrder = {
      id: "order_123",
      customer_id: "cust_123",
      service_plan_id: "plan_123",
      status: "PENDING",
      installation_address: "123 Main St, City, State 12345",
      monthly_cost: 89.99,
      setup_fee: 99.0,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    it("should create service order", async () => {
      const orderData = {
        customer_id: "cust_123",
        service_plan_id: "plan_123",
        installation_address: "123 Main St, City, State 12345",
        monthly_cost: 89.99,
        setup_fee: 99.0,
      };

      mockResponse({ data: mockServiceOrder });

      const result = await client.createServiceOrder(orderData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/orders",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(orderData),
        }),
      );

      expect(result.data.id).toBe("order_123");
    });

    it("should get service orders with filters", async () => {
      mockResponse({
        data: [mockServiceOrder],
        pagination: expect.any(Object),
      });

      await client.getServiceOrders({
        customer_id: "cust_123",
        status: "PENDING",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/orders?customer_id=cust_123&status=PENDING",
        expect.any(Object),
      );
    });

    it("should get single service order", async () => {
      mockResponse({ data: mockServiceOrder });

      const result = await client.getServiceOrder("order_123");

      expect(result.data.id).toBe("order_123");
    });

    it("should update service order", async () => {
      const updates = { installation_date: "2024-01-20T00:00:00Z" };
      mockResponse({ data: { ...mockServiceOrder, ...updates } });

      const result = await client.updateServiceOrder("order_123", updates);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/orders/order_123",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(updates),
        }),
      );
    });

    it("should approve service order", async () => {
      const notes = "Approved by manager";
      mockResponse({ data: { ...mockServiceOrder, status: "APPROVED" } });

      const result = await client.approveServiceOrder("order_123", notes);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/orders/order_123/approve",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ notes }),
        }),
      );

      expect(result.data.status).toBe("APPROVED");
    });

    it("should cancel service order", async () => {
      const reason = "Customer requested cancellation";
      mockResponse({ data: { ...mockServiceOrder, status: "CANCELLED" } });

      const result = await client.cancelServiceOrder("order_123", reason);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/orders/order_123/cancel",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason }),
        }),
      );

      expect(result.data.status).toBe("CANCELLED");
    });
  });

  describe("Service Provisioning", () => {
    const mockProvisioning: ServiceProvisioning = {
      id: "prov_123",
      service_order_id: "order_123",
      status: "IN_PROGRESS",
      steps: [
        {
          id: "step_1",
          name: "Network Configuration",
          status: "COMPLETED",
          description: "Configure network settings",
          estimated_duration: 30,
          actual_duration: 25,
          dependencies: [],
        },
        {
          id: "step_2",
          name: "Equipment Installation",
          status: "IN_PROGRESS",
          description: "Install customer equipment",
          estimated_duration: 60,
          dependencies: ["step_1"],
        },
      ],
      assigned_technician: "tech_456",
    };

    it("should get provisioning status for multiple orders", async () => {
      const orderIds = ["order_123", "order_456"];
      mockResponse({ data: [mockProvisioning] });

      const result = await client.getProvisioningStatus(orderIds);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/provisioning/status",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ order_ids: orderIds }),
        }),
      );

      expect(result.data).toContain(mockProvisioning);
    });

    it("should update provisioning step", async () => {
      const stepUpdates = {
        status: "COMPLETED" as const,
        actual_duration: 55,
      };

      mockResponse({
        data: {
          ...mockProvisioning.steps[1],
          ...stepUpdates,
        },
      });

      const result = await client.updateProvisioningStep("prov_123", "step_2", stepUpdates);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/provisioning/prov_123/steps/step_2",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(stepUpdates),
        }),
      );

      expect(result.data.status).toBe("COMPLETED");
    });
  });

  describe("Service Configuration", () => {
    it("should get service configuration", async () => {
      const config = {
        static_ip: "192.168.1.100",
        vlan_id: 100,
        bandwidth_limit: 1000,
        dns_servers: ["8.8.8.8", "8.8.4.4"],
      };

      mockResponse({ data: config });

      const result = await client.getServiceConfiguration("service_123");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/service_123/configuration",
        expect.any(Object),
      );

      expect(result.data.static_ip).toBe("192.168.1.100");
    });

    it("should update service configuration", async () => {
      const newConfig = {
        bandwidth_limit: 500,
        dns_servers: ["1.1.1.1", "1.0.0.1"],
      };

      mockResponse({ data: newConfig });

      const result = await client.updateServiceConfiguration("service_123", newConfig);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/service_123/configuration",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(newConfig),
        }),
      );

      expect(result.data.bandwidth_limit).toBe(500);
    });
  });

  describe("Usage and Metrics", () => {
    it("should get service usage data", async () => {
      const usageData = {
        period: {
          start_date: "2024-01-01T00:00:00Z",
          end_date: "2024-01-31T23:59:59Z",
        },
        data_usage: {
          download_bytes: 1073741824000, // 1TB
          upload_bytes: 214748364800, // 200GB
          total_bytes: 1288490188800, // 1.2TB
        },
        peak_usage: {
          download_mbps: 950,
          upload_mbps: 980,
          timestamp: "2024-01-15T20:30:00Z",
        },
      };

      mockResponse({ data: usageData });

      const result = await client.getServiceUsage("service_123", {
        start_date: "2024-01-01T00:00:00Z",
        end_date: "2024-01-31T23:59:59Z",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/service_123/usage?start_date=2024-01-01T00%3A00%3A00Z&end_date=2024-01-31T23%3A59%3A59Z",
        expect.any(Object),
      );

      expect(result.data.data_usage.total_bytes).toBe(1288490188800);
    });

    it("should get service metrics", async () => {
      const metrics = {
        latency_ms: 12,
        packet_loss_percent: 0.01,
        uptime_percent: 99.95,
        throughput_mbps: {
          download: 985,
          upload: 975,
        },
        connection_quality: "EXCELLENT",
      };

      mockResponse({ data: metrics });

      const result = await client.getServiceMetrics("service_123", {
        metrics: ["latency", "packet_loss", "uptime"],
        period: "last_24h",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/services/service_123/metrics?metrics=latency%2Cpacket_loss%2Cuptime&period=last_24h",
        expect.any(Object),
      );

      expect(result.data.connection_quality).toBe("EXCELLENT");
    });
  });

  describe("Error Handling", () => {
    it("should handle service order validation errors", async () => {
      mockErrorResponse(400, "Invalid installation address");

      await expect(
        client.createServiceOrder({
          customer_id: "cust_123",
          service_plan_id: "plan_123",
          installation_address: "", // Invalid empty address
          monthly_cost: 89.99,
          setup_fee: 99.0,
        }),
      ).rejects.toThrow("Invalid installation address");
    });

    it("should handle service not found errors", async () => {
      mockErrorResponse(404, "Service not found");

      await expect(client.getServiceConfiguration("invalid_service")).rejects.toThrow(
        "Service not found",
      );
    });

    it("should handle provisioning conflicts", async () => {
      mockErrorResponse(409, "Service already being provisioned");

      await expect(
        client.updateProvisioningStep("prov_123", "step_1", {
          status: "IN_PROGRESS",
        }),
      ).rejects.toThrow("Service already being provisioned");
    });

    it("should handle unauthorized access", async () => {
      mockErrorResponse(403, "Insufficient permissions");

      await expect(client.approveServiceOrder("order_123")).rejects.toThrow(
        "Insufficient permissions",
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network connection failed"));

      await expect(client.getServicePlans()).rejects.toThrow("Network connection failed");
    });
  });

  describe("Service Lifecycle Workflows", () => {
    it("should handle complete service activation workflow", async () => {
      // Step 1: Create service order
      const orderData = {
        customer_id: "cust_123",
        service_plan_id: "plan_123",
        installation_address: "123 Main St",
        monthly_cost: 89.99,
        setup_fee: 99.0,
      };

      mockResponse({ data: { ...mockServiceOrder, id: "order_123" } });
      await client.createServiceOrder(orderData);

      // Step 2: Approve order
      mockResponse({ data: { ...mockServiceOrder, status: "APPROVED" } });
      await client.approveServiceOrder("order_123", "Approved for installation");

      // Step 3: Update provisioning
      mockResponse({ data: { id: "step_1", status: "COMPLETED" } });
      await client.updateProvisioningStep("prov_123", "step_1", {
        status: "COMPLETED",
      });

      // Step 4: Activate service
      mockResponse({ data: { id: "service_123", status: "ACTIVE" } });
      await client.activateService("cust_123", "service_123");

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it("should handle service suspension and reactivation workflow", async () => {
      // Suspend service
      mockResponse({ data: { id: "service_123", status: "SUSPENDED" } });
      await client.suspendService("cust_123", "service_123", "Payment overdue");

      // Reactivate service
      mockResponse({ data: { id: "service_123", status: "ACTIVE" } });
      await client.activateService("cust_123", "service_123");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Performance and Reliability", () => {
    it("should handle large service order batches", async () => {
      const manyOrders = Array.from({ length: 100 }, (_, i) => ({
        ...mockServiceOrder,
        id: `order_${i}`,
      }));

      mockResponse({
        data: manyOrders,
        pagination: { total: 100, page: 1, limit: 100 },
      });

      const startTime = performance.now();
      const result = await client.getServiceOrders({ limit: 100 });
      const endTime = performance.now();

      expect(result.data).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle concurrent provisioning updates", async () => {
      const updates = [
        { stepId: "step_1", data: { status: "COMPLETED" as const } },
        { stepId: "step_2", data: { status: "IN_PROGRESS" as const } },
        { stepId: "step_3", data: { status: "PENDING" as const } },
      ];

      // Mock responses for concurrent calls
      updates.forEach(() => {
        mockResponse({ data: { status: "COMPLETED" } });
      });

      const promises = updates.map(({ stepId, data }) =>
        client.updateProvisioningStep("prov_123", stepId, data),
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});
