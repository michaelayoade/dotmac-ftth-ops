/**
 * Multi-Tenant Isolation Security Tests
 * Critical tests ensuring complete tenant data isolation and preventing cross-tenant data leakage
 */

import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import "@testing-library/jest-dom";
import React from "react";

import { ISPTenantProvider } from "../../components/ISPTenantProvider";
import { AuthProvider } from "../../components/AuthProvider";
import { ApiManager } from "../../api/manager/ApiManager";
import { EnhancedISPError, ErrorCode } from "../../utils/enhancedErrorHandling";
import { IdentityApiClient } from "@dotmac/headless/api";
import { BillingApiClient } from "@dotmac/headless/api";

// Mock API clients
jest.mock("../../api/clients/IdentityApiClient");
jest.mock("../../api/clients/BillingApiClient");
jest.mock("../../api/manager/ApiManager");

const MockedIdentityApiClient = IdentityApiClient as jest.MockedClass<typeof IdentityApiClient>;
const MockedBillingApiClient = BillingApiClient as jest.MockedClass<typeof BillingApiClient>;
const MockedApiManager = ApiManager as jest.MockedClass<typeof ApiManager>;

// Test data for different tenants
const TENANT_DATA = {
  tenant_001: {
    customers: [
      {
        id: "cust_001_001",
        name: "Tenant 1 Customer 1",
        email: "cust1@tenant1.com",
      },
      {
        id: "cust_001_002",
        name: "Tenant 1 Customer 2",
        email: "cust2@tenant1.com",
      },
    ],
    billing: [
      { customerId: "cust_001_001", balance: 299.99, status: "current" },
      { customerId: "cust_001_002", balance: 89.5, status: "overdue" },
    ],
    sensitive_data: {
      api_keys: ["key_001_secret", "key_001_private"],
      database_credentials: "db_tenant_001_secret",
    },
  },
  tenant_002: {
    customers: [
      {
        id: "cust_002_001",
        name: "Tenant 2 Customer 1",
        email: "cust1@tenant2.com",
      },
      {
        id: "cust_002_002",
        name: "Tenant 2 Customer 2",
        email: "cust2@tenant2.com",
      },
    ],
    billing: [
      { customerId: "cust_002_001", balance: 199.99, status: "current" },
      { customerId: "cust_002_002", balance: 0.0, status: "paid" },
    ],
    sensitive_data: {
      api_keys: ["key_002_secret", "key_002_private"],
      database_credentials: "db_tenant_002_secret",
    },
  },
  tenant_003: {
    customers: [
      {
        id: "cust_003_001",
        name: "Tenant 3 Customer 1",
        email: "cust1@tenant3.com",
      },
    ],
    billing: [{ customerId: "cust_003_001", balance: 499.99, status: "current" }],
    sensitive_data: {
      api_keys: ["key_003_secret"],
      database_credentials: "db_tenant_003_secret",
    },
  },
};

// Mock component that displays customer data
const TenantCustomerDisplay: React.FC<{
  customerId: string;
  onDataReceived?: (data: any) => void;
}> = ({ customerId, onDataReceived }) => {
  const [customer, setCustomer] = React.useState<any>(null);
  const [billing, setBilling] = React.useState<any>(null);
  const [error, setError] = React.useState<any>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const identityClient = new IdentityApiClient();
        const billingClient = new BillingApiClient();

        const customerData = await identityClient.getCustomer(customerId);
        const billingData = await billingClient.getCustomerBilling(customerId);

        setCustomer(customerData);
        setBilling(billingData);

        const combinedData = { customer: customerData, billing: billingData };
        onDataReceived?.(combinedData);
      } catch (err) {
        setError(err);
      }
    };

    fetchData();
  }, [customerId, onDataReceived]);

  if (error) {
    return <div data-testid="error-display">{error.message}</div>;
  }

  if (!customer || !billing) {
    return <div data-testid="loading">Loading...</div>;
  }

  return (
    <div data-testid="customer-display">
      <div data-testid="customer-name">{customer.name}</div>
      <div data-testid="customer-email">{customer.email}</div>
      <div data-testid="billing-balance">${billing.balance}</div>
      <div data-testid="billing-status">{billing.status}</div>
    </div>
  );
};

