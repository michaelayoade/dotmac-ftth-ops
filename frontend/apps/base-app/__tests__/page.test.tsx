import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HomePage from "../app/page";

// Mock fetch globally
global.fetch = jest.fn();

describe("HomePage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    // Mock auth check to never resolve
    (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

    render(<HomePage />);

    // Check for spinner
    expect(screen.getByRole("main")).toHaveClass("min-h-screen flex items-center justify-center");
    const spinner = screen.getByRole("main").querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("renders authenticated state when user is logged in", async () => {
    // Mock successful auth check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "user123", email: "user@example.com" }),
    });

    render(<HomePage />);

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByText("Go to Dashboard")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { level: 1, name: /DotMac Platform/ })).toBeInTheDocument();
    expect(
      screen.getByText("Reusable SaaS backend and APIs to launch faster."),
    ).toBeInTheDocument();

    // Check for authenticated UI - should show dashboard button
    const dashboardButton = screen.getByRole("button", {
      name: "Go to Dashboard",
    });
    expect(dashboardButton).toBeInTheDocument();

    // Should not show sign in/register buttons
    expect(screen.queryByText("Sign In")).not.toBeInTheDocument();
    expect(screen.queryByText("Create Account")).not.toBeInTheDocument();
  });

  it("renders unauthenticated state when user is not logged in", async () => {
    // Mock failed auth check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(<HomePage />);

    // Wait for auth check to complete
    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { level: 1, name: /DotMac Platform/ })).toBeInTheDocument();
    expect(
      screen.getByText("Reusable SaaS backend and APIs to launch faster."),
    ).toBeInTheDocument();

    // Check for unauthenticated UI - should show sign in and register buttons
    const signInButton = screen.getByRole("button", { name: "Sign In" });
    const createAccountButton = screen.getByRole("button", {
      name: "Create Account",
    });
    expect(signInButton).toBeInTheDocument();
    expect(createAccountButton).toBeInTheDocument();

    // Should not show dashboard button
    expect(screen.queryByText("Go to Dashboard")).not.toBeInTheDocument();
  });

  it("handles auth check errors gracefully", async () => {
    // Mock network error
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    render(<HomePage />);

    // Wait for auth check to complete with error
    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    // Should default to unauthenticated state
    expect(screen.getByText("Sign In")).toBeInTheDocument();
    expect(screen.getByText("Create Account")).toBeInTheDocument();
  });

  it("renders main content elements", async () => {
    // Mock auth check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    // Check main headings and content
    expect(screen.getByText("🚀 DotMac Platform")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: /DotMac Platform/ })).toBeInTheDocument();
    expect(
      screen.getByText("Reusable SaaS backend and APIs to launch faster."),
    ).toBeInTheDocument();
    expect(screen.getByText(/Complete reusable backend for authentication/)).toBeInTheDocument();

    // Check test credentials section
    expect(screen.getByText("Quick Start - Test Credentials:")).toBeInTheDocument();
    expect(screen.getByText("newuser / Test123!@#")).toBeInTheDocument();
  });

  it("renders feature cards", async () => {
    // Mock auth check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    // Check feature cards
    expect(screen.getByText("Authentication & Security")).toBeInTheDocument();
    expect(screen.getByText("Business Operations")).toBeInTheDocument();
    expect(screen.getByText("Developer Experience")).toBeInTheDocument();

    // Check feature details
    expect(screen.getByText(/JWT-based authentication/)).toBeInTheDocument();
    expect(screen.getByText(/Role-based access control/)).toBeInTheDocument();
    expect(screen.getByText(/Customer relationship management/)).toBeInTheDocument();
    expect(screen.getByText(/Modern React\/Next.js frontend/)).toBeInTheDocument();
  });

  it("renders API status indicators", async () => {
    // Mock auth check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
    });

    render(<HomePage />);

    await waitFor(() => {
      expect(screen.getByText("Sign In")).toBeInTheDocument();
    });

    // Check status indicators
    expect(screen.getByText(/API:/)).toBeInTheDocument();
    expect(screen.getByText("localhost:8000")).toBeInTheDocument();
    expect(screen.getByText(/Frontend:/)).toBeInTheDocument();
    expect(screen.getByText("localhost:3001")).toBeInTheDocument();
  });

  it("calls auth endpoint with correct parameters", async () => {
    // Mock auth check
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
    });

    render(<HomePage />);

    // Wait for auth check
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/v1/auth/me", {
        credentials: "include",
      });
    });
  });
});
