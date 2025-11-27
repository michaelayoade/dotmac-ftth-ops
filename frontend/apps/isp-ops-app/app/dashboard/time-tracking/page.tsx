"use client";

/**
 * Time Tracking Dashboard
 * Clock in/out and timesheet management for technicians
 */

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Button } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Input } from "@dotmac/ui";
import {
  Clock,
  Play,
  Square,
  Filter,
  Calendar,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Clock3,
} from "lucide-react";
import {
  useTimeEntries,
  useClockIn,
  useClockOut,
  useSubmitTimeEntry,
  useApproveTimeEntry,
  useRejectTimeEntry,
} from "@/hooks/useFieldService";
import type { TimeEntry, TimeEntryStatus, TimeEntryFilter } from "@/types/field-service";
import { TimeEntryType } from "@/types/field-service";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { useSession } from "@shared/lib/auth";
import type { UserInfo } from "@shared/lib/auth";

// ============================================================================
// Clock In/Out Component
// ============================================================================

interface ClockInOutProps {
  technicianId: string;
  activeEntry?: TimeEntry;
}

function ClockInOut({ technicianId, activeEntry }: ClockInOutProps) {
  const [entryType, setEntryType] = useState<TimeEntryType>(TimeEntryType.REGULAR);
  const [description, setDescription] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");

  const clockInMutation = useClockIn();
  const clockOutMutation = useClockOut();

  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Get current location
  const getCurrentLocation = () => {
    return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(coords);
          resolve(coords);
        },
        (error) => {
          console.error("Error getting location:", error);
          reject(error);
        },
      );
    });
  };

  const handleClockIn = async () => {
    try {
      const loc = await getCurrentLocation();

      await clockInMutation.mutateAsync({
        technicianId,
        entryType,
        ...(description ? { description } : {}),
        latitude: loc.latitude,
        longitude: loc.longitude,
      });

      setDescription("");
    } catch (error) {
      console.error("Clock in failed:", error);
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;

    try {
      const loc = await getCurrentLocation();

      await clockOutMutation.mutateAsync({
        id: activeEntry.id,
        data: {
          breakDurationMinutes: parseFloat(breakMinutes) || 0,
          latitude: loc.latitude,
          longitude: loc.longitude,
        },
      });

      setBreakMinutes("0");
    } catch (error) {
      console.error("Clock out failed:", error);
    }
  };

  const getElapsedTime = () => {
    if (!activeEntry?.clockIn) return "00:00:00";

    const start = new Date(activeEntry.clockIn);
    const now = new Date();
    const duration = intervalToDuration({ start, end: now });

    const hours = String(duration.hours || 0).padStart(2, "0");
    const minutes = String(duration.minutes || 0).padStart(2, "0");
    const seconds = String(duration.seconds || 0).padStart(2, "0");

    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Time Clock
          </div>
          {activeEntry && (
            <Badge variant="default" className="text-lg font-mono">
              {getElapsedTime()}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!activeEntry ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium">Entry Type</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2"
                value={entryType}
                onChange={(e) => setEntryType(e.target.value as TimeEntryType)}
              >
                <option value={TimeEntryType.REGULAR}>Regular</option>
                <option value={TimeEntryType.OVERTIME}>Overtime</option>
                <option value={TimeEntryType.TRAVEL}>Travel</option>
                <option value={TimeEntryType.TRAINING}>Training</option>
                <option value={TimeEntryType.ADMINISTRATIVE}>Administrative</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description (Optional)</label>
              <Input
                placeholder="What are you working on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleClockIn}
              disabled={clockInMutation.isPending}
            >
              <Play className="mr-2 h-5 w-5" />
              {clockInMutation.isPending ? "Clocking In..." : "Clock In"}
            </Button>

            {location && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin className="h-4 w-4" />
                Location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="rounded-lg bg-green-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-900">Clocked In</span>
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                  {activeEntry.entryType}
                </Badge>
              </div>
              <div className="text-sm text-green-700">
                Started: {format(new Date(activeEntry.clockIn), "h:mm a")}
              </div>
              {activeEntry.description && (
                <div className="text-sm text-green-700">{activeEntry.description}</div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Break Duration (minutes)</label>
              <Input
                type="number"
                min="0"
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                placeholder="0"
              />
            </div>

            <Button
              className="w-full"
              size="lg"
              variant="destructive"
              onClick={handleClockOut}
              disabled={clockOutMutation.isPending}
            >
              <Square className="mr-2 h-5 w-5" />
              {clockOutMutation.isPending ? "Clocking Out..." : "Clock Out"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Time Entry List Component
// ============================================================================

interface TimeEntryListProps {
  entries: TimeEntry[];
  onApprove?: (id: string) => void;
  onReject?: (id: string, reason: string) => void;
  onSubmit?: (id: string) => void;
  showActions?: boolean;
}

function TimeEntryList({
  entries,
  onApprove,
  onReject,
  onSubmit,
  showActions = false,
}: TimeEntryListProps) {
  const [rejectReason, setRejectReason] = useState("");
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const getStatusBadge = (status: TimeEntryStatus) => {
    const variants: Record<
      TimeEntryStatus,
      { variant: "default" | "secondary" | "outline" | "destructive"; color: string }
    > = {
      draft: { variant: "secondary", color: "gray" },
      submitted: { variant: "outline", color: "blue" },
      approved: { variant: "default", color: "green" },
      rejected: { variant: "destructive", color: "red" },
      invoiced: { variant: "outline", color: "purple" },
    };

    const config = variants[status];
    return (
      <Badge variant={config.variant}>{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>
    );
  };

  const formatDurationString = (minutes?: number) => {
    if (!minutes) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-2">
      {entries.map((entry) => (
        <Card key={entry.id}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Clock3 className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">
                    {format(new Date(entry.clockIn), "MMM d, yyyy")}
                  </span>
                  {getStatusBadge(entry.status)}
                  <Badge variant="outline">{entry.entryType}</Badge>
                </div>

                <div className="flex items-center gap-6 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">In:</span>{" "}
                    {format(new Date(entry.clockIn), "h:mm a")}
                  </div>
                  {entry.clockOut && (
                    <div>
                      <span className="font-medium">Out:</span>{" "}
                      {format(new Date(entry.clockOut), "h:mm a")}
                    </div>
                  )}
                  {entry.durationMinutes && (
                    <div>
                      <span className="font-medium">Duration:</span>{" "}
                      {formatDurationString(entry.durationMinutes)}
                    </div>
                  )}
                  {entry.totalCost && (
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-medium">{entry.totalCost.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {entry.description && (
                  <div className="text-sm text-gray-600">{entry.description}</div>
                )}

                {(entry.clockInLat || entry.clockOutLat) && (
                  <div className="text-xs text-gray-500 flex gap-4">
                    {entry.clockInLat && entry.clockInLng && (
                      <div>
                        <MapPin className="inline h-3 w-3 mr-1" />
                        In: {entry.clockInLat.toFixed(4)}, {entry.clockInLng.toFixed(4)}
                      </div>
                    )}
                    {entry.clockOutLat && entry.clockOutLng && (
                      <div>
                        <MapPin className="inline h-3 w-3 mr-1" />
                        Out: {entry.clockOutLat.toFixed(4)}, {entry.clockOutLng.toFixed(4)}
                      </div>
                    )}
                  </div>
                )}

                {entry.status === "rejected" && entry.rejectionReason && (
                  <div className="rounded-md bg-red-50 p-2 text-sm text-red-700">
                    <strong>Rejected:</strong> {entry.rejectionReason}
                  </div>
                )}
              </div>

              {showActions && (
                <div className="flex gap-2">
                  {entry.status === "draft" && onSubmit && (
                    <Button size="sm" onClick={() => onSubmit(entry.id)}>
                      Submit
                    </Button>
                  )}

                  {entry.status === "submitted" && onApprove && (
                    <>
                      <Button size="sm" variant="default" onClick={() => onApprove(entry.id)}>
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejectingId(entry.id)}
                      >
                        <XCircle className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            {rejectingId === entry.id && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <Input
                  placeholder="Reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      if (onReject && rejectReason) {
                        onReject(entry.id, rejectReason);
                        setRejectingId(null);
                        setRejectReason("");
                      }
                    }}
                    disabled={!rejectReason}
                  >
                    Confirm Rejection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRejectingId(null);
                      setRejectReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function TimeTrackingPage() {
  const [filter, setFilter] = useState<TimeEntryFilter>({
    dateFrom: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
    dateTo: format(new Date(), "yyyy-MM-dd"),
  });

  const { user: sessionUser, isLoading: authLoading } = useSession();
  const user = sessionUser as UserInfo | undefined;
  const technicianId = user?.technician_id ?? null;
  const queryFilter = useMemo(() => {
    if (!technicianId) {
      return undefined;
    }
    return {
      ...filter,
      technicianId,
    };
  }, [filter, technicianId]);

  const {
    data: entriesData,
    isLoading,
    isError,
  } = useTimeEntries(queryFilter, { enabled: Boolean(queryFilter) });
  const submitMutation = useSubmitTimeEntry();
  const approveMutation = useApproveTimeEntry();
  const rejectMutation = useRejectTimeEntry();

  const entries = entriesData?.entries || [];
  const activeEntry = entries.find((e) => e.isActive);

  const stats = {
    totalHours: entries.reduce((sum, e) => sum + (e.totalHours || 0), 0),
    totalCost: entries.reduce((sum, e) => sum + (e.totalCost || 0), 0),
    submitted: entries.filter((e) => e.status === "submitted").length,
    approved: entries.filter((e) => e.status === "approved").length,
  };

  const handleSubmit = async (id: string) => {
    await submitMutation.mutateAsync(id);
  };

  const handleApprove = async (id: string) => {
    await approveMutation.mutateAsync(id);
  };

  const handleReject = async (id: string, reason: string) => {
    await rejectMutation.mutateAsync({ id, reason });
  };

  if (authLoading) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="py-12 text-center text-gray-500">
            Loading time tracking…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!technicianId) {
    return (
      <div className="container mx-auto py-8 space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Technician Profile Required</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-600 space-y-2">
            <p>
              We couldn&apos;t find a technician profile for your account. Contact an administrator
              to link your user before using the time tracking tools.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Tracking</h1>
          <p className="text-gray-600">Track your work hours and manage timesheets</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Hours</p>
                <p className="text-2xl font-bold">{stats.totalHours.toFixed(1)}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold">₦{stats.totalCost.toLocaleString()}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Submitted</p>
                <p className="text-2xl font-bold">{stats.submitted}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Approved</p>
                <p className="text-2xl font-bold">{stats.approved}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Clock In/Out */}
        <div className="lg:col-span-1">
          <ClockInOut technicianId={technicianId} activeEntry={activeEntry as any} />
        </div>

        {/* Time Entries List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Time Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">Loading...</div>
              ) : isError ? (
                <div className="text-center py-8 text-red-500">Error loading time entries</div>
              ) : entries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No time entries found</div>
              ) : (
                <TimeEntryList
                  entries={entries}
                  onSubmit={handleSubmit}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  showActions={true}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
