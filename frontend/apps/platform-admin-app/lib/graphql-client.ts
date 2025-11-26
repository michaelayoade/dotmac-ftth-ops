/**
 * GraphQL Client Configuration
 *
 * Provides a configured GraphQL client for making GraphQL requests.
 * Uses a lightweight fetch-based client for better performance and smaller bundle size.
 */

import { platformConfig } from "./config";

/**
 * GraphQL client interface
 */
export interface GraphQLClient {
  request<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T>;
}

/**
 * GraphQL error response
 */
interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: Record<string, unknown>;
}

interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: GraphQLError[];
}

/**
 * Create a lightweight GraphQL client
 */
function resolveGraphqlUrl(): string {
  return platformConfig.api.graphqlEndpoint ?? platformConfig.api.buildUrl("/graphql");
}

function createGraphQLClient(): GraphQLClient {
  return {
    async request<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<T> {
      const graphqlUrl = resolveGraphqlUrl();

      const response = await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Portal-Type": "platformAdmin", // ✅ Identify as platform admin portal
        },
        credentials: "include",
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const json: GraphQLResponse<T> = await response.json();

      const [firstError] = json.errors ?? [];
      if (firstError) {
        throw new Error(firstError.message || "GraphQL request failed");
      }

      if (!json.data) {
        throw new Error("GraphQL response missing data");
      }

      return json.data;
    },
  };
}

/**
 * Global GraphQL client instance
 */
export const graphqlClient = createGraphQLClient();

/**
 * Default export for backwards compatibility
 */
export default graphqlClient;
