/**
 * Tests for useIntegrations hooks
 * Tests integration management functionality with TanStack Query
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import {
  useIntegrations,
  useIntegration,
  useHealthCheck,
  IntegrationResponse,
  IntegrationListResponse,
  IntegrationType,
  IntegrationStatus,
  getStatusColor,
  getStatusIcon,
  getTypeColor,
  getTypeIcon,
  formatLastCheck,
  getProviderDisplayName,
  groupByType,
  calculateHealthStats,
} from "../useIntegrations";
import { apiClient } from "@/lib/api/client";
import { logger } from "@/lib/logger";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock dependencies
jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Mock toast
const mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({ toast: mockToast }),
}));

describe("useIntegrations", () => {
  function createWrapper() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useIntegrations - list integrations", () => {
    it("should fetch all integrations successfully", async () => {
      const mockIntegrations: IntegrationResponse[] = [
        {
          name: "sendgrid",
          type: "email",
          provider: "sendgrid",
          enabled: true,
          status: "ready",
          message: "Connected",
          last_check: "2024-01-01T00:00:00Z",
          settings_count: 5,
          has_secrets: true,
          required_packages: ["sendgrid"],
          metadata: { api_version: "v3" },
        },
        {
          name: "twilio",
          type: "sms",
          provider: "twilio",
          enabled: false,
          status: "disabled",
          message: null,
          last_check: null,
          settings_count: 3,
          has_secrets: false,
          required_packages: ["twilio"],
          metadata: null,
        },
      ];

      const mockResponse: IntegrationListResponse = {
        integrations: mockIntegrations,
        total: 2,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.integrations).toEqual(mockIntegrations);
      expect(result.current.data?.total).toBe(2);
      expect(apiClient.get).toHaveBeenCalledWith("/integrations");
    });

    it("should handle empty integrations list", async () => {
      const mockResponse: IntegrationListResponse = {
        integrations: [],
        total: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.integrations).toEqual([]);
      expect(result.current.data?.total).toBe(0);
    });

    it("should handle fetch error", async () => {
      const error = new Error("Failed to fetch integrations");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: { integrations: [], total: 0 } }), 100))
      );

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });

    it("should refetch on interval", async () => {
      jest.useFakeTimers();

      const mockResponse: IntegrationListResponse = {
        integrations: [],
        total: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(1);
      });

      // Fast forward 60 seconds (refetchInterval is 60000ms)
      jest.advanceTimersByTime(60000);

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(1);
      });

      jest.useRealTimers();
    });

    it("should accept custom query options", async () => {
      const mockResponse: IntegrationListResponse = {
        integrations: [],
        total: 0,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockResponse,
      });

      const { result } = renderHook(
        () => useIntegrations({ enabled: false }),
        {
          wrapper: createWrapper(),
        }
      );

      // Should not fetch when enabled is false
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle all integration types", async () => {
      const integrationTypes: IntegrationType[] = [
        "email",
        "sms",
        "storage",
        "search",
        "analytics",
        "monitoring",
        "secrets",
        "cache",
        "queue",
      ];

      const mockIntegrations: IntegrationResponse[] = integrationTypes.map((type, index) => ({
        name: `integration-${index}`,
        type,
        provider: `provider-${index}`,
        enabled: true,
        status: "ready",
        message: null,
        last_check: null,
        settings_count: 0,
        has_secrets: false,
        required_packages: [],
        metadata: null,
      }));

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { integrations: mockIntegrations, total: mockIntegrations.length },
      });

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.integrations.length).toBe(integrationTypes.length);
      integrationTypes.forEach((type, index) => {
        expect(result.current.data?.integrations[index].type).toBe(type);
      });
    });

    it("should handle all integration statuses", async () => {
      const statuses: IntegrationStatus[] = [
        "disabled",
        "configuring",
        "ready",
        "error",
        "deprecated",
      ];

      const mockIntegrations: IntegrationResponse[] = statuses.map((status, index) => ({
        name: `integration-${index}`,
        type: "email",
        provider: `provider-${index}`,
        enabled: status !== "disabled",
        status,
        message: null,
        last_check: null,
        settings_count: 0,
        has_secrets: false,
        required_packages: [],
        metadata: null,
      }));

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { integrations: mockIntegrations, total: mockIntegrations.length },
      });

      const { result } = renderHook(() => useIntegrations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data?.integrations.length).toBe(statuses.length);
      statuses.forEach((status, index) => {
        expect(result.current.data?.integrations[index].status).toBe(status);
      });
    });
  });

  describe("useIntegration - single integration", () => {
    it("should fetch single integration successfully", async () => {
      const mockIntegration: IntegrationResponse = {
        name: "sendgrid",
        type: "email",
        provider: "sendgrid",
        enabled: true,
        status: "ready",
        message: "Connected",
        last_check: "2024-01-01T00:00:00Z",
        settings_count: 5,
        has_secrets: true,
        required_packages: ["sendgrid"],
        metadata: { api_version: "v3" },
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockIntegration,
      });

      const { result } = renderHook(() => useIntegration("sendgrid"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toEqual(mockIntegration);
      expect(apiClient.get).toHaveBeenCalledWith("/integrations/sendgrid");
    });

    it("should not fetch when name is empty", async () => {
      const { result } = renderHook(() => useIntegration(""), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.data).toBeUndefined();
      expect(apiClient.get).not.toHaveBeenCalled();
    });

    it("should handle fetch error", async () => {
      const error = new Error("Integration not found");
      (apiClient.get as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useIntegration("sendgrid"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.error).toBeTruthy();
      expect(result.current.data).toBeUndefined();
    });

    it("should refetch on interval", async () => {
      jest.useFakeTimers();

      const mockIntegration: IntegrationResponse = {
        name: "sendgrid",
        type: "email",
        provider: "sendgrid",
        enabled: true,
        status: "ready",
        message: null,
        last_check: null,
        settings_count: 0,
        has_secrets: false,
        required_packages: [],
        metadata: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockIntegration,
      });

      renderHook(() => useIntegration("sendgrid"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledTimes(1);
      });

      // Fast forward 30 seconds (refetchInterval is 30000ms)
      jest.advanceTimersByTime(30000);

      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(1);
      });

      jest.useRealTimers();
    });

    it("should accept custom query options", async () => {
      const mockIntegration: IntegrationResponse = {
        name: "sendgrid",
        type: "email",
        provider: "sendgrid",
        enabled: true,
        status: "ready",
        message: null,
        last_check: null,
        settings_count: 0,
        has_secrets: false,
        required_packages: [],
        metadata: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: mockIntegration,
      });

      const { result } = renderHook(
        () => useIntegration("sendgrid", { refetchInterval: false }),
        {
          wrapper: createWrapper(),
        }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.data).toEqual(mockIntegration);
    });

    it("should set loading state correctly", async () => {
      (apiClient.get as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useIntegration("sendgrid"), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => expect(result.current.isLoading).toBe(false), {
        timeout: 200,
      });
    });
  });

  describe("useHealthCheck - mutation", () => {
    it("should trigger health check successfully", async () => {
      const mockIntegration: IntegrationResponse = {
        name: "sendgrid",
        type: "email",
        provider: "sendgrid",
        enabled: true,
        status: "ready",
        message: "Health check passed",
        last_check: "2024-01-01T00:00:00Z",
        settings_count: 5,
        has_secrets: true,
        required_packages: ["sendgrid"],
        metadata: null,
      };

      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockIntegration,
      });

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        const response = await result.current.mutateAsync("sendgrid");
        expect(response).toEqual(mockIntegration);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/integrations/sendgrid/health-check");
      expect(mockToast).toHaveBeenCalledWith({
        title: "Health check complete",
        description: "sendgrid: ready",
      });
    });

    it("should handle health check error", async () => {
      const error = {
        response: {
          data: {
            detail: "Failed to connect to integration",
          },
        },
      };
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("sendgrid");
        } catch (e) {
          // Expected error
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Health check failed",
        description: "Failed to connect to integration",
        variant: "destructive",
      });
    });

    it("should handle health check error without detail", async () => {
      const error = new Error("Network error");
      (apiClient.post as jest.Mock).mockRejectedValue(error);

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createWrapper(),
      });

      await act(async () => {
        try {
          await result.current.mutateAsync("sendgrid");
        } catch (e) {
          // Expected error
        }
      });

      expect(mockToast).toHaveBeenCalledWith({
        title: "Health check failed",
        description: "Failed to check integration health",
        variant: "destructive",
      });
    });

    it("should invalidate queries after successful health check", async () => {
      const mockIntegration: IntegrationResponse = {
        name: "sendgrid",
        type: "email",
        provider: "sendgrid",
        enabled: true,
        status: "ready",
        message: null,
        last_check: null,
        settings_count: 0,
        has_secrets: false,
        required_packages: [],
        metadata: null,
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { integrations: [], total: 0 },
      });
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: mockIntegration,
      });

      // First, set up a query that will be invalidated
      const wrapper = createWrapper();
      const { result: listResult } = renderHook(() => useIntegrations(), { wrapper });
      await waitFor(() => expect(listResult.current.isLoading).toBe(false));

      const initialCallCount = (apiClient.get as jest.Mock).mock.calls.length;

      // Now trigger the health check
      const { result: healthCheckResult } = renderHook(() => useHealthCheck(), { wrapper });

      await act(async () => {
        await healthCheckResult.current.mutateAsync("sendgrid");
      });

      // Wait for invalidation to trigger refetch
      await waitFor(() => {
        expect((apiClient.get as jest.Mock).mock.calls.length).toBeGreaterThan(initialCallCount);
      });
    });

    it("should set loading state correctly during mutation", async () => {
      (apiClient.post as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({ data: {} }), 100))
      );

      const { result } = renderHook(() => useHealthCheck(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate("sendgrid");
      });

      await waitFor(() => expect(result.current.isPending).toBe(true), { timeout: 100 });
      await waitFor(() => expect(result.current.isPending).toBe(false), { timeout: 200 });
    });
  });

  describe("Utility Functions", () => {
    describe("getStatusColor", () => {
      it("should return correct color for each status", () => {
        expect(getStatusColor("disabled")).toBe("text-gray-400 bg-gray-500/15 border-gray-500/30");
        expect(getStatusColor("configuring")).toBe("text-yellow-400 bg-yellow-500/15 border-yellow-500/30");
        expect(getStatusColor("ready")).toBe("text-emerald-400 bg-emerald-500/15 border-emerald-500/30");
        expect(getStatusColor("error")).toBe("text-red-400 bg-red-500/15 border-red-500/30");
        expect(getStatusColor("deprecated")).toBe("text-orange-400 bg-orange-500/15 border-orange-500/30");
      });

      it("should return default color for invalid status", () => {
        expect(getStatusColor("invalid" as IntegrationStatus)).toBe("text-gray-400 bg-gray-500/15 border-gray-500/30");
      });
    });

    describe("getStatusIcon", () => {
      it("should return correct icon for each status", () => {
        expect(getStatusIcon("disabled")).toBe("⊘");
        expect(getStatusIcon("configuring")).toBe("⚙");
        expect(getStatusIcon("ready")).toBe("✓");
        expect(getStatusIcon("error")).toBe("✗");
        expect(getStatusIcon("deprecated")).toBe("⚠");
      });

      it("should return default icon for invalid status", () => {
        expect(getStatusIcon("invalid" as IntegrationStatus)).toBe("⊘");
      });
    });

    describe("getTypeColor", () => {
      it("should return correct color for each type", () => {
        expect(getTypeColor("email")).toBe("text-blue-300 bg-blue-500/15");
        expect(getTypeColor("sms")).toBe("text-purple-300 bg-purple-500/15");
        expect(getTypeColor("storage")).toBe("text-cyan-300 bg-cyan-500/15");
        expect(getTypeColor("search")).toBe("text-green-300 bg-green-500/15");
        expect(getTypeColor("analytics")).toBe("text-orange-300 bg-orange-500/15");
        expect(getTypeColor("monitoring")).toBe("text-red-300 bg-red-500/15");
        expect(getTypeColor("secrets")).toBe("text-yellow-300 bg-yellow-500/15");
        expect(getTypeColor("cache")).toBe("text-pink-300 bg-pink-500/15");
        expect(getTypeColor("queue")).toBe("text-indigo-300 bg-indigo-500/15");
      });

      it("should return default color for invalid type", () => {
        expect(getTypeColor("invalid" as IntegrationType)).toBe("text-blue-300 bg-blue-500/15");
      });
    });

    describe("getTypeIcon", () => {
      it("should return correct icon for each type", () => {
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

      it("should return default icon for invalid type", () => {
        expect(getTypeIcon("invalid" as IntegrationType)).toBe("🔌");
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

      it("should format minutes ago", () => {
        const date = new Date();
        date.setMinutes(date.getMinutes() - 5);
        expect(formatLastCheck(date.toISOString())).toBe("5 minutes ago");
      });

      it("should format single minute ago", () => {
        const date = new Date();
        date.setMinutes(date.getMinutes() - 1);
        expect(formatLastCheck(date.toISOString())).toBe("1 minute ago");
      });

      it("should format hours ago", () => {
        const date = new Date();
        date.setHours(date.getHours() - 3);
        expect(formatLastCheck(date.toISOString())).toBe("3 hours ago");
      });

      it("should format single hour ago", () => {
        const date = new Date();
        date.setHours(date.getHours() - 1);
        expect(formatLastCheck(date.toISOString())).toBe("1 hour ago");
      });

      it("should format days ago", () => {
        const date = new Date();
        date.setDate(date.getDate() - 5);
        expect(formatLastCheck(date.toISOString())).toBe("5 days ago");
      });

      it("should format single day ago", () => {
        const date = new Date();
        date.setDate(date.getDate() - 1);
        expect(formatLastCheck(date.toISOString())).toBe("1 day ago");
      });

      it("should return date string for old timestamps", () => {
        const date = new Date();
        date.setDate(date.getDate() - 45);
        const result = formatLastCheck(date.toISOString());
        expect(result).toBe(date.toLocaleDateString());
      });
    });

    describe("getProviderDisplayName", () => {
      it("should return display name for known providers", () => {
        expect(getProviderDisplayName("sendgrid")).toBe("SendGrid");
        expect(getProviderDisplayName("twilio")).toBe("Twilio");
        expect(getProviderDisplayName("minio")).toBe("MinIO");
        expect(getProviderDisplayName("elasticsearch")).toBe("Elasticsearch");
        expect(getProviderDisplayName("opensearch")).toBe("OpenSearch");
        expect(getProviderDisplayName("redis")).toBe("Redis");
        expect(getProviderDisplayName("celery")).toBe("Celery");
        expect(getProviderDisplayName("vault")).toBe("HashiCorp Vault");
        expect(getProviderDisplayName("openbao")).toBe("OpenBao");
      });

      it("should handle case-insensitive provider names", () => {
        expect(getProviderDisplayName("SENDGRID")).toBe("SendGrid");
        expect(getProviderDisplayName("Twilio")).toBe("Twilio");
      });

      it("should return original provider name for unknown providers", () => {
        expect(getProviderDisplayName("unknown-provider")).toBe("unknown-provider");
        expect(getProviderDisplayName("CustomProvider")).toBe("CustomProvider");
      });
    });

    describe("groupByType", () => {
      it("should group integrations by type", () => {
        const integrations: IntegrationResponse[] = [
          {
            name: "sendgrid",
            type: "email",
            provider: "sendgrid",
            enabled: true,
            status: "ready",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
          {
            name: "gmail",
            type: "email",
            provider: "gmail",
            enabled: true,
            status: "ready",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
          {
            name: "twilio",
            type: "sms",
            provider: "twilio",
            enabled: true,
            status: "ready",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
        ];

        const grouped = groupByType(integrations);

        expect(grouped.email).toHaveLength(2);
        expect(grouped.sms).toHaveLength(1);
        expect(grouped.email[0].name).toBe("sendgrid");
        expect(grouped.email[1].name).toBe("gmail");
        expect(grouped.sms[0].name).toBe("twilio");
      });

      it("should handle empty integration list", () => {
        const grouped = groupByType([]);
        expect(Object.keys(grouped)).toHaveLength(0);
      });

      it("should handle single integration", () => {
        const integrations: IntegrationResponse[] = [
          {
            name: "redis",
            type: "cache",
            provider: "redis",
            enabled: true,
            status: "ready",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
        ];

        const grouped = groupByType(integrations);
        expect(grouped.cache).toHaveLength(1);
        expect(grouped.cache[0].name).toBe("redis");
      });
    });

    describe("calculateHealthStats", () => {
      it("should calculate correct health statistics", () => {
        const integrations: IntegrationResponse[] = [
          {
            name: "integration-1",
            type: "email",
            provider: "provider-1",
            enabled: true,
            status: "ready",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
          {
            name: "integration-2",
            type: "sms",
            provider: "provider-2",
            enabled: true,
            status: "ready",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
          {
            name: "integration-3",
            type: "storage",
            provider: "provider-3",
            enabled: false,
            status: "disabled",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
          {
            name: "integration-4",
            type: "cache",
            provider: "provider-4",
            enabled: true,
            status: "error",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
          {
            name: "integration-5",
            type: "queue",
            provider: "provider-5",
            enabled: true,
            status: "configuring",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
        ];

        const stats = calculateHealthStats(integrations);

        expect(stats.total).toBe(5);
        expect(stats.ready).toBe(2);
        expect(stats.error).toBe(1);
        expect(stats.disabled).toBe(1);
        expect(stats.configuring).toBe(1);
      });

      it("should handle empty integration list", () => {
        const stats = calculateHealthStats([]);

        expect(stats.total).toBe(0);
        expect(stats.ready).toBe(0);
        expect(stats.error).toBe(0);
        expect(stats.disabled).toBe(0);
        expect(stats.configuring).toBe(0);
      });

      it("should handle all integrations with same status", () => {
        const integrations: IntegrationResponse[] = [
          {
            name: "integration-1",
            type: "email",
            provider: "provider-1",
            enabled: true,
            status: "ready",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
          {
            name: "integration-2",
            type: "sms",
            provider: "provider-2",
            enabled: true,
            status: "ready",
            message: null,
            last_check: null,
            settings_count: 0,
            has_secrets: false,
            required_packages: [],
            metadata: null,
          },
        ];

        const stats = calculateHealthStats(integrations);

        expect(stats.total).toBe(2);
        expect(stats.ready).toBe(2);
        expect(stats.error).toBe(0);
        expect(stats.disabled).toBe(0);
        expect(stats.configuring).toBe(0);
      });
    });
  });
});
