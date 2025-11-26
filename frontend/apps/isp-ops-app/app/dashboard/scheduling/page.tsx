"use client";

/**
 * Scheduling Dashboard
 * Technician scheduling and task assignment interface
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Calendar,
  Users,
  Zap,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  MoreVertical,
} from "lucide-react";
import {
  useSchedules,
  useAssignments,
  useCreateAssignment,
  useAutoAssignTask,
  useCancelAssignment,
  useTechnicians,
} from "@/hooks/useFieldService";
import type { TaskAssignment, AssignmentStatus } from "@/types/field-service";
import { format, addDays, startOfWeek } from "date-fns";

// ============================================================================
// Quick Assign Component
// ============================================================================

function QuickAssign() {
  const [taskId, setTaskId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [scheduledStart, setScheduledStart] = useState("");
  const [scheduledEnd, setScheduledEnd] = useState("");
  const [useAuto, setUseAuto] = useState(false);

  const { data: techniciansData } = useTechnicians({ isAvailable: true });
  const createMutation = useCreateAssignment();
  const autoAssignMutation = useAutoAssignTask();

  const handleAssign = async () => {
    if (useAuto) {
      await autoAssignMutation.mutateAsync({
        taskId,
        scheduledStart,
        scheduledEnd,
      });
    } else {
      await createMutation.mutateAsync({
        taskId,
        technicianId,
        scheduledStart,
        scheduledEnd,
      });
    }

    // Reset form
    setTaskId("");
    setTechnicianId("");
    setScheduledStart("");
    setScheduledEnd("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Assign Task
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Task ID</label>
          <input
            type="text"
            className="w-full rounded-md border border-gray-300 px-3 py-2"
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
            placeholder="Enter task ID"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="useAuto"
            checked={useAuto}
            onChange={(e) => setUseAuto(e.target.checked)}
          />
          <label htmlFor="useAuto" className="text-sm font-medium cursor-pointer">
            Auto-assign to best technician
          </label>
        </div>

        {!useAuto && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Technician</label>
            <select
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={technicianId}
              onChange={(e) => setTechnicianId(e.target.value)}
            >
              <option value="">Select technician...</option>
              {techniciansData?.technicians.map((tech) => (
                <option key={tech.id} value={tech.id}>
                  {tech.fullName} ({tech.skillLevel})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">End</label>
            <input
              type="datetime-local"
              className="w-full rounded-md border border-gray-300 px-3 py-2"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
            />
          </div>
        </div>

        <Button
          className="w-full"
          onClick={handleAssign}
          disabled={!taskId || !scheduledStart || !scheduledEnd || (!useAuto && !technicianId)}
        >
          {useAuto ? <Zap className="mr-2 h-4 w-4" /> : <Users className="mr-2 h-4 w-4" />}
          {useAuto ? "Auto Assign" : "Assign Task"}
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Assignment List Component
// ============================================================================

interface AssignmentListProps {
  assignments: TaskAssignment[];
  onCancel?: (id: string) => void;
}

function AssignmentList({ assignments, onCancel }: AssignmentListProps) {
  const getStatusBadge = (status: AssignmentStatus) => {
    const config: Record<
      AssignmentStatus,
      { variant: "default" | "secondary" | "outline" | "destructive"; className: string }
    > = {
      scheduled: { variant: "secondary", className: "bg-blue-100 text-blue-800" },
      confirmed: { variant: "default", className: "bg-green-100 text-green-800" },
      in_progress: { variant: "default", className: "bg-yellow-100 text-yellow-800" },
      completed: { variant: "outline", className: "bg-gray-100 text-gray-800" },
      cancelled: { variant: "destructive", className: "" },
      rescheduled: { variant: "outline", className: "bg-orange-100 text-orange-800" },
    };

    const { variant, className } = config[status];
    return (
      <Badge variant={variant} className={className}>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  return (
    <div className="space-y-2">
      {assignments.map((assignment) => (
        <Card key={assignment.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-medium">
                    {assignment.task?.name || `Task ${assignment.taskId.slice(0, 8)}`}
                  </span>
                  {getStatusBadge(assignment.status)}
                  {assignment.assignmentMethod && (
                    <Badge variant="outline" className="text-xs">
                      {assignment.assignmentMethod}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{assignment.technician?.fullName || "Unassigned"}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>
                      {format(new Date(assignment.scheduledStart), "MMM d, h:mm a")} -{" "}
                      {format(new Date(assignment.scheduledEnd), "h:mm a")}
                    </span>
                  </div>

                  {assignment.taskLocationAddress && (
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate max-w-[200px]">
                        {assignment.taskLocationAddress}
                      </span>
                    </div>
                  )}
                </div>

                {assignment.assignmentScore !== undefined && (
                  <div className="text-sm text-gray-500">
                    Match Score: {(assignment.assignmentScore * 100).toFixed(0)}%
                  </div>
                )}

                {assignment.notes && (
                  <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                    {assignment.notes}
                  </div>
                )}
              </div>

              {onCancel && assignment.status === "scheduled" && (
                <Button size="sm" variant="ghost" onClick={() => onCancel(assignment.id)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Week Calendar Component
// ============================================================================

function WeekCalendar() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const { data: assignmentsData } = useAssignments({
    dateFrom: format(weekStart, "yyyy-MM-dd"),
    dateTo: format(addDays(weekStart, 6), "yyyy-MM-dd"),
  });

  const assignments = assignmentsData?.assignments || [];

  const getAssignmentsForDay = (date: Date) => {
    const dayStr = format(date, "yyyy-MM-dd");
    return assignments.filter((a) => {
      const assignmentDay = format(new Date(a.scheduledStart), "yyyy-MM-dd");
      return assignmentDay === dayStr;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Week Schedule
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentWeek(addDays(currentWeek, -7))}
            >
              Previous
            </Button>
            <Button size="sm" variant="outline" onClick={() => setCurrentWeek(new Date())}>
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentWeek(addDays(currentWeek, 7))}
            >
              Next
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => {
            const dayAssignments = getAssignmentsForDay(day);
            const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");

            return (
              <div
                key={day.toISOString()}
                className={`border rounded-lg p-3 min-h-[150px] ${
                  isToday ? "border-blue-500 bg-blue-50" : "border-gray-200"
                }`}
              >
                <div className="font-medium text-sm mb-2">
                  <div>{format(day, "EEE")}</div>
                  <div className="text-lg">{format(day, "d")}</div>
                </div>

                <div className="space-y-1">
                  {dayAssignments.slice(0, 3).map((assignment) => (
                    <div
                      key={assignment.id}
                      className="text-xs p-1 rounded bg-blue-100 text-blue-800 truncate"
                      title={assignment.task?.name}
                    >
                      {format(new Date(assignment.scheduledStart), "h:mm a")}
                    </div>
                  ))}
                  {dayAssignments.length > 3 && (
                    <div className="text-xs text-gray-500">+{dayAssignments.length - 3} more</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function SchedulingPage() {
  const { data: assignmentsData } = useAssignments();
  const cancelMutation = useCancelAssignment();

  const assignments = assignmentsData?.assignments || [];

  const stats = {
    scheduled: assignments.filter((a) => a.status === "scheduled").length,
    inProgress: assignments.filter((a) => a.status === "in_progress").length,
    completed: assignments.filter((a) => a.status === "completed").length,
    total: assignments.length,
  };

  const handleCancel = async (id: string) => {
    if (confirm("Are you sure you want to cancel this assignment?")) {
      await cancelMutation.mutateAsync({ id });
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Scheduling</h1>
        <p className="text-gray-600">Manage technician schedules and task assignments</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold">{stats.scheduled}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Week Calendar */}
      <WeekCalendar />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Assign */}
        <div className="lg:col-span-1">
          <QuickAssign />
        </div>

        {/* Assignments List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              {assignments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No assignments found</div>
              ) : (
                <AssignmentList assignments={assignments.slice(0, 10)} onCancel={handleCancel} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
