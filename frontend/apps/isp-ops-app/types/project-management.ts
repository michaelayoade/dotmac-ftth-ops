/**
 * Project Management Domain Types
 * Strict TypeScript types for project/task management system
 */

// ============================================================================
// Enums
// ============================================================================

export enum ProjectStatus {
  DRAFT = "DRAFT",
  PLANNING = "PLANNING",
  ACTIVE = "ACTIVE",
  ON_HOLD = "ON_HOLD",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  ARCHIVED = "ARCHIVED",
}

export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  IN_REVIEW = "IN_REVIEW",
  BLOCKED = "BLOCKED",
  DONE = "DONE",
  CANCELLED = "CANCELLED",
}

export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum ProjectPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum TaskType {
  TASK = "TASK",
  BUG = "BUG",
  FEATURE = "FEATURE",
  IMPROVEMENT = "IMPROVEMENT",
  RESEARCH = "RESEARCH",
  DOCUMENTATION = "DOCUMENTATION",
}

export enum RecurrenceType {
  NONE = "NONE",
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  BIWEEKLY = "BIWEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  YEARLY = "YEARLY",
}

// ============================================================================
// Base Interfaces
// ============================================================================

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface Timestamps {
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Team Member
// ============================================================================

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  role: TeamRole;
  permissions: TeamPermission[];
  joinedAt: string;
  status: MemberStatus;
}

export enum TeamRole {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  MEMBER = "MEMBER",
  VIEWER = "VIEWER",
}

export enum MemberStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  INVITED = "INVITED",
}

export type TeamPermission =
  | "CREATE_PROJECT"
  | "EDIT_PROJECT"
  | "DELETE_PROJECT"
  | "CREATE_TASK"
  | "EDIT_TASK"
  | "DELETE_TASK"
  | "ASSIGN_TASK"
  | "MANAGE_TEAM"
  | "VIEW_ANALYTICS";

// ============================================================================
// Project
// ============================================================================

export interface Project extends BaseEntity {
  name: string;
  description: string;
  code: string; // Unique project code (e.g., "PROJ-001")
  status: ProjectStatus;
  priority: ProjectPriority;

  // Dates
  startDate: string;
  endDate: string;
  actualStartDate?: string;
  actualEndDate?: string;

  // Progress
  progress: number; // 0-100
  completedTasks: number;
  totalTasks: number;

  // Team
  ownerId: string;
  owner: TeamMember;
  teamMembers: TeamMember[];

  // Relationships
  templateId?: string;
  parentProjectId?: string;
  tags: string[];

  // Metadata
  budget?: number;
  actualCost?: number;
  estimatedHours?: number;
  actualHours?: number;
  color?: string;
  icon?: string;

  // Settings
  isTemplate: boolean;
  isArchived: boolean;
  isPublic: boolean;
}

// ============================================================================
// Task
// ============================================================================

export interface Task extends BaseEntity {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;

  // Project relationship
  projectId: string;
  project?: Project;

  // Assignment
  assigneeId?: string;
  assignee?: TeamMember;
  reporterId: string;
  reporter?: TeamMember;

  // Dates
  startDate?: string;
  dueDate?: string;
  completedAt?: string;

  // Progress
  progress: number; // 0-100
  estimatedHours?: number;
  actualHours?: number;

  // Dependencies
  parentTaskId?: string;
  parentTask?: Task;
  subtasks: Task[];
  dependencies: TaskDependency[];
  blockedBy: Task[];

  // Kanban
  columnId: string;
  position: number; // Order within column

  // Metadata
  tags: string[];
  attachments: TaskAttachment[];
  comments: TaskComment[];
  watchers: string[]; // User IDs

  // Recurrence
  recurrence?: TaskRecurrence;

  // Custom fields
  customFields: Record<string, unknown>;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: DependencyType;
}

export enum DependencyType {
  BLOCKS = "BLOCKS",
  IS_BLOCKED_BY = "IS_BLOCKED_BY",
  RELATES_TO = "RELATES_TO",
  DUPLICATES = "DUPLICATES",
}

export interface TaskRecurrence {
  type: RecurrenceType;
  interval: number;
  endDate?: string;
  count?: number;
}

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  author?: TeamMember;
  content: string;
  createdAt: string;
  updatedAt: string;
  isEdited: boolean;
  mentions: string[]; // User IDs
}

// ============================================================================
// Template
// ============================================================================

export interface ProjectTemplate extends BaseEntity {
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail?: string | undefined;

  // Template structure
  taskTemplates: TaskTemplate[];
  columns: KanbanColumn[];

  // Settings
  isPublic: boolean;
  usageCount: number;

  // Metadata
  tags: string[];
  defaultDuration?: number | undefined; // in days
  estimatedHours?: number | undefined;
}

export enum TemplateCategory {
  SOFTWARE_DEVELOPMENT = "SOFTWARE_DEVELOPMENT",
  MARKETING = "MARKETING",
  SALES = "SALES",
  OPERATIONS = "OPERATIONS",
  HR = "HR",
  CUSTOM = "CUSTOM",
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  type: TaskType;
  priority: TaskPriority;
  estimatedHours?: number | undefined;
  position: number;
  columnId: string;
  dependencies: string[]; // Template task IDs
  assignToRole?: TeamRole | undefined;
  daysFromStart?: number | undefined; // Auto-set due date based on project start
}

