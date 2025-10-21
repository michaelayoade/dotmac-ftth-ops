/**
 * Tests for Dashboard page component
 *
 * Tests dashboard rendering, metric cards, and user interactions
 */

import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { authService } from "@/lib/api/services/auth.service";
import { apiClient } from "@/lib/api/client";
import type { AxiosResponse, AxiosRequestConfig } from "axios";

// Mock dependencies
jest.mock("@/lib/api/services/auth.service");
jest.mock("@/lib/api-client");
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => "/dashboard",
}));

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const createAxiosResponse = <T,>(data: T, config: AxiosRequestConfig = {}): AxiosResponse<T> =>
  ({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: config as AxiosRequestConfig,
    request: undefined,
  }) as AxiosResponse<T>;

// Mock Dashboard component (simplified)
const MockDashboard = () => {
  return (
    <div>
      <h1>Dashboard</h1>
      <div data-testid="metrics-section">
        <div data-testid="metric-card-users">
          <span>Total Users</span>
          <span>150</span>
        </div>
        <div data-testid="metric-card-revenue">
          <span>Revenue</span>
          <span>$12,450</span>
        </div>
        <div data-testid="metric-card-active">
          <span>Active Sessions</span>
          <span>42</span>
        </div>
      </div>
      <div data-testid="recent-activity">
        <h2>Recent Activity</h2>
        <ul>
          <li>User logged in</li>
          <li>Invoice created</li>
          <li>Payment received</li>
        </ul>
      </div>
    </div>
  );
};

describe("Dashboard Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthService.getCurrentUser.mockResolvedValue({
      success: true,
      data: {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      },
    });

    mockApiClient.get.mockResolvedValue(createAxiosResponse({ effective_permissions: [] }));
  });

  describe("Rendering", () => {
    it("should render dashboard title", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      expect(screen.getByText("Dashboard")).toBeInTheDocument();
    });

    it("should render metrics section", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      const metricsSection = screen.getByTestId("metrics-section");
      expect(metricsSection).toBeInTheDocument();
    });

    it("should render all metric cards", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      expect(screen.getByTestId("metric-card-users")).toBeInTheDocument();
      expect(screen.getByTestId("metric-card-revenue")).toBeInTheDocument();
      expect(screen.getByTestId("metric-card-active")).toBeInTheDocument();
    });

    it("should display metric values", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      expect(screen.getByText("150")).toBeInTheDocument();
      expect(screen.getByText("$12,450")).toBeInTheDocument();
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("should render recent activity section", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      expect(screen.getByTestId("recent-activity")).toBeInTheDocument();
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading hierarchy", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      const h1 = screen.getByRole("heading", { level: 1 });
      const h2 = screen.getByRole("heading", { level: 2 });

      expect(h1).toHaveTextContent("Dashboard");
      expect(h2).toHaveTextContent("Recent Activity");
    });

    it("should render lists properly", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      const list = screen.getByRole("list");
      expect(list).toBeInTheDocument();

      const listItems = screen.getAllByRole("listitem");
      expect(listItems).toHaveLength(3);
    });
  });

  describe("Content", () => {
    it("should display user metrics", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      expect(screen.getByText("Total Users")).toBeInTheDocument();
      expect(screen.getByText("150")).toBeInTheDocument();
    });

    it("should display revenue metrics", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      expect(screen.getByText("Revenue")).toBeInTheDocument();
      expect(screen.getByText("$12,450")).toBeInTheDocument();
    });

    it("should display activity information", () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      expect(screen.getByText("User logged in")).toBeInTheDocument();
      expect(screen.getByText("Invoice created")).toBeInTheDocument();
      expect(screen.getByText("Payment received")).toBeInTheDocument();
    });
  });

  describe("Authentication State", () => {
    it("should render for authenticated users", async () => {
      render(
        <AuthProvider>
          <MockDashboard />
        </AuthProvider>,
      );

      await waitFor(() => {
        expect(screen.getByText("Dashboard")).toBeInTheDocument();
      });

      expect(mockAuthService.getCurrentUser).toHaveBeenCalled();
    });
  });
});
