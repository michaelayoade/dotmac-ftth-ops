/**
 * Apollo Client Configuration
 * GraphQL client setup with authentication and caching
 *
 * IMPORTANT PRODUCTION REQUIREMENTS:
 *
 * 1. CORS Configuration:
 *    - Backend must set: Access-Control-Allow-Credentials: true
 *    - Backend must set specific origin (NOT wildcard *): Access-Control-Allow-Origin: https://yourdomain.com
 *    - Backend must allow credentials in preflight OPTIONS requests
 *
 * 2. Cookie Configuration:
 *    - Set SameSite=None for cross-domain (if frontend/backend on different domains)
 *    - Set SameSite=Lax for same-domain deployments
 *    - Always set Secure=true in production (HTTPS only)
 *    - Use HttpOnly=true to prevent XSS attacks
 *
 * 3. Environment Variables:
 *    - NEXT_PUBLIC_API_URL: Full backend URL for absolute requests (optional)
 *    - If not set, uses relative path /api/isp/v1/admin/graphql (works with Next.js rewrites)
 *
 * 4. Pagination Requirements:
 *    - All paginated queries MUST include consistent args: offset, limit, filters
 *    - Changing filter parameters resets pagination (offset=0)
 *    - See merge functions below for cache key logic
 */

import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from,
  type NormalizedCacheObject,
} from "@apollo/client";
import { setContext } from "@apollo/client/link/context";
import { onError } from "@apollo/client/link/error";
import { logger } from "@/lib/logger";
import "./patchApolloCache";

function resolveGraphQLEndpoint(preferred?: string): string {
  if (preferred) {
    return preferred;
  }

  if (process.env["NEXT_PUBLIC_API_URL"]) {
    return `${process.env["NEXT_PUBLIC_API_URL"]}/api/isp/v1/admin/graphql`;
  }

  return "/api/isp/v1/admin/graphql";
}

// Auth link - cookies are automatically included via credentials: 'include'
// No need to manually set Authorization header since we use HttpOnly cookies
const authLink = setContext((_, { headers }) => {
  // Cookies with JWT are automatically sent via credentials: 'include'
  // This ensures consistent auth across GraphQL and REST endpoints
  return {
    headers: {
      ...headers,
      // No authorization header needed - using HttpOnly cookies
    },
  };
});

const createErrorLink = (getClient: () => ApolloClient<NormalizedCacheObject> | null) =>
  onError(({ graphQLErrors, networkError, operation }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path, extensions }) => {
        logger.error("GraphQL Error", {
          message,
          locations,
          path,
          code: extensions?.["code"],
          operation: operation.operationName,
        });

        if (extensions?.["code"] === "UNAUTHENTICATED") {
          logger.warn("Authentication required for GraphQL query - redirecting to login");

          const client = getClient();
          client
            ?.clearStore()
            .catch((err) => logger.error("Failed to clear Apollo cache on auth error", err));

          if (typeof window !== "undefined") {
            const currentPath = window.location.pathname;
            if (currentPath !== "/login" && !currentPath.startsWith("/api/")) {
              window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
            }
          }
        }
      });
    }

    if (networkError) {
      logger.error("GraphQL Network Error", {
        message: networkError.message,
        operation: operation.operationName,
      });

      if ("statusCode" in networkError && networkError.statusCode === 401) {
        logger.warn("Unauthorized network error - session may have expired");
        if (typeof window !== "undefined" && window.location.pathname !== "/login") {
          window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
      }
    }
  });

function buildCache() {
  return new InMemoryCache({
    typePolicies: {
      Subscriber: {
        keyFields: ["id"],
        fields: {
          sessions: {
            keyArgs: ["filters", "status"],
            merge(existing = [], incoming: any[], { args }) {
              if (args?.["offset"] === 0 || !existing.length) {
                return incoming;
              }
              return [...existing, ...incoming];
            },
          },
        },
      },
      Session: {
        keyFields: ["radacctid"],
      },
      Query: {
        fields: {
          subscribers: {
            keyArgs: ["filters", "status", "search"],
            merge(existing, incoming, { args, variables }) {
              const offset = args?.["offset"] ?? variables?.["offset"] ?? 0;
              const limit = args?.["limit"] ?? variables?.["limit"];

              if (!existing || offset === 0 || !limit) {
                return incoming;
              }

              if (
                incoming?.subscribers &&
                existing?.subscribers &&
                Array.isArray(incoming.subscribers) &&
                Array.isArray(existing.subscribers)
              ) {
                const expectedLength = offset;
                const actualLength = existing.subscribers.length;

                if (Math.abs(expectedLength - actualLength) > limit) {
                  logger.warn("Pagination offset mismatch, resetting cache", {
                    expected: expectedLength,
                    actual: actualLength,
                    offset,
                    limit,
                  });
                  return incoming;
                }

                return {
                  ...incoming,
                  subscribers: [...existing.subscribers, ...incoming.subscribers],
                };
              }

              return incoming;
            },
          },
          sessions: {
            keyArgs: ["filters", "status", "subscriber"],
            merge(existing, incoming, { args, variables }) {
              const offset = args?.["offset"] ?? variables?.["offset"] ?? 0;
              const limit = args?.["limit"] ?? variables?.["limit"];

              if (!existing || offset === 0 || !limit) {
                return incoming;
              }

              if (
                incoming?.sessions &&
                existing?.sessions &&
                Array.isArray(incoming.sessions) &&
                Array.isArray(existing.sessions)
              ) {
                const expectedLength = offset;
                const actualLength = existing.sessions.length;

                if (Math.abs(expectedLength - actualLength) > limit) {
                  logger.warn("Pagination offset mismatch, resetting cache", {
                    expected: expectedLength,
                    actual: actualLength,
                    offset,
                    limit,
                  });
                  return incoming;
                }

                return {
                  ...incoming,
                  sessions: [...existing.sessions, ...incoming.sessions],
                };
              }

              return incoming;
            },
          },
        },
      },
    },
  });
}

export function createApolloClient(
  preferredEndpoint?: string,
): ApolloClient<NormalizedCacheObject> {
  const cache = buildCache();
  let client: ApolloClient<NormalizedCacheObject> | null = null;

  const errorLink = createErrorLink(() => client);
  const httpLink = createHttpLink({
    uri: resolveGraphQLEndpoint(preferredEndpoint),
    credentials: "include",
  });

  const link = from([errorLink, authLink.concat(httpLink)]);

  client = new ApolloClient({
    link,
    cache,
    defaultOptions: {
      watchQuery: {
        fetchPolicy: "cache-and-network",
        errorPolicy: "all",
      },
      query: {
        fetchPolicy: "cache-first",
        errorPolicy: "all",
      },
      mutate: {
        errorPolicy: "all",
      },
    },
    devtools: {
      enabled: process.env.NODE_ENV === "development",
    },
  });

  return client;
}

export async function clearApolloCache(client: ApolloClient<NormalizedCacheObject>): Promise<void> {
  await client.clearStore();
}
