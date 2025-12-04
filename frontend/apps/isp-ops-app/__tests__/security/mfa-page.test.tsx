import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MFAPage from "@/app/dashboard/security-access/mfa/page";

jest.mock("@/components/auth/PermissionGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockPost = jest.fn();

jest.mock("@/lib/api/client", () => {
  const actual = jest.requireActual("@/lib/api/client");
  return {
    ...actual,
    apiClient: {
      get: jest.fn(),
      post: (...args: any[]) => mockPost(...args),
      delete: jest.fn(),
      put: jest.fn(),
    },
  };
});

describe("MFAPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPost.mockImplementation((url: string) => {
      if (url === "/auth/2fa/enable") {
        return Promise.resolve({
          data: {
            secret: "ABC123",
            qr_code: "data:image/png;base64,xxx",
            provisioning_uri: "otpauth://totp/issuer:user",
            backup_codes: ["code1", "code2"],
          },
        });
      }
      if (url === "/auth/2fa/verify") {
        return Promise.resolve({ data: { message: "verified" } });
      }
      if (url === "/auth/2fa/regenerate-backup-codes") {
        return Promise.resolve({ data: { backup_codes: ["code3", "code4"] } });
      }
      if (url === "/auth/2fa/disable") {
        return Promise.resolve({ data: { message: "disabled" } });
      }
      return Promise.resolve({ data: {} });
    });
  });

  it("starts setup and shows secret/QR", async () => {
    const user = userEvent.setup();
    render(<MFAPage />);

    const setupPassword = screen.getByLabelText("Current Password (setup)");
    await act(async () => {
      await user.type(setupPassword, "password");
      await user.click(screen.getByText("Start Setup"));
    });

    expect(await screen.findByText(/Secret:/)).toBeInTheDocument();
    expect(screen.getByAltText("MFA QR code")).toBeInTheDocument();
  });

  it("verifies and enables", async () => {
    const user = userEvent.setup();
    render(<MFAPage />);

    const setupPassword = screen.getByLabelText("Current Password (setup)");
    await act(async () => {
      await user.type(setupPassword, "password");
      await user.click(screen.getByText("Start Setup"));
    });

    await act(async () => {
      await user.type(screen.getByLabelText("Authenticator Code (verify)"), "123456");
      await user.click(screen.getByText("Verify & Enable"));
    });

    expect(mockPost).toHaveBeenCalledWith("/auth/2fa/verify", { token: "123456" });
  });

  it("regenerates backup codes", async () => {
    const user = userEvent.setup();
    render(<MFAPage />);

    const setupPassword = screen.getByLabelText("Current Password (setup)");
    await act(async () => {
      await user.type(setupPassword, "password");
      await user.click(screen.getByText("Start Setup"));
    });

    await act(async () => {
      await user.click(screen.getByText("Regenerate"));
    });

    expect(await screen.findByText("code3")).toBeInTheDocument();
  });

  it("disables MFA", async () => {
    const user = userEvent.setup();
    render(<MFAPage />);

    await act(async () => {
      await user.type(screen.getByLabelText("Current Password (setup)"), "password");
      await user.click(screen.getByText("Start Setup"));
    });

    await act(async () => {
      await user.type(screen.getByLabelText("Current Password (disable)"), "pw");
      await user.type(screen.getByLabelText("Authenticator Code (disable)"), "111111");
      await user.click(screen.getByRole("button", { name: "Disable MFA" }));
    });

    expect(mockPost).toHaveBeenCalledWith("/auth/2fa/disable", { password: "pw", token: "111111" });
  });
});
