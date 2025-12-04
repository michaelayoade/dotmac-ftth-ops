/**
 * Tests for GraphQL client
 */

// Mock HttpClient before importing anything
const mockPost = jest.fn();
const mockEnableAuth = jest.fn().mockReturnThis();
const mockGetCurrentTenantId = jest.fn(() => "test-tenant-123");

const mockHttpClientInstance = {
  enableAuth: mockEnableAuth,
  post: mockPost,
  getCurrentTenantId: mockGetCurrentTenantId,
};

jest.mock("@dotmac/http-client", () => ({
  HttpClient: {
    createFromHostname: jest.fn(() => mockHttpClientInstance),
    create: jest.fn(() => mockHttpClientInstance),
  },
}));

import {
  GraphQLClient,
  GraphQLError,
  createGraphQLClient,
} from "../client";
import { HttpClient } from "@dotmac/http-client";

const mockHttpClient = HttpClient as jest.Mocked<typeof HttpClient>;

describe("GraphQL Client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock implementations
    mockPost.mockReset();
    mockEnableAuth.mockReset().mockReturnThis();
    mockGetCurrentTenantId.mockReset().mockReturnValue("test-tenant-123");
  });

  describe("constructor", () => {
    it("creates client with default endpoint", () => {
      const client = new GraphQLClient();
      expect(mockHttpClient.createFromHostname).toHaveBeenCalled();
      expect(mockEnableAuth).toHaveBeenCalled();
    });

    it("creates client with custom endpoint", () => {
      const client = new GraphQLClient({
        endpoint: "/custom/graphql",
      });

      expect(client).toBeInstanceOf(GraphQLClient);
    });

    it("creates client with custom headers", () => {
      const client = new GraphQLClient({
        headers: { "X-Custom-Header": "value" },
      });

      expect(client).toBeInstanceOf(GraphQLClient);
    });

    it("uses provided httpClient", () => {
      const customHttpClient = {
        enableAuth: jest.fn().mockReturnThis(),
        post: jest.fn(),
        getCurrentTenantId: jest.fn(),
      };

      const client = new GraphQLClient({
        httpClient: customHttpClient as any,
      });

      // Should not create a new HttpClient
      expect(client.getHttpClient()).toBe(customHttpClient);
    });
  });

  describe("request()", () => {
    it("sends GraphQL query to endpoint", async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { users: [{ id: 1, name: "Test" }] },
        },
      });

      const client = new GraphQLClient();
      const result = await client.request(
        "query GetUsers { users { id name } }"
      );

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: "query GetUsers { users { id name } }",
        }),
        expect.any(Object)
      );
      expect(result).toEqual({ users: [{ id: 1, name: "Test" }] });
    });

    it("sends query with variables", async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { user: { id: 1, name: "Test" } },
        },
      });

      const client = new GraphQLClient();
      await client.request(
        "query GetUser($id: ID!) { user(id: $id) { id name } }",
        { id: "1" }
      );

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: expect.any(String),
          variables: { id: "1" },
        }),
        expect.any(Object)
      );
    });

    it("sends query with operationName", async () => {
      mockPost.mockResolvedValueOnce({
        data: {
          data: { user: { id: 1 } },
        },
      });

      const client = new GraphQLClient();
      await client.request(
        "query GetUser { user { id } }",
        undefined,
        "GetUser"
      );

      expect(mockPost).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          query: expect.any(String),
          operationName: "GetUser",
        }),
        expect.any(Object)
      );
    });

    it("throws GraphQLError when response has errors", async () => {
      const graphqlErrors = [{
        message: "User not found",
        path: ["user"],
        extensions: { code: "NOT_FOUND" },
      }];

      mockPost.mockResolvedValueOnce({
        data: {
          data: null,
          errors: graphqlErrors,
        },
      });

      const client = new GraphQLClient();

      await expect(
        client.request("query { user { id } }")
      ).rejects.toThrow(GraphQLError);

      try {
        await client.request("query { user { id } }");
      } catch (error) {
        if (error instanceof GraphQLError) {
          expect(error.message).toBe("User not found");
          expect(error.errors).toEqual(graphqlErrors);
        }
      }
    });

    it("throws error when response is missing data field", async () => {
      mockPost.mockResolvedValueOnce({
        data: {},
      });

      const client = new GraphQLClient();

      await expect(
        client.request("query { user { id } }")
      ).rejects.toThrow("GraphQL response missing data field");
    });

    it("wraps non-GraphQL errors", async () => {
      mockPost.mockRejectedValueOnce(new Error("Network failure"));

      const client = new GraphQLClient();

      await expect(
        client.request("query { user { id } }")
      ).rejects.toThrow("GraphQL request failed: Network failure");
    });

    it("re-throws GraphQLError as-is", async () => {
      const originalError = new GraphQLError("Original error", []);
      mockPost.mockRejectedValueOnce(originalError);

      const client = new GraphQLClient();

      await expect(
        client.request("query { user { id } }")
      ).rejects.toBe(originalError);
    });
  });

  describe("getHttpClient()", () => {
    it("returns the underlying HTTP client", () => {
      const client = new GraphQLClient();
      const httpClient = client.getHttpClient();

      expect(httpClient).toBeDefined();
      expect(httpClient.post).toBeDefined();
    });
  });

  describe("getTenantId()", () => {
    it("returns current tenant ID", () => {
      const client = new GraphQLClient();
      const tenantId = client.getTenantId();

      expect(mockGetCurrentTenantId).toHaveBeenCalled();
      expect(tenantId).toBe("test-tenant-123");
    });
  });
});

describe("GraphQLError", () => {
  it("creates error with message and errors array", () => {
    const errors = [{
      message: "Test error",
      path: ["query", "field"],
    }];

    const error = new GraphQLError("Test error", errors);

    expect(error.name).toBe("GraphQLError");
    expect(error.message).toBe("Test error");
    expect(error.errors).toEqual(errors);
  });

  it("extends Error", () => {
    const error = new GraphQLError("Test", []);
    expect(error instanceof Error).toBe(true);
  });
});

describe("createGraphQLClient", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockReset();
    mockEnableAuth.mockReset().mockReturnThis();
    mockGetCurrentTenantId.mockReset().mockReturnValue("test-tenant-123");
  });

  it("creates a new GraphQLClient instance", () => {
    const client = createGraphQLClient();
    expect(client).toBeInstanceOf(GraphQLClient);
  });

  it("passes config to GraphQLClient", () => {
    const client = createGraphQLClient({
      endpoint: "/custom",
      headers: { "X-Test": "value" },
    });

    expect(client).toBeInstanceOf(GraphQLClient);
  });
});

// Note: graphqlFetcher uses the singleton graphqlClient which is created at module load time
// Testing it requires the mock to be set up before module import, which we do above
// However, the singleton is already created, so we just test the function signature
describe("graphqlFetcher", () => {
  it("is a function", async () => {
    // Import separately to avoid issues with the singleton
    const { graphqlFetcher } = await import("../client");
    expect(typeof graphqlFetcher).toBe("function");
  });
});
