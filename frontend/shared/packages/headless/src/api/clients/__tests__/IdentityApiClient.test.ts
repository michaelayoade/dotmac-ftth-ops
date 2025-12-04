/**
 * IdentityApiClient Tests
 * Comprehensive test suite for the Identity API client
 */

import { IdentityApiClient } from "../IdentityApiClient";
import type { CustomerData, UserData } from "../../types/api";

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("IdentityApiClient", () => {
  let client: IdentityApiClient;
  const baseURL = "https://api.test.com";
  const defaultHeaders = { Authorization: "Bearer test-token" };

  beforeEach(() => {
    client = new IdentityApiClient(baseURL, defaultHeaders);
    jest.clearAllMocks();
  });

  // Mock response helper
  const mockResponse = <T>(data: T, status = 200) => {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
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
        timestamp: new Date().toISOString(),
      }),
    } as Response);
  };

  describe("Customer Management", () => {
    const mockCustomer: CustomerData = {
      id: "cust_123",
      portal_id: "CUST001",
      company_name: "Test Company",
      contact_name: "John Doe",
      email: "john@test.com",
      phone: "+1-555-0123",
      address: {
        street: "123 Main St",
        city: "Test City",
        state: "CA",
        zip: "12345",
        country: "US",
      },
      status: "ACTIVE",
      account_type: "BUSINESS",
      services: [],
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    describe("getCustomers", () => {
      it("should fetch customers with pagination", async () => {
        const mockResponse_data = {
          data: [mockCustomer],
          pagination: {
            page: 1,
            limit: 10,
            total: 1,
            total_pages: 1,
            has_next: false,
            has_previous: false,
          },
        };

        mockResponse(mockResponse_data);

        const result = await client.getCustomers({ page: 1, limit: 10 });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/customers?page=1&limit=10",
          expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining(defaultHeaders),
          }),
        );

        expect(result).toEqual(mockResponse_data);
      });

      it("should handle search parameters", async () => {
        const mockResponse_data = { data: [], pagination: expect.any(Object) };
        mockResponse(mockResponse_data);

        await client.getCustomers({ search: "john@test.com" });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/customers?search=john%40test.com",
          expect.any(Object),
        );
      });

      it("should handle API errors", async () => {
        mockErrorResponse(500, "Internal Server Error");

        await expect(client.getCustomers()).rejects.toThrow("Internal Server Error");
      });
    });

    describe("getCustomer", () => {
      it("should fetch single customer by ID", async () => {
        const mockResponse_data = { data: mockCustomer };
        mockResponse(mockResponse_data);

        const result = await client.getCustomer("cust_123");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/customers/cust_123",
          expect.objectContaining({
            method: "GET",
            headers: expect.objectContaining(defaultHeaders),
          }),
        );

        expect(result).toEqual(mockResponse_data);
      });

      it("should handle customer not found", async () => {
        mockErrorResponse(404, "Customer not found");

        await expect(client.getCustomer("invalid_id")).rejects.toThrow("Customer not found");
      });
    });

    describe("createCustomer", () => {
      it("should create new customer", async () => {
        const newCustomerData = {
          contact_name: "Jane Smith",
          email: "jane@test.com",
          phone: "+1-555-0456",
          address: mockCustomer.address,
          account_type: "RESIDENTIAL" as const,
        };

        const createdCustomer = {
          ...mockCustomer,
          ...newCustomerData,
          id: "cust_456",
        };
        mockResponse({ data: createdCustomer });

        const result = await client.createCustomer(newCustomerData);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/customers",
          expect.objectContaining({
            method: "POST",
            headers: expect.objectContaining({
              ...defaultHeaders,
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(newCustomerData),
          }),
        );

        expect(result.data.email).toBe("jane@test.com");
      });

      it("should handle validation errors", async () => {
        mockErrorResponse(400, "Invalid email format");

        await expect(
          client.createCustomer({
            contact_name: "Test",
            email: "invalid-email",
            address: mockCustomer.address,
            account_type: "RESIDENTIAL",
          }),
        ).rejects.toThrow("Invalid email format");
      });
    });

    describe("updateCustomer", () => {
      it("should update customer data", async () => {
        const updates = { contact_name: "John Smith Updated" };
        const updatedCustomer = { ...mockCustomer, ...updates };
        mockResponse({ data: updatedCustomer });

        const result = await client.updateCustomer("cust_123", updates);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/customers/cust_123",
          expect.objectContaining({
            method: "PUT",
            headers: expect.objectContaining({
              ...defaultHeaders,
              "Content-Type": "application/json",
            }),
            body: JSON.stringify(updates),
          }),
        );

        expect(result.data.contact_name).toBe("John Smith Updated");
      });
    });

    describe("deleteCustomer", () => {
      it("should delete customer", async () => {
        mockResponse({ success: true });

        const result = await client.deleteCustomer("cust_123");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/customers/cust_123",
          expect.objectContaining({
            method: "DELETE",
            headers: expect.objectContaining(defaultHeaders),
          }),
        );

        expect(result.success).toBe(true);
      });

      it("should handle deletion errors", async () => {
        mockErrorResponse(409, "Customer has active services");

        await expect(client.deleteCustomer("cust_123")).rejects.toThrow(
          "Customer has active services",
        );
      });
    });
  });

  describe("User Management", () => {
    const mockUser: UserData = {
      id: "user_123",
      email: "admin@test.com",
      name: "Admin User",
      role: "ADMIN",
      permissions: ["admin.read", "admin.write"],
      status: "ACTIVE",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    describe("getUsers", () => {
      it("should fetch users with filtering", async () => {
        const mockResponse_data = {
          data: [mockUser],
          pagination: expect.any(Object),
        };
        mockResponse(mockResponse_data);

        await client.getUsers({ role: "ADMIN" });

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/users?role=ADMIN",
          expect.any(Object),
        );
      });
    });

    describe("createUser", () => {
      it("should create new user", async () => {
        const newUserData = {
          email: "newuser@test.com",
          name: "New User",
          role: "OPERATOR",
          permissions: ["basic.read"],
        };

        mockResponse({ data: { ...mockUser, ...newUserData, id: "user_456" } });

        const result = await client.createUser(newUserData);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/users",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify(newUserData),
          }),
        );

        expect(result.data.email).toBe("newuser@test.com");
      });
    });

    describe("updateUserPermissions", () => {
      it("should update user permissions", async () => {
        const newPermissions = ["admin.read", "admin.write", "billing.read"];
        mockResponse({ data: { ...mockUser, permissions: newPermissions } });

        const result = await client.updateUserPermissions("user_123", newPermissions);

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/users/user_123/permissions",
          expect.objectContaining({
            method: "PUT",
            body: JSON.stringify({ permissions: newPermissions }),
          }),
        );

        expect(result.data.permissions).toEqual(newPermissions);
      });
    });
  });

  describe("Portal ID Management", () => {
    describe("generatePortalId", () => {
      it("should generate portal ID for customer", async () => {
        mockResponse({ data: { portal_id: "CUST789" } });

        const result = await client.generatePortalId("cust_123");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/customers/cust_123/portal-id",
          expect.objectContaining({
            method: "POST",
          }),
        );

        expect(result.data.portal_id).toBe("CUST789");
      });
    });

    describe("validatePortalId", () => {
      it("should validate portal ID", async () => {
        mockResponse({ data: { valid: true, customer_id: "cust_123" } });

        const result = await client.validatePortalId("CUST789");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/portal-id/CUST789/validate",
          expect.objectContaining({
            method: "GET",
          }),
        );

        expect(result.data.valid).toBe(true);
        expect(result.data.customer_id).toBe("cust_123");
      });

      it("should handle invalid portal ID", async () => {
        mockResponse({ data: { valid: false } });

        const result = await client.validatePortalId("INVALID");

        expect(result.data.valid).toBe(false);
      });
    });
  });

  describe("Authentication", () => {
    describe("loginWithPortalId", () => {
      it("should authenticate with portal ID and password", async () => {
        const authResponse = {
          data: {
            access_token: "jwt-token",
            refresh_token: "refresh-token",
            user: mockUser,
            expires_in: 3600,
          },
        };

        mockResponse(authResponse);

        const result = await client.loginWithPortalId("CUST789", "password123");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/auth/portal-login",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({
              portal_id: "CUST789",
              password: "password123",
            }),
          }),
        );

        expect(result.data.access_token).toBe("jwt-token");
      });

      it("should handle invalid credentials", async () => {
        mockErrorResponse(401, "Invalid credentials");

        await expect(client.loginWithPortalId("CUST789", "wrongpass")).rejects.toThrow(
          "Invalid credentials",
        );
      });
    });

    describe("refreshToken", () => {
      it("should refresh access token", async () => {
        const refreshResponse = {
          data: {
            access_token: "new-jwt-token",
            expires_in: 3600,
          },
        };

        mockResponse(refreshResponse);

        const result = await client.refreshToken("refresh-token");

        expect(mockFetch).toHaveBeenCalledWith(
          "https://api.test.com/api/identity/auth/refresh",
          expect.objectContaining({
            method: "POST",
            body: JSON.stringify({ refresh_token: "refresh-token" }),
          }),
        );

        expect(result.data.access_token).toBe("new-jwt-token");
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(client.getCustomers()).rejects.toThrow("Network error");
    });

    it("should handle malformed JSON responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      } as Response);

      await expect(client.getCustomers()).rejects.toThrow("Invalid JSON");
    });

    it("should handle rate limiting", async () => {
      mockErrorResponse(429, "Too Many Requests");

      await expect(client.getCustomers()).rejects.toThrow("Too Many Requests");
    });
  });

  describe("Request Headers", () => {
    it("should include default headers in requests", async () => {
      mockResponse({ data: [] });

      await client.getCustomers();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining(defaultHeaders),
        }),
      );
    });

    it("should include Content-Type for POST requests", async () => {
      mockResponse({ data: mockCustomer });

      await client.createCustomer({
        contact_name: "Test",
        email: "test@test.com",
        address: mockCustomer.address,
        account_type: "RESIDENTIAL",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });
  });

  describe("URL Construction", () => {
    it("should construct URLs correctly with query parameters", async () => {
      mockResponse({ data: [], pagination: expect.any(Object) });

      await client.getCustomers({
        page: 2,
        limit: 25,
        search: "test query",
        status: "ACTIVE",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/identity/customers?page=2&limit=25&search=test%20query&status=ACTIVE",
        expect.any(Object),
      );
    });

    it("should handle special characters in query parameters", async () => {
      mockResponse({ data: [], pagination: expect.any(Object) });

      await client.getCustomers({ search: "test@example.com & co." });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.test.com/api/identity/customers?search=test%40example.com%20%26%20co.",
        expect.any(Object),
      );
    });
  });
});
