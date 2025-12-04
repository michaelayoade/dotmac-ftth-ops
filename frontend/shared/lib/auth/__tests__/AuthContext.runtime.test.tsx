import React from "react";
import { render, waitFor, screen } from "@testing-library/react";

import { AuthProvider, useAuth } from "../AuthContext";
import { RuntimeConfigProvider } from "../../runtime/RuntimeConfigContext";
import { setRuntimeConfigSnapshot, type RuntimeConfig } from "../../runtime/runtime-config";

const runtimeConfig: RuntimeConfig = {
  version: "1.0.0",
  generatedAt: "2024-01-01T00:00:00.000Z",
  cacheTtlSeconds: 0,
  tenant: {
    id: "tenant-1",
    slug: "tenant-1",
    name: "Tenant One",
  },
  api: {
    baseUrl: "https://api.runtime.test",
    restPath: "/api/v2",
    restUrl: "https://api.runtime.test/api/v2",
    graphqlUrl: "https://api.runtime.test/api/v2/graphql",
    websocketUrl: "https://api.runtime.test/api/v2/realtime/ws",
  },
  realtime: {
    wsUrl: "wss://api.runtime.test/realtime/ws",
    sseUrl: "https://api.runtime.test/api/v2/realtime/events",
    alertsChannel: "tenant-1",
  },
  deployment: {
    mode: "multi_tenant",
    tenantId: "tenant-1",
    platformRoutesEnabled: true,
  },
  license: {
    allowMultiTenant: true,
    enforcePlatformAdmin: true,
  },
  branding: {
    companyName: "DotMac",
    productName: "DotMac Platform",
    productTagline: "Ready to Deploy",
  },
  features: {},
  app: {
    name: "Test App",
    environment: "test",
  },
};

const mockUser = {
  id: "user-1",
  username: "user",
  email: "user@example.com",
  roles: [],
  permissions: [],
  is_active: true,
  is_platform_admin: false,
  tenant_id: "tenant-1",
  mfa_enabled: false,
  activeOrganization: null,
};

function TestConsumer() {
  const { user, isLoading } = useAuth();

  return (
    <>
      <div data-testid="loading">{isLoading ? "loading" : "ready"}</div>
      <div data-testid="user-email">{user?.email ?? "none"}</div>
    </>
  );
}

describe("AuthProvider with runtime config", () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    setRuntimeConfigSnapshot(runtimeConfig);
    fetchMock = jest.fn(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as any;
    });
    global.fetch = fetchMock as any;
  });

  afterEach(() => {
    fetchMock.mockReset();
    (globalThis as any).__DOTMAC_RUNTIME_CONFIG__ = undefined;
    (global as any).fetch = undefined;
  });

  it("bootstraps auth using runtime REST url", async () => {
    render(
      <RuntimeConfigProvider>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </RuntimeConfigProvider>,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      expect(screen.getByTestId("loading").textContent).toBe("ready");
    });

    const [requestedUrl] = fetchMock.mock.calls[0];
    expect(requestedUrl).toBe(`${runtimeConfig.api.restUrl}/auth/me`);
    expect(screen.getByTestId("user-email").textContent).toBe(mockUser.email);
  });
});
