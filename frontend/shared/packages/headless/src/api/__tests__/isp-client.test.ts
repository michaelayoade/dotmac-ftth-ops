/**
 * ISP API Client Tests
 * Comprehensive test suite for the refactored ISP API client composition
 */

import { ISPApiClient } from "../isp-client";
import { IdentityApiClient } from "../clients/IdentityApiClient";
import { NetworkingApiClient } from "../clients/NetworkingApiClient";
import { BillingApiClient } from "../clients/BillingApiClient";

// Mock the individual API clients
jest.mock("../clients/IdentityApiClient");
jest.mock("../clients/NetworkingApiClient");
jest.mock("../clients/BillingApiClient");

const MockedIdentityApiClient = IdentityApiClient as jest.MockedClass<typeof IdentityApiClient>;
const MockedNetworkingApiClient = NetworkingApiClient as jest.MockedClass<
  typeof NetworkingApiClient
>;
const MockedBillingApiClient = BillingApiClient as jest.MockedClass<typeof BillingApiClient>;

describe("ISPApiClient", () => {
  let client: ISPApiClient;
  const baseURL = "https://api.test.com";
  const authToken = "test-auth-token";

  beforeEach(() => {
    jest.clearAllMocks();
    client = new ISPApiClient(baseURL, authToken);
  });

  describe("Initialization", () => {
    it("should initialize with correct configuration", () => {
      expect(client).toBeInstanceOf(ISPApiClient);
      expect(client.identity).toBeInstanceOf(IdentityApiClient);
      expect(client.networking).toBeInstanceOf(NetworkingApiClient);
      expect(client.billing).toBeInstanceOf(BillingApiClient);
    });

    it("should pass correct parameters to sub-clients", () => {
      expect(MockedIdentityApiClient).toHaveBeenCalledWith(
        baseURL,
        expect.objectContaining({
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
          "X-API-Version": "1.0",
        }),
      );

      expect(MockedNetworkingApiClient).toHaveBeenCalledWith(
        baseURL,
        expect.objectContaining({
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
          "X-API-Version": "1.0",
        }),
      );

      expect(MockedBillingApiClient).toHaveBeenCalledWith(
        baseURL,
        expect.objectContaining({
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
          "X-API-Version": "1.0",
        }),
      );
    });

    it("should handle custom headers", () => {
      const customHeaders = {
        "X-Custom-Header": "custom-value",
        "X-Tenant-ID": "tenant_123",
      };

      const clientWithCustomHeaders = new ISPApiClient(baseURL, authToken, customHeaders);

      expect(MockedIdentityApiClient).toHaveBeenCalledWith(
        baseURL,
        expect.objectContaining({
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
          "X-API-Version": "1.0",
          "X-Custom-Header": "custom-value",
          "X-Tenant-ID": "tenant_123",
        }),
      );
    });
  });

  describe("Authentication Token Management", () => {
    it("should update auth token across all clients", () => {
      const newToken = "new-auth-token";

      // Mock the updateAuthToken method on all sub-clients
      const identityUpdateSpy = jest.fn();
      const networkingUpdateSpy = jest.fn();
      const billingUpdateSpy = jest.fn();

      client.identity.updateAuthToken = identityUpdateSpy;
      client.networking.updateAuthToken = networkingUpdateSpy;
      client.billing.updateAuthToken = billingUpdateSpy;

      client.updateAuthToken(newToken);

      expect(identityUpdateSpy).toHaveBeenCalledWith(newToken);
      expect(networkingUpdateSpy).toHaveBeenCalledWith(newToken);
      expect(billingUpdateSpy).toHaveBeenCalledWith(newToken);
    });

    it("should handle empty or null tokens", () => {
      const updateSpy = jest.fn();
      client.identity.updateAuthToken = updateSpy;

      client.updateAuthToken("");
      expect(updateSpy).toHaveBeenCalledWith("");

      client.updateAuthToken(null as any);
      expect(updateSpy).toHaveBeenCalledWith(null);
    });
  });

  describe("Tenant Context Management", () => {
    it("should set tenant context across all clients", () => {
      const tenantId = "tenant_456";

      const identitySetTenantSpy = jest.fn();
      const networkingSetTenantSpy = jest.fn();
      const billingSetTenantSpy = jest.fn();

      client.identity.setTenantContext = identitySetTenantSpy;
      client.networking.setTenantContext = networkingSetTenantSpy;
      client.billing.setTenantContext = billingSetTenantSpy;

      client.setTenantContext(tenantId);

      expect(identitySetTenantSpy).toHaveBeenCalledWith(tenantId);
      expect(networkingSetTenantSpy).toHaveBeenCalledWith(tenantId);
      expect(billingSetTenantSpy).toHaveBeenCalledWith(tenantId);
    });
  });

  describe("Global Configuration", () => {
    it("should set global timeout across all clients", () => {
      const timeout = 30000;

      const identitySetTimeoutSpy = jest.fn();
      const networkingSetTimeoutSpy = jest.fn();
      const billingSetTimeoutSpy = jest.fn();

      client.identity.setTimeout = identitySetTimeoutSpy;
      client.networking.setTimeout = networkingSetTimeoutSpy;
      client.billing.setTimeout = billingSetTimeoutSpy;

      client.setTimeout(timeout);

      expect(identitySetTimeoutSpy).toHaveBeenCalledWith(timeout);
      expect(networkingSetTimeoutSpy).toHaveBeenCalledWith(timeout);
      expect(billingSetTimeoutSpy).toHaveBeenCalledWith(timeout);
    });

    it("should enable/disable debug mode across all clients", () => {
      const debugMode = true;

      const identityDebugSpy = jest.fn();
      const networkingDebugSpy = jest.fn();
      const billingDebugSpy = jest.fn();

      client.identity.setDebugMode = identityDebugSpy;
      client.networking.setDebugMode = networkingDebugSpy;
      client.billing.setDebugMode = billingDebugSpy;

      client.setDebugMode(debugMode);

      expect(identityDebugSpy).toHaveBeenCalledWith(debugMode);
      expect(networkingDebugSpy).toHaveBeenCalledWith(debugMode);
      expect(billingDebugSpy).toHaveBeenCalledWith(debugMode);
    });
  });

  describe("Client Module Access", () => {
    it("should provide access to identity client methods", () => {
      // Mock some identity methods
      const getCustomersSpy = jest.fn().mockResolvedValue({ data: [] });
      client.identity.getCustomers = getCustomersSpy;

      client.identity.getCustomers({ page: 1, limit: 10 });

      expect(getCustomersSpy).toHaveBeenCalledWith({ page: 1, limit: 10 });
    });

    it("should provide access to networking client methods", () => {
      const getDevicesSpy = jest.fn().mockResolvedValue({ data: [] });
      client.networking.getDevices = getDevicesSpy;

      client.networking.getDevices({ status: "online" });

      expect(getDevicesSpy).toHaveBeenCalledWith({ status: "online" });
    });

    it("should provide access to billing client methods", () => {
      const getInvoicesSpy = jest.fn().mockResolvedValue({ data: [] });
      client.billing.getInvoices = getInvoicesSpy;

      client.billing.getInvoices({ customer_id: "cust_123" });

      expect(getInvoicesSpy).toHaveBeenCalledWith({ customer_id: "cust_123" });
    });
  });

  describe("Error Handling", () => {
    it("should handle initialization errors", () => {
      MockedIdentityApiClient.mockImplementation(() => {
        throw new Error("Identity client initialization failed");
      });

      expect(() => {
        new ISPApiClient(baseURL, authToken);
      }).toThrow("Identity client initialization failed");
    });

    it("should handle method call errors gracefully", async () => {
      const errorMessage = "Network error";
      const getCustomersError = jest.fn().mockRejectedValue(new Error(errorMessage));
      client.identity.getCustomers = getCustomersError;

      await expect(client.identity.getCustomers()).rejects.toThrow(errorMessage);
    });
  });

  describe("Cross-Client Integration", () => {
    it("should support cross-client operations", async () => {
      // Mock methods that might be used together
      const getCustomerSpy = jest.fn().mockResolvedValue({
        data: { id: "cust_123", name: "Test Customer" },
      });
      const getCustomerInvoicesSpy = jest.fn().mockResolvedValue({
        data: [{ id: "inv_123", amount: 2999 }],
      });
      const getCustomerDevicesSpy = jest.fn().mockResolvedValue({
        data: [{ id: "dev_123", name: "Router 1" }],
      });

      client.identity.getCustomer = getCustomerSpy;
      client.billing.getCustomerInvoices = getCustomerInvoicesSpy;
      client.networking.getCustomerDevices = getCustomerDevicesSpy;

      // Simulate a cross-client operation
      const customerId = "cust_123";

      const customer = await client.identity.getCustomer(customerId);
      const invoices = await client.billing.getCustomerInvoices(customerId);
      const devices = await client.networking.getCustomerDevices(customerId);

      expect(getCustomerSpy).toHaveBeenCalledWith(customerId);
      expect(getCustomerInvoicesSpy).toHaveBeenCalledWith(customerId);
      expect(getCustomerDevicesSpy).toHaveBeenCalledWith(customerId);

      expect(customer.data.id).toBe(customerId);
      expect(invoices.data).toHaveLength(1);
      expect(devices.data).toHaveLength(1);
    });
  });

  describe("Request Interceptors", () => {
    it("should support adding request interceptors", () => {
      const interceptor = jest.fn((config) => config);

      const identityAddInterceptorSpy = jest.fn();
      const networkingAddInterceptorSpy = jest.fn();
      const billingAddInterceptorSpy = jest.fn();

      client.identity.addRequestInterceptor = identityAddInterceptorSpy;
      client.networking.addRequestInterceptor = networkingAddInterceptorSpy;
      client.billing.addRequestInterceptor = billingAddInterceptorSpy;

      client.addRequestInterceptor(interceptor);

      expect(identityAddInterceptorSpy).toHaveBeenCalledWith(interceptor);
      expect(networkingAddInterceptorSpy).toHaveBeenCalledWith(interceptor);
      expect(billingAddInterceptorSpy).toHaveBeenCalledWith(interceptor);
    });

    it("should support adding response interceptors", () => {
      const interceptor = jest.fn((response) => response);

      const identityAddInterceptorSpy = jest.fn();
      const networkingAddInterceptorSpy = jest.fn();
      const billingAddInterceptorSpy = jest.fn();

      client.identity.addResponseInterceptor = identityAddInterceptorSpy;
      client.networking.addResponseInterceptor = networkingAddInterceptorSpy;
      client.billing.addResponseInterceptor = billingAddInterceptorSpy;

      client.addResponseInterceptor(interceptor);

      expect(identityAddInterceptorSpy).toHaveBeenCalledWith(interceptor);
      expect(networkingAddInterceptorSpy).toHaveBeenCalledWith(interceptor);
      expect(billingAddInterceptorSpy).toHaveBeenCalledWith(interceptor);
    });
  });

  describe("Health Check", () => {
    it("should perform health check on all clients", async () => {
      const identityHealthSpy = jest.fn().mockResolvedValue({ status: "healthy" });
      const networkingHealthSpy = jest.fn().mockResolvedValue({ status: "healthy" });
      const billingHealthSpy = jest.fn().mockResolvedValue({ status: "healthy" });

      client.identity.healthCheck = identityHealthSpy;
      client.networking.healthCheck = networkingHealthSpy;
      client.billing.healthCheck = billingHealthSpy;

      const healthResults = await client.healthCheck();

      expect(identityHealthSpy).toHaveBeenCalled();
      expect(networkingHealthSpy).toHaveBeenCalled();
      expect(billingHealthSpy).toHaveBeenCalled();

      expect(healthResults.identity.status).toBe("healthy");
      expect(healthResults.networking.status).toBe("healthy");
      expect(healthResults.billing.status).toBe("healthy");
      expect(healthResults.overall).toBe("healthy");
    });

    it("should detect unhealthy clients", async () => {
      const identityHealthSpy = jest.fn().mockResolvedValue({ status: "healthy" });
      const networkingHealthSpy = jest.fn().mockRejectedValue(new Error("Network down"));
      const billingHealthSpy = jest.fn().mockResolvedValue({ status: "healthy" });

      client.identity.healthCheck = identityHealthSpy;
      client.networking.healthCheck = networkingHealthSpy;
      client.billing.healthCheck = billingHealthSpy;

      const healthResults = await client.healthCheck();

      expect(healthResults.identity.status).toBe("healthy");
      expect(healthResults.networking.status).toBe("unhealthy");
      expect(healthResults.billing.status).toBe("healthy");
      expect(healthResults.overall).toBe("degraded");
    });
  });

  describe("Batch Operations", () => {
    it("should support batch operations across clients", async () => {
      const batchCustomers = jest.fn().mockResolvedValue({
        data: { success: 5, failed: 0 },
      });
      const batchInvoices = jest.fn().mockResolvedValue({
        data: { success: 3, failed: 0 },
      });

      client.identity.batchCreateCustomers = batchCustomers;
      client.billing.batchCreateInvoices = batchInvoices;

      const operations = [
        { client: "identity", method: "batchCreateCustomers", params: [{}] },
        { client: "billing", method: "batchCreateInvoices", params: [{}] },
      ];

      const results = await client.batchOperations(operations);

      expect(batchCustomers).toHaveBeenCalled();
      expect(batchInvoices).toHaveBeenCalled();
      expect(results).toHaveLength(2);
    });
  });

  describe("Rate Limiting", () => {
    it("should handle rate limiting across all clients", () => {
      const rateLimitSpy = jest.fn();

      client.identity.setRateLimit = rateLimitSpy;
      client.networking.setRateLimit = rateLimitSpy;
      client.billing.setRateLimit = rateLimitSpy;

      const rateLimit = { requests: 100, window: 60000 };
      client.setRateLimit(rateLimit);

      expect(rateLimitSpy).toHaveBeenCalledTimes(3);
      expect(rateLimitSpy).toHaveBeenCalledWith(rateLimit);
    });
  });

  describe("Client Factory", () => {
    it("should create client with factory method", () => {
      const config = {
        baseURL: "https://api.test.com",
        authToken: "test-token",
        headers: { "X-Custom": "value" },
      };

      const factoryClient = ISPApiClient.create(config);

      expect(factoryClient).toBeInstanceOf(ISPApiClient);
    });

    it("should validate configuration in factory method", () => {
      expect(() => {
        ISPApiClient.create({} as any);
      }).toThrow("baseURL is required");

      expect(() => {
        ISPApiClient.create({ baseURL: "invalid-url" } as any);
      }).toThrow("Invalid baseURL format");
    });
  });
});
