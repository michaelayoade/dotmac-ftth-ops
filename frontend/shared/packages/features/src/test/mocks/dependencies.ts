/**
 * Mock factories for Dependency Injection (DI) dependencies
 * These mocks are used for testing components that use the DI pattern
 */

import { vi } from "vitest";

/**
 * Mock API client for billing, network, and other API calls
 */
export const createMockApiClient = () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
});

/**
 * Mock logger for error and debug logging
 */
export const createMockLogger = () => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
});

/**
 * Mock Next.js router
 */
export const createMockRouter = () => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
  pathname: "/",
  query: {},
  asPath: "/",
});

/**
 * Mock toast notification function
 */
export const createMockToast = () =>
  vi.fn((options: { title: string; description: string; variant?: "default" | "destructive" }) => {
    // Can be extended to track toast calls if needed
  });

/**
 * Mock confirmation dialog function
 */
export const createMockConfirmDialog = () =>
  vi.fn(
    (options: {
      title: string;
      description: string;
      confirmText?: string;
      variant?: "destructive" | "default";
    }) => Promise.resolve(true),
  );

/**
 * Mock useToast hook factory
 */
export const createMockUseToast = () => {
  const toast = createMockToast();
  return () => ({ toast });
};

/**
 * Mock useConfirmDialog hook factory
 */
export const createMockUseConfirmDialog = () => {
  const confirmDialog = createMockConfirmDialog();
  return () => confirmDialog;
};

/**
 * Mock query client for React Query
 */
export const createMockQueryClient = () => ({
  invalidateQueries: vi.fn(),
  refetchQueries: vi.fn(),
  getQueryData: vi.fn(),
  setQueryData: vi.fn(),
  removeQueries: vi.fn(),
  clear: vi.fn(),
});

/**
 * Complete set of billing module dependencies
 */
export const createBillingDependencies = () => ({
  apiClient: createMockApiClient(),
  logger: createMockLogger(),
  router: createMockRouter(),
  useToast: createMockUseToast(),
  useConfirmDialog: createMockUseConfirmDialog(),
});

/**
 * Complete set of CRM module dependencies
 */
export const createCRMDependencies = () => ({
  apiClient: createMockApiClient(),
  logger: createMockLogger(),
  router: createMockRouter(),
  useToast: createMockUseToast(),
  useConfirmDialog: createMockUseConfirmDialog(),
});

/**
 * Complete set of network module dependencies
 */
export const createNetworkDependencies = () => ({
  apiClient: createMockApiClient(),
  logger: createMockLogger(),
  router: createMockRouter(),
  useToast: createMockUseToast(),
  useConfirmDialog: createMockUseConfirmDialog(),
});

/**
 * Complete set of RADIUS module dependencies
 */
export const createRadiusDependencies = () => ({
  apiClient: createMockApiClient(),
  logger: createMockLogger(),
  router: createMockRouter(),
  useToast: createMockUseToast(),
  useConfirmDialog: createMockUseConfirmDialog(),
});
