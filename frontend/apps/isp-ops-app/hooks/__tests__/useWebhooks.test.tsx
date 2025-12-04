/**
 * ISP Ops App - useWebhooks tests
 * Runs the shared test suite for webhook management functionality
 */
import { useWebhooks, useWebhookDeliveries } from "../useWebhooks";
import { runUseWebhooksTestSuite } from "../../../../tests/hooks/runUseWebhooksSuite";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
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
runUseWebhooksTestSuite({
  label: "ISP Ops App",
  useWebhooks,
  useWebhookDeliveries,
  apiClient,
});
