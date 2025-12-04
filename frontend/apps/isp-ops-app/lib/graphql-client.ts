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
  request<T = any>(query: string, variables?: Record<string, any>): Promise<T>;
}

/**
 * GraphQL error response
 */
interface GraphQLError {
  message: string;
  locations?: Array<{ line: number; column: number }>;
  path?: string[];
  extensions?: Record<string, any>;
}

interface GraphQLResponse<T = any> {
  data?: T;
  errors?: GraphQLError[];
}

/**
 * Create a lightweight GraphQL client
 */
function createGraphQLClient(): GraphQLClient {
  const graphqlUrl = platformConfig.api.graphqlEndpoint ?? platformConfig.api.buildUrl("/graphql");

  return {
    async request<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
      const response = await fetch(graphqlUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Portal-Type": "ispAdmin", // ✅ Identify as ISP admin portal
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