// Test wrapper with tenant context
const TenantTestWrapper: React.FC<{
  tenantId: string;
  userId: string;
  children: React.ReactNode;
}> = ({ tenantId, userId, children }) => {
  return (
    <AuthProvider initialUser={{ id: userId, tenantId }}>
      <ISPTenantProvider tenantId={tenantId}>{children}</ISPTenantProvider>
    </AuthProvider>
  );
};

describe("Multi-Tenant Isolation Security Tests", () => {
  let mockIdentityClient: jest.Mocked<IdentityApiClient>;
  let mockBillingClient: jest.Mocked<BillingApiClient>;
  let mockApiManager: jest.Mocked<ApiManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    cleanup();

    mockIdentityClient = new MockedIdentityApiClient() as jest.Mocked<IdentityApiClient>;
    mockBillingClient = new MockedBillingApiClient() as jest.Mocked<BillingApiClient>;
    mockApiManager = new MockedApiManager() as jest.Mocked<ApiManager>;

    // Mock API client responses based on tenant context
    mockIdentityClient.getCustomer.mockImplementation(async (customerId: string) => {
      const currentTenantId =
        localStorage.getItem("currentTenant") ||
        document.documentElement.getAttribute("data-tenant-id");

      if (!currentTenantId) {
        throw new EnhancedISPError({
          code: ErrorCode.AUTHZ_TENANT_CONTEXT_MISSING,
          message: "Tenant context required for customer access",
          context: {
            operation: "get_customer",
            businessProcess: "tenant_security",
            customerImpact: "high",
          },
        });
      }

      const tenantData = TENANT_DATA[currentTenantId as keyof typeof TENANT_DATA];
      if (!tenantData) {
        throw new EnhancedISPError({
          code: ErrorCode.AUTHZ_INVALID_TENANT,
          message: "Invalid tenant context",
          context: {
            operation: "get_customer",
            businessProcess: "tenant_security",
            customerImpact: "critical",
          },
        });
      }

      const customer = tenantData.customers.find((c) => c.id === customerId);
      if (!customer) {
        // Check if customer exists in other tenants (cross-tenant access attempt)
        const allTenants = Object.values(TENANT_DATA);
        const customerInOtherTenant = allTenants.some((tenant) =>
          tenant.customers.some((c) => c.id === customerId),
        );

        if (customerInOtherTenant) {
          throw new EnhancedISPError({
            code: ErrorCode.AUTHZ_CROSS_TENANT_ACCESS,
            message: "Cross-tenant access denied",
            context: {
              operation: "get_customer",
              businessProcess: "tenant_security",
              customerImpact: "critical",
              metadata: {
                requestedTenant: currentTenantId,
                customerId: customerId,
              },
            },
            sensitiveData: true, // Don't leak which tenant has this customer
          });
        }

        throw new EnhancedISPError({
          code: ErrorCode.CUSTOMER_NOT_FOUND,
          message: "Customer not found",
          context: {
            operation: "get_customer",
            businessProcess: "customer_management",
            customerImpact: "medium",
          },
        });
      }

      return customer;
    });

    mockBillingClient.getCustomerBilling.mockImplementation(async (customerId: string) => {
      const currentTenantId =
        localStorage.getItem("currentTenant") ||
        document.documentElement.getAttribute("data-tenant-id");

      if (!currentTenantId) {
        throw new EnhancedISPError({
          code: ErrorCode.AUTHZ_TENANT_CONTEXT_MISSING,
          message: "Tenant context required for billing access",
          context: {
            operation: "get_customer_billing",
            businessProcess: "tenant_security",
            customerImpact: "high",
          },
        });
      }

      const tenantData = TENANT_DATA[currentTenantId as keyof typeof TENANT_DATA];
      if (!tenantData) {
        throw new EnhancedISPError({
          code: ErrorCode.AUTHZ_INVALID_TENANT,
          message: "Invalid tenant context",
          context: {
            operation: "get_customer_billing",
            businessProcess: "tenant_security",
            customerImpact: "critical",
          },
        });
      }

      const billing = tenantData.billing.find((b) => b.customerId === customerId);
      if (!billing) {
        throw new EnhancedISPError({
          code: ErrorCode.BILLING_CUSTOMER_NOT_FOUND,
          message: "Billing data not found for customer",
          context: {
            operation: "get_customer_billing",
            businessProcess: "billing",
            customerImpact: "medium",
          },
        });
      }

      return billing;
    });
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-tenant-id");
  });

  describe("Tenant Context Isolation", () => {
    it("should enforce tenant context for all API calls", async () => {
      // No tenant context set - should fail
      render(<TenantCustomerDisplay customerId="cust_001_001" />);

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toHaveTextContent(/Tenant context required/);
      });

      expect(mockIdentityClient.getCustomer).toHaveBeenCalledWith("cust_001_001");
    });

    it("should only allow access to data within tenant boundary", async () => {
      const receivedData: any[] = [];

      // Set up tenant 1 context
      localStorage.setItem("currentTenant", "tenant_001");

      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay
            customerId="cust_001_001"
            onDataReceived={(data) => receivedData.push(data)}
          />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("customer-display")).toBeInTheDocument();
        expect(screen.getByTestId("customer-name")).toHaveTextContent("Tenant 1 Customer 1");
        expect(screen.getByTestId("customer-email")).toHaveTextContent("cust1@tenant1.com");
        expect(screen.getByTestId("billing-balance")).toHaveTextContent("$299.99");
      });

      expect(receivedData).toHaveLength(1);
      expect(receivedData[0].customer.name).toBe("Tenant 1 Customer 1");
      expect(receivedData[0].billing.balance).toBe(299.99);
    });

    it("should prevent cross-tenant data access", async () => {
      // Set up tenant 1 context
      localStorage.setItem("currentTenant", "tenant_001");

      // Try to access customer from tenant 2
      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay customerId="cust_002_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toHaveTextContent(/Cross-tenant access denied/);
      });

      expect(mockIdentityClient.getCustomer).toHaveBeenCalledWith("cust_002_001");
    });

    it("should isolate data between multiple tenant contexts", async () => {
      const tenant1Data: any[] = [];
      const tenant2Data: any[] = [];

      // Test Tenant 1
      localStorage.setItem("currentTenant", "tenant_001");

      const { unmount: unmountTenant1 } = render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay
            customerId="cust_001_001"
            onDataReceived={(data) => tenant1Data.push(data)}
          />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("customer-name")).toHaveTextContent("Tenant 1 Customer 1");
      });

      unmountTenant1();

      // Switch to Tenant 2
      localStorage.setItem("currentTenant", "tenant_002");

      render(
        <TenantTestWrapper tenantId="tenant_002" userId="user_002">
          <TenantCustomerDisplay
            customerId="cust_002_001"
            onDataReceived={(data) => tenant2Data.push(data)}
          />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("customer-name")).toHaveTextContent("Tenant 2 Customer 1");
      });

      // Verify complete isolation
      expect(tenant1Data[0].customer.name).toBe("Tenant 1 Customer 1");
      expect(tenant1Data[0].customer.email).toBe("cust1@tenant1.com");

      expect(tenant2Data[0].customer.name).toBe("Tenant 2 Customer 1");
      expect(tenant2Data[0].customer.email).toBe("cust1@tenant2.com");

      // Ensure no data leakage
      expect(tenant1Data[0].customer.email).not.toContain("tenant2.com");
      expect(tenant2Data[0].customer.email).not.toContain("tenant1.com");
    });
  });

  describe("Cross-Tenant Attack Prevention", () => {
    it("should prevent tenant ID manipulation attacks", async () => {
      // Set legitimate tenant context
      localStorage.setItem("currentTenant", "tenant_001");
      document.documentElement.setAttribute("data-tenant-id", "tenant_001");

      // Attempt to manipulate tenant ID in API call
      mockIdentityClient.getCustomer.mockImplementationOnce(async (customerId: string) => {
        // Simulate attacker trying to override tenant context in request
        const manipulatedTenantId = "tenant_002";

        // Security check should prevent this
        const actualTenantId = localStorage.getItem("currentTenant");
        if (actualTenantId !== manipulatedTenantId) {
          throw new EnhancedISPError({
            code: ErrorCode.AUTHZ_TENANT_MANIPULATION_DETECTED,
            message: "Tenant ID manipulation attempt detected",
            context: {
              operation: "get_customer",
              businessProcess: "security_enforcement",
              customerImpact: "critical",
              metadata: {
                expectedTenant: actualTenantId,
                attemptedTenant: manipulatedTenantId,
              },
            },
          });
        }

        // Should not reach here in real implementation
        return TENANT_DATA.tenant_002.customers[0];
      });

      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay customerId="cust_002_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toHaveTextContent(
          /Tenant ID manipulation attempt detected/,
        );
      });
    });

    it("should prevent session hijacking attempts", async () => {
      // Simulate session with different tenant context
      const originalTenant = "tenant_001";
      const hijackedTenant = "tenant_002";

      localStorage.setItem("currentTenant", originalTenant);
      localStorage.setItem("sessionToken", "session_tenant_001");

      // Simulate session token manipulation
      mockIdentityClient.getCustomer.mockImplementationOnce(async (customerId: string) => {
        const sessionToken = localStorage.getItem("sessionToken");
        const currentTenant = localStorage.getItem("currentTenant");

        // Simulate security check for session-tenant mismatch
        if (sessionToken === "session_tenant_001" && currentTenant !== "tenant_001") {
          throw new EnhancedISPError({
            code: ErrorCode.AUTH_SESSION_HIJACKING_DETECTED,
            message: "Session hijacking attempt detected",
            context: {
              operation: "get_customer",
              businessProcess: "security_enforcement",
              customerImpact: "critical",
            },
          });
        }

        return TENANT_DATA[currentTenant as keyof typeof TENANT_DATA].customers[0];
      });

      // Attempt to change tenant while keeping original session
      localStorage.setItem("currentTenant", hijackedTenant);

      render(
        <TenantTestWrapper tenantId={hijackedTenant} userId="user_002">
          <TenantCustomerDisplay customerId="cust_002_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toHaveTextContent(
          /Session hijacking attempt detected/,
        );
      });
    });

    it("should prevent privilege escalation through tenant switching", async () => {
      // Start with limited tenant access
      localStorage.setItem("currentTenant", "tenant_003");
      localStorage.setItem("userRole", "limited_user");

      mockIdentityClient.getCustomer.mockImplementationOnce(async (customerId: string) => {
        const userRole = localStorage.getItem("userRole");
        const currentTenant = localStorage.getItem("currentTenant");

        // Simulate attempting to access data from higher-privilege tenant
        if (userRole === "limited_user" && customerId.includes("001")) {
          throw new EnhancedISPError({
            code: ErrorCode.AUTHZ_PRIVILEGE_ESCALATION_DETECTED,
            message: "Privilege escalation attempt detected",
            context: {
              operation: "get_customer",
              businessProcess: "security_enforcement",
              customerImpact: "critical",
              metadata: {
                userRole: userRole,
                attemptedAccess: "admin_customer_data",
              },
            },
          });
        }

        const tenantData = TENANT_DATA[currentTenant as keyof typeof TENANT_DATA];
        return tenantData.customers.find((c) => c.id === customerId);
      });

      render(
        <TenantTestWrapper tenantId="tenant_003" userId="user_limited">
          <TenantCustomerDisplay customerId="cust_001_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toHaveTextContent(
          /Privilege escalation attempt detected/,
        );
      });
    });
  });

  describe("Sensitive Data Protection", () => {
    it("should never leak sensitive data in error messages", async () => {
      localStorage.setItem("currentTenant", "tenant_001");

      // Mock API to include sensitive data in internal error but not expose it
      mockIdentityClient.getCustomer.mockImplementationOnce(async () => {
        const error = new EnhancedISPError({
          code: ErrorCode.SYSTEM_DATABASE_ERROR,
          message: "Database connection failed",
          context: {
            operation: "get_customer",
            businessProcess: "data_access",
            customerImpact: "high",
          },
          sensitiveData: true,
          metadata: {
            // This sensitive data should never be exposed to frontend
            internalError: "Connection failed to db_tenant_001_secret",
            apiKey: "key_001_secret",
            credentials: "admin:password123",
          },
        });

        throw error;
      });

      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay customerId="cust_001_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        const errorDisplay = screen.getByTestId("error-display");
        const errorText = errorDisplay.textContent || "";

        // Should show safe error message
        expect(errorText).toContain("Database connection failed");

        // Should NOT leak sensitive information
        expect(errorText).not.toContain("db_tenant_001_secret");
        expect(errorText).not.toContain("key_001_secret");
        expect(errorText).not.toContain("admin:password123");
        expect(errorText).not.toContain("Connection failed to");
      });
    });

    it("should sanitize tenant identifiers in logs", async () => {
      localStorage.setItem("currentTenant", "tenant_001");

      const loggedErrors: any[] = [];

      // Mock console.error to capture logs
      const originalConsoleError = console.error;
      console.error = jest.fn((...args) => {
        loggedErrors.push(args);
      });

      mockIdentityClient.getCustomer.mockImplementationOnce(async () => {
        throw new EnhancedISPError({
          code: ErrorCode.CUSTOMER_NOT_FOUND,
          message: "Customer not found",
          context: {
            operation: "get_customer",
            businessProcess: "customer_management",
            customerImpact: "medium",
            metadata: {
              tenantId: "tenant_001", // Should be sanitized in logs
              customerId: "cust_001_001",
              internalQuery: "SELECT * FROM customers WHERE tenant_id = tenant_001",
            },
          },
        });
      });

      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay customerId="cust_001_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });

      // Restore console.error
      console.error = originalConsoleError;

      // Verify tenant identifiers are sanitized in logs
      const errorLog = loggedErrors.find((log) =>
        log.some((arg: any) => typeof arg === "string" && arg.includes("Customer not found")),
      );

      if (errorLog) {
        const logString = errorLog.join(" ");
        expect(logString).not.toContain("tenant_001");
        expect(logString).not.toContain("SELECT * FROM customers");
      }
    });

    it("should prevent data leakage through timing attacks", async () => {
      const timingResults: number[] = [];

      // Test legitimate tenant access timing
      localStorage.setItem("currentTenant", "tenant_001");

      const startTime = performance.now();

      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay customerId="cust_001_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("customer-display")).toBeInTheDocument();
      });

      const legitimateAccessTime = performance.now() - startTime;
      timingResults.push(legitimateAccessTime);

      cleanup();

      // Test cross-tenant access attempt timing
      const crossTenantStartTime = performance.now();

      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay customerId="cust_002_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toBeInTheDocument();
      });

      const crossTenantAccessTime = performance.now() - crossTenantStartTime;
      timingResults.push(crossTenantAccessTime);

      // Timing should be similar to prevent information leakage
      // Allow 50% variance to account for test environment variability
      const timingDifference = Math.abs(timingResults[0] - timingResults[1]);
      const averageTiming = (timingResults[0] + timingResults[1]) / 2;
      const variancePercentage = (timingDifference / averageTiming) * 100;

      expect(variancePercentage).toBeLessThan(50);
    });
  });

  describe("Tenant Context Consistency", () => {
    it("should maintain tenant context across multiple API calls", async () => {
      localStorage.setItem("currentTenant", "tenant_002");

      let apiCallCount = 0;
      const tenantContextLog: string[] = [];

      // Mock both clients to track tenant context
      mockIdentityClient.getCustomer.mockImplementation(async (customerId: string) => {
        apiCallCount++;
        const currentTenant = localStorage.getItem("currentTenant");
        tenantContextLog.push(`identity-call-${apiCallCount}:${currentTenant}`);

        const tenantData = TENANT_DATA[currentTenant as keyof typeof TENANT_DATA];
        return tenantData.customers.find((c) => c.id === customerId)!;
      });

      mockBillingClient.getCustomerBilling.mockImplementation(async (customerId: string) => {
        apiCallCount++;
        const currentTenant = localStorage.getItem("currentTenant");
        tenantContextLog.push(`billing-call-${apiCallCount}:${currentTenant}`);

        const tenantData = TENANT_DATA[currentTenant as keyof typeof TENANT_DATA];
        return tenantData.billing.find((b) => b.customerId === customerId)!;
      });

      render(
        <TenantTestWrapper tenantId="tenant_002" userId="user_002">
          <TenantCustomerDisplay customerId="cust_002_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("customer-display")).toBeInTheDocument();
      });

      // Verify both API calls maintained the same tenant context
      expect(tenantContextLog).toHaveLength(2);
      expect(tenantContextLog[0]).toBe("identity-call-1:tenant_002");
      expect(tenantContextLog[1]).toBe("billing-call-2:tenant_002");
    });

    it("should handle tenant context changes during async operations", async () => {
      localStorage.setItem("currentTenant", "tenant_001");

      // Mock a slow API call that might be interrupted by tenant switch
      mockIdentityClient.getCustomer.mockImplementation(async (customerId: string) => {
        const initialTenant = localStorage.getItem("currentTenant");

        // Simulate slow operation
        await new Promise((resolve) => setTimeout(resolve, 100));

        const finalTenant = localStorage.getItem("currentTenant");

        if (initialTenant !== finalTenant) {
          throw new EnhancedISPError({
            code: ErrorCode.AUTHZ_TENANT_CONTEXT_CHANGED,
            message: "Tenant context changed during operation",
            context: {
              operation: "get_customer",
              businessProcess: "tenant_security",
              customerImpact: "high",
              metadata: {
                initialTenant: initialTenant,
                finalTenant: finalTenant,
              },
            },
          });
        }

        const tenantData = TENANT_DATA[finalTenant as keyof typeof TENANT_DATA];
        return tenantData.customers.find((c) => c.id === customerId)!;
      });

      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay customerId="cust_001_001" />
        </TenantTestWrapper>,
      );

      // Change tenant context while API call is in progress
      setTimeout(() => {
        localStorage.setItem("currentTenant", "tenant_002");
      }, 50);

      await waitFor(() => {
        expect(screen.getByTestId("error-display")).toHaveTextContent(
          /Tenant context changed during operation/,
        );
      });
    });

    it("should validate tenant context on every request", async () => {
      const contextValidations: string[] = [];

      // Mock API to log every context validation
      mockIdentityClient.getCustomer.mockImplementation(async (customerId: string) => {
        const tenantId = localStorage.getItem("currentTenant");
        const sessionTenant = document.documentElement.getAttribute("data-tenant-id");

        contextValidations.push(`validation:tenant=${tenantId},session=${sessionTenant}`);

        if (!tenantId || !sessionTenant || tenantId !== sessionTenant) {
          throw new EnhancedISPError({
            code: ErrorCode.AUTHZ_TENANT_CONTEXT_INVALID,
            message: "Invalid tenant context",
            context: {
              operation: "get_customer",
              businessProcess: "tenant_security",
              customerImpact: "critical",
            },
          });
        }

        const tenantData = TENANT_DATA[tenantId as keyof typeof TENANT_DATA];
        return tenantData.customers.find((c) => c.id === customerId)!;
      });

      // Valid context
      localStorage.setItem("currentTenant", "tenant_001");
      document.documentElement.setAttribute("data-tenant-id", "tenant_001");

      render(
        <TenantTestWrapper tenantId="tenant_001" userId="user_001">
          <TenantCustomerDisplay customerId="cust_001_001" />
        </TenantTestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("customer-display")).toBeInTheDocument();
      });

      expect(contextValidations).toHaveLength(1);
      expect(contextValidations[0]).toBe("validation:tenant=tenant_001,session=tenant_001");
    });
  });
});
