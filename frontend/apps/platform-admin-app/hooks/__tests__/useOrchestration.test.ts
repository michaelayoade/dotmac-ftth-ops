/**
 * Platform Admin App - useOrchestrationStats tests
 * Runs the shared test suite for orchestration workflow statistics
 */
import { useOrchestrationStats } from "../useOrchestration";
import { runUseOrchestrationStatsSuite } from "../../../../tests/hooks/runUseOrchestrationStatsSuite";

jest.unmock("@tanstack/react-query");

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

// Import mocked apiClient
const { apiClient } = jest.requireMock("@/lib/api/client");

// Run the shared test suite
runUseOrchestrationStatsSuite(useOrchestrationStats, apiClient);
