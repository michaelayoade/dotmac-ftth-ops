import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DashboardPage from "../app/dashboard/page";
import { useRouter } from "next/navigation";
import { getCurrentUser, logout } from "@/lib/auth";
import { logger } from "@/lib/logger";
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
  useFeatureFlag: jest.fn(),
}));

jest.mock("@/contexts/RBACContext", () => {
  const mockHasPermission = jest.fn();
  return {
    useRBAC: () => ({ hasPermission: mockHasPermission }),
    RBACProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    __mockHasPermission: mockHasPermission,
  };
});

const useFeatureFlagMock = jest.requireMock("@/lib/feature-flags").useFeatureFlag as jest.Mock;
const hasPermissionMock = jest.requireMock("@/contexts/RBACContext")
  .__mockHasPermission as jest.Mock;

type ApiOverrides = Partial<{
  serviceStats: { active_count: number; provisioning_count: number } | undefined;
  serviceInstances: Array<Record<string, unknown>>;
  systemHealth: Record<string, unknown>;
  netboxHealth: Record<string, unknown>;
  netboxSites: Array<Record<string, unknown>>;
}>;

const defaultServiceStats = { active_count: 24, provisioning_count: 6 };
const defaultServiceInstances = [
  {
    id: "svc-1",
    service_name: "FTTH Provisioning",
    service_type: "fiber_service",
    provisioning_status: "running",
    status: "active",
    created_at: "2024-01-01T00:00:00Z",
  },
];
const defaultSubscribers = [
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
const defaultSessions = [
  {
    radacctid: 42,
    tenant_id: "tenant-1",
    subscriber_id: "sub-1",
    username: "alice",
    acctsessionid: "abc",
    nasipaddress: "10.0.0.1",
    framedipaddress: "192.168.0.1",
    framedipv6address: null,
    framedipv6prefix: null,
    delegatedipv6prefix: null,
    acctstarttime: "2024-02-01T11:00:00Z",
    acctsessiontime: 3600,
    acctinputoctets: 512,
    acctoutputoctets: 1024,
  },
];
const defaultSystemHealth = {
  status: "healthy",
  checks: {
    database: { name: "database", status: "healthy", message: "ok", required: true },
    redis: { name: "redis", status: "healthy", message: "ok", required: true },
  },
  timestamp: new Date().toISOString(),
};
const defaultNetboxHealth = { healthy: true, message: "NetBox healthy" };
const defaultNetboxSites = [
  { id: "site-1", name: "Central POP", physical_address: "123 Fiber Way", facility: null },
];

const setupApiMocks = (overrides: ApiOverrides = {}) => {
  const responses: Record<string, unknown> = {
    "/services/lifecycle/statistics": overrides.serviceStats ?? defaultServiceStats,
    "/services/lifecycle/services": overrides.serviceInstances ?? defaultServiceInstances,
    "/health": overrides.systemHealth ?? defaultSystemHealth,
    "/netbox/health": overrides.netboxHealth ?? defaultNetboxHealth,
    "/netbox/dcim/sites": overrides.netboxSites ?? defaultNetboxSites,
  };

  (apiClient.get as jest.Mock).mockImplementation((url: string) => {
    const match = Object.keys(responses).find((key) => url.startsWith(key));
    if (!match) {
      throw new Error(`Unhandled apiClient.get call for URL: ${url}`);
    }
    return Promise.resolve({ data: responses[match] });
  });
};

type FetchOverrides = Partial<{
  subscribers: Array<Record<string, unknown>>;
  sessions: Array<Record<string, unknown>>;
}>;

const setupFetchMocks = (overrides: FetchOverrides = {}) => {
  const subscribers = overrides.subscribers ?? defaultSubscribers;
  const sessions = overrides.sessions ?? defaultSessions;

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
        json: async () => sessions,
      });
    }

    // Default empty response for other fetches
    return Promise.resolve({
      ok: true,
      json: async () => ({}),
    });
  });

  (global.fetch as unknown) = fetchMock;
};

const renderWithProviders = (ui: React.ReactElement, queryClient: QueryClient) => {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
};

type PrimeOverrides = Partial<{
  subscribers: typeof defaultSubscribers;
  sessions: typeof defaultSessions;
  serviceStats: typeof defaultServiceStats;
  serviceInstances: typeof defaultServiceInstances;
  systemHealth: typeof defaultSystemHealth;
  netboxHealth: typeof defaultNetboxHealth;
  netboxSites: typeof defaultNetboxSites;
}>;

