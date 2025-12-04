"use client";

/**
 * Kanban Board Component
 * Drag-and-drop task management with strict TypeScript
 */

import { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Plus, MoreVertical, Clock, User } from "lucide-react";
import type { Task, KanbanColumn, TaskStatus } from "@/types/project-management";
import { TaskType, TaskPriority } from "@/types/project-management";
import { useKanbanBoard, useUpdateTask, useCreateTask, useTeams } from "@/hooks/useProjects";

// ============================================================================
// Types
// ============================================================================

interface KanbanBoardProps {
  projectId: string;
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  teamName?: string;
}

interface ColumnProps {
  column: KanbanColumn;
  tasks: Task[];
  onAddTask: (columnId: string) => void;
  teamNameById: Map<string, string>;
}

// ============================================================================
// Task Card Component
// ============================================================================

function TaskCard({ task, isDragging = false, teamName }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging || isSortableDragging ? 0.5 : 1,
  };

  const priorityColors: Record<TaskPriority, string> = {
    [TaskPriority.LOW]: "bg-gray-500",
    [TaskPriority.MEDIUM]: "bg-blue-500",
    [TaskPriority.HIGH]: "bg-orange-500",
    [TaskPriority.CRITICAL]: "bg-red-500",
  };

  const statusColors: Record<TaskStatus, string> = {
    TODO: "bg-gray-200 text-gray-800",
    IN_PROGRESS: "bg-blue-200 text-blue-800",
    IN_REVIEW: "bg-purple-200 text-purple-800",
    BLOCKED: "bg-red-200 text-red-800",
    DONE: "bg-green-200 text-green-800",
    CANCELLED: "bg-gray-200 text-gray-800",
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card className="mb-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-sm font-medium line-clamp-2">{task.title}</h4>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </div>

          {task.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{task.description}</p>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-xs ${statusColors[task.status]}`}>
              {task.status.replace("_", " ")}
            </Badge>

            <div
              className={`h-2 w-2 rounded-full ${priorityColors[task.priority]}`}
              title={task.priority}
            />

            {task.dueDate && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {new Date(task.dueDate).toLocaleDateString()}
              </div>
            )}

            {task.assignee && (
              <div className="flex items-center text-xs">
                <User className="h-3 w-3 mr-1" />
                {task.assignee.name}
              </div>
            )}
            {!task.assignee && teamName && (
              <div className="flex items-center text-xs text-muted-foreground">
                <User className="h-3 w-3 mr-1" />
                {teamName}
              </div>
            )}
          </div>

          {task.progress > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{task.progress}%</span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>
          )}

          {task.tags.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {task.tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                  {tag}
                </span>
              ))}
              {task.tags.length > 3 && (
                <span className="text-xs text-muted-foreground">+{task.tags.length - 3}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Column Component
// ============================================================================

function Column({ column, tasks, onAddTask, teamNameById }: ColumnProps) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);

  return (
    <div className="flex-shrink-0 w-80">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">{column.name}</CardTitle>
              <Badge variant="secondary" className="text-xs">
                {tasks.length}
                {column.wipLimit && ` / ${column.wipLimit}`}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddTask(column.id)}
              className="h-7 w-7 p-0"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {column.wipLimit && tasks.length >= column.wipLimit && (
            <p className="text-xs text-orange-600">WIP limit reached!</p>
          )}
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 pt-0">
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <p className="text-sm text-muted-foreground">No tasks</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Drag tasks here or click + to add
                </p>
              </div>
            ) : (
              tasks.map((task) => {
                const teamName = teamNameById.get(task.reporterId ?? "");
                return <TaskCard key={task.id} task={task} {...(teamName ? { teamName } : {})} />;
              })
            )}
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Kanban Board Component
// ============================================================================

export function KanbanBoard({ projectId }: KanbanBoardProps) {
  const { data: board, isLoading } = useKanbanBoard(projectId);
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: createTask } = useCreateTask();
  const { data: teams } = useTeams();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);

  // Update columns when board data changes
  useMemo(() => {
    if (board?.columns) {
      setColumns(board.columns);
    }
  }, [board]);

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    (teams ?? []).forEach((team) => map.set(team.id, team.name));
    return map;
  }, [teams]);

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Get active task for drag overlay
  const activeTask = useMemo(() => {
    if (!activeId) return null;
    for (const column of columns) {
      const task = column.tasks.find((t) => t.id === activeId);
      if (task) return task;
    }
    return null;
  }, [activeId, columns]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source and destination columns
    const activeColumn = columns.find((col) => col.tasks.some((task) => task.id === activeId));
    const overColumn = columns.find(
      (col) => col.id === overId || col.tasks.some((task) => task.id === overId),
    );

    if (!activeColumn || !overColumn) return;

    if (activeColumn.id !== overColumn.id) {
      setColumns((cols) => {
        const activeIndex = activeColumn.tasks.findIndex((t) => t.id === activeId);
        const overIndex =
          overColumn.id === overId
            ? overColumn.tasks.length
            : overColumn.tasks.findIndex((t) => t.id === overId);

        const activeTask = activeColumn.tasks[activeIndex];
        if (!activeTask) return cols;

        const newColumns = cols.map((col) => {
          if (col.id === activeColumn.id) {
            return {
              ...col,
              tasks: col.tasks.filter((t) => t.id !== activeId),
            };
          }
          if (col.id === overColumn.id) {
            const newTasks = [...col.tasks];
            newTasks.splice(overIndex, 0, { ...activeTask, columnId: col.id });
            return {
              ...col,
              tasks: newTasks,
            };
          }
          return col;
        });

        return newColumns;
      });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find the columns
    const activeColumn = columns.find((col) => col.tasks.some((task) => task.id === activeId));
    const overColumn = columns.find(
      (col) => col.id === overId || col.tasks.some((task) => task.id === overId),
    );

    if (!activeColumn || !overColumn) return;

    const activeTask = activeColumn.tasks.find((t) => t.id === activeId);
    if (!activeTask) return;

    const activeIndex = activeColumn.tasks.findIndex((t) => t.id === activeId);
    const overIndex =
      overColumn.id === overId
        ? overColumn.tasks.length
        : overColumn.tasks.findIndex((t) => t.id === overId);

    // Update task in database
    if (activeColumn.id !== overColumn.id || activeIndex !== overIndex) {
      updateTask({
        id: activeTask.id,
        columnId: overColumn.id,
        status: overColumn.status,
        position: overIndex,
      });
    }
  };

  const handleAddTask = (columnId: string) => {
    const column = columns.find((c) => c.id === columnId);
    if (!column) return;

    createTask({
      title: "New Task",
      description: "",
      projectId,
      columnId,
      status: column.status,
      priority: TaskPriority.MEDIUM,
      type: TaskType.TASK,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Loading kanban board...</p>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">No kanban board found</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <Column
            key={column.id}
            column={column}
            tasks={column.tasks}
            onAddTask={handleAddTask}
            teamNameById={teamNameById}
          />
        ))}
      </div>

      <DragOverlay>
        {activeTask
          ? (() => {
              const teamName = teamNameById.get(activeTask.reporterId ?? "");
              return teamName ? (
                <TaskCard task={activeTask} isDragging teamName={teamName} />
              ) : (
                <TaskCard task={activeTask} isDragging />
              );
            })()
          : null}
      </DragOverlay>
    </DndContext>
  );
}
