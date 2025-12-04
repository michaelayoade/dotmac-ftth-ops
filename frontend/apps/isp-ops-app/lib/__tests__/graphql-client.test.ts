/**
 * Tests for GraphQL client
 * Tests GraphQL request handling and error scenarios
 */

import { graphqlClient } from "../graphql-client";

// Mock operatorAuth
jest.mock("../../../../shared/utils/operatorAuth", () => ({
  getOperatorAccessToken: jest.fn(),
}));

describe("graphql-client", () => {
  let mockFetch: jest.Mock;
  let originalFetch: typeof fetch | undefined;
  const { getOperatorAccessToken } = require("../../../../shared/utils/operatorAuth");

  beforeEach(() => {
    originalFetch = (global as any).fetch;
    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;
    getOperatorAccessToken.mockReturnValue("test-token");
  });

  afterEach(() => {
    // Restore original fetch instead of deleting (preserves MSW compatibility)
    (global as any).fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe("request", () => {
    it("should make GraphQL request with query", async () => {
      const mockResponse = {
        data: { users: [{ id: "1", name: "John" }] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const query = "query { users { id name } }";
      const result = await graphqlClient.request(query);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/isp/v1/admin/graphql",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Portal-Type": "ispAdmin",
            Authorization: "Bearer test-token",
          }),
        }),
      );

      expect(result).toEqual(mockResponse.data);
    });

    it("should make GraphQL request with variables", async () => {
      const mockResponse = {
        data: { user: { id: "1", name: "John" } },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const query = "query GetUser($id: ID!) { user(id: $id) { id name } }";
      const variables = { id: "1" };

      const result = await graphqlClient.request(query, variables);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.query).toBe(query);
      expect(callBody.variables).toEqual(variables);
      expect(result).toEqual(mockResponse.data);
    });

    it("should include Authorization header when token exists", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      await graphqlClient.request("query { test }");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        }),
      );
    });

    it("should not include Authorization header when token is null", async () => {
      getOperatorAccessToken.mockReturnValue(null);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      await graphqlClient.request("query { test }");

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers.Authorization).toBeUndefined();
    });

    it("should throw error when response is not ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      await expect(graphqlClient.request("query { test }")).rejects.toThrow(
        "GraphQL request failed: 500 Internal Server Error",
      );
    });

    it("should throw error when GraphQL response contains errors", async () => {
      const mockResponse = {
        errors: [{ message: "User not found" }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(graphqlClient.request("query { test }")).rejects.toThrow("User not found");
    });

    it("should throw error when response is missing data", async () => {
      const mockResponse = {};

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(graphqlClient.request("query { test }")).rejects.toThrow(
        "GraphQL response missing data",
      );
    });

    it("should include credentials in request", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      await graphqlClient.request("query { test }");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: "include",
        }),
      );
    });

    it("should set X-Portal-Type header", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      await graphqlClient.request("query { test }");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Portal-Type": "ispAdmin",
          }),
        }),
      );
    });
  });

  describe("Error handling", () => {
    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(graphqlClient.request("query { test }")).rejects.toThrow("Network error");
    });

    it("should handle malformed JSON response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(graphqlClient.request("query { test }")).rejects.toThrow("Invalid JSON");
    });

    it("should handle multiple errors in response", async () => {
      const mockResponse = {
        errors: [{ message: "First error" }, { message: "Second error" }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Should throw first error
      await expect(graphqlClient.request("query { test }")).rejects.toThrow("First error");
    });

    it("should handle error without message", async () => {
      const mockResponse = {
        errors: [{}],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      await expect(graphqlClient.request("query { test }")).rejects.toThrow(
        "GraphQL request failed",
      );
    });
  });

  describe("Type safety", () => {
    it("should return typed data", async () => {
      interface User {
        id: string;
        name: string;
      }

      const mockResponse = {
        data: { users: [{ id: "1", name: "John" }] },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await graphqlClient.request<{ users: User[] }>("query { users { id name } }");

      expect(result.users).toHaveLength(1);
      expect(result.users[0].id).toBe("1");
      expect(result.users[0].name).toBe("John");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty query", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const result = await graphqlClient.request("");

      expect(result).toEqual({});
    });

    it("should handle empty variables", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const result = await graphqlClient.request("query { test }", {});

      expect(result).toEqual({});
    });

    it("should handle null data with no errors", async () => {
      const mockResponse = {
        data: null,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      // Should throw because data is null (falsy)
      await expect(graphqlClient.request("query { test }")).rejects.toThrow(
        "GraphQL response missing data",
      );
    });

    it("should handle complex nested variables", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: { result: "success" } }),
      });

      const variables = {
        input: {
          user: {
            name: "John",
            age: 30,
            address: {
              city: "New York",
              zip: "10001",
            },
          },
        },
      };

      await graphqlClient.request("mutation { test }", variables);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.variables).toEqual(variables);
    });
  });
});
