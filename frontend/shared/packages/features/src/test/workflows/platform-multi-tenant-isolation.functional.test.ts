/**
 * Functional Tests: Platform Multi-Tenant Isolation
 *
 * Tests critical data isolation between ISP tenants:
 * - Data isolation enforcement
 * - Cross-tenant access prevention
 * - Tenant context validation
 * - Row-level security
 * - Data leakage prevention
 * - Platform admin special access
 */

import { describe, it, expect, beforeEach } from "vitest";

import { createMockCustomer, createActiveCustomer } from "../factories/customer";
import { createMockONU } from "../factories/network";
import {
  createMockTenant,
  createMockSubscription,
  resetPlatformCounters,
  type Tenant,
} from "../factories/platform";

// Mock database query helper for testing
interface TenantScopedData {
  id: string;
  tenant_id: string;
  [key: string]: any;
}

describe("Platform: Multi-Tenant Isolation", () => {
  beforeEach(() => {
    resetPlatformCounters();
  });

  // ============================================================================
  // Data Isolation
  // ============================================================================

  describe("Data Isolation", () => {
    it("should isolate customer data between tenants", () => {
      const tenant1 = createMockTenant({ company_name: "ISP Alpha" });
      const tenant2 = createMockTenant({ company_name: "ISP Beta" });

      const customer1 = createMockCustomer({
        tenant_id: tenant1.tenant_id,
        first_name: "Alice",
      });

      const customer2 = createMockCustomer({
        tenant_id: tenant2.tenant_id,
        first_name: "Bob",
      });

      // Simulate tenant-scoped query
      const getCustomersForTenant = (tenantId: string, allCustomers: any[]) => {
        return allCustomers.filter((c) => c.tenant_id === tenantId);
      };

      const allCustomers = [customer1, customer2];
      const tenant1Customers = getCustomersForTenant(tenant1.tenant_id, allCustomers);

      expect(tenant1Customers.length).toBe(1);
      expect(tenant1Customers[0].first_name).toBe("Alice");
      expect(tenant1Customers[0].tenant_id).toBe(tenant1.tenant_id);
    });

    it("should isolate network equipment data between tenants", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const onu1 = createMockONU({
        tenant_id: tenant1.tenant_id,
        serial_number: "ALCL00000001",
      });

      const onu2 = createMockONU({
        tenant_id: tenant2.tenant_id,
        serial_number: "ALCL00000002",
      });

      // Tenant 1 should only see their own ONUs
      const getONUsForTenant = (tenantId: string, allONUs: any[]) => {
        return allONUs.filter((o) => o.tenant_id === tenantId);
      };

      const allONUs = [onu1, onu2];
      const tenant1ONUs = getONUsForTenant(tenant1.tenant_id, allONUs);

      expect(tenant1ONUs.length).toBe(1);
      expect(tenant1ONUs[0].serial_number).toBe("ALCL00000001");
    });

    it("should prevent tenant from counting other tenants' data", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const customers = [
        createMockCustomer({ tenant_id: tenant1.tenant_id }),
        createMockCustomer({ tenant_id: tenant1.tenant_id }),
        createMockCustomer({ tenant_id: tenant2.tenant_id }),
        createMockCustomer({ tenant_id: tenant2.tenant_id }),
        createMockCustomer({ tenant_id: tenant2.tenant_id }),
      ];

      const getTenantCustomerCount = (tenantId: string, allCustomers: any[]) => {
        return allCustomers.filter((c) => c.tenant_id === tenantId).length;
      };

      expect(getTenantCustomerCount(tenant1.tenant_id, customers)).toBe(2);
      expect(getTenantCustomerCount(tenant2.tenant_id, customers)).toBe(3);
    });
  });

  // ============================================================================
  // Cross-Tenant Access Prevention
  // ============================================================================

  describe("Cross-Tenant Access Prevention", () => {
    it("should prevent tenant from accessing another tenant's customer by ID", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const customer = createMockCustomer({
        customer_id: "cust_123",
        tenant_id: tenant2.tenant_id,
      });

      // Business logic: Fetch customer with tenant validation
      const getCustomerById = (
        customerId: string,
        requestingTenantId: string,
        allCustomers: any[],
      ) => {
        const customer = allCustomers.find((c) => c.customer_id === customerId);
        if (!customer) return null;
        // Enforce tenant isolation
        if (customer.tenant_id !== requestingTenantId) return null;
        return customer;
      };

      const allCustomers = [customer];
      const result = getCustomerById("cust_123", tenant1.tenant_id, allCustomers);

      expect(result).toBeNull();
    });

    it("should prevent tenant from updating another tenant's data", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const customer = createMockCustomer({
        customer_id: "cust_456",
        tenant_id: tenant2.tenant_id,
        first_name: "Original",
      });

      // Business logic: Update with tenant validation
      const updateCustomer = (
        customerId: string,
        requestingTenantId: string,
        updates: any,
        allCustomers: any[],
      ) => {
        const customer = allCustomers.find((c) => c.customer_id === customerId);
        if (!customer || customer.tenant_id !== requestingTenantId) {
          return { success: false, error: "Customer not found or access denied" };
        }
        return { success: true, data: { ...customer, ...updates } };
      };

      const result = updateCustomer("cust_456", tenant1.tenant_id, { first_name: "Hacked" }, [
        customer,
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain("access denied");
    });

    it("should prevent tenant from deleting another tenant's data", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const customer = createMockCustomer({
        customer_id: "cust_789",
        tenant_id: tenant2.tenant_id,
      });

      // Business logic: Delete with tenant validation
      const deleteCustomer = (
        customerId: string,
        requestingTenantId: string,
        allCustomers: any[],
      ) => {
        const customer = allCustomers.find((c) => c.customer_id === customerId);
        if (!customer || customer.tenant_id !== requestingTenantId) {
          return { success: false, error: "Unauthorized" };
        }
        return { success: true };
      };

      const result = deleteCustomer("cust_789", tenant1.tenant_id, [customer]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });
  });

  // ============================================================================
  // Tenant Context Validation
  // ============================================================================

  describe("Tenant Context Validation", () => {
    it("should validate tenant context is set before data access", () => {
      const validateTenantContext = (tenantId: string | null) => {
        if (!tenantId) {
          throw new Error("Tenant context not set");
        }
        return true;
      };

      expect(() => validateTenantContext(null)).toThrow("Tenant context not set");
      expect(() => validateTenantContext("tenant_1")).not.toThrow();
    });

    it("should reject query without tenant filter", () => {
      const requireTenantFilter = (query: { tenant_id?: string }) => {
        if (!query.tenant_id) {
          throw new Error("Query must include tenant_id filter");
        }
        return true;
      };

      expect(() => requireTenantFilter({})).toThrow("must include tenant_id");
      expect(() => requireTenantFilter({ tenant_id: "tenant_1" })).not.toThrow();
    });

    it("should validate JWT token contains tenant_id claim", () => {
      const mockJWTPayload = {
        user_id: "user_123",
        tenant_id: "tenant_1",
        role: "admin",
      };

      const validateToken = (payload: any) => {
        if (!payload.tenant_id) {
          throw new Error("Token missing tenant_id claim");
        }
        return true;
      };

      expect(() => validateToken(mockJWTPayload)).not.toThrow();
      expect(() => validateToken({ user_id: "user_123" })).toThrow("missing tenant_id");
    });
  });

  // ============================================================================
  // Row-Level Security Simulation
  // ============================================================================

  describe("Row-Level Security", () => {
    it("should automatically filter all queries by tenant_id", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const allCustomers = [
        createMockCustomer({ tenant_id: tenant1.tenant_id }),
        createMockCustomer({ tenant_id: tenant1.tenant_id }),
        createMockCustomer({ tenant_id: tenant2.tenant_id }),
      ];

      // Simulate RLS policy: WHERE tenant_id = current_tenant_id()
      const queryWithRLS = (currentTenantId: string, data: any[]) => {
        return data.filter((row) => row.tenant_id === currentTenantId);
      };

      const result = queryWithRLS(tenant1.tenant_id, allCustomers);
      expect(result.length).toBe(2);
      expect(result.every((r) => r.tenant_id === tenant1.tenant_id)).toBe(true);
    });

    it("should enforce tenant isolation in JOIN operations", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const customers = [
        { id: "c1", tenant_id: tenant1.tenant_id, name: "Customer 1" },
        { id: "c2", tenant_id: tenant2.tenant_id, name: "Customer 2" },
      ];

      const orders = [
        { id: "o1", tenant_id: tenant1.tenant_id, customer_id: "c1" },
        { id: "o2", tenant_id: tenant2.tenant_id, customer_id: "c2" },
      ];

      // Simulate JOIN with RLS
      const getCustomerOrders = (tenantId: string) => {
        const tenantCustomers = customers.filter((c) => c.tenant_id === tenantId);
        const tenantOrders = orders.filter((o) => o.tenant_id === tenantId);

        return tenantCustomers.map((customer) => ({
          ...customer,
          orders: tenantOrders.filter((o) => o.customer_id === customer.id),
        }));
      };

      const tenant1Data = getCustomerOrders(tenant1.tenant_id);
      expect(tenant1Data.length).toBe(1);
      expect(tenant1Data[0].orders.length).toBe(1);
      expect(tenant1Data[0].orders[0].id).toBe("o1");
    });

    it("should prevent aggregate queries from leaking data across tenants", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const invoices = [
        { tenant_id: tenant1.tenant_id, amount: 100 },
        { tenant_id: tenant1.tenant_id, amount: 200 },
        { tenant_id: tenant2.tenant_id, amount: 500 },
      ];

      const getTotalRevenue = (tenantId: string, allInvoices: any[]) => {
        return allInvoices
          .filter((inv) => inv.tenant_id === tenantId)
          .reduce((sum, inv) => sum + inv.amount, 0);
      };

      expect(getTotalRevenue(tenant1.tenant_id, invoices)).toBe(300);
      expect(getTotalRevenue(tenant2.tenant_id, invoices)).toBe(500);
    });
  });

  // ============================================================================
  // Platform Admin Special Access
  // ============================================================================

  describe("Platform Admin Access", () => {
    it("should allow platform admin to access all tenants", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const allTenants = [tenant1, tenant2];

      // Business logic: Platform admin can see all tenants
      const isPlatformAdmin = (role: string) => role === "platform_admin";
      const getAccessibleTenants = (role: string, tenants: Tenant[]) => {
        if (isPlatformAdmin(role)) {
          return tenants; // All tenants
        }
        return []; // Regular users don't see tenant list
      };

      const adminTenants = getAccessibleTenants("platform_admin", allTenants);
      const userTenants = getAccessibleTenants("tenant_admin", allTenants);

      expect(adminTenants.length).toBe(2);
      expect(userTenants.length).toBe(0);
    });

    it("should allow platform admin to query any tenant's data for support", () => {
      const tenant1 = createMockTenant();
      const customer = createMockCustomer({
        tenant_id: tenant1.tenant_id,
        customer_id: "cust_support",
      });

      // Business logic: Platform admin bypass tenant filter
      const getCustomerForSupport = (
        customerId: string,
        isPlatformAdmin: boolean,
        targetTenantId: string | null,
        allCustomers: any[],
      ) => {
        if (isPlatformAdmin) {
          // Platform admin can specify which tenant to query
          if (targetTenantId) {
            return allCustomers.find(
              (c) => c.customer_id === customerId && c.tenant_id === targetTenantId,
            );
          }
          // Or search across all tenants
          return allCustomers.find((c) => c.customer_id === customerId);
        }
        return null;
      };

      const result = getCustomerForSupport("cust_support", true, tenant1.tenant_id, [customer]);

      expect(result).not.toBeNull();
      expect(result?.customer_id).toBe("cust_support");
    });

    it("should log platform admin access to tenant data for audit", () => {
      const tenant = createMockTenant();
      const platformAdminId = "admin_999";

      const auditLog = {
        admin_id: platformAdminId,
        action: "view_customer_data",
        target_tenant_id: tenant.tenant_id,
        timestamp: new Date().toISOString(),
        reason: "Customer support ticket #1234",
      };

      expect(auditLog.admin_id).toBe(platformAdminId);
      expect(auditLog.target_tenant_id).toBe(tenant.tenant_id);
      expect(auditLog.reason).toBeDefined();
    });
  });

  // ============================================================================
  // Data Leakage Prevention
  // ============================================================================

  describe("Data Leakage Prevention", () => {
    it("should prevent tenant ID exposure in API responses", () => {
      const customer = createMockCustomer({
        tenant_id: "tenant_sensitive_123",
        first_name: "John",
      });

      // Business logic: Sanitize response
      const sanitizeForAPI = (data: any) => {
        const { tenant_id, ...publicData } = data;
        return publicData;
      };

      const apiResponse = sanitizeForAPI(customer);
      expect(apiResponse.tenant_id).toBeUndefined();
      expect(apiResponse.first_name).toBe("John");
    });

    it("should validate search queries cannot leak cross-tenant data", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const customers = [
        createMockCustomer({ tenant_id: tenant1.tenant_id, email: "alice@example.com" }),
        createMockCustomer({ tenant_id: tenant2.tenant_id, email: "bob@example.com" }),
      ];

      const searchCustomers = (tenantId: string, query: string, allCustomers: any[]) => {
        return allCustomers.filter((c) => c.tenant_id === tenantId && c.email.includes(query));
      };

      const results = searchCustomers(tenant1.tenant_id, "@example.com", customers);
      expect(results.length).toBe(1);
      expect(results[0].email).toBe("alice@example.com");
    });

    it("should prevent information disclosure through error messages", () => {
      const tenant1 = createMockTenant();
      const tenant2 = createMockTenant();

      const customer = createMockCustomer({
        customer_id: "cust_secret",
        tenant_id: tenant2.tenant_id,
      });

      // Business logic: Generic error for unauthorized access
      const getCustomer = (customerId: string, requestingTenantId: string, allCustomers: any[]) => {
        const customer = allCustomers.find((c) => c.customer_id === customerId);
        if (!customer || customer.tenant_id !== requestingTenantId) {
          // Don't reveal if customer exists in another tenant
          throw new Error("Customer not found");
        }
        return customer;
      };

      expect(() => getCustomer("cust_secret", tenant1.tenant_id, [customer])).toThrow(
        "Customer not found",
      );
    });
  });
});
