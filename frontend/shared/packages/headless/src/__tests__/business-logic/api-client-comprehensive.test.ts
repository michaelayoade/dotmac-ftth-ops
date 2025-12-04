/**
 * API Client Business Logic Tests - Production Coverage
 * Testing critical API patterns with ISP-specific scenarios
 */

import { createAPIClient, APIClient } from "@dotmac/headless/api/client";
import { BusinessLogicTestFactory, ISPTestDataFactory } from "./business-logic-test-factory";
import { jest } from "@jest/globals";

// Mock fetch globally
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe("API Client Business Logic", () => {
  let client: APIClient;
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();

    client = createAPIClient({
      baseURL: "https://api.test-isp.com",
      timeout: 5000,
      retries: 3,
      portal: "admin",
      tenantId: "tenant_test_001",
    });
  });

  describe("Request Configuration and Headers", () => {
    it("should include proper headers for ISP API requests", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
        headers: new Headers(),
      } as Response);

      await client.get("/customers");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test-isp.com/customers",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Portal": "admin",
            "X-Tenant-ID": "tenant_test_001",
            Accept: "application/json",
          }),
        }),
      );
    });

    it("should handle portal-specific authentication headers", async () => {
      const portalConfigs = [
        { portal: "admin", expectedAuth: "Bearer admin-token" },
        { portal: "customer", expectedAuth: "Bearer customer-token" },
        { portal: "technician", expectedAuth: "Bearer tech-token" },
        { portal: "reseller", expectedAuth: "Bearer reseller-token" },
      ];

      for (const { portal, expectedAuth } of portalConfigs) {
        const portalClient = createAPIClient({
          baseURL: "https://api.test-isp.com",
          portal,
          tenantId: "tenant_test",
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ portal }),
        } as Response);

        // Mock token retrieval for this portal
        jest.spyOn(portalClient as any, "getAuthToken").mockReturnValue(expectedAuth);

        await portalClient.get("/profile");

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/profile"),
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: expectedAuth,
              "X-Portal": portal,
            }),
          }),
        );
      }
    });

    it("should handle multi-tenant header configuration", async () => {
      const tenantIds = ["isp_east_001", "isp_west_002", "isp_central_003"];

      for (const tenantId of tenantIds) {
        const tenantClient = createAPIClient({
          baseURL: "https://api.test-isp.com",
          portal: "admin",
          tenantId,
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ tenantId }),
        } as Response);

        await tenantClient.get("/tenant-info");

        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/tenant-info"),
          expect.objectContaining({
            headers: expect.objectContaining({
              "X-Tenant-ID": tenantId,
            }),
          }),
        );
      }
    });
  });

  describe("HTTP Methods and Data Handling", () => {
    it("should handle GET requests with query parameters", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ customers: [] }),
      } as Response);

      const params = {
        page: 1,
        limit: 50,
        status: "active",
        plan: "premium",
      };

      await client.get("/customers", { params });

      const expectedUrl =
        "https://api.test-isp.com/customers?page=1&limit=50&status=active&plan=premium";
      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: "GET",
        }),
      );
    });

    it("should handle POST requests with ISP customer data", async () => {
      const customerData = ISPTestDataFactory.createCustomer("residential");

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "new_customer_001", ...customerData }),
      } as Response);

      await client.post("/customers", customerData);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test-isp.com/customers",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(customerData),
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should handle PUT requests for customer updates", async () => {
      const customerId = "cust_001";
      const updateData = {
        plan: "Business Pro 500",
        monthlyRevenue: 299.99,
        status: "active",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: customerId, ...updateData }),
      } as Response);

      await client.put(`/customers/${customerId}`, updateData);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.test-isp.com/customers/${customerId}`,
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(updateData),
        }),
      );
    });

    it("should handle DELETE requests for resource cleanup", async () => {
      const customerId = "cust_to_delete";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await client.delete(`/customers/${customerId}`);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.test-isp.com/customers/${customerId}`,
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle network connectivity errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network request failed"));

      await expect(client.get("/customers")).rejects.toThrow("Network request failed");
    });

    it("should handle HTTP error responses with proper ISP error structure", async () => {
      const errorResponse = {
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        json: async () => ({
          code: "VALIDATION_ERROR",
          message: "Customer email already exists",
          details: {
            field: "email",
            value: "existing@customer.com",
            constraint: "unique",
          },
          correlationId: "req_12345",
        }),
      };

      mockFetch.mockResolvedValueOnce(errorResponse as Response);

      try {
        await client.post("/customers", { email: "existing@customer.com" });
      } catch (error: any) {
        expect(error.status).toBe(422);
        expect(error.data.code).toBe("VALIDATION_ERROR");
        expect(error.data.details.field).toBe("email");
        expect(error.data.correlationId).toBe("req_12345");
      }
    });

    it("should handle rate limiting with appropriate backoff", async () => {
      const rateLimitResponse = {
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
        headers: new Headers({
          "Retry-After": "60",
          "X-RateLimit-Limit": "1000",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Date.now() + 60000),
        }),
        json: async () => ({
          code: "RATE_LIMITED",
          message: "API rate limit exceeded",
          retryAfter: 60,
        }),
      };

      mockFetch.mockResolvedValueOnce(rateLimitResponse as Response);

      try {
        await client.get("/customers");
      } catch (error: any) {
        expect(error.status).toBe(429);
        expect(error.data.retryAfter).toBe(60);
        expect(error.headers.get("Retry-After")).toBe("60");
      }
    });

    it("should handle authentication failures appropriately", async () => {
      const authErrorResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => ({
          code: "AUTH_TOKEN_EXPIRED",
          message: "Access token has expired",
          requiresRefresh: true,
        }),
      };

      mockFetch.mockResolvedValueOnce(authErrorResponse as Response);

      try {
        await client.get("/admin/users");
      } catch (error: any) {
        expect(error.status).toBe(401);
        expect(error.data.requiresRefresh).toBe(true);
      }
    });

    it("should handle server errors with proper logging context", async () => {
      const serverErrorResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({
          code: "INTERNAL_SERVER_ERROR",
          message: "An unexpected error occurred",
          correlationId: "err_67890",
          timestamp: new Date().toISOString(),
        }),
      };

      mockFetch.mockResolvedValueOnce(serverErrorResponse as Response);

      try {
        await client.get("/billing/invoices");
      } catch (error: any) {
        expect(error.status).toBe(500);
        expect(error.data.correlationId).toBe("err_67890");
        expect(error.data.timestamp).toBeDefined();
      }
    });
  });

  describe("Retry Logic and Circuit Breaking", () => {
    it("should retry failed requests up to configured limit", async () => {
      // First two attempts fail, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response);

      const result = await client.get("/customers");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result.success).toBe(true);
    });

    it("should not retry on client errors (4xx)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({ error: "Invalid request" }),
      } as Response);

      await expect(client.get("/customers")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
    });

    it("should handle exponential backoff for retries", async () => {
      const startTime = Date.now();

      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        } as Response);

      await client.get("/customers");

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should take at least some time due to backoff (rough check)
      expect(duration).toBeGreaterThan(10);
    });
  });

  describe("ISP-Specific Business Operations", () => {
    it("should handle customer service plan changes", async () => {
      const customerId = "cust_001";
      const planChangeData = {
        newPlan: "Business Pro 1GB",
        effectiveDate: "2024-02-01",
        prorateBilling: true,
        reason: "customer_upgrade",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          customerId,
          oldPlan: "Home Premium 100",
          newPlan: "Business Pro 1GB",
          changeId: "change_001",
          billingAdjustment: 45.67,
        }),
      } as Response);

      const result = await client.post(`/customers/${customerId}/plan-change`, planChangeData);

      expect(result.changeId).toBe("change_001");
      expect(result.billingAdjustment).toBe(45.67);
    });

    it("should handle network device configuration requests", async () => {
      const deviceId = "router_001";
      const configData = {
        vlan: 100,
        qos_profile: "business",
        bandwidth_limit: "1000Mbps",
        monitoring_enabled: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          deviceId,
          configurationId: "config_001",
          status: "applied",
          timestamp: new Date().toISOString(),
        }),
      } as Response);

      const result = await client.put(`/network/devices/${deviceId}/config`, configData);

      expect(result.status).toBe("applied");
      expect(result.configurationId).toBe("config_001");
    });

    it("should handle billing invoice generation", async () => {
      const invoiceData = {
        customerId: "cust_001",
        billingPeriod: "2024-01",
        services: [
          { id: "internet_service", amount: 79.99 },
          { id: "static_ip", amount: 10.0 },
        ],
        taxes: 8.99,
        totalAmount: 98.98,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          invoiceId: "INV-2024-001",
          ...invoiceData,
          status: "generated",
          dueDate: "2024-02-15",
        }),
      } as Response);

      const result = await client.post("/billing/invoices", invoiceData);

      expect(result.invoiceId).toBe("INV-2024-001");
      expect(result.status).toBe("generated");
      expect(result.totalAmount).toBe(98.98);
    });

    it("should handle field technician work orders", async () => {
      const workOrderData = {
        customerId: "cust_001",
        type: "installation",
        priority: "high",
        scheduledDate: "2024-02-01T09:00:00Z",
        address: "123 Main St, Anytown, NY 12345",
        services: ["internet_installation", "equipment_setup"],
        technicianNotes: "Customer prefers morning appointment",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          workOrderId: "WO-2024-001",
          ...workOrderData,
          status: "scheduled",
          assignedTechnician: "tech_123",
          estimatedDuration: 120, // minutes
        }),
      } as Response);

      const result = await client.post("/field-ops/work-orders", workOrderData);

      expect(result.workOrderId).toBe("WO-2024-001");
      expect(result.assignedTechnician).toBe("tech_123");
      expect(result.estimatedDuration).toBe(120);
    });
  });

  describe("Timeout and Performance", () => {
    it("should respect configured timeout settings", async () => {
      const slowClient = createAPIClient({
        baseURL: "https://api.test-isp.com",
        timeout: 100, // Very short timeout
        portal: "admin",
        tenantId: "tenant_test",
      });

      // Mock a slow response
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  json: async () => ({ data: "slow response" }),
                } as Response),
              200,
            ),
          ),
      );

      await expect(slowClient.get("/customers")).rejects.toThrow(/timeout/i);
    });

    it("should handle concurrent requests efficiently", async () => {
      const responses = Array.from({ length: 10 }, (_, i) => ({
        ok: true,
        status: 200,
        json: async () => ({ id: `customer_${i}` }),
      }));

      responses.forEach((response) => {
        mockFetch.mockResolvedValueOnce(response as Response);
      });

      const promises = Array.from({ length: 10 }, (_, i) => client.get(`/customers/customer_${i}`));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(mockFetch).toHaveBeenCalledTimes(10);
      results.forEach((result, index) => {
        expect(result.id).toBe(`customer_${index}`);
      });
    });
  });

  describe("Request/Response Interceptors", () => {
    it("should apply request interceptors for logging and metrics", async () => {
      const interceptorSpy = jest.fn();

      // Mock client with interceptor
      const clientWithInterceptor = createAPIClient({
        baseURL: "https://api.test-isp.com",
        portal: "admin",
        tenantId: "tenant_test",
        interceptors: {
          request: interceptorSpy,
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      await clientWithInterceptor.get("/customers");

      expect(interceptorSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "/customers",
          method: "GET",
        }),
      );
    });

    it("should apply response interceptors for error handling", async () => {
      const responseInterceptor = jest.fn();

      const clientWithInterceptor = createAPIClient({
        baseURL: "https://api.test-isp.com",
        portal: "admin",
        tenantId: "tenant_test",
        interceptors: {
          response: responseInterceptor,
        },
      });

      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: "success" }),
      };

      mockFetch.mockResolvedValueOnce(mockResponse as Response);

      await clientWithInterceptor.get("/customers");

      expect(responseInterceptor).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 200,
        }),
      );
    });
  });
});
