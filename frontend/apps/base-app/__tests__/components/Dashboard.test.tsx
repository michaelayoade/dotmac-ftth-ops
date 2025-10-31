import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "../../app/dashboard/page";
import { useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { apiClient } from "@/lib/api/client";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/auth", () => ({
  getCurrentUser: jest.fn(),
  logout: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/config", () => {
  const actual = jest.requireActual("@/lib/config");
  return {
    ...actual,
    platformConfig: {
      ...actual.platformConfig,
      features: {
        ...actual.platformConfig.features,
        enableRadius: true,
        enableAutomation: true,
        enableNetwork: true,
      },
    },
  };
});

jest.mock("@/lib/feature-flags", () => ({
  useFeatureFlag: jest.fn(() => ({ enabled: true })),
}));

jest.mock("@/contexts/RBACContext", () => {
  const mockHasPermission = jest.fn();
  return {
    useRBAC: () => ({ hasPermission: mockHasPermission }),
    RBACProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    __mockHasPermission: mockHasPermission,
  };
});

const hasPermissionMock = jest.requireMock("@/contexts/RBACContext")
  .__mockHasPermission as jest.Mock;

const setupApiMocks = (overrides: Record<string, unknown> = {}) => {
  const responses: Record<string, unknown> = {
    "/services/lifecycle/statistics": overrides.serviceStats ?? {
      active_count: 12,
      provisioning_count: 2,
    },
    "/services/lifecycle/services": overrides.serviceInstances ?? [],
    "/health": {
      status: "healthy",
      checks: {},
      timestamp: new Date().toISOString(),
    },
    "/netbox/health": overrides.netboxHealth ?? { healthy: true, message: "Healthy" },
    "/netbox/dcim/sites": overrides.netboxSites ?? [],
  };

  (apiClient.get as jest.Mock).mockImplementation((url: string) => {
    const match = Object.keys(responses).find((key) => url.startsWith(key));
    if (!match) {
      throw new Error(`Unhandled apiClient.get call for URL: ${url}`);
    }
    return Promise.resolve({ data: responses[match] });
  });
};

const setupFetchMocks = (overrides: Record<string, unknown> = {}) => {
  const subscribers =
    overrides.subscribers ??
    [
      {
        id: 1,
        tenant_id: "tenant-1",
        subscriber_id: "sub-1",
        username: "alice",
        enabled: true,
        bandwidth_profile_id: "Premium",
        created_at: "2024-02-01T12:00:00Z",
      },
    ];

  const fetchMock = jest.fn((input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/api/v1/radius/subscribers")) {
      return Promise.resolve({
        ok: true,
        json: async () => subscribers,
      });
    }

    if (url.includes("/api/v1/radius/sessions")) {
      return Promise.resolve({
        ok: true,
        json: async () => [],
      });
    }

    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  });

  (global.fetch as unknown) = fetchMock;
};

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

describe("DashboardPage access states", () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();
  let getItemSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });

    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: "u-1",
      email: "operator@example.com",
      roles: ["Operator"],
    });

    setupApiMocks();
    setupFetchMocks();

    getItemSpy = jest.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue("token");
  });

  afterEach(() => {
    getItemSpy.mockRestore();
  });

  it("shows permission warning when RADIUS access is denied", async () => {
    hasPermissionMock.mockImplementation((permission: string) => permission !== "isp.radius.read");

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Network Operations Center")).toBeInTheDocument();
    });

    expect(
      screen.getByText(/Radius access is disabled for your role/i),
    ).toBeInTheDocument();
  });

  it("falls back to lifecycle placeholder when statistics are unavailable", async () => {
    hasPermissionMock.mockImplementation(() => true);
    setupApiMocks({
      serviceStats: undefined,
    });

    renderWithProviders(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText("Network Operations Center")).toBeInTheDocument();
    });

    expect(screen.getByText("Lifecycle stats unavailable")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});
