/**
 * Platform Admin App - useWirelessBackend tests
 *
 * Covers devices/radios/clients/coverage queries plus mutation flows and statistics helpers.
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useWirelessDevices,
  useWirelessDevice,
  useDeviceHealth,
  useCreateDevice,
  useUpdateDevice,
  useDeleteDevice,
  useWirelessRadios,
  useWirelessRadio,
  useCreateRadio,
  useUpdateRadio,
  useDeleteRadio,
  useCoverageZones,
  useCreateCoverageZone,
  useWirelessClients,
  useWirelessStatistics,
} from "../useWirelessBackend";
import { apiClient } from "@/lib/api/client";
import { useToast } from "@dotmac/ui";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockToast = jest.fn();
jest.mock("@dotmac/ui", () => ({
  useToast: () => ({
    toast: mockToast,
  }),
}));

const mockedApi = apiClient as jest.Mocked<typeof apiClient>;

describe("Platform Admin useWirelessBackend hooks", () => {
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

  it("fetches devices and device detail/health", async () => {
    mockedApi.get
      .mockResolvedValueOnce({
        data: [{ id: "dev-1", name: "AP-1" }],
      })
      .mockResolvedValueOnce({ data: { id: "dev-1", name: "AP-1" } })
      .mockResolvedValueOnce({ data: { status: "healthy" } });

    const { wrapper } = createWrapper();

    const devicesHook = renderHook(() => useWirelessDevices({ device_type: "ap" as any }), {
      wrapper,
    });
    await waitFor(() => expect(devicesHook.result.current.data?.length).toBe(1));
    expect(mockedApi.get).toHaveBeenCalledWith("/wireless/devices?device_type=ap");

    const detailHook = renderHook(() => useWirelessDevice("dev-1"), { wrapper });
    await waitFor(() => expect(detailHook.result.current.data?.id).toBe("dev-1"));

    const healthHook = renderHook(() => useDeviceHealth("dev-1"), { wrapper });
    await waitFor(() => expect(healthHook.result.current.data?.status).toBe("healthy"));
  });

  it("creates/updates/deletes devices and triggers toasts/invalidation", async () => {
    mockedApi.post.mockResolvedValue({ data: { id: "dev-2", name: "AP-2" } });
    mockedApi.patch.mockResolvedValue({ data: { id: "dev-2", name: "AP-2 Updated" } });
    mockedApi.delete.mockResolvedValue({});

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const createHook = renderHook(() => useCreateDevice(), { wrapper });
    await act(async () => {
      await createHook.result.current.mutateAsync({ name: "AP-2" } as any);
    });
    expect(mockedApi.post).toHaveBeenCalledWith("/wireless/devices", { name: "AP-2" });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["wireless", "devices"] });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Device Created" }),
    );

    const updateHook = renderHook(() => useUpdateDevice(), { wrapper });
    await act(async () => {
      await updateHook.result.current.mutateAsync({
        id: "dev-2",
        data: { name: "AP-2 Updated" },
      });
    });
    expect(mockedApi.patch).toHaveBeenCalledWith("/wireless/devices/dev-2", {
      name: "AP-2 Updated",
    });

    const deleteHook = renderHook(() => useDeleteDevice(), { wrapper });
    await act(async () => {
      await deleteHook.result.current.mutateAsync("dev-2");
    });
    expect(mockedApi.delete).toHaveBeenCalledWith("/wireless/devices/dev-2");
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Device Deleted" }),
    );
  });

  it("fetches radios and manages radio mutations", async () => {
    mockedApi.get.mockResolvedValueOnce({ data: [{ id: "radio-1" }] }).mockResolvedValueOnce({
      data: { id: "radio-1" },
    });
    mockedApi.post.mockResolvedValue({ data: { id: "radio-2" } });
    mockedApi.patch.mockResolvedValue({ data: { id: "radio-2" } });
    mockedApi.delete.mockResolvedValue({});

    const { wrapper } = createWrapper();

    const radiosHook = renderHook(() => useWirelessRadios({ device_id: "dev-1" }), { wrapper });
    await waitFor(() => expect(radiosHook.result.current.data?.length).toBe(1));
    expect(mockedApi.get).toHaveBeenCalledWith("/wireless/radios?device_id=dev-1");

    const radioHook = renderHook(() => useWirelessRadio("radio-1"), { wrapper });
    await waitFor(() => expect(radioHook.result.current.data?.id).toBe("radio-1"));

    const createRadioHook = renderHook(() => useCreateRadio(), { wrapper });
    await act(async () => {
      await createRadioHook.result.current.mutateAsync({ device_id: "dev-1" } as any);
    });
    expect(mockedApi.post).toHaveBeenCalledWith("/wireless/radios", { device_id: "dev-1" });

    const updateRadioHook = renderHook(() => useUpdateRadio(), { wrapper });
    await act(async () => {
      await updateRadioHook.result.current.mutateAsync({ id: "radio-2", data: { channel: 36 } });
    });
    expect(mockedApi.patch).toHaveBeenCalledWith("/wireless/radios/radio-2", { channel: 36 });

    const deleteRadioHook = renderHook(() => useDeleteRadio(), { wrapper });
    await act(async () => {
      await deleteRadioHook.result.current.mutateAsync("radio-2");
    });
    expect(mockedApi.delete).toHaveBeenCalledWith("/wireless/radios/radio-2");
  });

  it("manages coverage zones and clients", async () => {
    mockedApi.get
      .mockResolvedValueOnce({ data: [{ id: "zone-1" }] })
      .mockResolvedValueOnce({ data: [{ id: "client-1" }] });
    mockedApi.post.mockResolvedValue({ data: { id: "zone-2" } });

    const { wrapper } = createWrapper();

    const coverageHook = renderHook(() => useCoverageZones(), { wrapper });
    await waitFor(() => expect(coverageHook.result.current.data?.length).toBe(1));
    expect(mockedApi.get).toHaveBeenCalledWith("/wireless/coverage-zones?");

    const clientsHook = renderHook(() => useWirelessClients({}), { wrapper });
    await waitFor(() => expect(clientsHook.result.current.data?.length).toBe(1));

    const createCoverageHook = renderHook(() => useCreateCoverageZone(), { wrapper });
    await act(async () => {
      await createCoverageHook.result.current.mutateAsync({ name: "Zone 2" } as any);
    });
    expect(mockedApi.post).toHaveBeenCalledWith("/wireless/coverage-zones", { name: "Zone 2" });
  });

  it("fetches wireless statistics", async () => {
    mockedApi.get.mockResolvedValue({ data: { total_devices: 10 } });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWirelessStatistics(), { wrapper });
    await waitFor(() => expect(result.current.data?.total_devices).toBe(10));
    expect(mockedApi.get).toHaveBeenCalledWith("/wireless/statistics");
  });
});