const primeDashboardQueries = (queryClient: QueryClient, overrides: PrimeOverrides = {}) => {
  const subscribers = overrides.subscribers ?? defaultSubscribers;
  const sessions = overrides.sessions ?? defaultSessions;
  const serviceStats = overrides.serviceStats ?? defaultServiceStats;
  const serviceInstances = overrides.serviceInstances ?? defaultServiceInstances;
  const systemHealth = overrides.systemHealth ?? defaultSystemHealth;
  const netboxHealth = overrides.netboxHealth ?? defaultNetboxHealth;
  const netboxSites = overrides.netboxSites ?? defaultNetboxSites;

  queryClient.setQueryData(["radius-subscribers", 0, 5], {
    data: subscribers,
    total: subscribers.length,
  });

  queryClient.setQueryData(["radius-sessions"], {
    data: sessions,
    total: sessions.length,
  });

  queryClient.setQueryData(["services", "statistics"], serviceStats);

  queryClient.setQueryData(
    [
      "services",
      "instances",
      { status: "provisioning", serviceType: null, limit: 5, offset: 0 },
    ],
    serviceInstances,
  );

  queryClient.setQueryData(["system", "health"], systemHealth);
  queryClient.setQueryData(["netbox", "health"], netboxHealth);
  queryClient.setQueryData(["netbox", "sites", { limit: 5, offset: 0 }], netboxSites);
};

describe("DashboardPage", () => {
  const mockPush = jest.fn();
  const mockReplace = jest.fn();
  let getItemSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
      replace: mockReplace,
    });

    hasPermissionMock.mockImplementation(() => true);
    useFeatureFlagMock.mockImplementation((flag: string) => ({
      enabled: flag === "radius-sessions" || flag === "radius-subscribers",
    }));

    setupApiMocks();
    setupFetchMocks();

    getItemSpy = jest.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue("token");
  });

  afterEach(() => {
    getItemSpy.mockRestore();
  });

  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

  it("renders loading state while user information is loading", () => {
    (getCurrentUser as jest.Mock).mockImplementation(() => new Promise(() => {}));

    const queryClient = createQueryClient();
    primeDashboardQueries(queryClient);
    renderWithProviders(<DashboardPage />, queryClient);

    expect(screen.getByText("Loading network operations center…")).toBeInTheDocument();
  });

  it("renders network overview once user loads", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: "user-123",
      email: "operator@example.com",
      roles: ["Operator"],
    });

    const queryClient = createQueryClient();
    primeDashboardQueries(queryClient);
    renderWithProviders(<DashboardPage />, queryClient);

    await waitFor(() => {
      expect(screen.getByText("Network Operations Center")).toBeInTheDocument();
    });

    expect(screen.getByText("operator@example.com")).toBeInTheDocument();
    expect(screen.getByText("Subscribers")).toHaveAttribute("href", "/dashboard/subscribers");
    expect(screen.getByText("Active Subscribers")).toBeInTheDocument();
    expect(screen.getByText("Recent subscribers")).toBeInTheDocument();
    expect(screen.getByText("Provisioning pipeline")).toBeInTheDocument();
    expect(screen.getByText("Network inventory")).toBeInTheDocument();
    expect(screen.getByText("Platform health")).toBeInTheDocument();
  });

  it("redirects to login when fetching the current user fails", async () => {
    const error = new Error("Unauthorized");
    (getCurrentUser as jest.Mock).mockRejectedValue(error);

    const queryClient = createQueryClient();
    primeDashboardQueries(queryClient);
    renderWithProviders(<DashboardPage />, queryClient);

    await waitFor(() => {
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch user", error);
      expect(mockReplace).toHaveBeenCalledWith("/login");
    });
  });

  it("logs out and navigates to login when Sign out is clicked", async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue({
      id: "user-123",
      email: "operator@example.com",
      roles: ["Operator"],
    });
    (logout as jest.Mock).mockResolvedValue(undefined);

    const queryClient = createQueryClient();
    primeDashboardQueries(queryClient);
    renderWithProviders(<DashboardPage />, queryClient);

    await waitFor(() => {
      expect(screen.getByText("Sign out")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Sign out"));

    await waitFor(() => {
      expect(logout).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/login");
    });
  });
});
