import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AuthMetricsPage from "@/app/dashboard/security-access/auth-metrics/page";

jest.mock("@/components/auth/PermissionGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockGet = jest.fn();

jest.mock("@/lib/api/client", () => {
  const actual = jest.requireActual("@/lib/api/client");
  return {
    ...actual,
    apiClient: {
      get: (...args: any[]) => mockGet(...args),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    },
  };
});

describe("AuthMetricsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockImplementation((url: string) => {
      if (url === "/auth/metrics") {
        return Promise.resolve({ data: { failedAttempts: 2, successfulLogins: 5 } });
      }
      if (url === "/auth/api-keys/metrics") {
        return Promise.resolve({ data: { total_keys: 3 } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("renders auth metrics and API key metrics", async () => {
    render(<AuthMetricsPage />);
    await waitFor(() => expect(mockGet).toHaveBeenCalledWith("/auth/metrics"));
    expect(await screen.findByText("failedAttempts")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(await screen.findByText("total_keys")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
