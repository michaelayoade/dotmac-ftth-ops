/**
 * Shared suite for ISP Ops App useWebhooks hook
 */
import { runUseWebhooksTestSuite } from "../../../../tests/hooks/runUseWebhooksSuite";
import { useWebhooks, useWebhookDeliveries } from "../useWebhooks";

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

const { apiClient } = jest.requireMock("@/lib/api/client");

runUseWebhooksTestSuite({
  label: "ISP Ops App",
  useWebhooks,
  useWebhookDeliveries,
  apiClient,
});
