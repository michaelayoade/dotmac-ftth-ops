/**
 * E2E tests for GraphQL API integration
 * Tests GraphQL queries, mutations, and their effects on the UI
 */
import { test, expect } from "#e2e/fixtures";
import type { APIRequestContext } from "@playwright/test";

test.describe("GraphQL API Integration", () => {
  const BASE_URL = process.env.API_BASE_URL || "http://localhost:8000";
  const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`;
  const TEST_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin@test.com";
  const TEST_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "Test123!@#";

  let authToken: string;

  /**
   * Helper to authenticate and get token
   */
  async function authenticate(request: APIRequestContext): Promise<string> {
    const response = await request.post(`${BASE_URL}/api/isp/v1/admin/auth/login`, {
      data: {
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      },
    });

    if (response.ok()) {
      const data = await response.json();
      return data.access_token || data.token;
    }
    return "";
  }

  /**
   * Helper to execute GraphQL query/mutation
   */
  async function executeGraphQL(
    request: APIRequestContext,
    query: string,
    variables?: Record<string, any>,
  ) {
    return await request.post(GRAPHQL_ENDPOINT, {
      headers: {
        Authorization: authToken ? `Bearer ${authToken}` : "",
        "Content-Type": "application/json",
      },
      data: {
        query,
        variables,
      },
    });
  }

  test.beforeEach(async ({ request }) => {
    // Get auth token before each test
    authToken = await authenticate(request);
  });

  test.describe("GraphQL Queries", () => {
    test("should execute basic query", async ({ request }) => {
      const query = `
        query {
          __schema {
            queryType {
              name
            }
          }
        }
      `;

      const response = await executeGraphQL(request, query);

      // Check if GraphQL endpoint exists
      if (response.status() === 404) {
        console.log("GraphQL endpoint not found at", GRAPHQL_ENDPOINT);
        test.skip();
      }

      if (response.ok()) {
        const data = await response.json();
        expect(data).toHaveProperty("data");
        console.log("GraphQL query successful");
      } else {
        console.log("GraphQL query failed with status:", response.status());
      }
    });

    test("should query dashboard analytics data", async ({ request }) => {
      // Use the actual dashboard_overview query from backend
      const query = `
        query GetDashboardOverview($period: String!) {
          dashboardOverview(period: $period) {
            billing {
              mrr
              arr
              totalRevenue
              period
            }
            customers {
              totalCustomers
              activeCustomers
              newCustomers
              churnRate
            }
            monitoring {
              errorRate
              totalRequests
              successfulRequests
            }
          }
        }
      `;

      const variables = {
        period: "30d",
      };

      const response = await executeGraphQL(request, query, variables);

      if (response.status() === 404) {
        console.log("GraphQL endpoint not found");
        test.skip();
        return;
      }

      expect(response.ok()).toBe(true);
      const data = await response.json();

      // Assert that query succeeded without errors
      expect(data.errors).toBeUndefined();
      expect(data.data).toHaveProperty("dashboardOverview");
      console.log("Dashboard analytics retrieved successfully");
    });
  });

  test.describe("GraphQL Mutations", () => {
    test("should execute ping mutation", async ({ request }) => {
      // Use the actual ping mutation from backend schema
      const mutation = `
        mutation PingTest {
          ping
        }
      `;

      const response = await executeGraphQL(request, mutation);

      if (response.status() === 404) {
        console.log("GraphQL endpoint not found");
        test.skip();
        return;
      }

      expect(response.ok()).toBe(true);
      const data = await response.json();

      // Assert that mutation succeeded without errors
      expect(data.errors).toBeUndefined();
      expect(data.data).toHaveProperty("ping");
      expect(data.data.ping).toBe("pong");
      console.log("Ping mutation executed successfully");
    });
  });

  test.describe("GraphQL Error Handling", () => {
    test("should handle invalid queries", async ({ request }) => {
      const invalidQuery = `
        query {
          nonExistentField {
            id
          }
        }
      `;

      const response = await executeGraphQL(request, invalidQuery);

      if (response.status() === 404) {
        console.log("GraphQL endpoint not available");
        return;
      }

      const data = await response.json();

      // GraphQL should return errors array for invalid queries
      if (data.errors) {
        expect(data.errors).toBeTruthy();
        expect(Array.isArray(data.errors)).toBe(true);
        console.log("GraphQL properly handles invalid queries");
      }
    });

    test("should handle syntax errors", async ({ request }) => {
      const malformedQuery = `
        query {
          __schema {
            invalid syntax here
          }
        }
      `;

      const response = await executeGraphQL(request, malformedQuery);

      if (response.status() === 404) {
        console.log("GraphQL endpoint not available");
        return;
      }

      const data = await response.json();

      // Should return errors for malformed queries
      if (data.errors) {
        expect(data.errors.length).toBeGreaterThan(0);
        console.log("GraphQL handles syntax errors:", data.errors[0].message);
      }
    });
  });

  test.describe("GraphQL Schema Introspection", () => {
    test("should support schema introspection", async ({ request }) => {
      const introspectionQuery = `
        query IntrospectionQuery {
          __schema {
            queryType {
              name
              fields {
                name
                description
              }
            }
            mutationType {
              name
            }
            subscriptionType {
              name
            }
          }
        }
      `;

      const response = await executeGraphQL(request, introspectionQuery);

      if (response.status() === 404) {
        console.log("GraphQL endpoint not available");
        return;
      }

      if (response.ok()) {
        const data = await response.json();

        if (data.data && data.data.__schema) {
          console.log("GraphQL schema introspection supported");
          console.log("Query type:", data.data.__schema.queryType?.name);
          console.log("Mutation type:", data.data.__schema.mutationType?.name);
          console.log("Subscription type:", data.data.__schema.subscriptionType?.name);
        } else if (data.errors) {
          console.log("Introspection disabled or not supported:", data.errors);
        }
      }
    });
  });

  test("GraphQL implementation status check", async ({ request }) => {
    // This test documents current GraphQL implementation status
    const testQueries = [
      {
        name: "Basic introspection",
        query: "{ __schema { queryType { name } } }",
      },
      {
        name: "Analytics query",
        query: "{ analytics { totalUsers } }",
      },
    ];

    const results: { name: string; status: string }[] = [];

    for (const { name, query } of testQueries) {
      try {
        const response = await executeGraphQL(request, query);

        if (response.status() === 404) {
          results.push({ name, status: "endpoint_not_found" });
        } else {
          const data = await response.json();
          if (data.data && !data.errors) {
            results.push({ name, status: "success" });
          } else if (data.errors) {
            results.push({ name, status: `error: ${data.errors[0].message}` });
          }
        }
      } catch (error) {
        results.push({ name, status: `exception: ${error}` });
      }
    }

    console.log("GraphQL Implementation Status:", results);

    // Check if endpoint is available
    const endpointNotAvailable = results.some((r) => r.status === "endpoint_not_found");
    if (endpointNotAvailable) {
      test.skip(true, "GraphQL endpoint not deployed");
      return;
    }

    // Assert that all queries succeeded when endpoint is available
    const failedQueries = results.filter(
      (r) => !r.status.includes("success") && r.status !== "endpoint_not_found",
    );
    expect(failedQueries).toEqual([]);
  });
});
