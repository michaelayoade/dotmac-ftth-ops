import { setGlobalErrorHandler } from "../hooks/useErrorHandler";

import { type ApiClient, createApiClient } from "./client";

export interface ApiConfig {
  baseUrl: string;
  apiKey?: string;
  tenantId?: string;
  timeout?: number;
  retryAttempts?: number;
  enableErrorLogging?: boolean;
}

export interface ApiEnvironments {
  development: ApiConfig;
  staging: ApiConfig;
  production: ApiConfig;
}

// Default configurations for different environments
export const defaultConfigs: ApiEnvironments = {
  development: {
    baseUrl: "http://localhost:8000",
    timeout: 10000,
    retryAttempts: 2,
    enableErrorLogging: true,
  },
  staging: {
    baseUrl: "https://api-staging.dotmac.com",
    timeout: 15000,
    retryAttempts: 3,
    enableErrorLogging: true,
  },
  production: {
    baseUrl: "https://api.dotmac.com",
    timeout: 10000,
    retryAttempts: 3,
    enableErrorLogging: false,
  },
};

let currentClient: ApiClient | null = null;
let currentConfig: ApiConfig | null = null;

export function initializeApi(config?: Partial<ApiConfig>): ApiClient {
  // Determine environment
  const environment = (process.env["NODE_ENV"] || "development") as keyof ApiEnvironments;
  const baseConfig = defaultConfigs[environment];

  // Override with environment variables
  const envConfig: Partial<ApiConfig> = {};

  if (process.env["NEXT_PUBLIC_API_BASE_URL"]) {
    envConfig.baseUrl = process.env["NEXT_PUBLIC_API_BASE_URL"];
  }
  if (process.env["NEXT_PUBLIC_API_KEY"]) {
    envConfig.apiKey = process.env["NEXT_PUBLIC_API_KEY"];
  }
  if (process.env["NEXT_PUBLIC_TENANT_ID"]) {
    envConfig.tenantId = process.env["NEXT_PUBLIC_TENANT_ID"];
  }

  // Merge configurations
  const finalConfig: ApiConfig = {
    ...baseConfig,
    ...envConfig,
    ...config,
  };

  // Remove undefined values
  Object.keys(finalConfig).forEach((key) => {
    const typedKey = key as keyof ApiConfig;
    if (finalConfig[typedKey] === undefined) {
      delete finalConfig[typedKey];
    }
  });

  // Create API client
  currentClient = createApiClient({
    ...finalConfig,
    onUnauthorized: () => {
      if (currentClient) {
        currentClient.clearAuthToken();
      }

      // Redirect to login if in browser
      if (typeof window !== "undefined") {
        const currentPath = window.location.pathname;
        if (!currentPath.includes("/auth/login")) {
          window.location.href = "/auth/login";
        }
      }
    },
    onError: (_error) => {
      if (finalConfig.enableErrorLogging) {
        // You could integrate with error tracking services here
        // e.g., Sentry, LogRocket, etc.
      }
    },
  });

  currentConfig = finalConfig;

  // Set up global error handler for unhandled API errors
  if (finalConfig.enableErrorLogging) {
    setGlobalErrorHandler((_errorInfo) => {
      // Send to error tracking service
    });
  }

  return currentClient;
}

export function getApiConfig(): ApiConfig | null {
  return currentConfig;
}

export function isApiInitialized(): boolean {
  return currentClient !== null;
}

export function requireApiClient(): ApiClient {
  if (!currentClient) {
    throw new Error("API client not initialized. Call initializeApi() first.");
  }
  return currentClient;
}

// Helper function to check if API is available
export async function checkApiHealth(): Promise<{
  available: boolean;
  latency?: number;
  error?: string;
}> {
  if (!currentClient || !currentConfig) {
    return { available: false, error: "API client not initialized" };
  }

  const startTime = Date.now();

  try {
    // Try a simple health check endpoint
    await fetch(`${currentConfig.baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - startTime;
    return { available: true, latency };
  } catch (error) {
    return {
      available: false,
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Initialize API client automatically if environment variables are present
if (typeof window !== "undefined" && process.env["NEXT_PUBLIC_API_BASE_URL"]) {
  try {
    initializeApi();
  } catch (_error) {
    // Error handling intentionally empty
  }
}
