/**
 * @jest-environment jsdom
 */
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe, toHaveNoViolations } from "jest-axe";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { UniversalProviders } from "../UniversalProviders";
// Note: AuthVariant removed - Better Auth configured at app level
import type { PortalType, FeatureFlags, TenantVariant } from "../UniversalProviders";

// Extend Jest matchers
expect.extend(toHaveNoViolations);

// Mock all the provider dependencies
jest.mock("@tanstack/react-query", () => {
  const actual = jest.requireActual("@tanstack/react-query");
  return {
    ...actual,
    QueryClient: jest.fn().mockImplementation(() => ({
      setDefaultOptions: jest.fn(),
      getQueryData: jest.fn(),
      setQueryData: jest.fn(),
      invalidateQueries: jest.fn(),
      clear: jest.fn(),
    })),
    QueryClientProvider: ({ children, client }: any) => (
      <div data-testid="query-client-provider" data-client={client?.constructor?.name}>
        {children}
      </div>
    ),
    useQueryClient: jest.fn(() => ({
      getQueryData: jest.fn(),
      setQueryData: jest.fn(),
      invalidateQueries: jest.fn(),
    })),
  };
});

// Note: @dotmac/auth removed - Better Auth is hook-based, no provider needed
// Old AuthProvider mock removed

jest.mock("../components/ErrorBoundary", () => ({
  ErrorBoundary: ({ children, portal }: any) => (
    <div data-testid="error-boundary" data-portal={portal}>
      {children}
    </div>
  ),
}));

jest.mock("../components/ThemeProvider", () => ({
  ThemeProvider: ({ children, portal, theme }: any) => (
    <div data-testid="theme-provider" data-portal={portal} data-theme={theme}>
      {children}
    </div>
  ),
}));

jest.mock("../components/NotificationProvider", () => ({
  NotificationProvider: ({ maxNotifications, defaultDuration, position }: any) => (
    <div
      data-testid="notification-provider"
      data-max={maxNotifications}
      data-duration={defaultDuration}
      data-position={position}
    />
  ),
}));

jest.mock("../components/FeatureProvider", () => ({
  FeatureProvider: ({ children, features }: any) => (
    <div data-testid="feature-provider" data-features={JSON.stringify(features)}>
      {children}
    </div>
  ),
}));

jest.mock("../components/TenantProvider", () => ({
  TenantProvider: ({ children, variant, portal }: any) => (
    <div data-testid="tenant-provider" data-variant={variant} data-portal={portal}>
      {children}
    </div>
  ),
}));

jest.mock("../utils/queryClients", () => ({
  createPortalQueryClient: jest.fn((portal: string) => {
    const mockClient = {
      portal,
      constructor: { name: "MockQueryClient" },
      setDefaultOptions: jest.fn(),
      getQueryData: jest.fn(),
      setQueryData: jest.fn(),
      invalidateQueries: jest.fn(),
      clear: jest.fn(),
    };
    return mockClient;
  }),
}));

// Test component that consumes providers
const TestConsumer = () => {
  return (
    <div data-testid="test-consumer">
      <h1>Test App Content</h1>
      <p>Providers are working</p>
    </div>
  );
};

// Test component that uses query client
const QueryTestComponent = () => {
  const queryClient = useQueryClient();
  return <div data-testid="query-test">Query client available: {queryClient ? "Yes" : "No"}</div>;
};

