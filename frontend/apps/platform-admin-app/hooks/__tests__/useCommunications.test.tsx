/**
 * Platform Admin App - useCommunications tests
 *
 * Ensures the TanStack hooks call communicationsService methods and handle cache updates.
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  useTemplates,
  useSendEmail,
  useCreateTemplate,
  useCommunicationsDashboard,
  communicationsKeys,
} from "../useCommunications";
import { communicationsService } from "@/lib/services/communications-service";

jest.unmock("@tanstack/react-query");

jest.mock("@/lib/services/communications-service", () => ({
  communicationsService: {
    sendEmail: jest.fn(),
    queueEmail: jest.fn(),
    listTemplates: jest.fn(),
    getTemplate: jest.fn(),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    renderTemplate: jest.fn(),
    quickRender: jest.fn(),
    listLogs: jest.fn(),
    getLog: jest.fn(),
    queueBulkEmail: jest.fn(),
    getBulkEmailStatus: jest.fn(),
    cancelBulkEmail: jest.fn(),
    getTaskStatus: jest.fn(),
    getStatistics: jest.fn(),
    getRecentActivity: jest.fn(),
    healthCheck: jest.fn(),
    getMetrics: jest.fn(),
  },
}));

const mockedService = communicationsService as jest.Mocked<typeof communicationsService>;

describe("Platform Admin useCommunications hooks", () => {
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

  it("fetches templates with filters", async () => {
    mockedService.listTemplates.mockResolvedValue({
      templates: [{ id: "tmpl-1", name: "Welcome" }],
      total: 1,
      page: 1,
      page_size: 10,
    } as any);

    const params = { page: 1, page_size: 10, search: "welcome" };
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTemplates(params), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedService.listTemplates).toHaveBeenCalledWith(params);
    expect(result.current.data?.templates[0].name).toBe("Welcome");
  });

  it("sends emails and invalidates logs cache", async () => {
    mockedService.sendEmail.mockResolvedValue({ id: "email-1" } as any);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useSendEmail(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        subject: "Hello",
        to: ["user@example.com"],
      } as any);
    });

    expect(mockedService.sendEmail).toHaveBeenCalledWith({
      subject: "Hello",
      to: ["user@example.com"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: communicationsKeys.logs.all });
  });

  it("creates templates and invalidates template + metrics caches", async () => {
    mockedService.createTemplate.mockResolvedValue({ id: "tmpl-2", name: "Reset" } as any);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = jest.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreateTemplate(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: "Reset" } as any);
    });

    expect(mockedService.createTemplate).toHaveBeenCalledWith({ name: "Reset" });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: communicationsKeys.templates.all,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: communicationsKeys.stats.metrics(),
    });
  });

  it("returns dashboard data when all queries resolve", async () => {
    mockedService.getStatistics.mockResolvedValue({ total_emails_sent: 10 } as any);
    mockedService.healthCheck.mockResolvedValue({ status: "healthy" } as any);
    mockedService.listLogs.mockResolvedValue({
      logs: [{ id: "log-1" }],
      total: 1,
    } as any);
    mockedService.getMetrics.mockResolvedValue({ queue_depth: 0 } as any);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCommunicationsDashboard(), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.stats?.total_emails_sent).toBe(10);
    expect(result.current.health?.status).toBe("healthy");
    expect(result.current.recentLogs).toHaveLength(1);
    expect(result.current.metrics?.queue_depth).toBe(0);
  });
});
