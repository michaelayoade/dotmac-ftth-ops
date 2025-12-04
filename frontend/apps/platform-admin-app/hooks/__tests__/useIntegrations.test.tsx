/**
 * Platform Admin App - useIntegrations tests
 *
 * Comprehensive test suite for integrations management hooks
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useIntegrations,
  useIntegration,
  useHealthCheck,
  getStatusColor,
  getStatusIcon,
  getTypeColor,
  getTypeIcon,
  formatLastCheck,
  getProviderDisplayName,
  groupByType,
  calculateHealthStats,
  type IntegrationResponse,
  type IntegrationType,
  type IntegrationStatus,
} from "../useIntegrations";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

// Mock data helpers
const createMockIntegration = (
  overrides: Partial<IntegrationResponse> = {},
): IntegrationResponse => ({
  name: "test-integration",
  type: "email",
  provider: "sendgrid",
  enabled: true,
  status: "ready",
  message: null,
  last_check: new Date().toISOString(),
  settings_count: 5,
  has_secrets: false,
  required_packages: [],
  metadata: null,
  ...overrides,
});

describe("Platform Admin useIntegrations hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useIntegrations - fetch all integrations", () => {
    it("should fetch integrations successfully", async () => {
      const mockIntegrations = [
        createMockIntegration({ name: "sendgrid", type: "email", status: "ready" }),
        createMockIntegration({ name: "twilio", type: "sms", status: "configuring" }),
      ];

      mockedApi.get.mockResolvedValue({
        data: { integrations: mockIntegrations, total: 2 },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegrations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.get).toHaveBeenCalledWith("/integrations");
      expect(result.current.data?.integrations).toHaveLength(2);
      expect(result.current.data?.total).toBe(2);
      expect(result.current.data?.integrations[0].name).toBe("sendgrid");
    });

    it("should handle empty integrations list", async () => {
      mockedApi.get.mockResolvedValue({
        data: { integrations: [], total: 0 },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegrations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.integrations).toHaveLength(0);
      expect(result.current.data?.total).toBe(0);
      expect(result.current.error).toBeNull();
    });

    it("should handle fetch error", async () => {
      mockedApi.get.mockRejectedValue(new Error("Network error"));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegrations(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should filter integrations by status", async () => {
      const integrations = [
        createMockIntegration({ name: "int-1", status: "ready" }),
        createMockIntegration({ name: "int-2", status: "error" }),
        createMockIntegration({ name: "int-3", status: "ready" }),
        createMockIntegration({ name: "int-4", status: "disabled" }),
      ];

      mockedApi.get.mockResolvedValue({
        data: { integrations, total: 4 },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegrations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const readyIntegrations = result.current.data?.integrations.filter(
        (i) => i.status === "ready",
      );
      expect(readyIntegrations).toHaveLength(2);
    });

    it("should set loading state correctly", async () => {
      let resolvePromise: any;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      mockedApi.get.mockReturnValue(promise as any);

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegrations(), { wrapper });

      expect(result.current.isLoading).toBe(true);

      resolvePromise({ data: { integrations: [], total: 0 } });

      await waitFor(() => expect(result.current.isLoading).toBe(false));
    });

    it("should handle multiple integration types", async () => {
      const integrations = [
        createMockIntegration({ name: "sendgrid", type: "email" }),
        createMockIntegration({ name: "twilio", type: "sms" }),
        createMockIntegration({ name: "minio", type: "storage" }),
        createMockIntegration({ name: "elasticsearch", type: "search" }),
        createMockIntegration({ name: "redis", type: "cache" }),
      ];

      mockedApi.get.mockResolvedValue({
        data: { integrations, total: 5 },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegrations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const types = result.current.data?.integrations.map((i) => i.type);
      expect(types).toContain("email");
      expect(types).toContain("sms");
      expect(types).toContain("storage");
      expect(types).toContain("search");
      expect(types).toContain("cache");
    });
  });

  describe("useIntegration - fetch single integration", () => {
    it("should fetch single integration successfully", async () => {
      const integration = createMockIntegration({
        name: "sendgrid",
        type: "email",
        provider: "sendgrid",
        status: "ready",
        settings_count: 10,
        has_secrets: true,
      });

      mockedApi.get.mockResolvedValue({
        data: integration,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegration("sendgrid"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockedApi.get).toHaveBeenCalledWith("/integrations/sendgrid");
      expect(result.current.data?.name).toBe("sendgrid");
      expect(result.current.data?.type).toBe("email");
      expect(result.current.data?.has_secrets).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("should not fetch when name is empty", () => {
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegration(""), { wrapper });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
      expect(mockedApi.get).not.toHaveBeenCalled();
    });

    it("should handle integration not found", async () => {
      mockedApi.get.mockRejectedValue(new Error("Not found"));

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegration("non-existent"), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));

      expect(result.current.error).toBeTruthy();
    });

    it("should handle integration with metadata", async () => {
      const integration = createMockIntegration({
        name: "with-metadata",
        metadata: {
          version: "1.0.0",
          region: "us-west-2",
          custom_field: "value",
        },
      });

      mockedApi.get.mockResolvedValue({
        data: integration,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegration("with-metadata"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(result.current.data?.metadata).toBeDefined();
      expect(result.current.data?.metadata?.version).toBe("1.0.0");
    });
  });

  describe("useHealthCheck - trigger health check", () => {
    it("should trigger health check successfully", async () => {
      const integration = createMockIntegration({
        name: "sendgrid",
        status: "ready",
      });

      mockedApi.post.mockResolvedValue({
        data: integration,
      });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      const { result } = renderHook(() => useHealthCheck(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("sendgrid");
      });

      expect(mockedApi.post).toHaveBeenCalledWith("/integrations/sendgrid/health-check");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["integrations"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["integrations", "sendgrid"],
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Health check complete",
        description: "sendgrid: ready",
      });
    });

    it("should handle health check for disabled integration", async () => {
      const integration = createMockIntegration({
        name: "disabled-integration",
        enabled: false,
        status: "disabled",
      });

      mockedApi.post.mockResolvedValue({
        data: integration,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useHealthCheck(), { wrapper });

      let updatedIntegration: any;
      await act(async () => {
        updatedIntegration = await result.current.mutateAsync("disabled-integration");
      });

      expect(updatedIntegration.status).toBe("disabled");
    });

    it("should handle health check error", async () => {
      mockedApi.post.mockRejectedValue({
        response: { data: { detail: "Integration not found" } },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useHealthCheck(), { wrapper });

      try {
        await act(async () => {
          await result.current.mutateAsync("non-existent");
        });
      } catch (error) {
        // Expected to throw
      }

      expect(mockToast).toHaveBeenCalledWith({
        title: "Health check failed",
        description: "Integration not found",
        variant: "destructive",
      });
    });

    it("should update last_check timestamp", async () => {
      const oldTimestamp = new Date("2024-01-01").toISOString();
      const newTimestamp = new Date().toISOString();

      const integration = createMockIntegration({
        name: "test-integration",
        last_check: newTimestamp,
      });

      mockedApi.post.mockResolvedValue({
        data: integration,
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useHealthCheck(), { wrapper });

      let updatedIntegration: any;
      await act(async () => {
        updatedIntegration = await result.current.mutateAsync("test-integration");
      });

      expect(updatedIntegration.last_check).toBe(newTimestamp);
      expect(updatedIntegration.last_check).not.toBe(oldTimestamp);
    });
  });

  describe("Utility Functions", () => {
    describe("getStatusColor", () => {
      it("should return correct colors for each status", () => {
        expect(getStatusColor("ready")).toContain("emerald");
        expect(getStatusColor("error")).toContain("red");
        expect(getStatusColor("disabled")).toContain("gray");
        expect(getStatusColor("configuring")).toContain("yellow");
        expect(getStatusColor("deprecated")).toContain("orange");
      });

      it("should return default color for unknown status", () => {
        expect(getStatusColor("unknown" as IntegrationStatus)).toContain("gray");
      });
    });

    describe("getStatusIcon", () => {
      it("should return correct icons for each status", () => {
        expect(getStatusIcon("ready")).toBe("✓");
        expect(getStatusIcon("error")).toBe("✗");
        expect(getStatusIcon("disabled")).toBe("⊘");
        expect(getStatusIcon("configuring")).toBe("⚙");
        expect(getStatusIcon("deprecated")).toBe("⚠");
      });

      it("should return default icon for unknown status", () => {
        expect(getStatusIcon("unknown" as IntegrationStatus)).toBe("⊘");
      });
    });

    describe("getTypeColor", () => {
      it("should return correct colors for each type", () => {
        expect(getTypeColor("email")).toContain("blue");
        expect(getTypeColor("sms")).toContain("purple");
        expect(getTypeColor("storage")).toContain("cyan");
        expect(getTypeColor("search")).toContain("green");
        expect(getTypeColor("analytics")).toContain("orange");
        expect(getTypeColor("monitoring")).toContain("red");
        expect(getTypeColor("secrets")).toContain("yellow");
        expect(getTypeColor("cache")).toContain("pink");
        expect(getTypeColor("queue")).toContain("indigo");
      });

      it("should return default color for unknown type", () => {
        expect(getTypeColor("unknown" as IntegrationType)).toContain("blue");
      });
    });

    describe("getTypeIcon", () => {
      it("should return correct icons for each type", () => {
        expect(getTypeIcon("email")).toBe("✉");
        expect(getTypeIcon("sms")).toBe("📱");
        expect(getTypeIcon("storage")).toBe("💾");
        expect(getTypeIcon("search")).toBe("🔍");
        expect(getTypeIcon("analytics")).toBe("📊");
        expect(getTypeIcon("monitoring")).toBe("🔧");
        expect(getTypeIcon("secrets")).toBe("🔐");
        expect(getTypeIcon("cache")).toBe("⚡");
        expect(getTypeIcon("queue")).toBe("📬");
      });

      it("should return default icon for unknown type", () => {
        expect(getTypeIcon("unknown" as IntegrationType)).toBe("🔌");
      });
    });

    describe("formatLastCheck", () => {
      it("should return 'Never' for null timestamp", () => {
        expect(formatLastCheck(null)).toBe("Never");
      });

      it("should return 'Just now' for very recent timestamp", () => {
        const now = new Date().toISOString();
        expect(formatLastCheck(now)).toBe("Just now");
      });

      it("should return minutes ago for recent timestamps", () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        expect(formatLastCheck(fiveMinutesAgo)).toContain("minute");
      });

      it("should return hours ago for timestamps within 24 hours", () => {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        expect(formatLastCheck(twoHoursAgo)).toContain("hour");
      });

      it("should return days ago for timestamps within 30 days", () => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        expect(formatLastCheck(threeDaysAgo)).toContain("day");
      });

      it("should return formatted date for old timestamps", () => {
        const longAgo = new Date("2023-01-01").toISOString();
        const result = formatLastCheck(longAgo);
        expect(result).not.toContain("ago");
        expect(result).toMatch(/\d+\/\d+\/\d+/);
      });
    });

    describe("getProviderDisplayName", () => {
      it("should return display names for known providers", () => {
        expect(getProviderDisplayName("sendgrid")).toBe("SendGrid");
        expect(getProviderDisplayName("twilio")).toBe("Twilio");
        expect(getProviderDisplayName("minio")).toBe("MinIO");
        expect(getProviderDisplayName("elasticsearch")).toBe("Elasticsearch");
        expect(getProviderDisplayName("redis")).toBe("Redis");
      });

      it("should handle case-insensitive provider names", () => {
        expect(getProviderDisplayName("SENDGRID")).toBe("SendGrid");
        expect(getProviderDisplayName("TwiLio")).toBe("Twilio");
      });

      it("should return original name for unknown providers", () => {
        expect(getProviderDisplayName("unknown-provider")).toBe("unknown-provider");
      });
    });

    describe("groupByType", () => {
      it("should group integrations by type", () => {
        const integrations = [
          createMockIntegration({ name: "sendgrid", type: "email" }),
          createMockIntegration({ name: "mailgun", type: "email" }),
          createMockIntegration({ name: "twilio", type: "sms" }),
          createMockIntegration({ name: "minio", type: "storage" }),
        ];

        const grouped = groupByType(integrations);

        expect(grouped.email).toHaveLength(2);
        expect(grouped.sms).toHaveLength(1);
        expect(grouped.storage).toHaveLength(1);
      });

      it("should handle empty array", () => {
        const grouped = groupByType([]);
        expect(Object.keys(grouped)).toHaveLength(0);
      });

      it("should handle single type", () => {
        const integrations = [
          createMockIntegration({ name: "int-1", type: "email" }),
          createMockIntegration({ name: "int-2", type: "email" }),
        ];

        const grouped = groupByType(integrations);

        expect(Object.keys(grouped)).toHaveLength(1);
        expect(grouped.email).toHaveLength(2);
      });
    });

    describe("calculateHealthStats", () => {
      it("should calculate correct statistics", () => {
        const integrations = [
          createMockIntegration({ status: "ready" }),
          createMockIntegration({ status: "ready" }),
          createMockIntegration({ status: "error" }),
          createMockIntegration({ status: "disabled" }),
          createMockIntegration({ status: "configuring" }),
        ];

        const stats = calculateHealthStats(integrations);

        expect(stats.total).toBe(5);
        expect(stats.ready).toBe(2);
        expect(stats.error).toBe(1);
        expect(stats.disabled).toBe(1);
        expect(stats.configuring).toBe(1);
      });

      it("should handle empty array", () => {
        const stats = calculateHealthStats([]);

        expect(stats.total).toBe(0);
        expect(stats.ready).toBe(0);
        expect(stats.error).toBe(0);
        expect(stats.disabled).toBe(0);
        expect(stats.configuring).toBe(0);
      });

      it("should handle all same status", () => {
        const integrations = [
          createMockIntegration({ status: "ready" }),
          createMockIntegration({ status: "ready" }),
          createMockIntegration({ status: "ready" }),
        ];

        const stats = calculateHealthStats(integrations);

        expect(stats.total).toBe(3);
        expect(stats.ready).toBe(3);
        expect(stats.error).toBe(0);
      });
    });
  });

  describe("Real-world scenarios", () => {
    it("should handle integrations with different statuses", async () => {
      const integrations = [
        createMockIntegration({ name: "ready-int", status: "ready" }),
        createMockIntegration({ name: "error-int", status: "error", message: "Connection failed" }),
        createMockIntegration({ name: "configuring-int", status: "configuring" }),
        createMockIntegration({ name: "disabled-int", status: "disabled" }),
      ];

      mockedApi.get.mockResolvedValue({
        data: { integrations, total: 4 },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegrations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const statusCounts = result.current.data?.integrations.reduce(
        (acc, i) => {
          acc[i.status] = (acc[i.status] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      expect(statusCounts?.ready).toBe(1);
      expect(statusCounts?.error).toBe(1);
      expect(statusCounts?.configuring).toBe(1);
      expect(statusCounts?.disabled).toBe(1);
    });

    it("should handle integrations with and without metadata", async () => {
      const integrations = [
        createMockIntegration({
          name: "with-metadata",
          metadata: { version: "1.0.0", region: "us-west-2" },
        }),
        createMockIntegration({
          name: "without-metadata",
          metadata: null,
        }),
      ];

      mockedApi.get.mockResolvedValue({
        data: { integrations, total: 2 },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useIntegrations(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const withMeta = result.current.data?.integrations.find((i) => i.name === "with-metadata");
      const withoutMeta = result.current.data?.integrations.find(
        (i) => i.name === "without-metadata",
      );

      expect(withMeta?.metadata).toBeDefined();
      expect(withMeta?.metadata?.version).toBe("1.0.0");
      expect(withoutMeta?.metadata).toBeNull();
    });

    it("should handle health check and cache invalidation", async () => {
      const listData = {
        integrations: [createMockIntegration({ name: "test-integration" })],
        total: 1,
      };

      const updatedIntegration = createMockIntegration({
        name: "test-integration",
        last_check: new Date().toISOString(),
      });

      mockedApi.get.mockResolvedValue({ data: listData });
      mockedApi.post.mockResolvedValue({ data: updatedIntegration });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

      renderHook(() => useIntegrations(), { wrapper });
      const { result: healthResult } = renderHook(() => useHealthCheck(), { wrapper });

      await act(async () => {
        await healthResult.current.mutateAsync("test-integration");
      });

      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["integrations"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["integrations", "test-integration"],
      });
    });
  });
});