// ============================================================================
// Kanban Board
// ============================================================================

export interface KanbanBoard {
  id: string;
  projectId: string;
  name: string;
  columns: KanbanColumn[];
  createdAt: string;
  updatedAt: string;
}

export interface KanbanColumn {
  id: string;
  name: string;
  status: TaskStatus;
  position: number;
  color?: string | undefined;
  wipLimit?: number | undefined; // Work In Progress limit
  tasks: Task[];
}

// ============================================================================
// Calendar
// ============================================================================

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  allDay: boolean;

  // Type
  type: CalendarEventType;

  // Related entities
  projectId?: string;
  taskId?: string;

  // Attendees
  attendees: TeamMember[];

  // Display
  color?: string;

  // Recurrence
  recurrence?: TaskRecurrence;
}

export enum CalendarEventType {
  TASK = "TASK",
  MEETING = "MEETING",
  DEADLINE = "DEADLINE",
  MILESTONE = "MILESTONE",
  HOLIDAY = "HOLIDAY",
  CUSTOM = "CUSTOM",
}

// ============================================================================
// Gantt Chart
// ============================================================================

export interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  dependencies: string[];
  type: GanttTaskType;
  project: string;
  styles?: GanttTaskStyles;
}

export enum GanttTaskType {
  TASK = "task",
  MILESTONE = "milestone",
  PROJECT = "project",
}

export interface GanttTaskStyles {
  backgroundColor?: string;
  backgroundSelectedColor?: string;
  progressColor?: string;
  progressSelectedColor?: string;
}

// ============================================================================
// Analytics & Metrics
// ============================================================================

export interface ProjectMetrics {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;

  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;

  averageCompletionTime: number; // in days
  teamUtilization: number; // percentage
  onTimeDeliveryRate: number; // percentage
}

export interface TeamMemberMetrics {
  memberId: string;
  member: TeamMember;
  assignedTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  averageTaskDuration: number;
  totalHours: number;
}

export interface Team {
  id: string;
  name: string;
  teamCode?: string;
  description?: string;
  type?: string;
  isActive?: boolean;
}

export interface TeamMembership {
  id: string;
  tenantId: string;
  technicianId: string;
  teamId: string;
  role: TeamRole;
  isPrimaryTeam: boolean;
  isActive: boolean;
  joinedAt: string;
  leftAt?: string;
}

export interface TeamMembershipListResponse {
  memberships: TeamMembership[];
  total: number;
  limit: number;
  offset: number;
}

// ============================================================================
// Filters & Search
// ============================================================================

export interface ProjectFilter {
  status?: ProjectStatus[];
  priority?: ProjectPriority[];
  ownerId?: string[];
  tags?: string[];
  startDateFrom?: string;
  startDateTo?: string;
  search?: string;
  projectType?: string;
  limit?: number;
  offset?: number;
}

export interface TaskFilter {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  type?: TaskType[];
  assigneeId?: string[];
  projectId?: string[];
  tags?: string[];
  dueDateFrom?: string;
  dueDateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  limit?: number;
  offset?: number;
}

export interface TaskListResponse {
  tasks: Task[];
  total: number;
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  limit?: number;
  offset?: number;
}

export interface TemplateListResponse {
  templates: ProjectTemplate[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ============================================================================
// Form Data Types
// ============================================================================

export interface CreateProjectData {
  name: string;
  description: string;
  code?: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  startDate: string;
  endDate: string;
  ownerId: string;
  teamMemberIds?: string[];
  templateId?: string;
  projectType?: string;
  budget?: number;
  estimatedHours?: number;
  tags?: string[];
  color?: string;
  icon?: string;
}

export interface UpdateProjectData extends Partial<CreateProjectData> {
  id: string;
  actualStartDate?: string;
  actualEndDate?: string;
  notes?: string;
}

export interface CreateTaskData {
  title: string;
  description: string;
  projectId: string;
  status: TaskStatus;
  priority: TaskPriority;
  type: TaskType;
  assigneeId?: string;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  parentTaskId?: string;
  columnId: string;
  tags?: string[];
  recurrence?: TaskRecurrence;
}

export interface UpdateTaskData extends Partial<CreateTaskData> {
  id: string;
  position?: number;
  actualStartDate?: string;
  completedAt?: string;
  progress?: number;
  notes?: string;
}

export interface CreateTemplateData {
  name: string;
  description: string;
  category: TemplateCategory;
  thumbnail?: string;
  taskTemplates: TaskTemplate[];
  columns: KanbanColumn[];
  isPublic: boolean;
  tags?: string[];
  defaultDuration?: number;
  estimatedHours?: number;
}

// ============================================================================
// Drag and Drop Types
// ============================================================================

export interface DragItem {
  type: "TASK" | "COLUMN";
  id: string;
  columnId?: string;
}

export interface DropResult {
  sourceColumnId: string;
  destinationColumnId: string;
  sourceIndex: number;
  destinationIndex: number;
}
