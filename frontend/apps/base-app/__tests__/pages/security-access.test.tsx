import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import SecurityAccessPage from "../../app/dashboard/security-access/page";
import { metricsService } from "@/lib/services/metrics-service";
import { apiClient } from "@/lib/api/client";

jest.mock("@/components/alerts/AlertBanner", () => ({
  AlertBanner: () => <div data-testid="alert-banner" />,
}));

jest.mock("@/lib/services/metrics-service", () => ({
  metricsService: {
    getSecurityMetrics: jest.fn(),
  },
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const buildMetrics = () => ({
  compliance: { score: 92, issues: 1 },
  auth: {
    activeSessions: 5,
    failedAttempts: 2,
    passwordResets: 1,
    mfaEnabled: 3,
  },
  apiKeys: { total: 4, expiring: 1 },
  secrets: { total: 6, rotated: 2, expired: 0 },
});

describe("SecurityAccessPage", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    (metricsService.getSecurityMetrics as jest.Mock).mockResolvedValue(buildMetrics());
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: [
        {
          id: "evt-1",
          type: "auth_success",
          description: "User login succeeded",
          user_email: "operator@example.com",
          created_at: "2024-02-01T10:00:00Z",
          severity: "info",
        },
      ],
    });
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders security metrics and headline content", async () => {
    render(<SecurityAccessPage />);

    await waitFor(() => expect(metricsService.getSecurityMetrics).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText("92/100")).toBeInTheDocument());

    expect(screen.getByText("Security & Access")).toBeInTheDocument();
    expect(screen.getByText("Security Score")).toBeInTheDocument();
    expect(screen.getByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getAllByText("API Keys").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Secrets").length).toBeGreaterThan(0);
    expect(screen.getByText("Access Control Summary")).toBeInTheDocument();
  });

  it("displays recent security events from the audit log", async () => {
    render(<SecurityAccessPage />);

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/audit/activities/recent?limit=10");
    });

    expect(screen.getByText("Security Events")).toBeInTheDocument();
    expect(screen.getByText("User login succeeded")).toBeInTheDocument();
    expect(screen.getByText(/User:\s*operator@example.com/)).toBeInTheDocument();
  });

  it("falls back to derived events when audit log fetch fails", async () => {
    (metricsService.getSecurityMetrics as jest.Mock).mockResolvedValue({
      compliance: { score: 60, issues: 3 },
      auth: {
        activeSessions: 2,
        failedAttempts: 7,
        passwordResets: 0,
        mfaEnabled: 1,
      },
      apiKeys: { total: 2, expiring: 2 },
      secrets: { total: 3, rotated: 0, expired: 2 },
    });
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new Error("unavailable"));

    render(<SecurityAccessPage />);

    await waitFor(() => {
      expect(screen.getByText("7 failed login attempts")).toBeInTheDocument();
    });

    expect(screen.getByText("2 API keys expiring soon")).toBeInTheDocument();
    expect(screen.getByText("2 secrets have expired")).toBeInTheDocument();
  });
});
