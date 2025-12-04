import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ApiKeysPage from "@/app/dashboard/security-access/api-keys/page";

jest.mock("@/components/auth/PermissionGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockApiKeys = [
  { id: "key-1", name: "Primary", created_at: new Date().toISOString(), disabled: false },
  { id: "key-2", name: "Automation", created_at: new Date().toISOString(), disabled: true },
];

const mockRevoke = jest.fn();

jest.mock("@/hooks/useApiKeys", () => ({
  useApiKeys: () => ({
    apiKeys: mockApiKeys,
    loading: false,
    error: null,
    revokeApiKey: mockRevoke,
  }),
}));

jest.mock("@/components/api-keys/CreateApiKeyModal", () => ({
  CreateApiKeyModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="create-modal" /> : null,
}));

jest.mock("@/components/api-keys/ApiKeyDetailModal", () => ({
  ApiKeyDetailModal: ({ apiKey }: any) =>
    apiKey ? <div data-testid="detail-modal">{apiKey.name}</div> : null,
}));

jest.mock("@/components/api-keys/RevokeConfirmModal", () => ({
  RevokeConfirmModal: ({ apiKey, onConfirm }: any) =>
    apiKey ? (
      <div data-testid="revoke-modal">
        <button onClick={onConfirm}>Confirm Revoke</button>
      </div>
    ) : null,
}));

describe("ApiKeysPage (ISP Ops)", () => {
  it("lists API keys and filters by search", async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);

    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("Automation")).toBeInTheDocument();

    await act(async () => {
      await user.type(screen.getByPlaceholderText("Search keys..."), "Primary");
    });
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("opens create modal", async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);
    await act(async () => {
      await user.click(screen.getByText("New API Key"));
    });
    expect(await screen.findByTestId("create-modal")).toBeInTheDocument();
  });

  it("shows detail modal", async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);
    await act(async () => {
      await user.click(screen.getAllByText("View")[0]);
    });
    expect(await screen.findByTestId("detail-modal")).toBeInTheDocument();
  });

  it("revokes an API key", async () => {
    const user = userEvent.setup();
    render(<ApiKeysPage />);
    await act(async () => {
      await user.click(screen.getAllByText("Revoke")[0]);
    });
    await act(async () => {
      await user.click(await screen.findByText("Confirm Revoke"));
    });
    await waitFor(() => expect(mockRevoke).toHaveBeenCalledWith("key-1"));
  });
});
