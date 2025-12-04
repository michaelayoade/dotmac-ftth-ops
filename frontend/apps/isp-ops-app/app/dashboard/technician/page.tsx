"use client";

/**
 * Technician Dashboard
 * Personal dashboard for field technicians - daily schedule, tasks, and quick actions
 */

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import {
  Clock,
  MapPin,
  CheckCircle2,
  Play,
  Square,
  Package,
  Car,
  AlertCircle,
  Navigation,
  Phone,
} from "lucide-react";
import {
  useAssignments,
  useResourceAssignments,
  useTimeEntries,
  useClockIn,
  useClockOut,
  useStartAssignment,
  useCompleteAssignment,
} from "@/hooks/useFieldService";
import type { TaskAssignment, TimeEntry } from "@/types/field-service";
import { TimeEntryType } from "@/types/field-service";
import { format, isToday, isTomorrow, parseISO } from "date-fns";
import { useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";
import { useToast } from "@dotmac/ui";

// ============================================================================
// Active Time Entry Component
// ============================================================================

interface ActiveTimeEntryProps {
  entry?: TimeEntry | undefined;
  onClockIn: (() => void) | undefined;
  onClockOut: (() => void) | undefined;
}

function ActiveTimeEntry({ entry, onClockIn, onClockOut }: ActiveTimeEntryProps) {
  const [elapsedTime, setElapsedTime] = useState("00:00:00");

  useEffect(() => {
    if (!entry?.clockIn) return;

    const interval = setInterval(() => {
      const start = new Date(entry.clockIn);
      const now = new Date();
      const diff = now.getTime() - start.getTime();

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setElapsedTime(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [entry]);

  return (
    <Card className="border-2 border-blue-500">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </div>
          {entry && (
            <Badge variant="default" className="text-lg font-mono bg-blue-600">
              {elapsedTime}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!entry ? (
          <div className="space-y-4">
            <p className="text-gray-600">Ready to start your shift?</p>
            <Button className="w-full" size="lg" onClick={onClockIn}>
              <Play className="mr-2 h-5 w-5" />
              Clock In
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-sm font-medium text-green-900">
                Clocked in at {format(parseISO(entry.clockIn), "h:mm a")}
              </div>
              {entry.description && (
                <div className="text-sm text-green-700 mt-1">{entry.description}</div>
              )}
            </div>
            <Button className="w-full" size="lg" variant="destructive" onClick={onClockOut}>
              <Square className="mr-2 h-5 w-5" />
              Clock Out
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Today's Schedule Component
// ============================================================================

interface TodaysScheduleProps {
  assignments: TaskAssignment[];
  onStartTask: (id: string) => void;
  onCompleteTask: (id: string) => void;
}

function TodaysSchedule({ assignments, onStartTask, onCompleteTask }: TodaysScheduleProps) {
  const now = new Date();

  const getTaskStatus = (assignment: TaskAssignment) => {
    const start = parseISO(assignment.scheduledStart);
    const end = parseISO(assignment.scheduledEnd);

    if (assignment.status === "completed") return "completed";
    if (assignment.status === "in_progress") return "in_progress";
    if (assignment.status === "cancelled") return "cancelled";
    if (now > end) return "overdue";
    if (now >= start && now <= end) return "current";
    return "upcoming";
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      completed: { className: "bg-green-100 text-green-800", label: "Completed" },
      in_progress: { className: "bg-blue-100 text-blue-800", label: "In Progress" },
      cancelled: { className: "bg-gray-100 text-gray-800", label: "Cancelled" },
      overdue: { className: "bg-red-100 text-red-800", label: "Overdue" },
      current: { className: "bg-yellow-100 text-yellow-800", label: "Current" },
      upcoming: { className: "bg-gray-100 text-gray-600", label: "Upcoming" },
    };

    const statusConfig = config[status];
    if (!statusConfig) return null;
    const { className, label } = statusConfig;
    return <Badge className={className}>{label}</Badge>;
  };

  const openInMaps = (lat?: number, lng?: number, address?: string) => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
    } else if (address) {
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
        "_blank",
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        {assignments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No tasks scheduled for today</div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => {
              const status = getTaskStatus(assignment);
              return (
                <Card
                  key={assignment.id}
                  className={status === "current" ? "border-2 border-blue-500" : ""}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {assignment.task?.name || `Task ${assignment.taskId.slice(0, 8)}`}
                          </span>
                          {getStatusBadge(status)}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {format(parseISO(assignment.scheduledStart), "h:mm a")} -{" "}
                            {format(parseISO(assignment.scheduledEnd), "h:mm a")}
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

                        {assignment.task?.description && (
                          <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            {assignment.task.description}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-2">
                        {(assignment.taskLocationLat || assignment.taskLocationAddress) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              openInMaps(
                                assignment.taskLocationLat,
                                assignment.taskLocationLng,
                                assignment.taskLocationAddress,
                              )
                            }
                          >
                            <Navigation className="h-4 w-4" />
                          </Button>
                        )}

                        {status === "current" && assignment.status !== "in_progress" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onStartTask(assignment.id)}
                          >
                            <Play className="mr-1 h-4 w-4" />
                            Start
                          </Button>
                        )}

                        {assignment.status === "in_progress" && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => onCompleteTask(assignment.id)}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" />
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Assigned Resources Component
// ============================================================================

interface AssignedResourcesProps {
  technicianId: string | null;
}

function AssignedResources({ technicianId }: AssignedResourcesProps) {
  const { data: assignments, isLoading } = useResourceAssignments(technicianId ?? undefined, {
    enabled: Boolean(technicianId),
  });

  if (!technicianId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Assigned Resources
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">
            Sign in with a technician account to view assigned equipment.
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeAssignments = assignments?.filter((a) => !a.returnedAt) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Assigned Resources
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-4 text-gray-500 text-sm">Loading assignments…</div>
        ) : activeAssignments.length === 0 ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            No resources currently assigned
          </div>
        ) : (
          <div className="space-y-2">
            {activeAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {assignment.equipment ? (
                    <>
                      <Package className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-sm">{assignment.equipment.name}</div>
                        <div className="text-xs text-gray-600">
                          {assignment.equipment.assetTag || assignment.equipment.category}
                        </div>
                      </div>
                    </>
                  ) : assignment.vehicle ? (
                    <>
                      <Car className="h-5 w-5 text-blue-600" />
                      <div>
                        <div className="font-medium text-sm">{assignment.vehicle.name}</div>
                        <div className="text-xs text-gray-600">
                          {assignment.vehicle.licensePlate}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>

                {assignment.expectedReturnAt && (
                  <div className="text-xs text-gray-500">
                    Due: {format(parseISO(assignment.expectedReturnAt), "MMM d")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function TechnicianDashboard() {
  const { user: sessionUser, isLoading: authLoading } = useSession();
  const user = sessionUser as UserInfo | undefined;
  const technicianId = user?.technician_id ?? null;
  const todayString = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const { toast } = useToast();

  const assignmentsFilter = useMemo(() => {
    if (!technicianId) {
      return undefined;
    }
    return {
      technicianId,
      dateFrom: todayString,
      dateTo: todayString,
    };
  }, [technicianId, todayString]);

  const timeEntriesFilter = useMemo(() => {
    if (!technicianId) {
      return undefined;
    }
    return {
      technicianId,
      dateFrom: todayString,
      dateTo: todayString,
    };
  }, [technicianId, todayString]);

  const { data: assignmentsData, isLoading: assignmentsLoading } = useAssignments(
    assignmentsFilter,
    { enabled: Boolean(assignmentsFilter) },
  );

  const { data: timeEntriesData, isLoading: timeEntriesLoading } = useTimeEntries(
    timeEntriesFilter,
    { enabled: Boolean(timeEntriesFilter) },
  );

  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();
  const startAssignmentMutation = useStartAssignment();
  const completeAssignmentMutation = useCompleteAssignment();

  const todaysAssignments = assignmentsData?.assignments || [];
  const activeTimeEntry = timeEntriesData?.entries.find((e) => e.isActive);

  const stats = {
    totalTasks: todaysAssignments.length,
    completed: todaysAssignments.filter((a) => a.status === "completed").length,
    inProgress: todaysAssignments.filter((a) => a.status === "in_progress").length,
    upcoming: todaysAssignments.filter((a) => a.status === "scheduled" || a.status === "confirmed")
      .length,
  };

  const handleClockIn = async () => {
    if (!technicianId) {
      console.warn("Cannot clock in without an associated technician ID");
      return;
    }

    try {
      await clockInMutation.mutateAsync({
        technicianId,
        entryType: TimeEntryType.REGULAR,
      });
    } catch (error) {
      console.error("Clock in failed:", error);
    }
  };

  const handleClockOut = async () => {
    if (!activeTimeEntry) return;

    try {
      await clockOutMutation.mutateAsync({
        id: activeTimeEntry.id,
        data: {},
      });
    } catch (error) {
      console.error("Clock out failed:", error);
    }
  };

  const handleStartTask = async (assignmentId: string) => {
    try {
      await startAssignmentMutation.mutateAsync({ id: assignmentId });
      toast({
        title: "Task started",
        description: "Assignment is now in progress.",
      });
    } catch (error) {
      console.error("Failed to start task:", error);
      toast({
        title: "Start failed",
        description: error instanceof Error ? error.message : "Unable to start assignment",
        variant: "destructive",
      });
    }
  };

  const handleCompleteTask = async (assignmentId: string) => {
    try {
      await completeAssignmentMutation.mutateAsync({ id: assignmentId });
      toast({
        title: "Task completed",
        description: "Assignment marked as complete.",
      });
    } catch (error) {
      console.error("Failed to complete task:", error);
      toast({
        title: "Completion failed",
        description: error instanceof Error ? error.message : "Unable to complete assignment",
        variant: "destructive",
      });
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center text-gray-500">Loading dashboard…</CardContent>
        </Card>
      </div>
    );
  }

  if (!technicianId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Technician Profile Required</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-600 space-y-2">
            <p>
              This dashboard is available only to technician accounts. Contact your administrator to
              link your user profile to a technician record.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here&apos;s your schedule for today.</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                <p className="text-2xl font-bold">{stats.totalTasks}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
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
              <Play className="h-8 w-8 text-yellow-500" />
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
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold">{stats.upcoming}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-gray-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Time Clock and Resources */}
        <div className="space-y-6">
          <ActiveTimeEntry
            entry={activeTimeEntry}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
          />
          <AssignedResources technicianId={technicianId} />
        </div>

        {/* Right Column - Today's Schedule */}
        <div className="lg:col-span-2">
          <TodaysSchedule
            assignments={todaysAssignments}
            onStartTask={handleStartTask}
            onCompleteTask={handleCompleteTask}
          />
        </div>
      </div>
    </div>
  );
}
