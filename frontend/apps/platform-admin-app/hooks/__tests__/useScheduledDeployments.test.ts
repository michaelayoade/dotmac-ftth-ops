/**
 * Platform Admin App - useScheduledDeployments tests
 * Runs the shared test suite for scheduled deployment management functionality
 */
import {
  useDeploymentTemplates,
  useDeploymentInstances,
  useScheduleDeploymentMutation,
  useScheduledDeployments,
} from "../useScheduledDeployments";
import { runUseScheduledDeploymentsSuite } from "../../../../tests/hooks/runUseScheduledDeploymentsSuite";

jest.unmock("@tanstack/react-query");

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
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
runUseScheduledDeploymentsSuite({
  useDeploymentTemplates,
  useDeploymentInstances,
  useScheduleDeploymentMutation,
  useScheduledDeployments,
  apiClient,
});
