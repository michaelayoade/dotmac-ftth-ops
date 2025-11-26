/**
 * Alignment tests for project management hooks against /project-management API.
 */

jest.mock("@/lib/api/client", () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

import React from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import { useProjects, useProjectMetrics, useTeams } from "../useProjects";
import { ProjectStatus, TaskPriority } from "@/types/project-management";

function createWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useProjects hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requests projects from /project-management with mapped status and transforms payload", async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: {
        projects: [
          {
            id: "p1",
            name: "Example",
            description: "desc",
            status: "in_progress",
            project_number: "PROJ-1",
            priority: "high",
            completion_percent: 50,
            tasks_total: 2,
            tasks_completed: 1,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-02T00:00:00Z",
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      },
    });

    const { result } = renderHook(
      () =>
        useProjects({
          status: [ProjectStatus.PLANNING],
        }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const calledUrl = (apiClient.get as jest.Mock).mock.calls[0]?.[0];
    const calledParams = (apiClient.get as jest.Mock).mock.calls[0]?.[1]?.params;
    expect(calledUrl).toBe("/project-management/projects");
    expect(calledParams?.status).toBe("planned");

    const project = result.current.data?.projects[0];
    expect(project?.id).toBe("p1");
    expect(project?.status).toBe(ProjectStatus.ACTIVE); // in_progress -> ACTIVE
    expect(project?.priority).toBe(TaskPriority.HIGH);
    expect(project?.code).toBe("PROJ-1");
  });

  it("maps metrics endpoint fields", async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: {
        total_projects: 5,
        active_projects: 3,
        completed_projects: 1,
        overdue_projects: 1,
        total_tasks: 12,
        completed_tasks: 4,
        in_progress_tasks: 6,
        overdue_tasks: 2,
        average_completion_time_days: 3.5,
        team_utilization: 75,
        on_time_delivery_rate: 90,
      },
    });

    const { result } = renderHook(() => useProjectMetrics(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect((apiClient.get as jest.Mock).mock.calls[0]?.[0]).toBe("/project-management/metrics");
    expect(result.current.data?.totalProjects).toBe(5);
    expect(result.current.data?.inProgressTasks).toBe(6);
    expect(result.current.data?.onTimeDeliveryRate).toBe(90);
  });

  it("fetches teams list", async () => {
    (apiClient.get as jest.Mock).mockResolvedValueOnce({
      data: {
        teams: [
          { id: "t1", name: "Installers", team_code: "INST" },
          { id: "t2", name: "Ops", team_code: "OPS" },
        ],
      },
    });

    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect((apiClient.get as jest.Mock).mock.calls[0]?.[0]).toBe("/project-management/teams");
    expect(result.current.data?.[0].name).toBe("Installers");
  });
});
