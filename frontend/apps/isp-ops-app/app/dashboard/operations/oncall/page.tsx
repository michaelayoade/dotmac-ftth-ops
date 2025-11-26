"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, RefreshCw, Users, Clock, AlertCircle } from "lucide-react";
import { Button } from "@dotmac/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@dotmac/ui";
import { Alert, AlertDescription } from "@dotmac/ui";
import { Badge } from "@dotmac/ui";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@dotmac/ui";
import { Skeleton } from "@dotmac/ui";
import { apiClient } from "@/lib/api/client";

interface OnCallSchedule {
  id: string;
  name: string;
  schedule_type: string;
  rotation_start: string;
  rotation_duration_hours: number;
  alarm_severities: string[] | null;
  team_name: string | null;
  timezone: string;
  is_active: boolean;
  created_at: string;
}

interface CurrentOnCall {
  user_id: string;
  user_email: string;
  user_name: string;
  schedule_id: string;
  schedule_name: string;
  rotation_id: string;
  start_time: string;
  end_time: string;
  is_override: boolean;
}

export default function OnCallSchedulePage() {
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch on-call schedules
  const {
    data: schedules,
    isLoading: schedulesLoading,
    refetch: refetchSchedules,
  } = useQuery({
    queryKey: ["oncall-schedules"],
    queryFn: async () => {
      const response = await apiClient.get("/oncall/schedules");
      return response.data as OnCallSchedule[];
    },
    refetchInterval: 30000,
  });

  // Fetch current on-call
  const {
    data: currentOnCall,
    isLoading: currentLoading,
    refetch: refetchCurrent,
  } = useQuery({
    queryKey: ["oncall-current"],
    queryFn: async () => {
      const response = await apiClient.get("/oncall/current");
      return response.data as CurrentOnCall[];
    },
    refetchInterval: 15000, // Refresh every 15 seconds
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">On-Call Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage on-call schedules, rotations, and escalation policies
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              refetchSchedules();
              refetchCurrent();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules?.filter((s) => s.is_active).length || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Currently On-Call
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{currentOnCall?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Schedules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overrides Active
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentOnCall?.filter((c) => c.is_override).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current On-Call */}
      <Card>
        <CardHeader>
          <CardTitle>Currently On-Call</CardTitle>
        </CardHeader>
        <CardContent>
          {currentLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : currentOnCall && currentOnCall.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>On-Call Period</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentOnCall.map((oncall) => (
                  <TableRow key={oncall.rotation_id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{oncall.user_name}</div>
                        <div className="text-sm text-muted-foreground">{oncall.user_email}</div>
                      </div>
                    </TableCell>
                    <TableCell>{oncall.schedule_name}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{formatDate(oncall.start_time)}</div>
                        <div className="text-muted-foreground">
                          to {formatDate(oncall.end_time)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {oncall.is_override ? (
                        <Badge variant="destructive">Override</Badge>
                      ) : (
                        <Badge variant="default">Regular</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">No one is currently on-call</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedules List */}
      <Card>
        <CardHeader>
          <CardTitle>On-Call Schedules</CardTitle>
        </CardHeader>
        <CardContent>
          {schedulesLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : schedules && schedules.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schedule Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Rotation Duration</TableHead>
                  <TableHead>Timezone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">{schedule.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{schedule.schedule_type}</Badge>
                    </TableCell>
                    <TableCell>{schedule.team_name || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {schedule.rotation_duration_hours}h
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{schedule.timezone}</TableCell>
                    <TableCell>
                      {schedule.is_active ? (
                        <Badge variant="default">Active</Badge>
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm">
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No on-call schedules</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Create your first on-call schedule to manage rotations
              </p>
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
