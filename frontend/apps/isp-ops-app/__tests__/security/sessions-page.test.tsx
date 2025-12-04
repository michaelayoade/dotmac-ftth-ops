import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SessionsPage from "@/app/dashboard/security-access/sessions/page";

jest.mock("@/components/auth/PermissionGuard", () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockSessions = [
  {
    session_id: "s1",
    user_agent: "Chrome",
    ip_address: "1.1.1.1",
    last_accessed: new Date().toISOString(),
    is_current: true,
  },
  {
    session_id: "s2",
    user_agent: "Safari",
    ip_address: "2.2.2.2",
    last_accessed: new Date().toISOString(),
    is_current: false,
  },
];

const mockGet = jest.fn();
const mockDelete = jest.fn();

jest.mock("@/lib/api/client", () => {
  const actual = jest.requireActual("@/lib/api/client");
  return {
    ...actual,
    apiClient: {
      get: (...args: any[]) => mockGet(...args),
      post: jest.fn(),
      put: jest.fn(),
      delete: (...args: any[]) => mockDelete(...args),
    },
  };
});

describe("SessionsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockResolvedValue({ data: { sessions: mockSessions } });
    mockDelete.mockResolvedValue({ data: {} });
  });

  it("lists sessions", async () => {
    render(<SessionsPage />);
    expect(await screen.findByText("Active Sessions")).toBeInTheDocument();
    expect(screen.getByText("Chrome")).toBeInTheDocument();
    expect(screen.getByText("Safari")).toBeInTheDocument();
  });

  it("revokes a session", async () => {
    const user = userEvent.setup();
    render(<SessionsPage />);

    await waitFor(() => expect(screen.getByText("Safari")).toBeInTheDocument());
    await act(async () => {
      await user.click(screen.getAllByText("Revoke")[0]);
    });

    expect(mockDelete).toHaveBeenCalledWith("/auth/me/sessions/s2");
  });

  it("revokes all sessions", async () => {
    const user = userEvent.setup();
    render(<SessionsPage />);

    await act(async () => {
      await user.click(screen.getByText("Revoke All"));
    });

    expect(mockDelete).toHaveBeenCalledWith("/auth/me/sessions");
  });
});
