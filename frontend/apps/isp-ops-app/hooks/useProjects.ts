/**
 * Project Management React Query Hooks
 * Strict TypeScript hooks for projects, tasks, and templates
 */

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query";
import type {
  Project,
  Task,
  ProjectTemplate,
  CreateProjectData,
  UpdateProjectData,
  CreateTaskData,
  UpdateTaskData,
  CreateTemplateData,
  ProjectListResponse,
  TaskListResponse,
  TemplateListResponse,
  ProjectFilter,
  TaskFilter,
  ProjectMetrics,
  KanbanBoard,
} from "@/types/project-management";

// ============================================================================
// API Client (Mock - replace with real API calls)
// ============================================================================

const API_BASE = "/api/v1/projects";

// Projects
const fetchProjects = async (filter?: ProjectFilter): Promise<ProjectListResponse> => {
  const params = new URLSearchParams();
  if (filter?.search) params.append("search", filter.search);
  if (filter?.status) params.append("status", filter.status.join(","));

  const response = await fetch(`${API_BASE}?${params}`);
  if (!response.ok) throw new Error("Failed to fetch projects");
  return response.json();
};

const fetchProject = async (id: string): Promise<Project> => {
  const response = await fetch(`${API_BASE}/${id}`);
  if (!response.ok) throw new Error("Failed to fetch project");
  return response.json();
};

const createProject = async (data: CreateProjectData): Promise<Project> => {
  const response = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create project");
  return response.json();
};

const updateProject = async (data: UpdateProjectData): Promise<Project> => {
  const response = await fetch(`${API_BASE}/${data.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update project");
  return response.json();
};

const deleteProject = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete project");
};

// Tasks
const fetchTasks = async (filter?: TaskFilter): Promise<TaskListResponse> => {
  const params = new URLSearchParams();
  if (filter?.search) params.append("search", filter.search);
  if (filter?.projectId) params.append("projectId", filter.projectId.join(","));

  const response = await fetch(`${API_BASE}/tasks?${params}`);
  if (!response.ok) throw new Error("Failed to fetch tasks");
  return response.json();
};

const fetchTask = async (id: string): Promise<Task> => {
  const response = await fetch(`${API_BASE}/tasks/${id}`);
  if (!response.ok) throw new Error("Failed to fetch task");
  return response.json();
};

const createTask = async (data: CreateTaskData): Promise<Task> => {
  const response = await fetch(`${API_BASE}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create task");
  return response.json();
};

const updateTask = async (data: UpdateTaskData): Promise<Task> => {
  const response = await fetch(`${API_BASE}/tasks/${data.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to update task");
  return response.json();
};

const deleteTask = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete task");
};

// Templates
const fetchTemplates = async (): Promise<TemplateListResponse> => {
  const response = await fetch(`${API_BASE}/templates`);
  if (!response.ok) throw new Error("Failed to fetch templates");
  return response.json();
};

const createTemplate = async (data: CreateTemplateData): Promise<ProjectTemplate> => {
  const response = await fetch(`${API_BASE}/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error("Failed to create template");
  return response.json();
};

// Kanban
const fetchKanbanBoard = async (projectId: string): Promise<KanbanBoard> => {
  const response = await fetch(`${API_BASE}/${projectId}/kanban`);
  if (!response.ok) throw new Error("Failed to fetch kanban board");
  return response.json();
};

// Metrics
const fetchMetrics = async (): Promise<ProjectMetrics> => {
  const response = await fetch(`${API_BASE}/metrics`);
  if (!response.ok) throw new Error("Failed to fetch metrics");
  return response.json();
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

export const useProject = (id: string, options?: Omit<UseQueryOptions<Project>, "queryKey" | "queryFn">) => {
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
