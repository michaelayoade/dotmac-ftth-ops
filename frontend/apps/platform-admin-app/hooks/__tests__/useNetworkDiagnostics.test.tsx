/**
 * Platform Admin App - useNetworkDiagnostics tests
 *
 * Ensures mutations hit the diagnostics API and surface toast notifications.
 */

import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useNetworkDiagnostics } from "../useNetworkDiagnostics";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";
import { logger } from "@/lib/logger";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    post: jest.fn(),
  },
}));

const toastMock = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe("Platform Admin useNetworkDiagnostics hook", () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    toastMock.mockClear();
  });

  it("executes ping mutation and reports success", async () => {
    mockedApi.post.mockResolvedValue({ data: { host: "1.1.1.1", packets_sent: 4, packets_received: 4, packet_loss_percent: 0 } });

    const { result } = renderHook(() => useNetworkDiagnostics(), { wrapper });

    await act(async () => {
      await result.current.pingDevice.mutateAsync({ host: "1.1.1.1" });
    });

    expect(mockedApi.post).toHaveBeenCalledWith("/diagnostics/ping", {
      host: "1.1.1.1",
      count: 4,
    });
    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Ping Completed" }),
    );
  });
});
