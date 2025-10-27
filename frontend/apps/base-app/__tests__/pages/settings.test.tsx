import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import SettingsHubPage from "../../app/dashboard/settings/page";
import { apiClient } from "@/lib/api/client";

jest.mock("@/components/auth/PermissionGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

describe("SettingsHubPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (apiClient.get as jest.Mock).mockResolvedValue({
      data: {
        username: "jdoe",
        email: "jdoe@example.com",
        roles: ["Admin"],
        full_name: "Jane Doe",
      },
    });
  });

  it("renders the settings hub with configuration areas", async () => {
    render(<SettingsHubPage />);

    expect(screen.getByText("Settings")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Configuration Areas")).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Organization")).toBeInTheDocument();
    expect(screen.getByText("Billing Preferences")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("API Tokens")).toBeInTheDocument();
  });

  it("displays user information banner when data is fetched", async () => {
    render(<SettingsHubPage />);

    await waitFor(() => {
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    });

    expect(screen.getByText("jdoe@example.com")).toBeInTheDocument();
    expect(screen.getByText(/Organization: Personal/i)).toBeInTheDocument();
    expect(screen.getByText("Edit Profile")).toHaveAttribute(
      "href",
      "/dashboard/settings/profile",
    );
    expect(screen.getByText("Security Settings")).toHaveAttribute(
      "href",
      "/dashboard/settings/security",
    );
  });

  it("renders quick actions and help links", async () => {
    render(<SettingsHubPage />);

    await waitFor(() => {
      expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    });

    expect(screen.getByText("Change Password")).toHaveAttribute(
      "href",
      "/dashboard/settings/security#change-password",
    );
    expect(screen.getByText("Enable 2FA")).toHaveAttribute(
      "href",
      "/dashboard/settings/security#2fa",
    );
    expect(screen.getByText("Export Data")).toHaveAttribute(
      "href",
      "/dashboard/settings/privacy#export",
    );
    expect(screen.getByText("Documentation")).toHaveAttribute("href", "/docs/settings");
    expect(screen.getByText("Contact Support")).toHaveAttribute("href", "/support");
  });
});
