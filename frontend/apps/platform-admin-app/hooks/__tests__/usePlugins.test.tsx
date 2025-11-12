/**
 * Platform Admin App - usePlugins tests
 *
 * Validates query/mutation flows for plugin management APIs plus toast + cache side-effects.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useAvailablePlugins,
  usePluginInstances,
  usePluginSchema,
  usePluginInstance,
  usePluginConfiguration,
  usePluginHealthCheck,
  useCreatePluginInstance,
  useUpdatePluginConfiguration,
  useDeletePluginInstance,
  useTestPluginConnection,
  useBulkHealthCheck,
  useRefreshPlugins,
} from "../usePlugins";
import { apiClient } from "@/lib/api/client";
import { extractDataOrThrow } from "@/lib/api/response-helpers";

jest.unmock("@tanstack/react-query");

const toastMock = jest.fn();

jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock("@/lib/api/response-helpers", () => ({
  extractDataOrThrow: jest.fn((response) => response.data),
}));

const mockedExtractDataOrThrow = extractDataOrThrow as jest.Mock;

describe("Platform Admin usePlugins hooks", () => {
  const createWrapper = () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return { wrapper, queryClient };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    toastMock.mockClear();
  });

  describe("Query hooks", () => {
    it("fetches available plugins", async () => {
      const plugins = [{ name: "webhooks" }];
      (apiClient.get as jest.Mock).mockResolvedValue({ data: plugins });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useAvailablePlugins(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.get).toHaveBeenCalledWith("/plugins");
      expect(mockedExtractDataOrThrow).toHaveBeenCalled();
      expect(result.current.data).toEqual(plugins);
    });

    it("fetches plugin instances", async () => {
      const instances = { plugins: [], total: 0 };
      (apiClient.get as jest.Mock).mockResolvedValue({ data: instances });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => usePluginInstances(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiClient.get).toHaveBeenCalledWith("/plugins/instances");
      expect(result.current.data).toEqual(instances);
    });

    it("fetches schema only when plugin name is provided", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { schema: { name: "webhooks" }, instance_id: null },
      });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => usePluginSchema("webhooks"), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/webhooks/schema");
      expect(result.current.data?.schema.name).toBe("webhooks");

      renderHook(() => usePluginSchema(""), { wrapper });
      expect(apiClient.get).toHaveBeenCalledTimes(1); // no extra call for falsy name
    });

    it("fetches plugin instances, configuration, and health by id", async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: { id: "inst-1" } });

      const { wrapper } = createWrapper();
      const instanceHook = renderHook(() => usePluginInstance("inst-1"), { wrapper });
      await waitFor(() => expect(instanceHook.result.current.isSuccess).toBe(true));
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/instances/inst-1");

      (apiClient.get as jest.Mock).mockResolvedValue({ data: { plugin_instance_id: "inst-1" } });
      const configHook = renderHook(() => usePluginConfiguration("inst-1"), { wrapper });
      await waitFor(() => expect(configHook.result.current.isSuccess).toBe(true));
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/instances/inst-1/configuration");

      (apiClient.get as jest.Mock).mockResolvedValue({ data: { plugin_instance_id: "inst-1" } });
      const healthHook = renderHook(() => usePluginHealthCheck("inst-1"), { wrapper });
      await waitFor(() => expect(healthHook.result.current.isSuccess).toBe(true));
      expect(apiClient.get).toHaveBeenCalledWith("/plugins/instances/inst-1/health");
    });
  });

  describe("Mutations", () => {
    it("creates plugin instances and invalidates cache", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { id: "inst-1", instance_name: "Stripe" },
      });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => useCreatePluginInstance(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          plugin_name: "stripe",
          instance_name: "Stripe",
          configuration: {},
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/plugins/instances", {
        plugin_name: "stripe",
        instance_name: "Stripe",
        configuration: {},
      });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["plugins", "instances"] });
      expect(toastMock).toHaveBeenCalledWith({
        title: "Plugin instance created",
        description: "Stripe was created successfully.",
      });
    });

    it("updates plugin configuration and invalidates dependent queries", async () => {
      (apiClient.put as jest.Mock).mockResolvedValue({ data: { message: "OK" } });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => useUpdatePluginConfiguration(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: "inst-5",
          data: { configuration: { apiKey: "secret" } },
        });
      });

      expect(apiClient.put).toHaveBeenCalledWith(
        "/plugins/instances/inst-5/configuration",
        { configuration: { apiKey: "secret" } },
      );
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["plugins", "instances"] });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["plugins", "instances", "inst-5"],
      });
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["plugins", "instances", "inst-5", "configuration"],
      });
      expect(toastMock).toHaveBeenCalledWith({
        title: "Configuration updated",
        description: "Plugin configuration was updated successfully.",
      });
    });

    it("deletes plugin instances and invalidates list", async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ status: 204 });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => useDeletePluginInstance(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync("inst-8");
      });

      expect(apiClient.delete).toHaveBeenCalledWith("/plugins/instances/inst-8");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["plugins", "instances"] });
      expect(toastMock).toHaveBeenCalledWith({
        title: "Plugin instance deleted",
        description: "Plugin instance was removed successfully.",
      });
    });

    it("tests plugin connections with optional configuration", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: { success: true } });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useTestPluginConnection(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          instanceId: "inst-9",
          configuration: { apiKey: "123" },
        });
      });

      expect(apiClient.post).toHaveBeenCalledWith("/plugins/instances/inst-9/test", {
        configuration: { apiKey: "123" },
      });
    });

    it("runs bulk health checks when requested", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: [] });

      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useBulkHealthCheck(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync(["inst-1", "inst-2"]);
      });

      expect(apiClient.post).toHaveBeenCalledWith("/plugins/instances/health-check", {
        instance_ids: ["inst-1", "inst-2"],
      });
    });

    it("refreshes plugins and invalidates available list", async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({
        data: { message: "Refreshed", available_plugins: 5 },
      });

      const { wrapper, queryClient } = createWrapper();
      const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");
      const { result } = renderHook(() => useRefreshPlugins(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync();
      });

      expect(apiClient.post).toHaveBeenCalledWith("/plugins/refresh");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["plugins", "available"] });
      expect(toastMock).toHaveBeenCalledWith({
        title: "Plugins refreshed",
        description: "Found 5 available plugins.",
      });
    });
  });
});
