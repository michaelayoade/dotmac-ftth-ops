import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import {
  CreateProjectData,
  CreateTaskData,
  MemberStatus,
  Project,
  ProjectFilter,
  ProjectListResponse,
  ProjectMetrics,
  ProjectPriority,
  ProjectStatus,
  ProjectTemplate,
  Task,
  TaskFilter,
  TaskListResponse,
  TaskPriority,
  TaskStatus,
  TaskType,
  TeamMember,
  TeamMembership,
  TeamMembershipListResponse,
  TeamRole,
  Team,
  UpdateProjectData,
  UpdateTaskData,
} from "@/types/project-management";

const API_BASE = "/project-management";

const defaultMember: TeamMember = {
  id: "unassigned",
  userId: "unassigned",
  name: "Unassigned",
  email: "",
  avatar: "",
  role: TeamRole.MEMBER,
  permissions: [],
  joinedAt: new Date().toISOString(),
  status: MemberStatus.ACTIVE,
};

const mapProjectStatusFromApi = (status: string): ProjectStatus => {
  const normalized = status?.toLowerCase();
  switch (normalized) {
    case "planned":
    case "scheduled":
      return ProjectStatus.PLANNING;
    case "in_progress":
      return ProjectStatus.ACTIVE;
    case "on_hold":
    case "blocked":
      return ProjectStatus.ON_HOLD;
    case "completed":
      return ProjectStatus.COMPLETED;
    case "cancelled":
    case "failed":
      return ProjectStatus.CANCELLED;
    default:
      return ProjectStatus.ACTIVE;
  }
};

const mapProjectStatusToApi = (status?: ProjectStatus): string | undefined => {
  switch (status) {
    case ProjectStatus.PLANNING:
    case ProjectStatus.DRAFT:
      return "planned";
    case ProjectStatus.ACTIVE:
      return "in_progress";
    case ProjectStatus.ON_HOLD:
      return "on_hold";
    case ProjectStatus.COMPLETED:
      return "completed";
    case ProjectStatus.CANCELLED:
    case ProjectStatus.ARCHIVED:
      return "cancelled";
    default:
      return undefined;
  }
};

const mapTaskStatusFromApi = (status: string): TaskStatus => {
  const normalized = status?.toLowerCase();
  switch (normalized) {
    case "in_progress":
      return TaskStatus.IN_PROGRESS;
    case "blocked":
    case "paused":
      return TaskStatus.BLOCKED;
    case "completed":
      return TaskStatus.DONE;
    case "cancelled":
    case "failed":
    case "skipped":
      return TaskStatus.CANCELLED;
    case "pending":
    case "ready":
    case "assigned":
    default:
      return TaskStatus.TODO;
  }
};

const mapTaskStatusToApi = (status?: TaskStatus): string | undefined => {
  switch (status) {
    case TaskStatus.IN_PROGRESS:
      return "in_progress";
    case TaskStatus.BLOCKED:
      return "blocked";
    case TaskStatus.DONE:
      return "completed";
    case TaskStatus.CANCELLED:
      return "cancelled";
    case TaskStatus.TODO:
    default:
      return undefined;
  }
};

const mapTaskPriorityFromApi = (priority: string): TaskPriority => {
  const normalized = priority?.toLowerCase();
  switch (normalized) {
    case "low":
      return TaskPriority.LOW;
    case "high":
      return TaskPriority.HIGH;
    case "critical":
    case "emergency":
      return TaskPriority.CRITICAL;
    case "normal":
    default:
      return TaskPriority.MEDIUM;
  }
};

const mapProjectPriorityFromApi = (priority: string): ProjectPriority => {
  const normalized = priority?.toLowerCase();
  switch (normalized) {
    case "low":
      return ProjectPriority.LOW;
    case "high":
      return ProjectPriority.HIGH;
    case "critical":
    case "emergency":
      return ProjectPriority.CRITICAL;
    case "normal":
    default:
      return ProjectPriority.MEDIUM;
  }
};

const mapPriorityToApi = (priority?: TaskPriority | ProjectPriority): string | undefined => {
  switch (priority) {
    case TaskPriority.LOW:
    case ProjectPriority.LOW:
      return "low";
    case TaskPriority.HIGH:
    case ProjectPriority.HIGH:
      return "high";
    case TaskPriority.CRITICAL:
    case ProjectPriority.CRITICAL:
      return "critical";
    case TaskPriority.MEDIUM:
    case ProjectPriority.MEDIUM:
    default:
      return "normal";
  }
};

