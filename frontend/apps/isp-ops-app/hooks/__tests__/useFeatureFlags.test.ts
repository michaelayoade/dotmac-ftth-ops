/**
 * ISP Ops App - useFeatureFlags tests
 * Runs the shared test suite for feature flag management functionality
 */
import { useFeatureFlags } from "../useFeatureFlags";
import { runUseFeatureFlagsSuite } from "../../../../tests/hooks/runUseFeatureFlagsSuite";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
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
runUseFeatureFlagsSuite(useFeatureFlags, apiClient);
