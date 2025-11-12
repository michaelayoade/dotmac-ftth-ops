/**
 * ISP Ops App - useHealth tests
 * Runs the shared test suite for health monitoring functionality
 */
import { useHealth } from "../useHealth";
import { runUseHealthSuite } from "../../../../tests/hooks/runUseHealthSuite";

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
runUseHealthSuite(useHealth, apiClient);
