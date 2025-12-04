/**
 * ISP Ops App - useApiKeys tests
 * Runs the shared test suite for API key management functionality
 */
import { useApiKeys } from "../useApiKeys";
import { runUseApiKeysSuite } from "../../../../tests/hooks/runUseApiKeysSuite";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Import mocked apiClient
const { apiClient } = jest.requireMock("@/lib/api/client");

// Run the shared test suite
runUseApiKeysSuite(useApiKeys, apiClient);