const mapProjectFromApi = (project: any): Project => {
  const mapped: Project = {
    id: project.id,
    name: project.name,
    description: project.description ?? "",
    code: project.project_number ?? project.id,
    status: mapProjectStatusFromApi(project.status),
    priority: mapProjectPriorityFromApi(project.priority),
    startDate: project.scheduled_start ?? project.actual_start ?? "",
    endDate: project.scheduled_end ?? project.actual_end ?? "",
    progress: project.completion_percent ?? 0,
    completedTasks: project.tasks_completed ?? 0,
    totalTasks: project.tasks_total ?? 0,
    ownerId: project.assigned_team_id ?? "unassigned",
    owner: defaultMember,
    teamMembers: [],
    tags: project.tags ?? [],
    isTemplate: project.is_template ?? false,
    isArchived: project.status === "cancelled",
    isPublic: project.is_public ?? false,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    createdBy: project.created_by ?? "",
    updatedBy: project.updated_by ?? "",
  };

  if (project.actual_start) mapped.actualStartDate = project.actual_start;
  if (project.actual_end) mapped.actualEndDate = project.actual_end;
  if (project.template_id) mapped.templateId = project.template_id;
  if (project.budget) mapped.budget = project.budget;
  if (project.actual_cost) mapped.actualCost = project.actual_cost;
  if (project.estimated_duration_hours) mapped.estimatedHours = project.estimated_duration_hours;
  if (project.color) mapped.color = project.color;
  if (project.icon) mapped.icon = project.icon;

  return mapped;
};

const mapTaskFromApi = (task: any): Task => {
  const mapped: Task = {
    id: task.id,
    title: task.name,
    description: task.description ?? "",
    status: mapTaskStatusFromApi(task.status),
    priority: mapTaskPriorityFromApi(task.priority),
    type: task.task_type ?? TaskType.TASK,
    projectId: task.project_id,
    reporterId: task.assigned_team_id ?? "unassigned",
    progress: task.completion_percent ?? 0,
    subtasks: [],
    dependencies: [],
    blockedBy: [],
    columnId: task.column_id ?? "TODO",
    position: task.position ?? 0,
    tags: task.tags ?? [],
    attachments: [],
    comments: [],
    watchers: task.watchers ?? [],
    customFields: task.custom_fields ?? {},
    createdAt: task.created_at ?? "",
    updatedAt: task.updated_at ?? "",
    createdBy: task.created_by ?? "",
    updatedBy: task.updated_by ?? "",
  };

  if (task.assigned_technician_id) mapped.assigneeId = task.assigned_technician_id;
  if (task.scheduled_start) mapped.startDate = task.scheduled_start;
  if (task.scheduled_end) mapped.dueDate = task.scheduled_end;
  if (task.actual_end) mapped.completedAt = task.actual_end;
  if (task.estimated_duration_minutes) mapped.estimatedHours = task.estimated_duration_minutes / 60;
  if (task.actual_duration_minutes) mapped.actualHours = task.actual_duration_minutes / 60;
  if (task.parent_task_id) mapped.parentTaskId = task.parent_task_id;

  return mapped;
};

// Projects
const fetchProjects = async (filter?: ProjectFilter): Promise<ProjectListResponse> => {
  const { data } = await apiClient.get(`${API_BASE}/projects`, {
    params: {
      search: filter?.search,
      status: mapProjectStatusToApi(filter?.status?.[0]),
      project_type: filter?.projectType,
      assigned_team_id: filter?.ownerId?.[0],
      limit: filter?.limit,
      offset: filter?.offset,
    },
  });

  return {
    projects: (data.projects ?? []).map(mapProjectFromApi),
    total: data.total ?? data.projects?.length ?? 0,
    limit: data.limit ?? filter?.limit ?? 50,
    offset: data.offset ?? filter?.offset ?? 0,
  };
};

const fetchProject = async (id: string): Promise<Project> => {
  const { data } = await apiClient.get(`${API_BASE}/projects/${id}`, {
    params: { include_tasks: true },
  });
  return mapProjectFromApi(data);
};

