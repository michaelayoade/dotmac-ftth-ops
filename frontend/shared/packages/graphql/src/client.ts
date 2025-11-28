/**
 * GraphQL Client for TanStack Query
 *
 * Builds on @dotmac/http-client to provide:
 * - Automatic tenant ID injection via X-Tenant-ID header
 * - Auth token management with refresh handling
 * - Standardized error normalization
 * - Retry logic for transient failures
 */

import { HttpClient } from "@dotmac/http-client";

export interface GraphQLRequest {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, any>;
  }>;
}

export interface GraphQLClientConfig {
  /**
   * GraphQL endpoint URL
   * Defaults to /api/platform/v1/admin/graphql (matching backend endpoint)
   * Supports NEXT_PUBLIC_API_BASE_URL env var for absolute URLs (works in SSR/build/browser)
   */
  endpoint?: string;

  /**
   * Custom headers to include in all requests
   */
  headers?: Record<string, string>;

  /**
   * Underlying HTTP client instance
   * If not provided, creates a default instance with auth and tenant resolution
   */
  httpClient?: InstanceType<typeof HttpClient>;
}

/**
 * GraphQL client that uses the shared HTTP client infrastructure
 */
export class GraphQLClient {
  private endpoint: string;
  private headers: Record<string, string>;
  private httpClient: InstanceType<typeof HttpClient>;

  constructor(config: GraphQLClientConfig = {}) {
    // Default to /api/platform/v1/admin/graphql (matching backend route)
    // Support NEXT_PUBLIC_API_BASE_URL for absolute URLs (e.g., cross-domain)
    this.endpoint = config.endpoint || this.getDefaultEndpoint();
    this.headers = config.headers || {};

    // Use provided client or create default with auth + tenant resolution
    this.httpClient =
      config.httpClient ||
      HttpClient.createFromHostname({
        timeout: 30000,
        retries: 3,
      }).enableAuth();
  }

  /**
   * Get default GraphQL endpoint
   * Matches Apollo client configuration for consistency
   * Works in both browser and server (SSR/build) contexts
   */
  private getDefaultEndpoint(): string {
    // Check for NEXT_PUBLIC_API_BASE_URL in both browser and server contexts
    // Next.js inlines NEXT_PUBLIC_* vars at build time for browser bundles
    // Server-side code has direct access to process.env
    const apiUrl =
      typeof process !== "undefined" ? process.env["NEXT_PUBLIC_API_BASE_URL"] : undefined;

    if (apiUrl) {
      return `${apiUrl}/api/platform/v1/admin/graphql`;
    }

    // Default to relative path (works with Next.js rewrites)
    return "/api/platform/v1/admin/graphql";
  }

  /**
   * Execute a GraphQL request
   */
  async request<TData = any, TVariables = Record<string, any>>(
    query: string,
    variables?: TVariables,
    operationName?: string,
  ): Promise<TData> {
    const body: GraphQLRequest = {
      query,
      ...(variables && { variables }),
      ...(operationName && { operationName }),
    };

    try {
      const response = await this.httpClient.post(this.endpoint, body, {
        headers: this.headers,
      });

      // Check for GraphQL errors
      if (response.data.errors && response.data.errors.length > 0) {
        const error = response.data.errors[0];
        throw new GraphQLError(error.message, response.data.errors);
      }

      if (!response.data.data) {
        throw new Error("GraphQL response missing data field");
      }

      return response.data.data;
    } catch (error: any) {
      // Re-throw GraphQL errors as-is
      if (error instanceof GraphQLError) {
        throw error;
      }

      // Wrap other errors
      throw new Error(`GraphQL request failed: ${error.message}`);
    }
  }

  /**
   * Get the underlying HTTP client (for advanced usage)
   */
  getHttpClient(): InstanceType<typeof HttpClient> {
    return this.httpClient;
  }

  /**
   * Get current tenant ID
   */
  getTenantId(): string | null {
    return this.httpClient.getCurrentTenantId();
  }
}

/**
 * GraphQL-specific error class
 */
export class GraphQLError extends Error {
  constructor(
    message: string,
    public errors: GraphQLResponse["errors"],
  ) {
    super(message);
    this.name = "GraphQLError";
  }
}

/**
 * Default GraphQL client instance
 * Configured with auth and tenant resolution
 */
export const graphqlClient = new GraphQLClient();

/**
 * Factory function for creating custom GraphQL clients
 */
export function createGraphQLClient(config?: GraphQLClientConfig): GraphQLClient {
  return new GraphQLClient(config);
}

/**
 * Fetcher function for TanStack Query / GraphQL Code Generator
 * This is the signature expected by @graphql-codegen/typescript-react-query
 */
export function graphqlFetcher<TData, TVariables>(
  query: string,
  variables?: TVariables,
  headers?: RequestInit["headers"],
): () => Promise<TData> {
  return () => {
    return graphqlClient.request<TData, TVariables>(query, variables);
  };
}