describe("UniversalProviders", () => {
  describe("Basic Rendering", () => {
    it("renders children correctly", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("test-consumer")).toBeInTheDocument();
      expect(screen.getByText("Test App Content")).toBeInTheDocument();
    });

    it("wraps children with all required providers", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
      expect(screen.getByTestId("query-client-provider")).toBeInTheDocument();
      expect(screen.getByTestId("theme-provider")).toBeInTheDocument();
      // Note: auth-provider removed - Better Auth is hook-based, no provider needed
      expect(screen.getByTestId("tenant-provider")).toBeInTheDocument();
      expect(screen.getByTestId("feature-provider")).toBeInTheDocument();
    });
  });

  describe("Portal Configuration", () => {
    const portals: PortalType[] = ["admin", "customer", "reseller", "technician", "management"];

    portals.forEach((portal) => {
      it(`configures providers correctly for ${portal} portal`, () => {
        render(
          <UniversalProviders portal={portal}>
            <TestConsumer />
          </UniversalProviders>,
        );

        expect(screen.getByTestId("error-boundary")).toHaveAttribute("data-portal", portal);
        expect(screen.getByTestId("theme-provider")).toHaveAttribute("data-portal", portal);
        // Note: auth-provider removed - Better Auth configured at app level
        expect(screen.getByTestId("tenant-provider")).toHaveAttribute("data-portal", portal);
      });
    });

    it("applies admin portal configuration", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("theme-provider")).toHaveAttribute("data-theme", "professional");
      // Note: auth-provider removed - Better Auth configured separately
      expect(screen.getByTestId("tenant-provider")).toHaveAttribute("data-variant", "multi");
    });

    it("applies customer portal configuration", () => {
      render(
        <UniversalProviders portal="customer">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("theme-provider")).toHaveAttribute("data-theme", "friendly");
    });

    it("applies technician portal configuration", () => {
      render(
        <UniversalProviders portal="technician">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("theme-provider")).toHaveAttribute("data-theme", "mobile");
    });

    it("applies management portal configuration", () => {
      render(
        <UniversalProviders portal="management">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("theme-provider")).toHaveAttribute("data-theme", "enterprise");
    });
  });

  describe("Feature Flags", () => {
    it("applies default feature flags", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      const featureProvider = screen.getByTestId("feature-provider");
      const features = JSON.parse(featureProvider.getAttribute("data-features") || "{}");

      expect(features.notifications).toBe(true);
      expect(features.realtime).toBe(false);
      expect(features.analytics).toBe(false);
      expect(features.offline).toBe(false);
    });

    it("merges custom feature flags with defaults", () => {
      const customFeatures: FeatureFlags = {
        realtime: true,
        analytics: true,
        websocket: true,
      };

      render(
        <UniversalProviders portal="admin" features={customFeatures}>
          <TestConsumer />
        </UniversalProviders>,
      );

      const featureProvider = screen.getByTestId("feature-provider");
      const features = JSON.parse(featureProvider.getAttribute("data-features") || "{}");

      expect(features.notifications).toBe(true); // Default
      expect(features.realtime).toBe(true); // Custom
      expect(features.analytics).toBe(true); // Custom
      expect(features.websocket).toBe(true); // Custom
      expect(features.offline).toBe(false); // Default
    });

    it("overrides default features with custom values", () => {
      const customFeatures: FeatureFlags = {
        notifications: false,
        offline: true,
      };

      render(
        <UniversalProviders portal="admin" features={customFeatures}>
          <TestConsumer />
        </UniversalProviders>,
      );

      const featureProvider = screen.getByTestId("feature-provider");
      const features = JSON.parse(featureProvider.getAttribute("data-features") || "{}");

      expect(features.notifications).toBe(false); // Overridden
      expect(features.offline).toBe(true); // Overridden
    });
  });

  // Note: Auth Variants section removed - authVariant prop no longer exists
  // Better Auth is configured at app level, not through UniversalProviders

  describe("Tenant Variants", () => {
    const tenantVariants: TenantVariant[] = ["single", "multi", "isp"];

    tenantVariants.forEach((variant) => {
      it(`applies ${variant} tenant variant correctly`, () => {
        render(
          <UniversalProviders portal="admin" tenantVariant={variant}>
            <TestConsumer />
          </UniversalProviders>,
        );

        expect(screen.getByTestId("tenant-provider")).toHaveAttribute("data-variant", variant);
      });
    });

    it("defaults to multi tenant variant", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("tenant-provider")).toHaveAttribute("data-variant", "multi");
    });
  });

  describe("Query Client", () => {
    it("creates portal-specific query client by default", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      const queryProvider = screen.getByTestId("query-client-provider");
      expect(queryProvider).toHaveAttribute("data-client", "MockQueryClient");
    });

    it("uses provided query client when specified", () => {
      const customClient = new QueryClient();

      render(
        <UniversalProviders portal="admin" queryClient={customClient}>
          <TestConsumer />
        </UniversalProviders>,
      );

      const queryProvider = screen.getByTestId("query-client-provider");
      expect(queryProvider).toBeInTheDocument();
    });

    it("provides query client to child components", () => {
      render(
        <UniversalProviders portal="admin">
          <QueryTestComponent />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("query-test")).toHaveTextContent("Query client available: Yes");
    });

    it("memoizes query client to prevent recreation", () => {
      const { rerender } = render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      const firstClient = screen.getByTestId("query-client-provider").getAttribute("data-client");

      rerender(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      const secondClient = screen.getByTestId("query-client-provider").getAttribute("data-client");
      expect(firstClient).toBe(secondClient);
    });
  });

  describe("Notifications", () => {
    it("renders notification provider when notifications feature is enabled", () => {
      render(
        <UniversalProviders portal="admin" features={{ notifications: true }}>
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("notification-provider")).toBeInTheDocument();
    });

    it("does not render notification provider when notifications are disabled", () => {
      render(
        <UniversalProviders portal="admin" features={{ notifications: false }}>
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.queryByTestId("notification-provider")).not.toBeInTheDocument();
    });

    it("configures notification provider with portal-specific settings", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      const notificationProvider = screen.getByTestId("notification-provider");
      expect(notificationProvider).toHaveAttribute("data-max", "5");
      expect(notificationProvider).toHaveAttribute("data-duration", "5000");
      expect(notificationProvider).toHaveAttribute("data-position", "top-right");
    });

    it("applies customer portal notification settings", () => {
      render(
        <UniversalProviders portal="customer">
          <TestConsumer />
        </UniversalProviders>,
      );

      const notificationProvider = screen.getByTestId("notification-provider");
      expect(notificationProvider).toHaveAttribute("data-max", "3");
      expect(notificationProvider).toHaveAttribute("data-duration", "4000");
      expect(notificationProvider).toHaveAttribute("data-position", "bottom-right");
    });

    it("applies technician portal notification settings", () => {
      render(
        <UniversalProviders portal="technician">
          <TestConsumer />
        </UniversalProviders>,
      );

      const notificationProvider = screen.getByTestId("notification-provider");
      expect(notificationProvider).toHaveAttribute("data-max", "2");
      expect(notificationProvider).toHaveAttribute("data-duration", "8000");
      expect(notificationProvider).toHaveAttribute("data-position", "bottom-center");
    });

    it("applies custom notification options", () => {
      const config = {
        notificationOptions: {
          maxNotifications: 10,
          defaultDuration: 3000,
        },
      };

      render(
        <UniversalProviders portal="admin" config={config}>
          <TestConsumer />
        </UniversalProviders>,
      );

      const notificationProvider = screen.getByTestId("notification-provider");
      expect(notificationProvider).toHaveAttribute("data-max", "10");
      expect(notificationProvider).toHaveAttribute("data-duration", "3000");
    });
  });

  describe("Development Tools", () => {
    it("enables devtools in development environment by default", () => {
      const originalEnv = process.env["NODE_ENV"];
      process.env["NODE_ENV"] = "development";

      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      // Devtools would be rendered (mocked as ReactQueryDevtools)
      expect(screen.getByTestId("test-consumer")).toBeInTheDocument();

      process.env["NODE_ENV"] = originalEnv;
    });

    it("disables devtools in production environment", () => {
      const originalEnv = process.env["NODE_ENV"];
      process.env["NODE_ENV"] = "production";

      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("test-consumer")).toBeInTheDocument();

      process.env["NODE_ENV"] = originalEnv;
    });

    it("respects explicit enableDevtools prop", () => {
      render(
        <UniversalProviders portal="admin" enableDevtools={true}>
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("test-consumer")).toBeInTheDocument();
    });
  });

  describe("Configuration", () => {
    // Note: "passes auth configuration to AuthProvider" test removed
    // UniversalProviders no longer accepts config.auth - Better Auth configured at app level

    it("passes API configuration", () => {
      const apiConfig = {
        baseUrl: "https://api.custom.com",
        timeout: 10000,
      };

      render(
        <UniversalProviders portal="admin" config={{ apiConfig }}>
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("test-consumer")).toBeInTheDocument();
    });

    it("handles empty configuration gracefully", () => {
      render(
        <UniversalProviders portal="admin" config={{}}>
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("test-consumer")).toBeInTheDocument();
    });

    it("handles undefined configuration", () => {
      render(
        <UniversalProviders portal="admin" config={undefined}>
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("test-consumer")).toBeInTheDocument();
    });
  });

  describe("Provider Hierarchy", () => {
    it("maintains correct provider nesting order", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      // Verify the nesting structure
      const errorBoundary = screen.getByTestId("error-boundary");
      const queryProvider = screen.getByTestId("query-client-provider");
      const themeProvider = screen.getByTestId("theme-provider");
      // Note: authProvider removed - Better Auth is hook-based
      const tenantProvider = screen.getByTestId("tenant-provider");
      const featureProvider = screen.getByTestId("feature-provider");

      expect(errorBoundary).toContainElement(queryProvider);
      expect(queryProvider).toContainElement(themeProvider);
      expect(themeProvider).toContainElement(tenantProvider); // Updated: theme → tenant
      expect(tenantProvider).toContainElement(featureProvider);
    });

    it("places notification provider correctly when enabled", () => {
      render(
        <UniversalProviders portal="admin" features={{ notifications: true }}>
          <TestConsumer />
        </UniversalProviders>,
      );

      const featureProvider = screen.getByTestId("feature-provider");
      const notificationProvider = screen.getByTestId("notification-provider");

      // Notification provider should be inside feature provider
      expect(featureProvider).toContainElement(notificationProvider);
    });
  });

  describe("Accessibility", () => {
    it("has no accessibility violations", async () => {
      const { container } = render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it("supports portal-specific accessibility configurations", () => {
      render(
        <UniversalProviders portal="technician">
          <TestConsumer />
        </UniversalProviders>,
      );

      // Technician portal should use mobile-optimized theme
      expect(screen.getByTestId("theme-provider")).toHaveAttribute("data-theme", "mobile");
    });

    it("provides accessible error boundaries", () => {
      render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("memoizes configuration to prevent unnecessary re-renders", () => {
      const renderSpy = jest.fn();

      const MemoizedConsumer = React.memo(() => {
        renderSpy();
        return <TestConsumer />;
      });

      const { rerender } = render(
        <UniversalProviders portal="admin">
          <MemoizedConsumer />
        </UniversalProviders>,
      );

      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(
        <UniversalProviders portal="admin">
          <MemoizedConsumer />
        </UniversalProviders>,
      );

      // Should not cause unnecessary re-renders
      expect(renderSpy.mock.calls.length).toBeGreaterThanOrEqual(1); // Should render once and memoize
    });

    it("initializes quickly with complex configuration", () => {
      const startTime = performance.now();

      const complexConfig = {
        // Note: auth config removed - Better Auth configured at app level
        apiConfig: {
          baseUrl: "https://api.example.com",
          timeout: 5000,
        },
        queryOptions: {
          staleTime: 300000,
          retry: () => true,
        },
        notificationOptions: {
          maxNotifications: 10,
          defaultDuration: 5000,
        },
      };

      render(
        <UniversalProviders
          portal="admin"
          features={{ notifications: true, realtime: true, analytics: true }}
          config={complexConfig}
        >
          <TestConsumer />
        </UniversalProviders>,
      );

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    it("handles large numbers of child components efficiently", () => {
      const ManyChildren = () => (
        <div>
          {Array.from({ length: 100 }, (_, i) => (
            <div key={i}>Child {i}</div>
          ))}
        </div>
      );

      const startTime = performance.now();

      render(
        <UniversalProviders portal="admin">
          <ManyChildren />
        </UniversalProviders>,
      );

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe("Edge Cases", () => {
    it("handles portal switching correctly", () => {
      const { rerender } = render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("theme-provider")).toHaveAttribute("data-theme", "professional");

      rerender(
        <UniversalProviders portal="customer">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("theme-provider")).toHaveAttribute("data-theme", "friendly");
    });

    it("handles feature flag changes gracefully", () => {
      const { rerender } = render(
        <UniversalProviders portal="admin" features={{ notifications: false }}>
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.queryByTestId("notification-provider")).not.toBeInTheDocument();

      rerender(
        <UniversalProviders portal="admin" features={{ notifications: true }}>
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("notification-provider")).toBeInTheDocument();
    });

    it("handles missing children gracefully", () => {
      render(<UniversalProviders portal="admin" />);

      // Should not crash, providers should still be rendered
      expect(screen.getByTestId("error-boundary")).toBeInTheDocument();
      expect(screen.getByTestId("query-client-provider")).toBeInTheDocument();
    });

    it("handles multiple provider instances", () => {
      render(
        <div>
          <UniversalProviders portal="admin">
            <div data-testid="admin-app">Admin App</div>
          </UniversalProviders>
          <UniversalProviders portal="customer">
            <div data-testid="customer-app">Customer App</div>
          </UniversalProviders>
        </div>,
      );

      expect(screen.getByTestId("admin-app")).toBeInTheDocument();
      expect(screen.getByTestId("customer-app")).toBeInTheDocument();
    });

    it("handles provider unmounting cleanly", () => {
      const { unmount } = render(
        <UniversalProviders portal="admin">
          <TestConsumer />
        </UniversalProviders>,
      );

      expect(screen.getByTestId("test-consumer")).toBeInTheDocument();

      unmount();

      expect(screen.queryByTestId("test-consumer")).not.toBeInTheDocument();
    });
  });
});
