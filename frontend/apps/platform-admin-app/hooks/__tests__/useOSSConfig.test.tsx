/**
 * Platform Admin App - useOSSConfig tests
 *
 * Covers configuration queries, mutations, and helper utilities.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useOSSConfiguration,
  useAllOSSConfigurations,
  useUpdateOSSConfiguration,
  useResetOSSConfiguration,
  useTestOSSConnection,
  useBatchUpdateOSSConfiguration,
  useOSSConfigStatus,
  useOSSConfigStatistics,
  ossConfigKeys,
} from "../useOSSConfig";
import { ossConfigService } from "@/lib/services/oss-config-service";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/services/oss-config-service", () => {
  const service = {
    getConfiguration: jest.fn(),
    getAllConfigurations: jest.fn(),
    updateConfiguration: jest.fn(),
    resetConfiguration: jest.fn(),
    testConnection: jest.fn(),
    hasOverrides: jest.fn(),
    getOverriddenFields: jest.fn(),
    validateUpdate: jest.fn(),
  };
  return { ossConfigService: service };
});

const mockedService = ossConfigService as jest.Mocked<typeof ossConfigService>;

describe("Platform Admin useOSSConfig hooks", () => {
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

  it("fetches single and all OSS configurations", async () => {
    mockedService.getConfiguration.mockResolvedValue({
      service: "voltha",
      config: { url: "https://voltha", verify_ssl: true, timeout_seconds: 30, max_retries: 3 },
      overrides: { url: "https://tenant-voltha" },
    } as any);
    mockedService.getAllConfigurations.mockResolvedValue([{ service: "voltha" }] as any);

    const { wrapper } = createWrapper();

    const singleHook = renderHook(() => useOSSConfiguration("voltha"), { wrapper });
    await waitFor(() => expect(singleHook.result.current.isSuccess).toBe(true));
    expect(mockedService.getConfiguration).toHaveBeenCalledWith("voltha");

    const allHook = renderHook(() => useAllOSSConfigurations(), { wrapper });
    await waitFor(() => expect(allHook.result.current.isSuccess).toBe(true));
    expect(mockedService.getAllConfigurations).toHaveBeenCalled();
  });

  it("updates and resets configurations with cache invalidation", async () => {
    mockedService.updateConfiguration.mockResolvedValue({ service: "voltha" } as any);
    mockedService.resetConfiguration.mockResolvedValue(undefined as any);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const updateHook = renderHook(() => useUpdateOSSConfiguration(), { wrapper });

    await act(async () => {
      await updateHook.result.current.mutateAsync({
        service: "voltha",
        updates: { url: "https://new" },
      });
    });

    expect(mockedService.updateConfiguration).toHaveBeenCalledWith("voltha", { url: "https://new" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ossConfigKeys.detail("voltha") });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ossConfigKeys.allConfigurations() });

    const resetHook = renderHook(() => useResetOSSConfiguration(), { wrapper });
    await act(async () => {
      await resetHook.result.current.mutateAsync("voltha");
    });

    expect(mockedService.resetConfiguration).toHaveBeenCalledWith("voltha");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ossConfigKeys.detail("voltha") });
  });

  it("tests OSS connection and forwards callbacks", async () => {
    const onSuccess = jest.fn();
    mockedService.testConnection.mockResolvedValue({ success: true, message: "ok" });

    const { wrapper } = createWrapper();
    const testHook = renderHook(
      () =>
        useTestOSSConnection({
          onSuccess,
        }),
      { wrapper },
    );

    await act(async () => {
      await testHook.result.current.mutateAsync("netbox");
    });

    expect(mockedService.testConnection).toHaveBeenCalledWith("netbox");
    expect(onSuccess).toHaveBeenCalledWith({ success: true, message: "ok" });
  });

  it("batch updates multiple configurations and invalidates root key", async () => {
    mockedService.updateConfiguration.mockResolvedValue({ service: "voltha" } as any);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const batchHook = renderHook(() => useBatchUpdateOSSConfiguration(), { wrapper });

    await act(async () => {
      await batchHook.result.current.mutateAsync([
        { service: "voltha", updates: { verify_ssl: false } },
        { service: "ansible", updates: { timeout_seconds: 60 } },
      ]);
    });

    expect(mockedService.updateConfiguration).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ossConfigKeys.all });
  });

  it("provides config status helpers", async () => {
    mockedService.getConfiguration.mockResolvedValue({
      service: "genieacs",
      config: { url: "https://genieacs", verify_ssl: true, timeout_seconds: 30, max_retries: 3 },
      overrides: { verify_ssl: false },
    } as any);
    mockedService.hasOverrides.mockReturnValue(true);
    mockedService.getOverriddenFields.mockReturnValue(["verify_ssl"]);
    mockedService.validateUpdate.mockReturnValue({ valid: true, errors: [] });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useOSSConfigStatus("genieacs"), { wrapper });

    await waitFor(() => expect(result.current.config?.service).toBe("genieacs"));
    expect(result.current.hasOverrides).toBe(true);
    expect(result.current.overriddenFields).toEqual(["verify_ssl"]);
    expect(result.current.validateUpdate({ url: "https://new" })).toEqual({ valid: true, errors: [] });
    expect(result.current.isConfigured).toBe(true);
  });

  it("computes aggregated statistics for all services", async () => {
    mockedService.getAllConfigurations.mockResolvedValue([
      {
        service: "voltha",
        config: { url: "https://voltha" },
        overrides: { url: "https://tenant-voltha" },
      },
      {
        service: "netbox",
        config: { url: "" },
        overrides: {},
      },
    ] as any);
    mockedService.hasOverrides.mockImplementation((config) => !!config.overrides.url);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useOSSConfigStatistics(), { wrapper });

    await waitFor(() => expect(result.current.statistics.totalServices).toBe(2));
    expect(result.current.statistics.configuredCount).toBe(1);
    expect(result.current.statistics.overriddenCount).toBe(1);
    expect(result.current.hasAnyConfigured).toBe(true);
    expect(result.current.hasAnyOverridden).toBe(true);
  });
});
