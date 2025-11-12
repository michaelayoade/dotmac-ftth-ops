/**
 * ISP Ops App - useNotifications tests
 * Runs the shared test suite for notification management functionality
 */
import { useNotifications } from "../useNotifications";
import { runUseNotificationsSuite } from "../../../../tests/hooks/runUseNotificationsSuite";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

// Import mocked apiClient
const { apiClient } = jest.requireMock("@/lib/api/client");

// Run the shared test suite
runUseNotificationsSuite(useNotifications, apiClient);
