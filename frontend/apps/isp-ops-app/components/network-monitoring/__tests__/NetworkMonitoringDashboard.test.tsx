/**
 * NetworkMonitoringDashboard Component Tests (App Wrapper)
 *
 * Thin wrapper test - validates prop injection (apiClient and logger)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { NetworkMonitoringDashboard } from "../NetworkMonitoringDashboard";

// Mock the shared component
const mockSharedDashboard = jest.fn(() => <div data-testid="shared-dashboard" />);
jest.mock("@dotmac/features/monitoring", () => ({
  NetworkMonitoringDashboard: (props: any) => mockSharedDashboard(props),
}));

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

jest.mock("@/lib/utils/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const { apiClient: mockApiClient } = jest.requireMock("@/lib/api/client");
const { logger: mockLogger } = jest.requireMock("@/lib/utils/logger");

describe("NetworkMonitoringDashboard (App Wrapper)", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementation
    mockSharedDashboard.mockClear();
  });

  it("renders the shared NetworkMonitoringDashboard component", () => {
    render(<NetworkMonitoringDashboard />);

    expect(screen.getByTestId("shared-dashboard")).toBeInTheDocument();
  });

  it("injects apiClient to shared component", () => {
    render(<NetworkMonitoringDashboard />);

    expect(mockSharedDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        apiClient: mockApiClient,
      }),
    );
  });

  it("injects logger to shared component", () => {
    render(<NetworkMonitoringDashboard />);

    expect(mockSharedDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        logger: mockLogger,
      }),
    );
  });

  it("passes both apiClient and logger to shared component correctly", () => {
    render(<NetworkMonitoringDashboard />);

    expect(mockSharedDashboard).toHaveBeenCalledWith(
      expect.objectContaining({
        apiClient: mockApiClient,
        logger: mockLogger,
      }),
    );
  });
});
