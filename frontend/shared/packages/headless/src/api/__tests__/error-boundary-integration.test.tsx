/**
 * API Error Boundary Integration Tests
 * Tests complex error scenarios across service boundaries and multi-tenant isolation
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";

import { ApiManager } from "../manager/ApiManager";
import { EnhancedErrorBoundary } from "../../components/ErrorDisplaySystem";
import { EnhancedISPError, ErrorCode } from "../../utils/enhancedErrorHandling";
import { AuthApiClient } from "../clients/AuthApiClient";
import { BillingApiClient } from "../clients/BillingApiClient";
import { IdentityApiClient } from "../clients/IdentityApiClient";

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock API clients
jest.mock("../clients/AuthApiClient");
jest.mock("../clients/BillingApiClient");
jest.mock("../clients/IdentityApiClient");

const MockedAuthApiClient = AuthApiClient as jest.MockedClass<typeof AuthApiClient>;
const MockedBillingApiClient = BillingApiClient as jest.MockedClass<typeof BillingApiClient>;
const MockedIdentityApiClient = IdentityApiClient as jest.MockedClass<typeof IdentityApiClient>;

// Test component that makes API calls
const ApiTestComponent: React.FC<{
  apiCall: () => Promise<any>;
  tenantId?: string;
}> = ({ apiCall, tenantId }) => {
  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(false);

  const handleApiCall = React.useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiCall();
      setData(result);
    } catch (error) {
      throw error;
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  React.useEffect(() => {
    if (tenantId) {
      // Set tenant context
      localStorage.setItem("currentTenant", tenantId);
    }
  }, [tenantId]);

  return (
    <div>
      <button onClick={handleApiCall} disabled={loading}>
        {loading ? "Loading..." : "Make API Call"}
      </button>
      {data && <div data-testid="api-result">{JSON.stringify(data)}</div>}
    </div>
  );
};

describe("API Error Boundary Integration Tests", () => {
  let mockAuthClient: jest.Mocked<AuthApiClient>;
  let mockBillingClient: jest.Mocked<BillingApiClient>;
  let mockIdentityClient: jest.Mocked<IdentityApiClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    mockAuthClient = new MockedAuthApiClient() as jest.Mocked<AuthApiClient>;
    mockBillingClient = new MockedBillingApiClient() as jest.Mocked<BillingApiClient>;
    mockIdentityClient = new MockedIdentityApiClient() as jest.Mocked<IdentityApiClient>;

    // Reset fetch mock
    mockFetch.mockClear();
  });

  describe("Cross-Service Error Propagation", () => {
    it("should handle authentication errors during billing operations", async () => {
      // Mock auth failure during billing call
      const authError = new EnhancedISPError({
        code: ErrorCode.AUTH_TOKEN_EXPIRED,
        message: "Authentication token has expired",
        context: {
          operation: "process_payment",
          businessProcess: "billing",
          customerImpact: "high",
        },
      });

      mockAuthClient.validateToken.mockRejectedValue(authError);
      mockBillingClient.processPayment.mockRejectedValue(authError);

      const billingOperation = async () => {
        await mockAuthClient.validateToken("expired_token");
        return await mockBillingClient.processPayment({
          amount: 299.99,
          customerId: "cust_123",
        });
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={billingOperation} />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByText(/Error AUTH_001/)).toBeInTheDocument();
        expect(screen.getByText(/Authentication token has expired/)).toBeInTheDocument();
        expect(screen.getByText(/business process: billing/)).toBeInTheDocument();
        expect(screen.getByText(/high severity/)).toBeInTheDocument();
      });

      expect(mockAuthClient.validateToken).toHaveBeenCalledWith("expired_token");
      expect(mockBillingClient.processPayment).not.toHaveBeenCalled();
    });

    it("should handle cascading service failures", async () => {
      // Identity service fails, affecting customer and billing services
      const identityError = new EnhancedISPError({
        code: ErrorCode.SYSTEM_DATABASE_ERROR,
        message: "Identity database connection failed",
        context: {
          operation: "fetch_customer_profile",
          businessProcess: "customer_management",
          customerImpact: "critical",
          service: "identity-service",
          correlationId: "req_cascade_test",
        },
        escalationRequired: true,
      });

      mockIdentityClient.getCustomer.mockRejectedValue(identityError);

      const cascadingOperation = async () => {
        const customer = await mockIdentityClient.getCustomer("cust_123");
        return await mockBillingClient.getCustomerBilling(customer.id);
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={cascadingOperation} />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByText(/Error SYS_001/)).toBeInTheDocument();
        expect(screen.getByText(/Identity database connection failed/)).toBeInTheDocument();
        expect(screen.getByText(/critical severity/)).toBeInTheDocument();
        expect(screen.getByText(/Contact Support/)).toBeInTheDocument(); // Escalation required
      });

      expect(mockIdentityClient.getCustomer).toHaveBeenCalledWith("cust_123");
      expect(mockBillingClient.getCustomerBilling).not.toHaveBeenCalled();
    });

    it("should handle network-level service communication failures", async () => {
      // Network failure between services
      const networkError = new EnhancedISPError({
        code: ErrorCode.NETWORK_CONNECTION_FAILED,
        message: "Unable to connect to billing service",
        context: {
          operation: "fetch_billing_history",
          businessProcess: "customer_service",
          customerImpact: "high",
          service: "api-gateway",
          component: "service-mesh",
          metadata: {
            targetService: "billing-service",
            timeout: 5000,
            retryAttempts: 3,
          },
        },
      });

      mockFetch.mockRejectedValue(new Error("Network Error"));
      mockBillingClient.getBillingHistory.mockRejectedValue(networkError);

      const networkOperation = async () => {
        return await mockBillingClient.getBillingHistory("cust_123");
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={networkOperation} />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByText(/Error NET_001/)).toBeInTheDocument();
        expect(screen.getByText(/Unable to connect to billing service/)).toBeInTheDocument();
        expect(screen.getByText(/Try Again/)).toBeInTheDocument(); // Retryable error
      });
    });
  });

  describe("Multi-Tenant Error Isolation", () => {
    it("should isolate errors between different tenants", async () => {
      const tenant1Error = new EnhancedISPError({
        code: ErrorCode.CUSTOMER_NOT_FOUND,
        message: "Customer not found in tenant context",
        context: {
          operation: "get_customer",
          businessProcess: "customer_management",
          customerImpact: "medium",
          metadata: {
            tenantId: "tenant_001",
            customerId: "cust_123",
          },
        },
      });

      const tenant2Error = new EnhancedISPError({
        code: ErrorCode.CUSTOMER_NOT_FOUND,
        message: "Customer not found in tenant context",
        context: {
          operation: "get_customer",
          businessProcess: "customer_management",
          customerImpact: "medium",
          metadata: {
            tenantId: "tenant_002",
            customerId: "cust_123",
          },
        },
      });

      // Mock different responses for different tenants
      mockIdentityClient.getCustomer.mockImplementation(async (customerId) => {
        const currentTenant = localStorage.getItem("currentTenant");
        if (currentTenant === "tenant_001") {
          throw tenant1Error;
        } else if (currentTenant === "tenant_002") {
          throw tenant2Error;
        }
        return { id: customerId, name: "Test Customer" };
      });

      const tenantOperation = async () => {
        return await mockIdentityClient.getCustomer("cust_123");
      };

      // Test Tenant 1
      const { unmount } = render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={tenantOperation} tenantId="tenant_001" />
        </EnhancedErrorBoundary>,
      );

      fireEvent.click(screen.getByRole("button", { name: /make api call/i }));

      await waitFor(() => {
        expect(screen.getByText(/tenant_001/)).toBeInTheDocument();
      });

      unmount();

      // Test Tenant 2 - should show different tenant context
      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={tenantOperation} tenantId="tenant_002" />
        </EnhancedErrorBoundary>,
      );

      fireEvent.click(screen.getByRole("button", { name: /make api call/i }));

      await waitFor(() => {
        expect(screen.getByText(/tenant_002/)).toBeInTheDocument();
        expect(screen.queryByText(/tenant_001/)).not.toBeInTheDocument();
      });
    });

    it("should prevent cross-tenant data leakage in error messages", async () => {
      const crossTenantError = new EnhancedISPError({
        code: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS,
        message: "Access denied: Customer belongs to different tenant",
        context: {
          operation: "access_customer_data",
          businessProcess: "data_access_control",
          customerImpact: "high",
          metadata: {
            requestedTenant: "tenant_001",
            actualTenant: "tenant_002",
            customerId: "cust_sensitive_123",
          },
        },
        sensitiveData: true,
      });

      mockIdentityClient.getCustomer.mockRejectedValue(crossTenantError);

      const crossTenantOperation = async () => {
        return await mockIdentityClient.getCustomer("cust_sensitive_123");
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={crossTenantOperation} tenantId="tenant_001" />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByText(/Error AUTHZ_001/)).toBeInTheDocument();
        expect(screen.getByText(/Access denied/)).toBeInTheDocument();

        // Should NOT leak sensitive tenant information
        expect(screen.queryByText(/tenant_002/)).not.toBeInTheDocument();
        expect(screen.queryByText(/cust_sensitive_123/)).not.toBeInTheDocument();
      });
    });

    it("should handle tenant context switching during API calls", async () => {
      let currentTenant = "tenant_001";

      mockIdentityClient.getCustomer.mockImplementation(async (customerId) => {
        // Simulate tenant switch during API call
        setTimeout(() => {
          currentTenant = "tenant_002";
          localStorage.setItem("currentTenant", "tenant_002");
        }, 100);

        const tenant = localStorage.getItem("currentTenant") || currentTenant;

        if (tenant !== "tenant_001") {
          throw new EnhancedISPError({
            code: ErrorCode.AUTHZ_TENANT_MISMATCH,
            message: "Tenant context changed during operation",
            context: {
              operation: "get_customer",
              businessProcess: "tenant_security",
              customerImpact: "high",
              metadata: {
                originalTenant: "tenant_001",
                currentTenant: tenant,
              },
            },
          });
        }

        return { id: customerId, name: "Test Customer" };
      });

      const tenantSwitchOperation = async () => {
        // Simulate slow API call where tenant context might change
        await new Promise((resolve) => setTimeout(resolve, 150));
        return await mockIdentityClient.getCustomer("cust_123");
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={tenantSwitchOperation} tenantId="tenant_001" />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByText(/Error AUTHZ_002/)).toBeInTheDocument();
        expect(screen.getByText(/Tenant context changed during operation/)).toBeInTheDocument();
      });
    });
  });

  describe("Complex Error Recovery Scenarios", () => {
    it("should handle retry with different error outcomes", async () => {
      let callCount = 0;
      const retryableError = new EnhancedISPError({
        code: ErrorCode.NETWORK_TIMEOUT,
        message: "Request timeout - server overloaded",
        context: {
          operation: "process_payment",
          businessProcess: "billing",
          customerImpact: "medium",
        },
        retryable: true,
        retryAfter: 1000,
      });

      mockBillingClient.processPayment.mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw retryableError;
        }
        return { success: true, transactionId: "txn_123" };
      });

      const retryOperation = async () => {
        return await mockBillingClient.processPayment({
          amount: 99.99,
          customerId: "cust_123",
        });
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={retryOperation} />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      // First attempt fails
      await waitFor(() => {
        expect(screen.getByText(/Error NET_002/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
      });

      // Retry - second attempt fails
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      await waitFor(() => {
        expect(screen.getByText(/Error NET_002/)).toBeInTheDocument();
      });

      // Third retry succeeds
      fireEvent.click(screen.getByRole("button", { name: /try again/i }));

      await waitFor(() => {
        expect(screen.queryByText(/Error NET_002/)).not.toBeInTheDocument();
        expect(screen.getByTestId("api-result")).toHaveTextContent(
          '{"success":true,"transactionId":"txn_123"}',
        );
      });

      expect(callCount).toBe(3);
    });

    it("should escalate after maximum retry attempts", async () => {
      let callCount = 0;
      const persistentError = new EnhancedISPError({
        code: ErrorCode.SYSTEM_DATABASE_ERROR,
        message: "Database connection pool exhausted",
        context: {
          operation: "save_customer_data",
          businessProcess: "data_persistence",
          customerImpact: "critical",
        },
        retryable: true,
        maxRetries: 3,
      });

      mockIdentityClient.updateCustomer.mockImplementation(async () => {
        callCount++;
        throw persistentError;
      });

      const persistentFailureOperation = async () => {
        return await mockIdentityClient.updateCustomer("cust_123", {
          name: "Updated Name",
        });
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={persistentFailureOperation} />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      // Retry multiple times
      for (let i = 0; i < 3; i++) {
        await waitFor(() => {
          expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole("button", { name: /try again/i }));
      }

      // After max retries, should show escalation
      await waitFor(() => {
        expect(screen.getByText(/Maximum retry attempts exceeded/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /contact support/i })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
      });

      expect(callCount).toBe(4); // Initial + 3 retries
    });

    it("should handle partial API failures with graceful degradation", async () => {
      // Customer API succeeds, but billing API fails
      mockIdentityClient.getCustomer.mockResolvedValue({
        id: "cust_123",
        name: "John Doe",
        email: "john@example.com",
      });

      mockBillingClient.getCustomerBilling.mockRejectedValue(
        new EnhancedISPError({
          code: ErrorCode.BILLING_SERVICE_UNAVAILABLE,
          message: "Billing service temporarily unavailable",
          context: {
            operation: "get_billing_data",
            businessProcess: "customer_dashboard",
            customerImpact: "low",
          },
          workaround:
            "Customer information is available, billing data will be shown when service recovers",
        }),
      );

      const partialFailureOperation = async () => {
        const customer = await mockIdentityClient.getCustomer("cust_123");
        try {
          const billing = await mockBillingClient.getCustomerBilling(customer.id);
          return { customer, billing };
        } catch (error) {
          // Return partial data with error info
          return {
            customer,
            billing: null,
            billingError: error,
          };
        }
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={partialFailureOperation} />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      await waitFor(() => {
        const result = screen.getByTestId("api-result");
        expect(result).toBeInTheDocument();

        const resultData = JSON.parse(result.textContent || "{}");
        expect(resultData.customer).toEqual({
          id: "cust_123",
          name: "John Doe",
          email: "john@example.com",
        });
        expect(resultData.billing).toBeNull();
        expect(resultData.billingError).toBeDefined();
      });

      expect(mockIdentityClient.getCustomer).toHaveBeenCalledWith("cust_123");
      expect(mockBillingClient.getCustomerBilling).toHaveBeenCalledWith("cust_123");
    });
  });

  describe("Error Correlation and Tracing", () => {
    it("should maintain correlation IDs across service calls", async () => {
      const correlationId = "trace_12345";

      mockAuthClient.validateToken.mockResolvedValue({ valid: true });
      mockIdentityClient.getCustomer.mockResolvedValue({ id: "cust_123" });

      const billingError = new EnhancedISPError({
        code: ErrorCode.BILLING_PAYMENT_FAILED,
        message: "Payment processing failed",
        context: {
          operation: "process_payment",
          businessProcess: "billing",
          customerImpact: "high",
          correlationId: correlationId,
        },
      });

      mockBillingClient.processPayment.mockRejectedValue(billingError);

      const tracedOperation = async () => {
        // Set correlation ID
        localStorage.setItem("correlationId", correlationId);

        await mockAuthClient.validateToken("valid_token");
        await mockIdentityClient.getCustomer("cust_123");
        return await mockBillingClient.processPayment({
          amount: 199.99,
          customerId: "cust_123",
        });
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={tracedOperation} />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByText(/Error BILL_001/)).toBeInTheDocument();
        expect(screen.getByText(new RegExp(correlationId))).toBeInTheDocument();
      });

      expect(mockAuthClient.validateToken).toHaveBeenCalled();
      expect(mockIdentityClient.getCustomer).toHaveBeenCalled();
      expect(mockBillingClient.processPayment).toHaveBeenCalled();
    });

    it("should track error propagation through service chain", async () => {
      const serviceChainErrors = [
        new EnhancedISPError({
          code: ErrorCode.AUTH_TOKEN_EXPIRED,
          message: "Token expired during service call",
          context: {
            operation: "validate_token",
            service: "auth-service",
            correlationId: "chain_123",
          },
        }),
        new EnhancedISPError({
          code: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS,
          message: "Cannot access customer data without valid token",
          context: {
            operation: "get_customer",
            service: "identity-service",
            correlationId: "chain_123",
            causedBy: ErrorCode.AUTH_TOKEN_EXPIRED,
          },
        }),
        new EnhancedISPError({
          code: ErrorCode.BILLING_CUSTOMER_ACCESS_DENIED,
          message: "Cannot retrieve billing data without customer identity",
          context: {
            operation: "get_billing_data",
            service: "billing-service",
            correlationId: "chain_123",
            causedBy: ErrorCode.AUTHZ_INSUFFICIENT_PERMISSIONS,
          },
        }),
      ];

      mockAuthClient.validateToken.mockRejectedValue(serviceChainErrors[0]);
      mockIdentityClient.getCustomer.mockRejectedValue(serviceChainErrors[1]);
      mockBillingClient.getCustomerBilling.mockRejectedValue(serviceChainErrors[2]);

      const serviceChainOperation = async () => {
        try {
          await mockAuthClient.validateToken("expired_token");
        } catch (authError) {
          try {
            await mockIdentityClient.getCustomer("cust_123");
          } catch (identityError) {
            throw identityError;
          }
        }
        return await mockBillingClient.getCustomerBilling("cust_123");
      };

      render(
        <EnhancedErrorBoundary>
          <ApiTestComponent apiCall={serviceChainOperation} />
        </EnhancedErrorBoundary>,
      );

      const apiButton = screen.getByRole("button", { name: /make api call/i });
      fireEvent.click(apiButton);

      await waitFor(() => {
        expect(screen.getByText(/Error AUTHZ_001/)).toBeInTheDocument();
        expect(
          screen.getByText(/Cannot access customer data without valid token/),
        ).toBeInTheDocument();
        expect(screen.getByText(/chain_123/)).toBeInTheDocument();
      });
    });
  });
});
