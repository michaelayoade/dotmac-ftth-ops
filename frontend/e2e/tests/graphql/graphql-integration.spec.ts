/**
 * E2E tests for GraphQL integration
 */

import { test, expect } from "#e2e/fixtures";

test.describe("GraphQL Integration", () => {
  const GRAPHQL_ENDPOINT = "http://localhost:8000/graphql";

  test("GraphQL health check works", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query HealthQuery {
            health {
              status
              version
              timestamp
              services
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data).toBeDefined();
    expect(data.data.health).toBeDefined();
    expect(data.data.health.status).toBe("ok");
    expect(data.data.health.version).toBeDefined();
    expect(Array.isArray(data.data.health.services)).toBeTruthy();
  });

  test("GraphQL introspection works", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query IntrospectionQuery {
            __schema {
              types {
                name
                kind
              }
              queryType {
                name
              }
              mutationType {
                name
              }
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.__schema).toBeDefined();
    expect(data.data.__schema.queryType.name).toBe("Query");
    expect(data.data.__schema.mutationType.name).toBe("Mutation");

    const typeNames = data.data.__schema.types.map((type: any) => type.name);
    expect(typeNames).toContain("User");
    expect(typeNames).toContain("FeatureFlag");
    expect(typeNames).toContain("AuditEvent");
    expect(typeNames).toContain("ServiceInstance");
  });

  test("Authentication required for protected queries", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query CurrentUserQuery {
            currentUser {
              id
              username
              email
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    // Should return null for currentUser when not authenticated
    expect(data.data.currentUser).toBeNull();
  });

  test("GraphQL error handling", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query InvalidQuery {
            nonExistentField {
              id
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeDefined();
    expect(data.errors.length).toBeGreaterThan(0);
    expect(data.errors[0].message).toContain("Cannot query field");
  });

  test("Feature flags query structure", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query FeatureFlagsQuery {
            featureFlags(first: 10) {
              nodes {
                key
                name
                enabled
                strategy
              }
              pageInfo {
                hasNextPage
                totalCount
              }
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.featureFlags).toBeDefined();
    expect(data.data.featureFlags.nodes).toBeDefined();
    expect(data.data.featureFlags.pageInfo).toBeDefined();
    expect(Array.isArray(data.data.featureFlags.nodes)).toBeTruthy();
  });

  test("Audit events query structure", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query AuditEventsQuery {
            auditEvents(first: 5) {
              nodes {
                id
                timestamp
                category
                level
                action
                resource
                actor
              }
              pageInfo {
                hasNextPage
                totalCount
              }
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.auditEvents).toBeDefined();
    expect(data.data.auditEvents.nodes).toBeDefined();
    expect(data.data.auditEvents.pageInfo).toBeDefined();
    expect(Array.isArray(data.data.auditEvents.nodes)).toBeTruthy();
  });

  test("Services query structure", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query ServicesQuery {
            services(first: 10) {
              nodes {
                id
                name
                version
                status
                endpoint
                registeredAt
              }
              pageInfo {
                hasNextPage
                totalCount
              }
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.services).toBeDefined();
    expect(data.data.services.nodes).toBeDefined();
    expect(data.data.services.pageInfo).toBeDefined();
    expect(Array.isArray(data.data.services.nodes)).toBeTruthy();
  });

  test("Metrics query structure", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query MetricsQuery {
            metrics {
              name
              description
              type
              unit
              recentValues {
                timestamp
                value
                labels
              }
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.metrics).toBeDefined();
    expect(Array.isArray(data.data.metrics)).toBeTruthy();
  });

  test("Health checks query structure", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query HealthChecksQuery {
            healthChecks {
              serviceName
              status
              message
              lastCheck
              responseTimeMs
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.healthChecks).toBeDefined();
    expect(Array.isArray(data.data.healthChecks)).toBeTruthy();
  });

  test("Secrets metadata query structure", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query SecretsQuery {
            secrets {
              path
              version
              createdAt
              updatedAt
              tags
              description
            }
          }
        `,
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.secrets).toBeDefined();
    expect(Array.isArray(data.data.secrets)).toBeTruthy();
  });

  test("GraphQL variables handling", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query FeatureFlagsWithVariables($first: Int, $after: String) {
            featureFlags(first: $first, after: $after) {
              nodes {
                key
                name
              }
              pageInfo {
                hasNextPage
              }
            }
          }
        `,
        variables: {
          first: 5,
          after: null,
        },
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.featureFlags).toBeDefined();
  });

  test("GraphQL enum validation", async ({ request }) => {
    const response = await request.post(GRAPHQL_ENDPOINT, {
      data: {
        query: `
          query AuditEventsWithFilter($filter: AuditEventFilter) {
            auditEvents(filter: $filter, first: 5) {
              nodes {
                category
                level
              }
            }
          }
        `,
        variables: {
          filter: {
            category: "AUTHENTICATION",
            level: "INFO",
          },
        },
      },
      headers: {
        "Content-Type": "application/json",
      },
    });

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.errors).toBeUndefined();
    expect(data.data.auditEvents).toBeDefined();
  });

  test("GraphQL concurrent queries", async ({ request }) => {
    const queries = [
      request.post(GRAPHQL_ENDPOINT, {
        data: {
          query: `
            query HealthQuery {
              health {
                status
              }
            }
          `,
        },
      }),
      request.post(GRAPHQL_ENDPOINT, {
        data: {
          query: `
            query FeatureFlagsQuery {
              featureFlags(first: 1) {
                nodes {
                  key
                }
              }
            }
          `,
        },
      }),
      request.post(GRAPHQL_ENDPOINT, {
        data: {
          query: `
            query ServicesQuery {
              services(first: 1) {
                nodes {
                  name
                }
              }
            }
          `,
        },
      }),
    ];

    const responses = await Promise.all(queries);

    for (const response of responses) {
      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.errors).toBeUndefined();
    }
  });
});