const createProject = async (payload: CreateProjectData): Promise<Project> => {
  const { data } = await apiClient.post(`${API_BASE}/projects`, {
    name: payload.name,
    description: payload.description,
    project_type: payload.projectType ?? "custom",
    priority: mapPriorityToApi(payload.priority),
    scheduled_start: payload.startDate,
    scheduled_end: payload.endDate,
    due_date: payload.endDate,
    tags: payload.tags,
    estimated_duration_hours: payload.estimatedHours,
    budget: payload.budget,
  });
  return mapProjectFromApi(data);
};

const updateProject = async (payload: UpdateProjectData): Promise<Project> => {
  const { data } = await apiClient.patch(`${API_BASE}/projects/${payload.id}`, {
    name: payload.name,
    description: payload.description,
    status: mapProjectStatusToApi(payload.status),
    priority: mapPriorityToApi(payload.priority),
    scheduled_start: payload.startDate,
    scheduled_end: payload.endDate,
    actual_start: payload.actualStartDate,
    actual_end: payload.actualEndDate,
    notes: payload.notes,
  });
  return mapProjectFromApi(data);
};

const deleteProject = async (id: string): Promise<void> => {
  await apiClient.delete(`${API_BASE}/projects/${id}`);
};

// Tasks
const fetchTasks = async (filter?: TaskFilter): Promise<TaskListResponse> => {
  const { data } = await apiClient.get(`${API_BASE}/tasks`, {
    params: {
      status: mapTaskStatusToApi(filter?.status?.[0]),
      project_id: filter?.projectId?.[0],
      assigned_team_id: filter?.assigneeId?.[0],
      limit: filter?.limit ?? 100,
      offset: filter?.offset ?? 0,
    },
  });

  return {
    tasks: (data.tasks ?? []).map(mapTaskFromApi),
    total: data.total ?? data.tasks?.length ?? 0,
    limit: data.limit ?? filter?.limit ?? 100,
    offset: data.offset ?? filter?.offset ?? 0,
  };
};

const fetchTask = async (id: string): Promise<Task> => {
  const { data } = await apiClient.get(`${API_BASE}/tasks/${id}`);
  return mapTaskFromApi(data);
};

const createTask = async (payload: CreateTaskData): Promise<Task> => {
  const { data } = await apiClient.post(`${API_BASE}/tasks`, {
    name: payload.title,
    description: payload.description,
    task_type: payload.type ?? "custom",
    priority: mapPriorityToApi(payload.priority),
    project_id: payload.projectId,
    scheduled_start: payload.startDate,
    scheduled_end: payload.dueDate,
    estimated_duration_minutes: payload.estimatedHours ? payload.estimatedHours * 60 : undefined,
    tags: payload.tags,
  });
  return mapTaskFromApi(data);
};

const updateTask = async (payload: UpdateTaskData): Promise<Task> => {
  const { data } = await apiClient.patch(`${API_BASE}/tasks/${payload.id}`, {
    name: payload.title,
    description: payload.description,
    status: mapTaskStatusToApi(payload.status),
    priority: mapPriorityToApi(payload.priority),
    assigned_technician_id: payload.assigneeId,
    scheduled_start: payload.startDate,
    scheduled_end: payload.dueDate,
    actual_start: payload.actualStartDate,
    actual_end: payload.completedAt,
    completion_percent: payload.progress,
    notes: payload.notes,
  });
  return mapTaskFromApi(data);
};

const deleteTask = async (id: string): Promise<void> => {
  await apiClient.delete(`${API_BASE}/tasks/${id}`);
};

// Templates (stubbed to API surface; backend templates are not yet exposed)
const fetchTemplates = async (): Promise<any> => {
  const { data } = await apiClient.get(`${API_BASE}/templates`).catch(() => ({ data: [] }));
  return data ?? [];
};

const createTemplate = async (data: any): Promise<any> => {
  const response = await apiClient.post(`${API_BASE}/templates`, data).catch(() => ({ data: {} }));
  return response.data ?? {};
};

