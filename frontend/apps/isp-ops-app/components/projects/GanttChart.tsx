"use client";

/**
 * Gantt Chart Component
 * Timeline visualization for project tasks with strict TypeScript
 * Note: This is a basic implementation. For production, consider using gantt-task-react library
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { ZoomIn, ZoomOut, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import type { Task, Project, TaskPriority } from "@/types/project-management";
import { useTasks } from "@/hooks/useProjects";

// ============================================================================
// Types
// ============================================================================

interface GanttChartProps {
  projectId: string;
  project: Project;
}

interface GanttTask {
  id: string;
  name: string;
  start: Date;
  end: Date;
  progress: number;
  priority: TaskPriority;
  assignee?: string;
  dependencies: string[];
}

interface TimelineConfig {
  startDate: Date;
  endDate: Date;
  dayWidth: number;
  viewMode: "day" | "week" | "month";
}

// ============================================================================
// Helper Functions
// ============================================================================

const calculateDaysBetween = (start: Date, end: Date): number => {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

const formatDate = (date: Date, format: "short" | "long" = "short"): string => {
  if (format === "long") {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const getWeekNumber = (date: Date): number => {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
};

// ============================================================================
// Gantt Row Component
// ============================================================================

interface GanttRowProps {
  task: GanttTask;
  timeline: TimelineConfig;
  rowHeight: number;
}

function GanttRow({ task, timeline, rowHeight }: GanttRowProps) {
  const totalDays = calculateDaysBetween(timeline.startDate, timeline.endDate);
  const taskStartDay = calculateDaysBetween(timeline.startDate, task.start);
  const taskDuration = calculateDaysBetween(task.start, task.end);

  const leftPercent = (taskStartDay / totalDays) * 100;
  const widthPercent = (taskDuration / totalDays) * 100;

  const priorityColors: Record<TaskPriority, string> = {
    LOW: "bg-gray-500",
    MEDIUM: "bg-blue-500",
    HIGH: "bg-orange-500",
    CRITICAL: "bg-red-500",
  };

  return (
    <div className="flex border-b hover:bg-gray-50">
      {/* Task Info Column */}
      <div className="w-64 border-r p-3 flex items-center">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={`h-2 w-2 rounded-full ${priorityColors[task.priority]}`} />
            <p className="font-medium text-sm truncate">{task.name}</p>
          </div>
          {task.assignee && (
            <p className="text-xs text-muted-foreground truncate">{task.assignee}</p>
          )}
        </div>
      </div>

      {/* Timeline Column */}
      <div className="flex-1 relative" style={{ height: `${rowHeight}px` }}>
        <div
          className="absolute top-1/2 -translate-y-1/2 h-8 rounded flex items-center px-2 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
          style={{
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            backgroundColor:
              task.priority === "CRITICAL"
                ? "#ef4444"
                : task.priority === "HIGH"
                  ? "#f97316"
                  : task.priority === "MEDIUM"
                    ? "#3b82f6"
                    : "#6b7280",
            minWidth: "30px",
          }}
        >
          <div className="h-full bg-white/30 rounded" style={{ width: `${task.progress}%` }} />
          <span className="text-xs text-white font-medium ml-2 truncate">{task.progress}%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Timeline Header Component
// ============================================================================

interface TimelineHeaderProps {
  timeline: TimelineConfig;
}

function TimelineHeader({ timeline }: TimelineHeaderProps) {
  const days = calculateDaysBetween(timeline.startDate, timeline.endDate);
  const dateHeaders: Date[] = [];

  for (let i = 0; i <= days; i++) {
    const date = new Date(timeline.startDate);
    date.setDate(date.getDate() + i);

    if (timeline.viewMode === "day" || i % 7 === 0) {
      dateHeaders.push(date);
    }
  }

  return (
    <div className="flex border-b bg-gray-50">
      <div className="w-64 border-r p-3 font-semibold text-sm">Tasks</div>
      <div className="flex-1 flex">
        {dateHeaders.map((date, idx) => {
          const width = timeline.viewMode === "week" ? "14.28%" : `${100 / dateHeaders.length}%`;

          return (
            <div
              key={idx}
              className="border-r p-2 text-center"
              style={{
                minWidth: "60px",
                flex: timeline.viewMode === "day" ? 1 : undefined,
                width: timeline.viewMode === "week" ? width : undefined,
              }}
            >
              <div className="text-xs font-medium">
                {timeline.viewMode === "day"
                  ? formatDate(date, "short")
                  : `W${getWeekNumber(date)}`}
              </div>
              {timeline.viewMode === "week" && (
                <div className="text-xs text-muted-foreground">{formatDate(date, "short")}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Gantt Chart Component
// ============================================================================

export function GanttChart({ projectId, project }: GanttChartProps) {
  const { data: tasksData, isLoading } = useTasks({ projectId: [projectId] });

  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [zoom, setZoom] = useState(1);

  const tasks: GanttTask[] = useMemo(() => {
    if (!tasksData?.tasks) return [];

    return tasksData.tasks
      .filter((task) => task.startDate && task.dueDate)
      .map((task) => {
        const assigneeName = task.assignee?.name;
        return {
          id: task.id,
          name: task.title,
          start: new Date(task.startDate!),
          end: new Date(task.dueDate!),
          progress: task.progress,
          priority: task.priority,
          ...(assigneeName ? { assignee: assigneeName } : {}),
          dependencies: task.dependencies.map((d) => d.dependsOnTaskId),
        };
      });
  }, [tasksData]);

  const timeline: TimelineConfig = useMemo(() => {
    if (tasks.length === 0) {
      const now = new Date();
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + 30);

      return {
        startDate: now,
        endDate,
        dayWidth: 40 * zoom,
        viewMode,
      };
    }

    const allDates = tasks.flatMap((task) => [task.start, task.end]);
    const minDate = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // Add buffer
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    return {
      startDate: minDate,
      endDate: maxDate,
      dayWidth: 40 * zoom,
      viewMode,
    };
  }, [tasks, zoom, viewMode]);

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.2, 2));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.2, 0.5));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Loading Gantt chart...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gantt Chart</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {project.name} · {tasks.length} tasks
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex border rounded-md">
                <Button
                  variant={viewMode === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("day")}
                  className="rounded-r-none"
                >
                  Day
                </Button>
                <Button
                  variant={viewMode === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("week")}
                  className="rounded-none border-x"
                >
                  Week
                </Button>
                <Button
                  variant={viewMode === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("month")}
                  className="rounded-l-none"
                >
                  Month
                </Button>
              </div>

              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={handleZoomOut}>
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleZoomIn}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Gantt Chart */}
      <Card>
        <div className="overflow-auto">
          <div className="min-w-[800px]">
            <TimelineHeader timeline={timeline} />

            {tasks.length > 0 ? (
              tasks.map((task) => (
                <GanttRow key={task.id} task={task} timeline={timeline} rowHeight={60} />
              ))
            ) : (
              <div className="p-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No tasks with dates</h3>
                <p className="text-muted-foreground mb-4">
                  Add start and due dates to your tasks to see them in the Gantt chart
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-6">
            <p className="text-sm font-medium">Priority:</p>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-gray-500" />
                <span className="text-sm">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-blue-500" />
                <span className="text-sm">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-orange-500" />
                <span className="text-sm">High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded bg-red-500" />
                <span className="text-sm">Critical</span>
              </div>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              {formatDate(timeline.startDate, "long")} - {formatDate(timeline.endDate, "long")}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
