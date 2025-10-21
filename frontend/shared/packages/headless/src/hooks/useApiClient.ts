/**
 * API Client Hook
 * Provides access to the configured API client instance
 * Following DRY patterns from existing hooks
 */

import { useMemo } from "react";
import { getApiClient, createApiClient, ApiClient } from "../api/client";
import type { ApiClientConfig } from "../api/types";

// Global client instance
let globalClient: ApiClient | null = null;

export function useApiClient(config?: ApiClientConfig): ApiClient {
  return useMemo(() => {
    try {
      // Try to get existing client first
      return getApiClient();
    } catch {
      // If no client exists, create one with provided or default config
      if (!globalClient) {
        globalClient = createApiClient({
          baseUrl: "/api",
          defaultHeaders: {
            "Content-Type": "application/json",
          },
          timeout: 30000,
          retries: 3,
          rateLimiting: true,
          caching: true,
          csrf: true,
          auth: {
            tokenHeader: "Authorization",
            refreshEndpoint: "/auth/refresh",
            autoRefresh: true,
          },
          onError: (error) => {
            console.error("API Error:", error);
          },
          onUnauthorized: () => {
            // Handle unauthorized access
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
          },
          ...config,
        });
      }

      return globalClient;
    }
  }, [config]);
}
