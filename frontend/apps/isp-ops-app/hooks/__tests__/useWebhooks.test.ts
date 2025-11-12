import { useWebhooks, useWebhookDeliveries } from "../useWebhooks";
import {
  MockedApiClient,
  runUseWebhooksTestSuite,
} from "../../../../tests/hooks/runUseWebhooksSuite";

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const { apiClient: mockApiClient } = jest.requireMock("@/lib/api/client") as {
  apiClient: MockedApiClient;
};

runUseWebhooksTestSuite({
  label: "ISP Ops",
  useWebhooks,
  useWebhookDeliveries,
  apiClient: mockApiClient,
});