// Kanban
const fetchKanbanBoard = async (projectId: string): Promise<any> => {
  const { data } = await apiClient
    .get(`${API_BASE}/projects/${projectId}`, { params: { include_tasks: true } })
    .catch(() => ({ data: { tasks: [] } }));
  return {
    columns: [],
    tasks: (data.tasks ?? []).map(mapTaskFromApi),
  };
};

// Metrics
const fetchMetrics = async (): Promise<ProjectMetrics> => {
  const { data } = await apiClient.get(`${API_BASE}/metrics`);
  return {
    totalProjects: data.total_projects ?? 0,
    activeProjects: data.active_projects ?? 0,
    completedProjects: data.completed_projects ?? 0,
    overdueProjects: data.overdue_projects ?? 0,
    totalTasks: data.total_tasks ?? 0,
    completedTasks: data.completed_tasks ?? 0,
    inProgressTasks: data.in_progress_tasks ?? 0,
    overdueTasks: data.overdue_tasks ?? 0,
    averageCompletionTime: data.average_completion_time_days ?? 0,
    teamUtilization: data.team_utilization ?? 0,
    onTimeDeliveryRate: data.on_time_delivery_rate ?? 0,
  };
};

// Teams & memberships
const fetchTeamMembers = async (): Promise<TeamMembershipListResponse> => {
  const { data } = await apiClient.get(`${API_BASE}/teams/members`);
  const memberships = (data.memberships ?? []).map(
    (member: any): TeamMembership => ({
      id: member.id,
      tenantId: member.tenant_id,
      technicianId: member.technician_id,
      teamId: member.team_id,
      role: member.role ?? TeamRole.MEMBER,
      isPrimaryTeam: member.is_primary_team ?? false,
      isActive: member.is_active ?? true,
      joinedAt: member.joined_at,
      leftAt: member.left_at ?? undefined,
    }),
  );
  return {
    memberships,
    total: data.total ?? memberships.length,
    limit: data.limit ?? memberships.length,
    offset: data.offset ?? 0,
  };
};

const fetchTeams = async (): Promise<Team[]> => {
  const { data } = await apiClient.get(`${API_BASE}/teams`, { params: { limit: 200, offset: 0 } });
  return (data.teams ?? []).map(
    (team: any): Team => ({
      id: team.id,
      name: team.name,
      teamCode: team.team_code,
      description: team.description,
      type: team.team_type,
      isActive: team.is_active,
    }),
  );
};

// ============================================================================
// React Query Hooks
// ============================================================================

// Projects
export const useProjects = (filter?: ProjectFilter) => {
  return useQuery({
    queryKey: ["projects", filter],
    queryFn: () => fetchProjects(filter),
    staleTime: 30000,
  });
};

export const useProject = (
  id: string,
  options?: Omit<UseQueryOptions<Project>, "queryKey" | "queryFn">,
) => {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => fetchProject(id),
    enabled: !!id,
    ...options,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateProject,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", data.id] });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
};

// Tasks
export const useTasks = (filter?: TaskFilter) => {
  return useQuery({
    queryKey: ["tasks", filter],
    queryFn: () => fetchTasks(filter),
    staleTime: 10000,
  });
};

export const useTask = (id: string) => {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => fetchTask(id),
    enabled: !!id,
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
    },
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTask,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task", data.id] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
    },
  });
};

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["kanban"] });
    },
  });
};

// Templates
export const useTemplates = () => {
  return useQuery({
    queryKey: ["templates"],
    queryFn: fetchTemplates,
    staleTime: 60000,
  });
};

export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
  });
};

// Kanban
export const useKanbanBoard = (projectId: string) => {
  return useQuery({
    queryKey: ["kanban", projectId],
    queryFn: () => fetchKanbanBoard(projectId),
    enabled: !!projectId,
    refetchInterval: 30000, // Auto-refresh every 30s
  });
};

// Metrics
export const useProjectMetrics = () => {
  return useQuery({
    queryKey: ["project-metrics"],
    queryFn: fetchMetrics,
    staleTime: 60000,
  });
};

export const useTeamMembers = () => {
  return useQuery({
    queryKey: ["project-team-members"],
    queryFn: fetchTeamMembers,
    staleTime: 60000,
  });
};

export const useTeams = () => {
  return useQuery({
    queryKey: ["project-teams"],
    queryFn: fetchTeams,
    staleTime: 60000,
  });
};
