"use client";

/**
 * Team Calendar Component
 * Calendar view for team activities, deadlines, and events with strict TypeScript
 * Note: This is a basic implementation. For production, consider using @fullcalendar/react
 */

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@dotmac/ui";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Users,
  Plus,
} from "lucide-react";
import type { Task, TaskStatus, TaskPriority } from "@/types/project-management";
import { useTasks, useTeams } from "@/hooks/useProjects";

// ============================================================================
// Types
// ============================================================================

interface TeamCalendarProps {
  projectId?: string;
}

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  tasks: Task[];
  events: CalendarEvent[];
}

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: "task" | "deadline" | "meeting" | "milestone";
  priority?: TaskPriority;
  attendees?: string[];
}

type ViewMode = "month" | "week" | "day";

// ============================================================================
// Helper Functions
// ============================================================================

const DAYS_OF_WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const getMonthDays = (year: number, month: number): CalendarDay[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevMonthLastDay = new Date(year, month, 0);

  const days: CalendarDay[] = [];
  const today = new Date();

  // Previous month days
  const firstDayOfWeek = firstDay.getDay();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthLastDay.getDate() - i);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      tasks: [],
      events: [],
    });
  }

  // Current month days
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
      tasks: [],
      events: [],
    });
  }

  // Next month days
  const remainingDays = 42 - days.length; // 6 rows * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const date = new Date(year, month + 1, day);
    days.push({
      date,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
      tasks: [],
      events: [],
    });
  }

  return days;
};

// ============================================================================
// Calendar Day Cell Component
// ============================================================================

interface DayCellProps {
  day: CalendarDay;
  onDayClick: (date: Date) => void;
}

function DayCell({ day, onDayClick }: DayCellProps) {
  const hasEvents = day.tasks.length > 0 || day.events.length > 0;

  return (
    <div
      className={`
        min-h-[100px] border p-2 cursor-pointer hover:bg-gray-50 transition-colors
        ${!day.isCurrentMonth ? "bg-gray-50/50 text-gray-400" : ""}
        ${day.isToday ? "bg-blue-50 border-blue-300" : ""}
      `}
      onClick={() => onDayClick(day.date)}
    >
      <div className="flex items-center justify-between mb-1">
        <span
          className={`
            text-sm font-medium
            ${day.isToday ? "bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center" : ""}
          `}
        >
          {day.date.getDate()}
        </span>
        {hasEvents && <div className="h-2 w-2 rounded-full bg-blue-600" />}
      </div>

      <div className="space-y-1">
        {day.tasks.slice(0, 2).map((task) => {
          const priorityColors: Record<TaskPriority, string> = {
            LOW: "bg-gray-200 text-gray-800",
            MEDIUM: "bg-blue-200 text-blue-800",
            HIGH: "bg-orange-200 text-orange-800",
            CRITICAL: "bg-red-200 text-red-800",
          };

          return (
            <div
              key={task.id}
              className={`text-xs px-2 py-1 rounded truncate ${priorityColors[task.priority]}`}
            >
              {task.title}
            </div>
          );
        })}

        {day.tasks.length > 2 && (
          <p className="text-xs text-muted-foreground">+{day.tasks.length - 2} more</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Day Detail Sidebar Component
// ============================================================================

interface DayDetailProps {
  selectedDate: Date;
  tasks: Task[];
  onClose: () => void;
  teamNameById: Map<string, string>;
}

function DayDetail({ selectedDate, tasks, onClose, teamNameById }: DayDetailProps) {
  return (
    <Card className="w-80">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {selectedDate.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ✕
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Event
        </Button>

        {tasks.length > 0 ? (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Tasks & Deadlines</h4>
            {tasks.map((task) => (
              <div key={task.id} className="p-3 border rounded-lg hover:bg-gray-50">
                <div className="flex items-start justify-between mb-1">
                  <p className="font-medium text-sm">{task.title}</p>
                  <Badge variant="outline" className="text-xs">
                    {task.status.replace("_", " ")}
                  </Badge>
                </div>
                {task.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                )}
                {task.assignee && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {task.assignee.name}
                  </div>
                )}
                {!task.assignee && task.reporterId && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {teamNameById.get(task.reporterId) ?? "Unassigned"}
                  </div>
                )}
                {task.dueDate && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Due:{" "}
                    {new Date(task.dueDate).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <CalendarIcon className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No events scheduled</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Team Calendar Component
// ============================================================================

export function TeamCalendar({ projectId }: TeamCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: tasksData, isLoading } = useTasks(
    projectId ? { projectId: [projectId] } : undefined,
  );
  const { data: teams } = useTeams();
  const [selectedTeam, setSelectedTeam] = useState<string>("");

  const teamNameById = useMemo(() => {
    const map = new Map<string, string>();
    (teams ?? []).forEach((team) => map.set(team.id, team.name));
    return map;
  }, [teams]);

  const calendarDays = useMemo(() => {
    const days = getMonthDays(currentDate.getFullYear(), currentDate.getMonth());

    if (tasksData?.tasks) {
      // Assign tasks to calendar days
      tasksData.tasks.forEach((task) => {
        if (task.dueDate) {
          const dueDate = new Date(task.dueDate);
          const day = days.find((d) => isSameDay(d.date, dueDate));
          if (day) {
            day.tasks.push(task);
          }
        }
        if (task.startDate) {
          const startDate = new Date(task.startDate);
          const day = days.find((d) => isSameDay(d.date, startDate));
          if (day && !day.tasks.some((t) => t.id === task.id)) {
            day.tasks.push(task);
          }
        }
      });
    }

    return days;
  }, [currentDate, tasksData]);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
  };

  const selectedDayTasks = useMemo(() => {
    if (!selectedDate || !tasksData?.tasks) return [];
    return tasksData.tasks
      .filter(
        (task) =>
          (task.dueDate && isSameDay(new Date(task.dueDate), selectedDate)) ||
          (task.startDate && isSameDay(new Date(task.startDate), selectedDate)),
      )
      .filter((task) => (selectedTeam ? task.reporterId === selectedTeam : true));
  }, [selectedDate, tasksData, selectedTeam]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-muted-foreground">Loading calendar...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Team Calendar</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
              </p>
            </div>
            <div className="flex gap-3 items-center">
              <Select onValueChange={(val) => setSelectedTeam(val)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All teams</SelectItem>
                  {(teams ?? []).map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleToday}>
                  Today
                </Button>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={handlePrevMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Calendar Grid */}
      <div className="flex gap-4">
        <Card className="flex-1">
          <div className="border-b">
            {/* Days of week header */}
            <div className="grid grid-cols-7">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="p-3 text-center text-sm font-semibold border-r last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, idx) => (
              <DayCell key={idx} day={day} onDayClick={handleDayClick} />
            ))}
          </div>
        </Card>

        {/* Day detail sidebar */}
        {selectedDate && (
          <DayDetail
            selectedDate={selectedDate}
            tasks={selectedDayTasks}
            onClose={() => setSelectedDate(null)}
            teamNameById={teamNameById}
          />
        )}
      </div>

      {/* Summary Stats */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-8">
            <div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <p className="text-2xl font-bold">
                {calendarDays.reduce((sum, day) => sum + day.tasks.length, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">
                {calendarDays
                  .filter((d) => d.isCurrentMonth)
                  .reduce((sum, day) => sum + day.tasks.length, 0)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Upcoming Deadlines</p>
              <p className="text-2xl font-bold">
                {tasksData?.tasks.filter((t) => t.dueDate && new Date(t.dueDate) > new Date())
                  .length || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
