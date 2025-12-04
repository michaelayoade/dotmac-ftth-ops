import { HttpClient } from "./http-client";

// Main exports
export { HttpClient };
export { TenantResolver } from "./tenant-resolver";
export { ErrorNormalizer } from "./error-normalizer";
export { RetryHandler } from "./retry-handler";
export { AuthInterceptor } from "./auth-interceptor";

// Platform services integration
export {
  PlatformInterceptors,
  createPlatformInterceptors,
  addPlatformInterceptors,
} from "./platform-interceptors";

// Type exports
export type {
  HttpClientConfig,
  RequestConfig,
  ApiResponse,
  ApiError,
  HttpMethod,
  RetryConfig,
  TenantConfig,
} from "./types";

export type { AuthConfig } from "./auth-interceptor";
export type { PlatformInterceptorConfig } from "./platform-interceptors";
export type {
  paths as OpenAPIPaths,
  operations as OpenAPIOperations,
  components as OpenAPIComponents,
} from "./generated-schema";
export {
  createApiQuery,
  useApiQuery,
  useApiMutation,
  createHttpClientForQuery,
} from "./react-query";

// Default instance for convenience
export const httpClient = HttpClient.createFromHostname({
  timeout: 30000,
  retries: 3,
}).enableAuth();

// Utility functions
export const createHttpClient = HttpClient.create;
export const createTenantClient = HttpClient.createWithTenant;
export const createAuthClient = HttpClient.createWithAuth;
